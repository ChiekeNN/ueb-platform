import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { registrations, events, ticketTiers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { assignSeat, badRequest, issueTicket, logMessage, releaseSeat, serverError } from "@/lib/server";

/**
 * PATCH /api/registrations/[id]
 * Approve / reject / hold / cancel, record payments, check attendees in and out.
 * Approving (or paying) a registration generates the unique digital ticket + QR code.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const [reg] = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
    if (!reg) return badRequest("Registration not found", 404);

    const [event] = await db.select().from(events).where(eq(events.id, reg.eventId)).limit(1);

    const updateData: Partial<typeof registrations.$inferInsert> = { updatedAt: new Date() };
    if (body.status) updateData.status = body.status;
    if (body.paymentStatus) updateData.paymentStatus = body.paymentStatus;
    if (body.amountPaid !== undefined) updateData.amountPaid = String(body.amountPaid);
    if (body.notes !== undefined) updateData.notes = body.notes;

    /* ── Check-in / check-out ── */
    if (body.checkedIn === true && !reg.checkedIn) {
      updateData.checkedIn = true;
      updateData.checkedInAt = new Date();
      updateData.checkedInBy = body.staffName ?? "Organiser console";
      await db
        .update(events)
        .set({ totalCheckins: sql`${events.totalCheckins} + 1` })
        .where(eq(events.id, reg.eventId));
    }
    if (body.checkedIn === false && reg.checkedIn) {
      updateData.checkedIn = false;
      updateData.checkedInAt = null;
      await db
        .update(events)
        .set({ totalCheckins: sql`GREATEST(${events.totalCheckins} - 1, 0)` })
        .where(eq(events.id, reg.eventId));
    }

    const [updated] = await db
      .update(registrations)
      .set(updateData)
      .where(eq(registrations.id, id))
      .returning();

    /* ── Approval → issue ticket + seat ── */
    let ticket: { ticketNumber: string; qrCode: string } | null = null;
    if (body.status === "approved") {
      const paymentOk = updated.paymentStatus === "paid" || parseFloat(updated.amountPaid ?? "0") === 0;
      const [tier] = updated.ticketTierId
        ? await db.select().from(ticketTiers).where(eq(ticketTiers.id, updated.ticketTierId)).limit(1)
        : [null];

      if (paymentOk) {
        const issued = await issueTicket(updated);
        ticket = { ticketNumber: issued.ticketNumber, qrCode: issued.qrCode };
        if (event?.seatSelectionEnabled && !updated.seatId) {
          await assignSeat(event.id, updated.id, tier?.name ?? null);
        }
      }
    }

    /* ── Rejection / cancellation releases the seat ── */
    if (["rejected", "cancelled"].includes(body.status ?? "") && updated.seatId) {
      await releaseSeat(updated.id);
    }

    /* ── Optional attendee notification ── */
    if (body.notify !== false && body.status && ["approved", "rejected", "on_hold", "cancelled"].includes(body.status)) {
      const copy: Record<string, string> = {
        approved: `Good news — your registration for ${event?.title ?? "the event"} has been approved. Your ticket is ready.`,
        rejected: `We're sorry — your registration for ${event?.title ?? "the event"} was not approved.`,
        on_hold: `Your registration for ${event?.title ?? "the event"} is on hold while we review it.`,
        cancelled: `Your registration for ${event?.title ?? "the event"} has been cancelled.`,
      };
      await logMessage({
        eventId: reg.eventId,
        channel: body.channel ?? "email",
        audience: `single:${body.status}`,
        subject: `Registration ${body.status}: ${event?.title ?? "UEB event"}`,
        body: body.message ?? copy[body.status],
        recipients: [{ name: reg.attendeeName, email: reg.attendeeEmail, phone: reg.attendeePhone }],
        senderName: body.staffName ?? "UEB Organiser",
      });
    }

    const [finalRow] = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
    return NextResponse.json({ registration: finalRow ?? updated, ticket, success: true });
  } catch (error) {
    return serverError(error, "Failed to update registration");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [reg] = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
    if (!reg) return badRequest("Registration not found", 404);

    if (reg.seatId) await releaseSeat(reg.id);
    await db.delete(registrations).where(eq(registrations.id, id));
    await db
      .update(events)
      .set({ totalRegistrations: sql`GREATEST(${events.totalRegistrations} - 1, 0)` })
      .where(eq(events.id, reg.eventId));
    if (reg.ticketTierId) {
      await db
        .update(ticketTiers)
        .set({ quantitySold: sql`GREATEST(${ticketTiers.quantitySold} - 1, 0)` })
        .where(eq(ticketTiers.id, reg.ticketTierId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Failed to delete registration");
  }
}
