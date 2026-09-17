import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { registrations, events, ticketTiers, checkinLogs } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { badRequest, serverError } from "@/lib/server";

/**
 * POST /api/checkin — venue verification.
 * Accepts a ticket number (typed) or a scanned QR payload (JSON or UEB-… string).
 * Every attempt is written to the check-in audit log.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const method = body.method ?? "manual";
    const staffName: string | null = body.staffName ?? null;

    let ticketNumber = (body.ticketNumber ?? body.code ?? "").toString().trim();

    // QR payloads are JSON: { ticketNumber, eventId, attendeeEmail }
    if (ticketNumber.startsWith("{")) {
      try {
        const parsed = JSON.parse(ticketNumber);
        ticketNumber = parsed.ticketNumber ?? ticketNumber;
      } catch {
        /* keep the raw value — it will just not match */
      }
    }
    ticketNumber = ticketNumber.toUpperCase();

    if (!ticketNumber) return badRequest("No ticket number provided");

    const record = async (result: string, registrationId?: string | null, eventId?: string | null) =>
      db.insert(checkinLogs).values({
        eventId: eventId ?? null,
        registrationId: registrationId ?? null,
        ticketNumber,
        result,
        method,
        staffName,
        device: body.device ?? null,
      });

    const [reg] = await db.select().from(registrations).where(eq(registrations.ticketNumber, ticketNumber)).limit(1);

    if (!reg) {
      await record("INVALID");
      return NextResponse.json({
        success: false,
        status: "INVALID",
        message: "Ticket not recognised. Please check the ticket number.",
      });
    }

    if (body.eventId && body.eventId !== reg.eventId) {
      await record("WRONG_EVENT", reg.id, reg.eventId);
      return NextResponse.json({
        success: false,
        status: "INVALID",
        message: "This ticket belongs to a different event.",
        attendeeName: reg.attendeeName,
      });
    }

    if (reg.status === "cancelled" || reg.status === "rejected") {
      await record("INVALID", reg.id, reg.eventId);
      return NextResponse.json({
        success: false,
        status: "INVALID",
        message: `This ticket has been ${reg.status}. Entry denied.`,
        attendeeName: reg.attendeeName,
      });
    }

    if (reg.status !== "approved") {
      await record("PENDING", reg.id, reg.eventId);
      return NextResponse.json({
        success: false,
        status: "PENDING",
        message: "This registration is pending approval.",
        attendeeName: reg.attendeeName,
      });
    }

    if (reg.paymentStatus !== "paid" && parseFloat(reg.amountPaid ?? "0") === 0) {
      const [tier] = reg.ticketTierId
        ? await db.select().from(ticketTiers).where(eq(ticketTiers.id, reg.ticketTierId)).limit(1)
        : [null];
      if (tier && parseFloat(tier.price ?? "0") > 0) {
        await record("UNPAID", reg.id, reg.eventId);
        return NextResponse.json({
          success: false,
          status: "UNPAID",
          message: "This ticket has not been paid for. Send the attendee to the payment desk.",
          attendeeName: reg.attendeeName,
        });
      }
    }

    if (reg.checkedIn) {
      await record("ALREADY_USED", reg.id, reg.eventId);
      return NextResponse.json({
        success: false,
        status: "ALREADY_USED",
        message: `This ticket was already scanned at ${reg.checkedInAt ? new Date(reg.checkedInAt).toLocaleTimeString() : "an earlier time"}.`,
        attendeeName: reg.attendeeName,
        checkedInAt: reg.checkedInAt,
      });
    }

    await db
      .update(registrations)
      .set({ checkedIn: true, checkedInAt: new Date(), checkedInBy: staffName ?? "Check-in desk", updatedAt: new Date() })
      .where(eq(registrations.id, reg.id));

    await db
      .update(events)
      .set({ totalCheckins: sql`${events.totalCheckins} + 1` })
      .where(eq(events.id, reg.eventId));

    await record("VALID", reg.id, reg.eventId);

    let tierName = "General Admission";
    if (reg.ticketTierId) {
      const [tier] = await db.select().from(ticketTiers).where(eq(ticketTiers.id, reg.ticketTierId)).limit(1);
      if (tier) tierName = tier.name;
    }

    const [{ count: checkedInCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(registrations)
      .where(and(eq(registrations.eventId, reg.eventId), eq(registrations.checkedIn, true)));

    return NextResponse.json({
      success: true,
      status: "VALID",
      message: `Welcome, ${reg.attendeeName}!`,
      attendeeName: reg.attendeeName,
      attendeeEmail: reg.attendeeEmail,
      ticketType: tierName,
      ticketNumber: reg.ticketNumber,
      seatLabel: reg.seatLabel,
      slotLabel: reg.slotLabel,
      checkedInCount: Number(checkedInCount),
      checkedInAt: new Date().toISOString(),
    });
  } catch (error) {
    return serverError(error, "Check-in failed");
  }
}

/** GET /api/checkin?eventId=…&slug=… — recent scan log + live attendance counters. */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let eventId = url.searchParams.get("eventId");
    const slug = url.searchParams.get("slug");

    if (!eventId && slug) {
      const [ev] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
      eventId = ev?.id ?? null;
    }
    if (!eventId) return badRequest("eventId or slug is required");

    const logs = await db
      .select()
      .from(checkinLogs)
      .where(eq(checkinLogs.eventId, eventId))
      .orderBy(desc(checkinLogs.scannedAt))
      .limit(100);

    const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    const [counts] = await db
      .select({
        total: sql<number>`count(*)`,
        checkedIn: sql<number>`count(*) filter (where ${registrations.checkedIn})`,
        approved: sql<number>`count(*) filter (where ${registrations.status} = 'approved')`,
      })
      .from(registrations)
      .where(eq(registrations.eventId, eventId));

    return NextResponse.json({
      event: event ? { id: event.id, title: event.title, slug: event.slug, capacity: event.capacity } : null,
      logs,
      counts: {
        total: Number(counts?.total ?? 0),
        checkedIn: Number(counts?.checkedIn ?? 0),
        approved: Number(counts?.approved ?? 0),
      },
    });
  } catch (error) {
    return serverError(error, "Failed to load check-in log");
  }
}
