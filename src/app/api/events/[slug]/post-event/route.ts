import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, registrations } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  audienceRecipients,
  badRequest,
  eventAnalytics,
  getEventBySlug,
  logMessage,
  serverError,
} from "@/lib/server";

/** GET /api/events/[slug]/post-event — close-out checklist state. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const analytics = await eventAnalytics(event.id);
    const checklist = [
      { key: "approved", label: "All registrations reviewed", done: analytics.statusCounts.pending === 0 },
      { key: "checked_in", label: "Attendance captured", done: analytics.totals.checkedIn > 0 },
      { key: "payments", label: "Payments reconciled", done: analytics.paymentCounts.pending === 0 },
      { key: "thank_you", label: "Thank-you message sent", done: analytics.totals.messagesSent > 0 },
      { key: "survey", label: "Feedback survey shared", done: !!event.surveyUrl },
      { key: "completed", label: "Event marked completed", done: !!event.completedAt },
    ];

    return NextResponse.json({
      completedAt: event.completedAt,
      postEventMessage: event.postEventMessage,
      surveyUrl: event.surveyUrl,
      checklist,
      summary: analytics.totals,
      noShows: analytics.registrations
        .filter((r) => r.status === "approved" && !r.checkedIn)
        .map((r) => ({ id: r.id, name: r.attendeeName, email: r.attendeeEmail })),
    });
  } catch (error) {
    return serverError(error, "Failed to load post-event state");
  }
}

/**
 * POST /api/events/[slug]/post-event
 * body: { action: "complete" | "announce" | "survey" | "follow_up" | "reopen", message?, surveyUrl?, audience? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    const action = body.action ?? "complete";

    if (action === "complete" || action === "reopen") {
      const [updated] = await db
        .update(events)
        .set({
          status: action === "complete" ? "completed" : "published",
          completedAt: action === "complete" ? new Date() : null,
          updatedAt: new Date(),
          ...(body.message ? { postEventMessage: body.message } : {}),
          ...(body.surveyUrl ? { surveyUrl: body.surveyUrl } : {}),
        })
        .where(eq(events.id, event.id))
        .returning();
      return NextResponse.json({ event: updated, success: true });
    }

    if (action === "announce" || action === "follow_up" || action === "survey") {
      const audience = body.audience ?? (action === "follow_up" ? "not_checked_in" : "approved");
      const recipients = await audienceRecipients(event.id, audience);
      if (recipients.length === 0) return badRequest("Nobody matches that audience");

      const message =
        body.message ??
        (action === "survey"
          ? `Thank you for attending ${event.title}! We would love your feedback — ${body.surveyUrl ?? event.surveyUrl ?? "the survey link will follow"}.`
          : action === "follow_up"
            ? `We missed you at ${event.title}! Let us know if you would like the session materials or a refund.`
            : `Thank you for being part of ${event.title}. The event report and photos are now available.`);

      const row = await logMessage({
        eventId: event.id,
        channel: body.channel ?? "email",
        audience: `post_event:${audience}`,
        subject: body.subject ?? `Thank you for attending ${event.title}`,
        body: message,
        recipients,
        senderName: body.senderName ?? "UEB Organiser",
      });

      if (action === "survey" && body.surveyUrl) {
        await db.update(events).set({ surveyUrl: body.surveyUrl }).where(eq(events.id, event.id));
      }

      // Reset check-in counters view after completion if asked.
      if (body.archiveStats) {
        await db
          .update(events)
          .set({ totalCheckins: sql`${events.totalCheckins}` })
          .where(eq(events.id, event.id));
      }

      return NextResponse.json({ message: row, recipientCount: recipients.length, success: true }, { status: 201 });
    }

    if (action === "issue_certificates") {
      // Placeholder hook: mark all checked-in attendees as certified.
      const rows = await db.select().from(registrations).where(eq(registrations.eventId, event.id));
      const checkedIn = rows.filter((r) => r.checkedIn);
      return NextResponse.json({
        certified: checkedIn.length,
        note: "Certificate generation hook — connect a PDF renderer to email signed certificates.",
        success: true,
      });
    }

    return badRequest("Unknown post-event action");
  } catch (error) {
    return serverError(error, "Post-event action failed");
  }
}
