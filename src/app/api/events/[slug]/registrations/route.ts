import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, registrations, ticketTiers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  assignSeat,
  badRequest,
  getEventBySlug,
  issueTicket,
  logMessage,
  releaseSeat,
  serverError,
} from "@/lib/server";
import { toCSV } from "@/lib/utils";

/** GET /api/events/[slug]/registrations — attendee roster for the organiser console (JSON or CSV). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const format = url.searchParams.get("format");

    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.eventId, event.id))
      .orderBy(registrations.createdAt);

    let filtered = rows;
    if (status && status !== "all") filtered = filtered.filter((r) => r.status === status);
    if (search) {
      filtered = filtered.filter((r) =>
        [r.attendeeName, r.attendeeEmail, r.organisation, r.ticketNumber, r.seatLabel]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search))
      );
    }

    if (format === "csv") {
      const csv = toCSV(
        filtered.map((r) => ({
          Ticket: r.ticketNumber ?? "",
          Name: r.attendeeName,
          Email: r.attendeeEmail,
          Phone: r.attendeePhone ?? "",
          Organisation: r.organisation ?? "",
          Role: r.jobTitle ?? "",
          Status: r.status,
          Payment: r.paymentStatus,
          AmountPaid: r.amountPaid ?? "0",
          CheckedIn: r.checkedIn ? "yes" : "no",
          CheckedInAt: r.checkedInAt ? new Date(r.checkedInAt).toISOString() : "",
          Seat: r.seatLabel ?? "",
          Slot: r.slotLabel ?? "",
          RegisteredAt: new Date(r.createdAt).toISOString(),
        }))
      );
      return new NextResponse(csv || "No registrations yet", {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${event.slug}-attendees.csv"`,
        },
      });
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
    return serverError(error, "Failed to load registrations");
  }
}

/**
 * PATCH /api/events/[slug]/registrations — bulk approval & attendance actions.
 * body: { ids: string[], action: "approve"|"reject"|"hold"|"cancel"|"check_in"|"undo_check_in"|"issue_ticket"|"mark_paid", notify?: boolean }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    const ids: string[] = body.ids ?? [];
    const action: string = body.action ?? "approve";
    if (ids.length === 0) return badRequest("Select at least one registration");

    const statusMap: Record<string, string> = {
      approve: "approved",
      reject: "rejected",
      hold: "on_hold",
      cancel: "cancelled",
    };

    let processed = 0;
    let ticketsIssued = 0;
    const touched: { name: string; email: string; phone?: string | null }[] = [];

    for (const id of ids) {
      const [reg] = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
      if (!reg || reg.eventId !== event.id) continue;

      const update: Partial<typeof registrations.$inferInsert> = { updatedAt: new Date() };

      if (statusMap[action]) {
        update.status = statusMap[action] as typeof reg.status;
      } else if (action === "check_in") {
        update.checkedIn = true;
        update.checkedInAt = new Date();
        update.checkedInBy = body.staffName ?? "Organiser console";
        if (!reg.checkedIn) {
          await db
            .update(events)
            .set({ totalCheckins: sql`${events.totalCheckins} + 1` })
            .where(eq(events.id, event.id));
        }
      } else if (action === "undo_check_in") {
        update.checkedIn = false;
        update.checkedInAt = null;
        if (reg.checkedIn) {
          await db
            .update(events)
            .set({ totalCheckins: sql`GREATEST(${events.totalCheckins} - 1, 0)` })
            .where(eq(events.id, event.id));
        }
      } else if (action === "mark_paid") {
        const price = reg.ticketTierId
          ? (await db.select().from(ticketTiers).where(eq(ticketTiers.id, reg.ticketTierId)).limit(1))[0]?.price
          : "0";
        update.paymentStatus = "paid";
        update.amountPaid = reg.amountPaid && parseFloat(reg.amountPaid) > 0 ? reg.amountPaid : String(price ?? "0");
      } else if (action === "issue_ticket") {
        if (reg.status !== "approved") update.status = "approved";
      } else if (action !== "notify") {
        return badRequest(`Unknown action: ${action}`);
      }

      const [updated] = await db
        .update(registrations)
        .set(update)
        .where(eq(registrations.id, id))
        .returning();
      processed++;

      const shouldIssue =
        (action === "mark_paid" || action === "issue_ticket" || action === "approve") &&
        updated.status === "approved" &&
        (updated.paymentStatus === "paid" || parseFloat(updated.amountPaid ?? "0") === 0);

      if (shouldIssue) {
        const before = updated.ticketIssuedAt;
        const issued = await issueTicket(updated);
        if (!before && issued.issued) ticketsIssued++;
        if (event.seatSelectionEnabled && !updated.seatId) {
          let tierName: string | null = null;
          if (updated.ticketTierId) {
            const [tier] = await db.select().from(ticketTiers).where(eq(ticketTiers.id, updated.ticketTierId)).limit(1);
            tierName = tier?.name ?? null;
          }
          await assignSeat(event.id, updated.id, tierName);
        }
      }

      if (["rejected", "cancelled"].includes(updated.status ?? "") && updated.seatId) {
        await releaseSeat(updated.id);
      }

      touched.push({ name: updated.attendeeName, email: updated.attendeeEmail, phone: updated.attendeePhone });
    }

    if (body.notify && touched.length > 0) {
      const label = action.replace(/_/g, " ");
      await logMessage({
        eventId: event.id,
        channel: body.channel ?? "email",
        audience: `bulk:${action}`,
        subject: body.subject ?? `${event.title}: registration ${label}`,
        body:
          body.message ??
          `An update about your registration for ${event.title}: your registration is now "${label}".`,
        recipients: touched,
        senderName: body.staffName ?? "UEB Organiser",
      });
    }

    return NextResponse.json({ processed, ticketsIssued, success: true });
  } catch (error) {
    return serverError(error, "Bulk action failed");
  }
}
