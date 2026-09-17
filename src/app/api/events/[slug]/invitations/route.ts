import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { badRequest, getEventBySlug, logMessage, serverError } from "@/lib/server";
import { generateInvitationCode } from "@/lib/utils";

type InviteInput = {
  name?: string;
  email?: string;
  phone?: string;
  tierId?: string | null;
  maxGuests?: number | string;
  notes?: string;
};

/** GET /api/events/[slug]/invitations — guest list + invite codes. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const rows = await db
      .select()
      .from(invitations)
      .where(eq(invitations.eventId, event.id))
      .orderBy(desc(invitations.createdAt));

    return NextResponse.json({
      invitations: rows,
      summary: {
        total: rows.length,
        sent: rows.filter((i) => i.status === "sent" || i.status === "opened").length,
        opened: rows.filter((i) => i.status === "opened").length,
        registered: rows.filter((i) => i.status === "registered").length,
      },
    });
  } catch (error) {
    return serverError(error, "Failed to load invitations");
  }
}

/**
 * POST /api/events/[slug]/invitations
 * body: { guests: [{ name, email, phone, maxGuests, tierId }], send?: boolean, message?: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    const guests: InviteInput[] = Array.isArray(body.guests) ? body.guests : [];
    if (guests.length === 0) return badRequest("Add at least one guest to invite");

    const clean = guests
      .map((g) => ({ ...g, email: (g.email ?? "").trim().toLowerCase(), name: (g.name ?? "").trim() }))
      .filter((g) => g.email.includes("@"));
    if (clean.length === 0) return badRequest("Every invitation needs a valid email address");

    const send = body.send !== false;
    const rows = await db
      .insert(invitations)
      .values(
        clean.map((g) => ({
          eventId: event.id,
          email: g.email as string,
          name: g.name || null,
          phone: g.phone ?? null,
          invitationCode: generateInvitationCode(),
          tierId: g.tierId ?? null,
          maxGuests: g.maxGuests ? parseInt(String(g.maxGuests), 10) || 1 : 1,
          notes: g.notes ?? null,
          status: send ? "sent" : "draft",
          sentAt: send ? new Date() : null,
        }))
      )
      .returning();

    if (send) {
      await logMessage({
        eventId: event.id,
        channel: body.channel ?? "email",
        audience: "invitations",
        subject: body.subject ?? `You're invited: ${event.title}`,
        body:
          body.message ??
          `You have been personally invited to ${event.title}. Use your unique invitation code to reserve your place.`,
        recipients: rows.map((r) => ({ name: r.name ?? r.email, email: r.email, phone: r.phone })),
        senderName: body.senderName ?? "UEB Invitations",
      });
    }

    return NextResponse.json({ invitations: rows, count: rows.length, success: true }, { status: 201 });
  } catch (error) {
    return serverError(error, "Failed to create invitations");
  }
}

/** PATCH /api/events/[slug]/invitations — resend, cancel or record an open. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
    if (ids.length === 0) return badRequest("Invitation ids are required");

    const action = body.action ?? "resend";
    if (action === "resend") {
      const rows = await db
        .update(invitations)
        .set({ status: "sent", sentAt: new Date() })
        .where(and(eq(invitations.eventId, event.id), inArray(invitations.id, ids)))
        .returning();
      await logMessage({
        eventId: event.id,
        channel: "email",
        audience: "invitations",
        subject: `Reminder: ${event.title}`,
        body: body.message ?? `A reminder about your invitation to ${event.title}.`,
        recipients: rows.map((r) => ({ name: r.name ?? r.email, email: r.email, phone: r.phone })),
      });
      return NextResponse.json({ invitations: rows, success: true });
    }

    const allowed = ["draft", "sent", "opened", "registered", "cancelled", "declined"];
    const status = action === "cancel" ? "cancelled" : allowed.includes(action) ? action : "sent";
    const [updated] = await db
      .update(invitations)
      .set({
        status,
        ...(status === "sent" ? { sentAt: new Date() } : {}),
        ...(status === "opened" ? { openedAt: new Date() } : {}),
      })
      .where(and(eq(invitations.eventId, event.id), eq(invitations.id, ids[0])))
      .returning();
    return NextResponse.json({ invitation: updated, success: true });
  } catch (error) {
    return serverError(error, "Failed to update invitations");
  }
}

/** DELETE /api/events/[slug]/invitations?id=… (or { ids: [] }) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const url = new URL(req.url);
    const single = url.searchParams.get("id");
    let ids: string[] = single ? [single] : [];
    if (ids.length === 0) {
      try {
        const body = await req.json();
        ids = body.ids ?? [];
      } catch {
        ids = [];
      }
    }
    if (ids.length === 0) return badRequest("Invitation ids are required");

    await db.delete(invitations).where(and(eq(invitations.eventId, event.id), inArray(invitations.id, ids)));
    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    return serverError(error, "Failed to delete invitations");
  }
}
