import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, registrations, ticketTiers, eventSlots, waitlistEntries, payments, invitations } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { generatePaymentReference, generateTicketNumber, feeBreakdown } from "@/lib/utils";
import { badRequest, assignSeat, findInvitation, serverError } from "@/lib/server";
import QRCode from "qrcode";
import { randomUUID } from "crypto";

type RegistrationBody = {
  eventId: string;
  ticketTierId?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  organisation?: string;
  jobTitle?: string;
  customAnswers?: Record<string, string>;
  quantity?: number | string;
  guests?: string[];
  slotId?: string;
  invitationCode?: string;
  accessCode?: string;
  provider?: string;
  channel?: string;
  joinWaitlist?: boolean;
};

/**
 * POST /api/registrations
 * Handles free + paid tickets, group tickets, invitation-only tickets, appointment slots,
 * approval workflows and waitlist overflow.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegistrationBody;
    const { eventId } = body;
    if (!eventId) return badRequest("eventId is required");

    const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (!event) return badRequest("Event not found", 404);
    if (event.status === "cancelled") return badRequest("This event has been cancelled");

    /* ── Ticket tier ── */
    let tier: typeof ticketTiers.$inferSelect | null = null;
    if (body.ticketTierId) {
      const [t] = await db.select().from(ticketTiers).where(eq(ticketTiers.id, body.ticketTierId)).limit(1);
      tier = t ?? null;
      if (tier && tier.quantity && (tier.quantitySold ?? 0) >= tier.quantity) {
        return badRequest("That ticket type is sold out");
      }
    }

    /* ── Invitation-only tickets + invite codes ── */
    let invitation: typeof invitations.$inferSelect | null = null;
    const code = (body.invitationCode ?? body.accessCode ?? "").trim();
    if (tier?.isInvitationOnly) {
      if (!code) return badRequest("This is an invitation-only ticket — an invite code is required");
      if (tier.accessCode && tier.accessCode.toUpperCase() !== code.toUpperCase()) {
        return badRequest("That invite code is not valid for this ticket type");
      }
    }
    if (code) {
      invitation = await findInvitation(eventId, code);
      if (!invitation && tier?.isInvitationOnly && !tier.accessCode) {
        return badRequest("Invitation code not recognised for this event");
      }
    }

    /* ── Appointment / time-slot booking ── */
    let slot: typeof eventSlots.$inferSelect | null = null;
    if (body.slotId) {
      const [s] = await db.select().from(eventSlots).where(eq(eventSlots.id, body.slotId)).limit(1);
      if (!s || s.eventId !== eventId || !s.isActive) return badRequest("That time slot is not available");
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(registrations)
        .where(and(eq(registrations.eventId, eventId), eq(registrations.slotId, s.id)));
      if (s.capacity && Number(count) >= s.capacity) return badRequest("That time slot is fully booked — pick another one");
      slot = s;
    } else if (event.type === "timeslot") {
      return badRequest("Please choose an available time slot");
    }

    /* ── Capacity + waitlist ── */
    const [{ count: regCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(registrations)
      .where(eq(registrations.eventId, eventId));
    const totalRegs = Number(regCount);
    if (event.capacity && totalRegs >= event.capacity) {
      if (event.waitlistEnabled || body.joinWaitlist) {
        const [entry] = await db
          .insert(waitlistEntries)
          .values({
            eventId,
            ticketTierId: tier?.id ?? null,
            name: (body.attendeeName ?? "").trim() || "Guest",
            email: (body.attendeeEmail ?? "").trim().toLowerCase(),
            phone: body.attendeePhone ?? null,
          })
          .returning();
        return NextResponse.json({
          waitlisted: true,
          entry,
          message: "You're on the waitlist — we'll contact you if a spot opens up.",
        }, { status: 202 });
      }
      return badRequest("Event is at full capacity");
    }

    /* ── Money ── */
    const price = tier ? parseFloat(tier.price ?? "0") : 0;
    const quantity = Math.max(1, Math.min(parseInt(String(body.quantity ?? "1"), 10) || 1, 50));
    const isGroup = quantity > 1 || tier?.type === "group";
    const breakdown = feeBreakdown(price, quantity, !!event.feeAbsorbedByOrganiser);
    const isFree = breakdown.total === 0;
    const requiresApproval = !!event.requiresApproval;
    const groupId = quantity > 1 ? randomUUID() : null;

    /* ── Initial status ── */
    const status = requiresApproval ? "pending" : "approved";
    const paymentStatus = isFree ? "paid" : "pending";
    const canIssueTicket = isFree && status === "approved";

    const guests = Array.isArray(body.guests) ? body.guests.slice(0, quantity) : [];

    const created: (typeof registrations.$inferSelect)[] = [];
    for (let i = 0; i < quantity; i++) {
      const isLead = i === 0;
      const attendeeName = isLead
        ? (body.attendeeName ?? "").trim()
        : (guests[i - 1] ?? `${body.attendeeName ?? "Guest"} (+${i})`);
      const attendeeEmail = isLead
        ? (body.attendeeEmail ?? "").trim().toLowerCase()
        : `${(body.attendeeEmail ?? "guest").split("@")[0]}+${i}@${(body.attendeeEmail ?? "guest@ueb.ng").split("@")[1] ?? "ueb.ng"}`;

      if (!attendeeName || !attendeeEmail) return badRequest("Name and email are required");

      const ticketNumber = isFree ? generateTicketNumber() : null;
      const qrCode = ticketNumber
        ? await QRCode.toDataURL(JSON.stringify({ ticketNumber, eventId, attendeeEmail }), {
            width: 320,
            margin: 2,
            color: { dark: "#1e1b4b", light: "#ffffff" },
          })
        : null;

      const [registration] = await db
        .insert(registrations)
        .values({
          eventId,
          ticketTierId: tier?.id ?? null,
          attendeeName,
          attendeeEmail,
          attendeePhone: isLead ? body.attendeePhone || null : null,
          organisation: isLead ? body.organisation || null : null,
          jobTitle: isLead ? body.jobTitle || null : null,
          status,
          paymentStatus,
          amountPaid: "0",
          ticketNumber,
          qrCode,
          ticketIssuedAt: canIssueTicket ? new Date() : null,
          customAnswers: isLead ? body.customAnswers || {} : {},
          quantity: isGroup ? quantity : 1,
          groupId,
          isGroupLead: isLead,
          guests: isLead ? guests : [],
          slotId: slot?.id ?? null,
          slotLabel: slot?.label ?? null,
        })
        .returning();

      created.push(registration);
    }

    const registration = created[0];

    /* ── Keep counters in sync ── */
    await db
      .update(events)
      .set({ totalRegistrations: sql`${events.totalRegistrations} + ${created.length}` })
      .where(eq(events.id, eventId));

    if (tier) {
      await db
        .update(ticketTiers)
        .set({ quantitySold: sql`${ticketTiers.quantitySold} + ${created.length}` })
        .where(eq(ticketTiers.id, tier.id));
    }

    if (slot) {
      await db
        .update(eventSlots)
        .set({ booked: sql`${eventSlots.booked} + 1` })
        .where(eq(eventSlots.id, slot.id));
    }

    if (invitation) {
      await db
        .update(invitations)
        .set({ status: "registered", registeredAt: new Date() })
        .where(eq(invitations.id, invitation.id));
    }

    /* ── Auto seat for approved attendees when a seating plan exists ── */
    if (event.seatSelectionEnabled && status === "approved") {
      await assignSeat(eventId, registration.id, tier?.name ?? null);
    }

    /* ── Payment intent for paid tickets ── */
    let payment: typeof payments.$inferSelect | null = null;
    if (!isFree) {
      const reference = generatePaymentReference("UEB");
      [payment] = await db
        .insert(payments)
        .values({
          eventId,
          registrationId: registration.id,
          provider: body.provider ?? "paystack",
          channel: body.channel ?? "card",
          reference,
          amount: breakdown.total.toString(),
          feeAmount: breakdown.processing.toString(),
          netAmount: breakdown.organiserNet.toString(),
          status: "initialized",
          payerEmail: registration.attendeeEmail,
          meta: { quantity, tierName: tier?.name ?? null, groupId },
        })
        .returning();
    }

    const fresh = canIssueTicket ? (await db.select().from(registrations).where(eq(registrations.id, registration.id)).limit(1))[0] : registration;

    return NextResponse.json(
      {
        registration: fresh,
        registrations: created,
        payment,
        breakdown,
        requiresApproval,
        isGroup,
        groupSize: created.length,
        slotLabel: slot?.label ?? null,
        checkoutUrl: payment ? `/pay/${payment.reference}` : null,
        success: true,
      },
      { status: 201 }
    );
  } catch (error) {
    return serverError(error, "Failed to create registration");
  }
}

