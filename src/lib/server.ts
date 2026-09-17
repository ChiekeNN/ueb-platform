import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  events,
  registrations,
  ticketTiers,
  vendors,
  waitlistEntries,
  eventMessages,
  seats,
  seatingSections,
  invitations,
} from "@/db/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import QRCode from "qrcode";
import { generateTicketNumber } from "@/lib/utils";

export type Event = typeof events.$inferSelect;
export type Registration = typeof registrations.$inferSelect;

export async function getEventBySlug(slug: string): Promise<Event | null> {
  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  return event ?? null;
}

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(error: unknown, message = "Request failed") {
  console.error(error);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Creates the unique ticket number + QR payload for a registration if it does not have one yet. */
export async function issueTicket(reg: Registration) {
  if (reg.ticketNumber && reg.qrCode && reg.ticketIssuedAt) {
    return { ticketNumber: reg.ticketNumber, qrCode: reg.qrCode, issued: false };
  }
  const ticketNumber = reg.ticketNumber ?? generateTicketNumber();
  const qrData = JSON.stringify({
    ticketNumber,
    eventId: reg.eventId,
    attendeeEmail: reg.attendeeEmail,
    v: 1,
  });
  const qrCode = await QRCode.toDataURL(qrData, {
    width: 320,
    margin: 2,
    color: { dark: "#1e1b4b", light: "#ffffff" },
  });
  await db
    .update(registrations)
    .set({ ticketNumber, qrCode, ticketIssuedAt: new Date(), updatedAt: new Date() })
    .where(eq(registrations.id, reg.id));
  return { ticketNumber, qrCode, issued: true };
}

/* ─── Audience segmentation for communications ─────────────── */

export type AudienceValue =
  | "all"
  | "approved"
  | "pending"
  | "on_hold"
  | "rejected"
  | "checked_in"
  | "not_checked_in"
  | "unpaid"
  | "vendors"
  | "waitlist";

export type Recipient = { name: string; email: string; phone?: string | null };

export async function audienceRecipients(eventId: string, audience: AudienceValue): Promise<Recipient[]> {
  if (audience === "vendors") {
    const rows = await db.select().from(vendors).where(eq(vendors.eventId, eventId));
    return rows
      .filter((v) => !!v.email)
      .map((v) => ({ name: v.contactName ?? v.name, email: v.email as string, phone: v.phone }));
  }

  if (audience === "waitlist") {
    const rows = await db.select().from(waitlistEntries).where(eq(waitlistEntries.eventId, eventId));
    return rows.map((w) => ({ name: w.name, email: w.email, phone: w.phone }));
  }

  const rows = await db.select().from(registrations).where(eq(registrations.eventId, eventId));

  const filtered = rows.filter((r) => {
    switch (audience) {
      case "all":
        return r.status !== "cancelled";
      case "approved":
        return r.status === "approved";
      case "pending":
        return r.status === "pending";
      case "on_hold":
        return r.status === "on_hold";
      case "rejected":
        return r.status === "rejected";
      case "checked_in":
        return r.checkedIn === true;
      case "not_checked_in":
        return r.status === "approved" && !r.checkedIn;
      case "unpaid":
        return r.paymentStatus !== "paid";
      default:
        return true;
    }
  });

  return filtered.map((r) => ({ name: r.attendeeName, email: r.attendeeEmail, phone: r.attendeePhone }));
}

/** Records an outbound communication (delivery is simulated — swap in an email/SMS provider later). */
export async function logMessage(opts: {
  eventId: string;
  channel: string;
  audience: string;
  subject?: string | null;
  body: string;
  recipients: Recipient[];
  senderName?: string | null;
  status?: string;
}) {
  const [row] = await db
    .insert(eventMessages)
    .values({
      eventId: opts.eventId,
      channel: opts.channel,
      audience: opts.audience,
      subject: opts.subject ?? null,
      body: opts.body,
      recipientCount: opts.recipients.length,
      senderName: opts.senderName ?? null,
      status: opts.status ?? "sent",
      sentAt: new Date(),
    })
    .returning();
  return row;
}

/* ─── Seating helpers ──────────────────────────────────────── */

/** Picks the next free seat (preferring a section that matches the ticket tier name) and assigns it. */
export async function assignSeat(eventId: string, registrationId: string, tierName?: string | null) {
  const sections = await db.select().from(seatingSections).where(eq(seatingSections.eventId, eventId));
  if (sections.length === 0) return null;

  const preferred = tierName
    ? sections.find((s) => (s.tierName ?? "").toLowerCase() === tierName.toLowerCase())
    : undefined;
  const ordered = preferred ? [preferred, ...sections.filter((s) => s.id !== preferred.id)] : sections;

  for (const section of ordered) {
    const [free] = await db
      .select()
      .from(seats)
      .where(and(eq(seats.sectionId, section.id), eq(seats.status, "available")))
      .orderBy(seats.rowName, seats.seatNumber)
      .limit(1);
    if (free) {
      await db
        .update(seats)
        .set({ status: "assigned", registrationId })
        .where(eq(seats.id, free.id));
      await db
        .update(registrations)
        .set({ seatId: free.id, seatLabel: free.label, updatedAt: new Date() })
        .where(eq(registrations.id, registrationId));
      return free;
    }
  }
  return null;
}

export async function releaseSeat(registrationId: string) {
  await db
    .update(seats)
    .set({ status: "available", registrationId: null })
    .where(eq(seats.registrationId, registrationId));
  await db
    .update(registrations)
    .set({ seatId: null, seatLabel: null, updatedAt: new Date() })
    .where(eq(registrations.id, registrationId));
}

/* ─── Invitations ──────────────────────────────────────────── */

export async function findInvitation(eventId: string, code: string) {
  const [inv] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.eventId, eventId), eq(invitations.invitationCode, code.toUpperCase())))
    .limit(1);
  return inv ?? null;
}

