import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { registrations, events, ticketTiers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticketNumber, eventId } = body;

    if (!ticketNumber) {
      return NextResponse.json({ success: false, message: "No ticket number provided" }, { status: 400 });
    }

    const [reg] = await db.select().from(registrations).where(eq(registrations.ticketNumber, ticketNumber)).limit(1);

    if (!reg) {
      return NextResponse.json({
        success: false,
        status: "INVALID",
        message: "Ticket not recognised. Please check the ticket number.",
      });
    }

    if (reg.status === "cancelled" || reg.status === "rejected") {
      return NextResponse.json({
        success: false,
        status: "INVALID",
        message: `This ticket has been ${reg.status}. Entry denied.`,
        attendeeName: reg.attendeeName,
      });
    }

    if (reg.status !== "approved") {
      return NextResponse.json({
        success: false,
        status: "PENDING",
        message: "This registration is pending approval.",
        attendeeName: reg.attendeeName,
      });
    }

    if (reg.checkedIn) {
      return NextResponse.json({
        success: false,
        status: "ALREADY_USED",
        message: `This ticket was already scanned at ${reg.checkedInAt ? new Date(reg.checkedInAt).toLocaleTimeString() : "an earlier time"}.`,
        attendeeName: reg.attendeeName,
        checkedInAt: reg.checkedInAt,
      });
    }

    // Valid - check in
    await db.update(registrations)
      .set({ checkedIn: true, checkedInAt: new Date(), updatedAt: new Date() })
      .where(eq(registrations.id, reg.id));

    await db.update(events)
      .set({ totalCheckins: sql`${events.totalCheckins} + 1` })
      .where(eq(events.id, reg.eventId));

    let tierName = "General Admission";
    if (reg.ticketTierId) {
      const [tier] = await db.select().from(ticketTiers).where(eq(ticketTiers.id, reg.ticketTierId)).limit(1);
      if (tier) tierName = tier.name;
    }

    return NextResponse.json({
      success: true,
      status: "VALID",
      message: `Welcome, ${reg.attendeeName}!`,
      attendeeName: reg.attendeeName,
      attendeeEmail: reg.attendeeEmail,
      ticketType: tierName,
      ticketNumber: reg.ticketNumber,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }
}
