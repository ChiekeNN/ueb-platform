import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { registrations, ticketTiers } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { badRequest, getEventBySlug, serverError } from "@/lib/server";

/** GET /api/events/[slug]/tiers — ticket types with live sales. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const tiers = await db
      .select()
      .from(ticketTiers)
      .where(eq(ticketTiers.eventId, event.id))
      .orderBy(asc(ticketTiers.createdAt));

    const sold = await db
      .select({ tierId: registrations.ticketTierId, count: sql<number>`count(*)`, checkedIn: sql<number>`count(*) filter (where ${registrations.checkedIn})` })
      .from(registrations)
      .where(eq(registrations.eventId, event.id))
      .groupBy(registrations.ticketTierId);

    const soldMap = new Map(sold.map((s) => [s.tierId, { count: Number(s.count), checkedIn: Number(s.checkedIn) }]));

    return NextResponse.json({
      tiers: tiers.map((t) => ({
        ...t,
        soldLive: soldMap.get(t.id)?.count ?? 0,
        checkedInLive: soldMap.get(t.id)?.checkedIn ?? 0,
        remaining: t.quantity ? Math.max(t.quantity - (soldMap.get(t.id)?.count ?? 0), 0) : null,
      })),
    });
  } catch (error) {
    return serverError(error, "Failed to load ticket types");
  }
}

/** POST /api/events/[slug]/tiers — add a ticket type. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    if (!(body.name ?? "").trim()) return badRequest("Ticket name is required");

    const [tier] = await db
      .insert(ticketTiers)
      .values({
        eventId: event.id,
        name: body.name.trim(),
        description: body.description ?? null,
        type: body.type ?? "free",
        price: String(body.price ?? "0"),
        quantity: body.quantity ? parseInt(String(body.quantity), 10) : null,
        groupSize: body.groupSize ? parseInt(String(body.groupSize), 10) : 1,
        isInvitationOnly: !!body.isInvitationOnly || body.type === "invitation_only",
        accessCode: body.accessCode ?? null,
        saleStartDate: body.saleStartDate ? new Date(body.saleStartDate) : null,
        saleEndDate: body.saleEndDate ? new Date(body.saleEndDate) : null,
      })
      .returning();

    return NextResponse.json({ tier, success: true }, { status: 201 });
  } catch (error) {
    return serverError(error, "Failed to create ticket type");
  }
}

/** PATCH /api/events/[slug]/tiers — edit price, inventory, sale window or access code. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    if (!body.id) return badRequest("Ticket id is required");

    const [tier] = await db
      .update(ticketTiers)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.type ? { type: body.type } : {}),
        ...(body.price !== undefined ? { price: String(body.price) } : {}),
        ...(body.quantity !== undefined ? { quantity: body.quantity ? parseInt(String(body.quantity), 10) : null } : {}),
        ...(body.groupSize !== undefined ? { groupSize: parseInt(String(body.groupSize), 10) || 1 } : {}),
        ...(body.isInvitationOnly !== undefined ? { isInvitationOnly: !!body.isInvitationOnly } : {}),
        ...(body.accessCode !== undefined ? { accessCode: body.accessCode } : {}),
        ...(body.saleStartDate !== undefined ? { saleStartDate: body.saleStartDate ? new Date(body.saleStartDate) : null } : {}),
        ...(body.saleEndDate !== undefined ? { saleEndDate: body.saleEndDate ? new Date(body.saleEndDate) : null } : {}),
      })
      .where(and(eq(ticketTiers.id, body.id), eq(ticketTiers.eventId, event.id)))
      .returning();

    if (!tier) return badRequest("Ticket type not found", 404);
    return NextResponse.json({ tier, success: true });
  } catch (error) {
    return serverError(error, "Failed to update ticket type");
  }
}

/** DELETE /api/events/[slug]/tiers?id=… */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Ticket id is required");

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(registrations)
      .where(eq(registrations.ticketTierId, id));
    if (Number(count) > 0) return badRequest("This ticket type already has registrations — set its inventory to 0 instead.");

    await db.delete(ticketTiers).where(and(eq(ticketTiers.id, id), eq(ticketTiers.eventId, event.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Failed to delete ticket type");
  }
}
