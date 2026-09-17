import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  events,
  ticketTiers,
  registrations,
  users,
  eventSlots,
  eventOccurrences,
  seatingSections,
  seats,
  vendors,
  eventMessages,
  eventFeedback,
  payments,
  waitlistEntries,
} from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { findDemoEvent } from "@/lib/demo-events";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
    if (!event) {
      throw new Error("Event not found");
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
      onHold: regs.filter(r => r.status === "on_hold").length,
      checkedIn: regs.filter(r => r.checkedIn).length,
      noShows: regs.filter(r => r.status === "approved" && !r.checkedIn).length,
      unpaid: regs.filter(r => r.paymentStatus !== "paid").length,
      totalRevenue: regs.filter(r => r.paymentStatus === "paid").reduce((sum, r) => sum + parseFloat(r.amountPaid ?? "0"), 0),
      attendanceRate: regs.length ? Math.round((regs.filter(r => r.checkedIn).length / regs.length) * 100) : 0,
    };

    // ── Recurring schedule, appointment slots, seating, vendors, comms ──
    const [slots, occurrences, sections, seatRows, vendorRows, messageRows, feedbackRows, paymentRows, waitlist] = await Promise.all([
      db.select().from(eventSlots).where(eq(eventSlots.eventId, event.id)).orderBy(asc(eventSlots.startDate)),
      db.select().from(eventOccurrences).where(eq(eventOccurrences.eventId, event.id)).orderBy(asc(eventOccurrences.startDate)),
      db.select().from(seatingSections).where(eq(seatingSections.eventId, event.id)),
      db.select().from(seats).where(eq(seats.eventId, event.id)),
      db.select().from(vendors).where(eq(vendors.eventId, event.id)),
      db.select().from(eventMessages).where(eq(eventMessages.eventId, event.id)),
      db.select().from(eventFeedback).where(eq(eventFeedback.eventId, event.id)),
      db.select().from(payments).where(eq(payments.eventId, event.id)),
      db.select().from(waitlistEntries).where(eq(waitlistEntries.eventId, event.id)),
    ]);

    const bookedBySlot = new Map<string, number>();
    regs.forEach(r => {
      if (r.slotId) bookedBySlot.set(r.slotId, (bookedBySlot.get(r.slotId) ?? 0) + 1);
    });

    const workspace = {
      slots: slots.map(s => ({
        id: s.id,
        label: s.label,
        startDate: s.startDate,
        endDate: s.endDate,
        capacity: s.capacity,
        booked: Math.max(s.booked ?? 0, bookedBySlot.get(s.id) ?? 0),
        remaining: s.capacity ? Math.max(s.capacity - (bookedBySlot.get(s.id) ?? 0), 0) : null,
        isActive: s.isActive,
      })),
      occurrences,
      seating: {
        enabled: event.seatSelectionEnabled,
        sections: sections.map(sec => ({
          ...sec,
          seats: seatRows.filter(st => st.sectionId === sec.id),
        })),
        summary: {
          totalSeats: seatRows.length,
          assigned: seatRows.filter(st => st.status === "assigned").length,
          available: seatRows.filter(st => st.status === "available").length,
        },
      },
      vendors: vendorRows,
      messages: messageRows,
      feedback: {
        responses: feedbackRows.length,
        averageRating: feedbackRows.filter(f => f.rating).length
          ? Math.round((feedbackRows.reduce((s, f) => s + (f.rating ?? 0), 0) / feedbackRows.filter(f => f.rating).length) * 10) / 10
          : 0,
      },
      payments: {
        transactions: paymentRows.length,
        settled: paymentRows.filter(p => p.status === "successful").length,
        pending: paymentRows.filter(p => p.status === "initialized").length,
        refunded: paymentRows.filter(p => p.status === "refunded").length,
      },
      waitlist: { count: waitlist.length, entries: waitlist },
      attendeesBySlot: Object.fromEntries(bookedBySlot),
    };

    return NextResponse.json({ event, tiers, registrations: regs, organiser, stats, workspace });
  } catch (error) {
    const { slug } = await params;
    const demoEvent = findDemoEvent(slug);
    if (demoEvent) {
      return NextResponse.json({
        event: demoEvent,
        tiers: demoEvent.tiers,
        registrations: [],
        organiser: {
          name: demoEvent.organiserName,
          email: "hello@ueb.ng",
          organisation: demoEvent.organiserOrg,
        },
        stats: {
          totalRegistrations: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          onHold: 0,
          checkedIn: 0,
          noShows: 0,
          unpaid: 0,
          totalRevenue: 0,
          attendanceRate: 0,
        },
        workspace: {
          slots: [],
          occurrences: [],
          seating: { enabled: false, sections: [], summary: { totalSeats: 0, assigned: 0, available: 0 } },
          vendors: [],
          messages: [],
          feedback: { responses: 0, averageRating: 0 },
          payments: { transactions: 0, settled: 0, pending: 0, refunded: 0 },
          waitlist: { count: 0, entries: [] },
        },
        demo: true,
      });
    }
    if (error instanceof Error && error.message === "Event not found") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
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
        ...(body.title ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.category ? { category: body.category } : {}),
        ...(body.type ? { type: body.type } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.venue !== undefined ? { venue: body.venue } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.bannerColor ? { bannerColor: body.bannerColor } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.capacity !== undefined ? { capacity: body.capacity ? parseInt(String(body.capacity), 10) : null } : {}),
        ...(body.requiresApproval !== undefined ? { requiresApproval: !!body.requiresApproval } : {}),
        ...(body.waitlistEnabled !== undefined ? { waitlistEnabled: !!body.waitlistEnabled } : {}),
        ...(body.seatSelectionEnabled !== undefined ? { seatSelectionEnabled: !!body.seatSelectionEnabled } : {}),
        ...(body.feeAbsorbedByOrganiser !== undefined ? { feeAbsorbedByOrganiser: !!body.feeAbsorbedByOrganiser } : {}),
        ...(body.refundPolicy !== undefined ? { refundPolicy: body.refundPolicy } : {}),
        ...(body.surveyUrl !== undefined ? { surveyUrl: body.surveyUrl } : {}),
        ...(body.postEventMessage !== undefined ? { postEventMessage: body.postEventMessage } : {}),
        ...(body.recurrenceRule !== undefined ? { recurrenceRule: body.recurrenceRule } : {}),
        ...(body.customConfirmationMessage !== undefined ? { customConfirmationMessage: body.customConfirmationMessage } : {}),
        startDate: body.startDate ? new Date(body.startDate) : event.startDate,
        endDate: body.endDate ? new Date(body.endDate) : event.endDate,
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id))
      .returning();

    return NextResponse.json({ event: updated, success: true });
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