/** GET /api/registrations?eventId=…&status=…&search=… — attendee list with live counts. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    if (!eventId) return badRequest("eventId required");

    const status = searchParams.get("status");
    const search = (searchParams.get("search") ?? "").toLowerCase();
    const audience = searchParams.get("audience");

    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.eventId, eventId))
      .orderBy(registrations.createdAt);

    let filtered = rows;
    if (status && status !== "all") filtered = filtered.filter((r) => r.status === status);
    if (audience && audience !== "all") {
      const map: Record<string, (r: typeof rows[number]) => boolean> = {
        approved: (r) => r.status === "approved",
        pending: (r) => r.status === "pending",
        on_hold: (r) => r.status === "on_hold",
        rejected: (r) => r.status === "rejected",
        checked_in: (r) => !!r.checkedIn,
        not_checked_in: (r) => r.status === "approved" && !r.checkedIn,
        unpaid: (r) => r.paymentStatus !== "paid",
      };
      const fn = map[audience];
      if (fn) filtered = filtered.filter(fn);
    }
    if (search) {
      filtered = filtered.filter((r) =>
        [r.attendeeName, r.attendeeEmail, r.organisation, r.ticketNumber, r.seatLabel]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      registrations: filtered,
      counts: {
        all: rows.length,
        pending: rows.filter((r) => r.status === "pending").length,
        approved: rows.filter((r) => r.status === "approved").length,
        rejected: rows.filter((r) => r.status === "rejected").length,
        on_hold: rows.filter((r) => r.status === "on_hold").length,
        checkedIn: rows.filter((r) => r.checkedIn).length,
        unpaid: rows.filter((r) => r.paymentStatus !== "paid").length,
      },
    });
  } catch (error) {
    return serverError(error, "Failed to fetch registrations");
  }
}
