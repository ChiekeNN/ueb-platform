import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventSlots, events, registrations } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { badRequest, getEventBySlug, serverError } from "@/lib/server";
import { expandSlots } from "@/lib/utils";

/** GET /api/events/[slug]/slots — appointment / time-slot availability. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const includeInactive = new URL(req.url).searchParams.get("all") === "1";
    const rows = await db
      .select()
      .from(eventSlots)
      .where(includeInactive ? eq(eventSlots.eventId, event.id) : and(eq(eventSlots.eventId, event.id), eq(eventSlots.isActive, true)))
      .orderBy(asc(eventSlots.startDate));

    const booked = await db
      .select({ slotId: registrations.slotId })
      .from(registrations)
      .where(eq(registrations.eventId, event.id));
    const bookingCounts = new Map<string, number>();
    booked.forEach((b) => {
      if (b.slotId) bookingCounts.set(b.slotId, (bookingCounts.get(b.slotId) ?? 0) + 1);
    });

    const slots = rows.map((s) => ({
      ...s,
      booked: Math.max(s.booked ?? 0, bookingCounts.get(s.id) ?? 0),
      remaining: s.capacity ? Math.max(s.capacity - (bookingCounts.get(s.id) ?? 0), 0) : null,
    }));

    return NextResponse.json({ slots, type: event.type });
  } catch (error) {
    return serverError(error, "Failed to load slots");
  }
}

/**
 * POST /api/events/[slug]/slots
 * Generate slots in bulk: { date, startTime, endTime, durationMinutes, capacity }
 * or pass explicit { slots: [{ startDate, endDate, capacity, label }] }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    let created: { startDate: Date; endDate: Date; capacity: number | null; label: string | null }[] = [];

    if (Array.isArray(body.slots) && body.slots.length > 0) {
      created = body.slots.map((s: { startDate: string; endDate?: string; capacity?: number | string; label?: string }) => ({
        startDate: new Date(s.startDate),
        endDate: s.endDate ? new Date(s.endDate) : new Date(new Date(s.startDate).getTime() + 30 * 60000),
        capacity: s.capacity ? parseInt(String(s.capacity), 10) : 1,
        label: s.label ?? null,
      }));
    } else {
      const dates: Date[] = Array.isArray(body.dates) && body.dates.length > 0
        ? body.dates.map((d: string) => new Date(d))
        : body.date
          ? [new Date(body.date)]
          : [];
      if (dates.length === 0) return badRequest("Provide a date (or list of dates) to generate slots for");

      const duration = parseInt(body.durationMinutes ?? "30", 10);
      created = dates.flatMap((day) =>
        expandSlots(day, {
          startTime: body.startTime ?? "09:00",
          endTime: body.endTime ?? "17:00",
          durationMinutes: duration,
        }).map((s) => ({
          startDate: s.start,
          endDate: s.end,
          capacity: body.capacity ? parseInt(String(body.capacity), 10) : 1,
          label: `${s.start.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })} – ${s.end.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}`,
        }))
      );
    }

    if (created.length === 0) return badRequest("No slots were generated — check the times and duration");

    const rows = await db
      .insert(eventSlots)
      .values(
        created.map((s) => ({
          eventId: event.id,
          label: s.label,
          startDate: s.startDate,
          endDate: s.endDate,
          capacity: s.capacity ?? 1,
          booked: 0,
          isActive: true,
        }))
      )
      .returning();

    if (event.type !== "timeslot" && body.setType !== false) {
      await db.update(events).set({ type: "timeslot", updatedAt: new Date() }).where(eq(events.id, event.id));
    }

    return NextResponse.json({ slots: rows, count: rows.length, success: true }, { status: 201 });
  } catch (error) {
    return serverError(error, "Failed to create slots");
  }
}

/** PATCH /api/events/[slug]/slots — toggle a slot, change capacity/label. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    if (body.id === "__all__" && body.isActive !== undefined) {
      await db
        .update(eventSlots)
        .set({ isActive: !!body.isActive })
        .where(eq(eventSlots.eventId, event.id));
      return NextResponse.json({ success: true });
    }
    if (!body.id) return badRequest("Slot id is required");

    const [updated] = await db
      .update(eventSlots)
      .set({
        ...(body.isActive !== undefined ? { isActive: !!body.isActive } : {}),
        ...(body.capacity !== undefined ? { capacity: parseInt(String(body.capacity), 10) || 1 } : {}),
        ...(body.label ? { label: body.label } : {}),
        ...(body.startDate ? { startDate: new Date(body.startDate) } : {}),
        ...(body.endDate ? { endDate: new Date(body.endDate) } : {}),
      })
      .where(and(eq(eventSlots.id, body.id), eq(eventSlots.eventId, event.id)))
      .returning();

    return NextResponse.json({ slot: updated });
  } catch (error) {
    return serverError(error, "Failed to update slot");
  }
}

/** DELETE /api/events/[slug]/slots?id=… */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Slot id is required");

    const booked = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(and(eq(registrations.eventId, event.id), eq(registrations.slotId, id)))
      .limit(1);
    if (booked.length > 0) return badRequest("This slot already has bookings — deactivate it instead.");

    await db.delete(eventSlots).where(and(eq(eventSlots.id, id), eq(eventSlots.eventId, event.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Failed to delete slot");
  }
}
