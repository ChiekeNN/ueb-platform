import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, ticketTiers, registrations, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const tiers = await db.select().from(ticketTiers).where(eq(ticketTiers.eventId, event.id));
    const regs = await db.select().from(registrations).where(eq(registrations.eventId, event.id)).orderBy(registrations.createdAt);

    let organiser = null;
    if (event.organiserId) {
      const [u] = await db.select({ name: users.name, email: users.email, organisation: users.organisation }).from(users).where(eq(users.id, event.organiserId)).limit(1);
      organiser = u;
    }

    // Stats
    const stats = {
      totalRegistrations: regs.length,
      approved: regs.filter(r => r.status === "approved").length,
      pending: regs.filter(r => r.status === "pending").length,
      rejected: regs.filter(r => r.status === "rejected").length,
      checkedIn: regs.filter(r => r.checkedIn).length,
      totalRevenue: regs.filter(r => r.paymentStatus === "paid").reduce((sum, r) => sum + parseFloat(r.amountPaid ?? "0"), 0),
    };

    return NextResponse.json({ event, tiers, registrations: regs, organiser, stats });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json();

    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [updated] = await db.update(events)
      .set({
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : event.startDate,
        endDate: body.endDate ? new Date(body.endDate) : event.endDate,
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id))
      .returning();

    return NextResponse.json({ event: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.delete(events).where(eq(events.id, event.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
