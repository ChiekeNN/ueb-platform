import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, payments, registrations, ticketTiers } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { badRequest, issueTicket, logMessage, serverError, assignSeat } from "@/lib/server";
import { feeBreakdown, generatePaymentReference } from "@/lib/utils";

/**
 * Payment gateway bridge.
 *
 * The flow mirrors Paystack / Flutterwave:
 *   initialize → customer pays on the hosted page → verify → ticket issued.
 * Provider credentials are not configured in this environment, so `verify`
 * settles the transaction locally (a sandbox settlement). Swap `settle()`
 * for the provider's verify endpoint when keys are available.
 */

/** GET /api/payments?reference=… | ?eventId=… | ?slug=… */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get("reference");
    const eventId = url.searchParams.get("eventId");
    const slug = url.searchParams.get("slug");

    if (reference) {
      const [payment] = await db.select().from(payments).where(eq(payments.reference, reference)).limit(1);
      if (!payment) return badRequest("Payment reference not found", 404);
      const [registration] = payment.registrationId
        ? await db.select().from(registrations).where(eq(registrations.id, payment.registrationId)).limit(1)
        : [null];
      const [event] = await db.select().from(events).where(eq(events.id, payment.eventId)).limit(1);
      return NextResponse.json({ payment, registration, event });
    }

    let id = eventId;
    if (!id && slug) {
      const [ev] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
      id = ev?.id ?? null;
    }
    if (!id) return badRequest("Provide a reference, eventId or slug");

    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.eventId, id))
      .orderBy(desc(payments.createdAt));

    const settled = rows.filter((p) => p.status === "successful");
    return NextResponse.json({
      payments: rows,
      summary: {
        transactions: rows.length,
        settled: settled.length,
        gross: settled.reduce((s, p) => s + parseFloat(p.amount ?? "0"), 0),
        fees: settled.reduce((s, p) => s + parseFloat(p.feeAmount ?? "0"), 0),
        net: settled.reduce((s, p) => s + parseFloat(p.netAmount ?? "0"), 0),
        refunded: rows.filter((p) => p.status === "refunded").length,
        pending: rows.filter((p) => p.status === "initialized").length,
        failed: rows.filter((p) => p.status === "failed").length,
      },
    });
  } catch (error) {
    return serverError(error, "Failed to load payments");
  }
}

