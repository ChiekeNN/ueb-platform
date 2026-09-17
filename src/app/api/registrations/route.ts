import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { registrations, events, ticketTiers, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateTicketNumber } from "@/lib/utils";
import QRCode from "qrcode";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, ticketTierId, attendeeName, attendeeEmail, attendeePhone, organisation, jobTitle, customAnswers } = body;

    // Check event exists
    const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // Check ticket tier
    let tier = null;
    if (ticketTierId) {
      const [t] = await db.select().from(ticketTiers).where(eq(ticketTiers.id, ticketTierId)).limit(1);
      if (t) tier = t;
    }

    // Check capacity
    if (event.capacity) {
      const count = await db.select({ count: sql<number>`count(*)` }).from(registrations).where(eq(registrations.eventId, eventId));
      if (count[0]?.count >= event.capacity) {
        return NextResponse.json({ error: "Event is at full capacity" }, { status: 400 });
      }
    }

    const ticketNumber = generateTicketNumber();
    const requiresApproval = event.requiresApproval;
    const status = requiresApproval ? "pending" : "approved";

    // Generate QR code
    const qrData = JSON.stringify({ ticketNumber, eventId, attendeeEmail });
    const qrCode = await QRCode.toDataURL(qrData, { width: 300, margin: 2, color: { dark: "#1e1b4b", light: "#ffffff" } });

    const price = tier ? parseFloat(tier.price ?? "0") : 0;
    const isFree = price === 0;

    const [registration] = await db.insert(registrations).values({
      eventId,
      ticketTierId: ticketTierId || null,
      attendeeName,
      attendeeEmail,
      attendeePhone: attendeePhone || null,
      organisation: organisation || null,
      jobTitle: jobTitle || null,
      status,
      paymentStatus: isFree ? "paid" : "pending",
      amountPaid: isFree ? "0" : "0",
      ticketNumber,
      qrCode,
      customAnswers: customAnswers || {},
    }).returning();

    // Update event stats
    await db.update(events)
      .set({ totalRegistrations: sql`${events.totalRegistrations} + 1` })
      .where(eq(events.id, eventId));

    if (tier) {
      await db.update(ticketTiers)
        .set({ quantitySold: sql`${ticketTiers.quantitySold} + 1` })
        .where(eq(ticketTiers.id, tier.id));
    }

    return NextResponse.json({ registration, success: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create registration" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    const regs = await db
      .select()
      .from(registrations)
      .where(eq(registrations.eventId, eventId))
      .orderBy(registrations.createdAt);

    return NextResponse.json({ registrations: regs });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
