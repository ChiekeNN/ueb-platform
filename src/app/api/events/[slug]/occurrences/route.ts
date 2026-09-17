import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventOccurrences, events, type RecurrenceRule } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { badRequest, getEventBySlug, serverError } from "@/lib/server";
import { expandRecurrence } from "@/lib/utils";

/** GET /api/events/[slug]/occurrences — list saved occurrences, or preview the rule. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const rows = await db
      .select()
      .from(eventOccurrences)
      .where(eq(eventOccurrences.eventId, event.id))
      .orderBy(asc(eventOccurrences.startDate));

    let preview: { startDate: Date; endDate: Date }[] = [];
    if (rows.length === 0 && event.recurrenceRule && event.startDate) {
      preview = expandRecurrence(new Date(event.startDate), event.recurrenceRule as RecurrenceRule).map(
        (o) => ({ startDate: o.start, endDate: o.end })
      );
    }

    return NextResponse.json({
      occurrences: rows,
      preview,
      rule: event.recurrenceRule ?? null,
    });
  } catch (error) {
    return serverError(error, "Failed to load occurrences");
  }
}

/**
 * POST /api/events/[slug]/occurrences
 * body: { rule, occurrenceDates?: string[] }  — regenerates the recurring schedule.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    const rule = body.rule as RecurrenceRule | undefined;
    if (!rule && !Array.isArray(body.occurrenceDates)) {
      return badRequest("A recurrence rule or explicit occurrence dates are required");
    }

    const anchor = body.startDate ? new Date(body.startDate) : event.startDate ? new Date(event.startDate) : new Date();

    const seedDurationMinutes = (() => {
      if (rule?.durationMinutes) return rule.durationMinutes;
      if (event.startDate && event.endDate) {
        const mins = (new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / 60000;
        if (mins > 0) return Math.round(mins);
      }
      return 120;
    })();

    const dates: { start: Date; end: Date }[] =
      Array.isArray(body.occurrenceDates) && body.occurrenceDates.length > 0
        ? body.occurrenceDates.map((d: string) => {
            const start = new Date(d);
            return { start, end: new Date(start.getTime() + seedDurationMinutes * 60000) };
          })
        : expandRecurrence(anchor, { ...(rule as RecurrenceRule), durationMinutes: seedDurationMinutes }, 120);

    await db.delete(eventOccurrences).where(eq(eventOccurrences.eventId, event.id));
    const inserted = dates.length
      ? await db
          .insert(eventOccurrences)
          .values(
            dates.map((d, i) => ({
              eventId: event.id,
              label: `Session ${i + 1}`,
              startDate: d.start,
              endDate: d.end,
              capacity: event.capacity ?? null,
              status: "scheduled",
            }))
          )
          .returning()
      : [];

    await db
      .update(events)
      .set({
        recurrenceRule: rule ?? event.recurrenceRule ?? null,
        updatedAt: new Date(),
        startDate: inserted[0]?.startDate ?? event.startDate,
      })
      .where(eq(events.id, event.id));

    return NextResponse.json({ occurrences: inserted, count: inserted.length, success: true });
  } catch (error) {
    return serverError(error, "Failed to generate occurrences");
  }
}

/** PATCH /api/events/[slug]/occurrences — update one occurrence (capacity / status). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    if (!body.id) return badRequest("Occurrence id is required");

    const [updated] = await db
      .update(eventOccurrences)
      .set({
        ...(body.capacity !== undefined ? { capacity: body.capacity ? parseInt(body.capacity, 10) : null } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.label ? { label: body.label } : {}),
        ...(body.startDate ? { startDate: new Date(body.startDate) } : {}),
        ...(body.endDate ? { endDate: new Date(body.endDate) } : {}),
      })
      .where(and(eq(eventOccurrences.id, body.id), eq(eventOccurrences.eventId, event.id)))
      .returning();

    return NextResponse.json({ occurrence: updated });
  } catch (error) {
    return serverError(error, "Failed to update occurrence");
  }
}

/** DELETE /api/events/[slug]/occurrences?id=… — remove a single occurrence. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Occurrence id is required");

    await db.delete(eventOccurrences).where(and(eq(eventOccurrences.id, id), eq(eventOccurrences.eventId, event.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Failed to delete occurrence");
  }
}