/**
 * POST /api/payments
 * body: { action: "initialize" | "verify" | "fail" | "refund", reference?, registrationId?, provider?, channel? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action ?? "initialize";

    /* Create a payment intent for an existing registration. */
    if (action === "initialize") {
      if (!body.registrationId) return badRequest("registrationId is required");
      const [reg] = await db.select().from(registrations).where(eq(registrations.id, body.registrationId)).limit(1);
      if (!reg) return badRequest("Registration not found", 404);

      const [event] = await db.select().from(events).where(eq(events.id, reg.eventId)).limit(1);
      const [tier] = reg.ticketTierId
        ? await db.select().from(ticketTiers).where(eq(ticketTiers.id, reg.ticketTierId)).limit(1)
        : [null];

      const quantity = reg.quantity ?? 1;
      const breakdown = feeBreakdown(parseFloat(tier?.price ?? "0"), quantity, !!event?.feeAbsorbedByOrganiser);
      const reference = generatePaymentReference("UEB");

      const [payment] = await db
        .insert(payments)
        .values({
          eventId: reg.eventId,
          registrationId: reg.id,
          provider: body.provider ?? "paystack",
          channel: body.channel ?? "card",
          reference,
          amount: breakdown.total.toString(),
          feeAmount: breakdown.processing.toString(),
          netAmount: breakdown.organiserNet.toString(),
          status: "initialized",
          payerEmail: reg.attendeeEmail,
          meta: { tierName: tier?.name ?? null, quantity },
        })
        .returning();

      return NextResponse.json({ payment, checkoutUrl: `/pay/${reference}`, breakdown, success: true }, { status: 201 });
    }

    /* Settle / fail / refund an existing payment. */
    const reference = body.reference;
    if (!reference) return badRequest("reference is required");
    const [payment] = await db.select().from(payments).where(eq(payments.reference, reference)).limit(1);
    if (!payment) return badRequest("Payment not found", 404);

    if (action === "fail") {
      const [updated] = await db
        .update(payments)
        .set({ status: "failed", meta: { ...(payment.meta ?? {}), failureReason: body.reason ?? "Declined in sandbox" } })
        .where(eq(payments.id, payment.id))
        .returning();
      if (payment.registrationId) {
        await db
          .update(registrations)
          .set({ paymentStatus: "failed", updatedAt: new Date() })
          .where(eq(registrations.id, payment.registrationId));
      }
      return NextResponse.json({ payment: updated, success: false });
    }

    if (action === "refund") {
      const [updated] = await db
        .update(payments)
        .set({ status: "refunded", meta: { ...(payment.meta ?? {}), refundedAt: new Date().toISOString() } })
        .where(eq(payments.id, payment.id))
        .returning();
      if (payment.registrationId) {
        const [reg] = await db.select().from(registrations).where(eq(registrations.id, payment.registrationId)).limit(1);
        await db
          .update(registrations)
          .set({ paymentStatus: "refunded", status: "cancelled", updatedAt: new Date() })
          .where(eq(registrations.id, payment.registrationId));
        if (reg) {
          const [event] = await db.select().from(events).where(eq(events.id, reg.eventId)).limit(1);
          await db
            .update(events)
            .set({ totalRevenue: sql`GREATEST(${events.totalRevenue} - ${payment.amount}::numeric, 0)` })
            .where(eq(events.id, reg.eventId));
          if (event) {
            await logMessage({
              eventId: reg.eventId,
              channel: "email",
              audience: "single:refund",
              subject: `Refund processed: ${event.title}`,
              body: `A refund of ₦${parseFloat(payment.amount).toLocaleString()} has been processed for ${reg.attendeeName}.`,
              recipients: [{ name: reg.attendeeName, email: reg.attendeeEmail, phone: reg.attendeePhone }],
              senderName: body.staffName ?? "UEB Finance",
            });
          }
        }
      }
      return NextResponse.json({ payment: updated, success: true });
    }

    /* action === "verify" — settle the transaction and release the ticket. */
    if (payment.status === "successful") {
      const [reg] = payment.registrationId
        ? await db.select().from(registrations).where(eq(registrations.id, payment.registrationId)).limit(1)
        : [null];
      return NextResponse.json({ payment, registration: reg, alreadySettled: true, success: true });
    }

    const [updated] = await db
      .update(payments)
      .set({
        status: "successful",
        paidAt: new Date(),
        channel: body.channel ?? payment.channel,
        meta: {
          ...(payment.meta ?? {}),
          verifiedAt: new Date().toISOString(),
          gateway: payment.provider,
          sandbox: true,
        },
      })
      .where(eq(payments.id, payment.id))
      .returning();

    let registration = null;
    let ticket = null;
    if (payment.registrationId) {
      const [reg] = await db.select().from(registrations).where(eq(registrations.id, payment.registrationId)).limit(1);
      if (reg) {
        const [event] = await db.select().from(events).where(eq(events.id, reg.eventId)).limit(1);
        const amountPaid = parseFloat(reg.amountPaid ?? "0") + parseFloat(payment.amount ?? "0");

        const [regUpdated] = await db
          .update(registrations)
          .set({
            paymentStatus: "paid",
            amountPaid: amountPaid.toString(),
            paymentReference: payment.reference,
            updatedAt: new Date(),
          })
          .where(eq(registrations.id, reg.id))
          .returning();
        registration = regUpdated;

        await db
          .update(events)
          .set({ totalRevenue: sql`${events.totalRevenue} + ${payment.netAmount}::numeric` })
          .where(eq(events.id, reg.eventId));

        // Ticket is released only when the attendee is (or becomes) approved.
        if (regUpdated.status === "approved") {
          const issued = await issueTicket(regUpdated);
          const [tier] = regUpdated.ticketTierId
            ? await db.select().from(ticketTiers).where(eq(ticketTiers.id, regUpdated.ticketTierId)).limit(1)
            : [null];
          if (event?.seatSelectionEnabled && !regUpdated.seatId) {
            await assignSeat(event.id, regUpdated.id, tier?.name ?? null);
          }
          const [fresh] = await db.select().from(registrations).where(eq(registrations.id, regUpdated.id)).limit(1);
          registration = fresh;
          ticket = { ticketNumber: issued.ticketNumber, qrCode: issued.qrCode };
        }

        if (event) {
          await logMessage({
            eventId: event.id,
            channel: "email",
            audience: "single:payment",
            subject: `Payment received — ${event.title}`,
            body: `We received your payment of ₦${parseFloat(payment.amount).toLocaleString()} for ${event.title}. Reference ${payment.reference}.`,
            recipients: [{ name: reg.attendeeName, email: reg.attendeeEmail, phone: reg.attendeePhone }],
            senderName: "UEB Payments",
          });
        }
      }
    }

    return NextResponse.json({ payment: updated, registration, ticket, success: true });
  } catch (error) {
    return serverError(error, "Payment action failed");
  }
}