/* ─── Analytics ────────────────────────────────────────────── */

export async function eventAnalytics(eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  const regs = await db
    .select()
    .from(registrations)
    .where(eq(registrations.eventId, eventId))
    .orderBy(desc(registrations.createdAt));
  const tiers = await db.select().from(ticketTiers).where(eq(ticketTiers.eventId, eventId));
  const msgs = await db.select().from(eventMessages).where(eq(eventMessages.eventId, eventId));
  const vends = await db.select().from(vendors).where(eq(vendors.eventId, eventId));

  const paid = regs.filter((r) => r.paymentStatus === "paid");
  const grossRevenue = paid.reduce((sum, r) => sum + parseFloat(r.amountPaid ?? "0"), 0);
  const approved = regs.filter((r) => r.status === "approved");
  const checkedIn = regs.filter((r) => r.checkedIn);
  const noShows = approved.filter((r) => !r.checkedIn);
  const feeRevenue = Math.round(grossRevenue * 0.08) + paid.length * 100;

  const salesByTier = tiers.map((t) => {
    const tierRegs = regs.filter((r) => r.ticketTierId === t.id);
    const tierPaid = tierRegs.filter((r) => r.paymentStatus === "paid");
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      price: parseFloat(t.price ?? "0"),
      quantity: t.quantity,
      sold: tierRegs.length,
      paidCount: tierPaid.length,
      checkedIn: tierRegs.filter((r) => r.checkedIn).length,
      revenue: tierPaid.reduce((s, r) => s + parseFloat(r.amountPaid ?? "0"), 0),
      remaining: t.quantity ? Math.max(t.quantity - tierRegs.length, 0) : null,
    };
  });

  const registrationTimeline = buildTimeline(regs.map((r) => r.createdAt));
  const checkinTimeline = buildTimeline(checkedIn.map((r) => r.checkedInAt));

  const statusCounts = {
    pending: regs.filter((r) => r.status === "pending").length,
    approved: approved.length,
    rejected: regs.filter((r) => r.status === "rejected").length,
    on_hold: regs.filter((r) => r.status === "on_hold").length,
    cancelled: regs.filter((r) => r.status === "cancelled").length,
  };

  const paymentCounts = {
    paid: paid.length,
    pending: regs.filter((r) => r.paymentStatus === "pending").length,
    failed: regs.filter((r) => r.paymentStatus === "failed").length,
    refunded: regs.filter((r) => r.paymentStatus === "refunded").length,
  };

  const customQuestionStats = summariseAnswers(event?.customQuestions ?? [], regs);

  return {
    event,
    totals: {
      registrations: regs.length,
      approved: approved.length,
      pending: statusCounts.pending,
      checkedIn: checkedIn.length,
      noShows: noShows.length,
      cancelled: statusCounts.cancelled,
      revenue: grossRevenue,
      uebFees: feeRevenue,
      organiserNet: Math.max(grossRevenue - feeRevenue, 0),
      attendanceRate: approved.length ? Math.round((checkedIn.length / approved.length) * 100) : 0,
      approvalRate: regs.length ? Math.round((approved.length / regs.length) * 100) : 0,
      messagesSent: msgs.reduce((s, m) => s + (m.recipientCount ?? 0), 0),
      vendors: vends.length,
      vendorRevenue: vends.reduce((s, v) => s + parseFloat(v.amountPaid ?? "0"), 0),
    },
    statusCounts,
    paymentCounts,
    salesByTier,
    registrationTimeline,
    checkinTimeline,
    customQuestionStats,
    registrations: regs,
  };
}

function buildTimeline(dates: (Date | string | null)[]): { date: string; count: number }[] {
  const map = new Map<string, number>();
  dates.forEach((d) => {
    if (!d) return;
    const key = new Date(d).toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
}

function summariseAnswers(
  questions: { id: string; label: string; type: string }[],
  regs: Registration[]
) {
  return questions.map((q) => {
    const answers = regs
      .map((r) => (r.customAnswers ?? {})[q.id])
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    const counts = new Map<string, number>();
    answers.forEach((a) => counts.set(a, (counts.get(a) ?? 0) + 1));
    return {
      id: q.id,
      label: q.label,
      answered: answers.length,
      topAnswers: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count })),
    };
  });
}

export async function countRegistrations(eventId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrations)
    .where(eq(registrations.eventId, eventId));
  return Number(row?.count ?? 0);
}
