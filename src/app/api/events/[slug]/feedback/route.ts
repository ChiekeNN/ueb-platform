import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventFeedback, registrations } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { badRequest, getEventBySlug, serverError } from "@/lib/server";

/** GET /api/events/[slug]/feedback — responses + rating summary. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const rows = await db
      .select()
      .from(eventFeedback)
      .where(eq(eventFeedback.eventId, event.id))
      .orderBy(desc(eventFeedback.submittedAt));

    const rated = rows.filter((r) => typeof r.rating === "number");
    return NextResponse.json({
      feedback: rows,
      summary: {
        responses: rows.length,
        averageRating: rated.length ? Math.round((rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) * 10) / 10 : 0,
        distribution: [5, 4, 3, 2, 1].map((star) => ({
          star,
          count: rated.filter((r) => r.rating === star).length,
        })),
      },
    });
  } catch (error) {
    return serverError(error, "Failed to load feedback");
  }
}

/** POST /api/events/[slug]/feedback — attendee feedback after the event. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    const rating = body.rating ? parseInt(String(body.rating), 10) : null;
    if (rating !== null && (rating < 1 || rating > 5)) return badRequest("Rating must be between 1 and 5");

    let attendeeName: string | null = body.attendeeName ?? null;
    let registrationId: string | null = null;

    if (body.ticketNumber) {
      const [reg] = await db
        .select()
        .from(registrations)
        .where(and(eq(registrations.eventId, event.id), eq(registrations.ticketNumber, String(body.ticketNumber).toUpperCase())))
        .limit(1);
      if (reg) {
        registrationId = reg.id;
        attendeeName = reg.attendeeName;
      }
    }

    const [row] = await db
      .insert(eventFeedback)
      .values({
        eventId: event.id,
        registrationId,
        attendeeName,
        rating,
        comment: body.comment ?? null,
      })
      .returning();

    return NextResponse.json({ feedback: row, success: true }, { status: 201 });
  } catch (error) {
    return serverError(error, "Failed to submit feedback");
  }
}
