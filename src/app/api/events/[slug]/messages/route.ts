import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventMessages } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { audienceRecipients, badRequest, getEventBySlug, logMessage, serverError, type AudienceValue } from "@/lib/server";

/** GET /api/events/[slug]/messages — communication history. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const rows = await db
      .select()
      .from(eventMessages)
      .where(eq(eventMessages.eventId, event.id))
      .orderBy(desc(eventMessages.sentAt));

    return NextResponse.json({
      messages: rows,
      totals: {
        campaigns: rows.length,
        recipients: rows.reduce((s, m) => s + (m.recipientCount ?? 0), 0),
      },
    });
  } catch (error) {
    return serverError(error, "Failed to load messages");
  }
}

/**
 * POST /api/events/[slug]/messages — send an announcement to a segment.
 * body: { channel, audience, subject?, body, previewOnly? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    const audience = (body.audience ?? "all") as AudienceValue;
    const channel = body.channel ?? "email";
    const message = (body.body ?? "").trim();
    if (!message) return badRequest("Write a message to send");

    const recipients = await audienceRecipients(event.id, audience);
    if (recipients.length === 0) return badRequest("Nobody matches that audience yet");

    if (body.previewOnly) {
      return NextResponse.json({
        preview: true,
        recipients: recipients.slice(0, 50),
        recipientCount: recipients.length,
      });
    }

    const row = await logMessage({
      eventId: event.id,
      channel,
      audience,
      subject: body.subject ?? null,
      body: message,
      recipients,
      senderName: body.senderName ?? null,
      status: body.scheduledFor ? "scheduled" : "sent",
    });

    // Per-channel delivery hooks live here (email/SMS/WhatsApp provider integration).
    return NextResponse.json({
      message: row,
      recipientCount: recipients.length,
      sample: recipients.slice(0, 5),
      success: true,
    }, { status: 201 });
  } catch (error) {
    return serverError(error, "Failed to send message");
  }
}
