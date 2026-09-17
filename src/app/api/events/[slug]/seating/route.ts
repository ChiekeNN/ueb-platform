import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, registrations, seatingSections, seats } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { assignSeat, badRequest, getEventBySlug, releaseSeat, serverError } from "@/lib/server";
import { seatLabels } from "@/lib/utils";

/** GET /api/events/[slug]/seating — sections, seats and the seating plan. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const sections = await db
      .select()
      .from(seatingSections)
      .where(eq(seatingSections.eventId, event.id))
      .orderBy(asc(seatingSections.createdAt));
    const allSeats = await db
      .select()
      .from(seats)
      .where(eq(seats.eventId, event.id))
      .orderBy(asc(seats.rowName), asc(seats.seatNumber));

    const assignees = await db
      .select({ id: registrations.id, name: registrations.attendeeName, seatId: registrations.seatId })
      .from(registrations)
      .where(eq(registrations.eventId, event.id));
    const nameBySeat = new Map(assignees.filter((a) => a.seatId).map((a) => [a.seatId as string, a.name]));

    return NextResponse.json({
      seatSelectionEnabled: event.seatSelectionEnabled,
      sections: sections.map((s) => ({
        ...s,
        seats: allSeats
          .filter((seat) => seat.sectionId === s.id)
          .map((seat) => ({
            id: seat.id,
            label: seat.label,
            rowName: seat.rowName,
            seatNumber: seat.seatNumber,
            status: seat.status,
            registrationId: seat.registrationId,
            attendeeName: seat.registrationId ? nameBySeat.get(seat.registrationId) ?? null : null,
          })),
      })),
      summary: {
        totalSeats: allSeats.length,
        assigned: allSeats.filter((s) => s.status === "assigned").length,
        held: allSeats.filter((s) => s.status === "held").length,
        blocked: allSeats.filter((s) => s.status === "blocked").length,
        available: allSeats.filter((s) => s.status === "available").length,
      },
    });
  } catch (error) {
    return serverError(error, "Failed to load seating");
  }
}

/**
 * POST /api/events/[slug]/seating — create a section (and its seats).
 * body: { name, rows, seatsPerRow, tierName?, color?, seatSelectionEnabled? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    const name = (body.name ?? "").trim();
    const rows = parseInt(body.rows ?? "0", 10);
    const seatsPerRow = parseInt(body.seatsPerRow ?? "0", 10);
    if (!name) return badRequest("Section name is required");
    if (rows < 1 || seatsPerRow < 1) return badRequest("Rows and seats per row must be at least 1");
    if (rows * seatsPerRow > 5000) return badRequest("That is more than 5,000 seats for one section");

    const [section] = await db
      .insert(seatingSections)
      .values({
        eventId: event.id,
        name,
        rows,
        seatsPerRow,
        tierName: body.tierName ?? null,
        color: body.color ?? "#7C3AED",
      })
      .returning();

    const seatRows = seatLabels(rows, seatsPerRow, name);
    const created = await db
      .insert(seats)
      .values(
        seatRows.map((s) => ({
          eventId: event.id,
          sectionId: section.id,
          label: s.label,
          rowName: s.rowName,
          seatNumber: s.seatNumber,
          status: "available",
        }))
      )
      .returning();

    if (body.seatSelectionEnabled !== false) {
      await db.update(events).set({ seatSelectionEnabled: true, updatedAt: new Date() }).where(eq(events.id, event.id));
    }

    return NextResponse.json({ section, seats: created.length, success: true }, { status: 201 });
  } catch (error) {
    return serverError(error, "Failed to create section");
  }
}

/**
 * PATCH /api/events/[slug]/seating
 * actions: auto-assign approved attendees · block/release seats · assign a specific seat · clear a seat
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    const action = body.action ?? "assign";

    if (action === "auto_assign") {
      const tiers = await db
        .select({ id: registrations.id, name: registrations.attendeeName, tierId: registrations.ticketTierId, seatId: registrations.seatId, status: registrations.status })
        .from(registrations)
        .where(eq(registrations.eventId, event.id));
      const pending = tiers.filter((r) => r.status === "approved" && !r.seatId);
      let assigned = 0;
      for (const reg of pending) {
        const seat = await assignSeat(event.id, reg.id, null);
        if (seat) assigned++;
      }
      return NextResponse.json({ assigned, remaining: pending.length - assigned, success: true });
    }

    if (action === "clear_all") {
      await db.update(seats).set({ status: "available", registrationId: null }).where(eq(seats.eventId, event.id));
      await db.update(registrations).set({ seatId: null, seatLabel: null }).where(eq(registrations.eventId, event.id));
      return NextResponse.json({ success: true });
    }

    if (action === "clear") {
      if (!body.registrationId) return badRequest("registrationId is required");
      await releaseSeat(body.registrationId);
      return NextResponse.json({ success: true });
    }

    if (action === "assign") {
      if (!body.seatId) return badRequest("seatId is required");
      const [seat] = await db
        .select()
        .from(seats)
        .where(and(eq(seats.id, body.seatId), eq(seats.eventId, event.id)))
        .limit(1);
      if (!seat) return badRequest("Seat not found", 404);
      if (seat.status === "assigned" && seat.registrationId !== body.registrationId) {
        return badRequest("That seat is already taken");
      }

      if (body.registrationId) {
        await releaseSeat(body.registrationId);
        await db
          .update(seats)
          .set({ status: "assigned", registrationId: body.registrationId })
          .where(eq(seats.id, seat.id));
        await db
          .update(registrations)
          .set({ seatId: seat.id, seatLabel: seat.label, updatedAt: new Date() })
          .where(eq(registrations.id, body.registrationId));
      } else {
        await db.update(seats).set({ status: "blocked", registrationId: null }).where(eq(seats.id, seat.id));
      }
      return NextResponse.json({ success: true });
    }

    if (action === "release") {
      if (!body.seatId) return badRequest("seatId is required");
      const [seat] = await db.select().from(seats).where(eq(seats.id, body.seatId)).limit(1);
      if (seat?.registrationId) await releaseSeat(seat.registrationId);
      await db.update(seats).set({ status: "available", registrationId: null }).where(eq(seats.id, body.seatId));
      return NextResponse.json({ success: true });
    }

    if (action === "toggle_selection") {
      await db
        .update(events)
        .set({ seatSelectionEnabled: !!body.seatSelectionEnabled, updatedAt: new Date() })
        .where(eq(events.id, event.id));
      return NextResponse.json({ success: true, seatSelectionEnabled: !!body.seatSelectionEnabled });
    }

    return badRequest("Unknown seating action");
  } catch (error) {
    return serverError(error, "Seating action failed");
  }
}

/** DELETE /api/events/[slug]/seating?id=… — delete a section and its seats. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Section id is required");

    const [seat] = await db
      .select()
      .from(seats)
      .where(and(eq(seats.sectionId, id), eq(seats.status, "assigned")))
      .limit(1);
    if (seat) return badRequest("This section has assigned seats — release them first.");

    await db.delete(seats).where(eq(seats.sectionId, id));
    await db.delete(seatingSections).where(and(eq(seatingSections.id, id), eq(seatingSections.eventId, event.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Failed to delete section");
  }
}
