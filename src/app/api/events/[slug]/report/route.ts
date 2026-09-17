import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventFeedback, vendors, payments, checkinLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { badRequest, eventAnalytics, getEventBySlug, serverError } from "@/lib/server";
import { toCSV } from "@/lib/utils";

/**
 * GET /api/events/[slug]/report
 * Full event report: sales, attendance, check-in velocity, custom answers,
 * vendor and payment performance. `?format=csv&type=attendees|sales|checkins|feedback|vendors|payments`
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    const type = url.searchParams.get("type") ?? "summary";

    const analytics = await eventAnalytics(event.id);
    const feedback = await db
      .select()
      .from(eventFeedback)
      .where(eq(eventFeedback.eventId, event.id))
      .orderBy(desc(eventFeedback.submittedAt));
    const vendorRows = await db.select().from(vendors).where(eq(vendors.eventId, event.id));
    const paymentRows = await db.select().from(payments).where(eq(payments.eventId, event.id));
    const scans = await db
      .select()
      .from(checkinLogs)
      .where(eq(checkinLogs.eventId, event.id))
      .orderBy(desc(checkinLogs.scannedAt))
      .limit(500);

    const feedbackSummary = {
      responses: feedback.length,
      averageRating: feedback.length
        ? Math.round((feedback.reduce((s, f) => s + (f.rating ?? 0), 0) / feedback.filter((f) => f.rating).length || 0) * 10) / 10
        : 0,
      positive: feedback.filter((f) => (f.rating ?? 0) >= 4).length,
      promoters: feedback.filter((f) => (f.rating ?? 0) === 5).length,
    };

    if (format === "csv") {
      const datasets: Record<string, { rows: Record<string, unknown>[]; file: string }> = {
        attendees: {
          file: "attendees",
          rows: analytics.registrations.map((r) => ({
            Ticket: r.ticketNumber ?? "",
            Name: r.attendeeName,
            Email: r.attendeeEmail,
            Phone: r.attendeePhone ?? "",
            Organisation: r.organisation ?? "",
            Status: r.status,
            Payment: r.paymentStatus,
            AmountPaid: r.amountPaid ?? "0",
            Seat: r.seatLabel ?? "",
            Slot: r.slotLabel ?? "",
            CheckedIn: r.checkedIn ? "yes" : "no",
            CheckedInAt: r.checkedInAt ? new Date(r.checkedInAt).toISOString() : "",
          })),
        },
        sales: {
          file: "ticket-sales",
          rows: analytics.salesByTier.map((t) => ({
            Tier: t.name,
            Type: t.type,
            Price: t.price,
            Capacity: t.quantity ?? "unlimited",
            Sold: t.sold,
            Paid: t.paidCount,
            CheckedIn: t.checkedIn,
            Revenue: t.revenue,
            Remaining: t.remaining ?? "unlimited",
          })),
        },
        checkins: {
          file: "checkin-log",
          rows: scans.map((s) => ({
            Ticket: s.ticketNumber ?? "",
            Result: s.result,
            Method: s.method ?? "",
            Staff: s.staffName ?? "",
            ScannedAt: new Date(s.scannedAt).toISOString(),
          })),
        },
        feedback: {
          file: "feedback",
          rows: feedback.map((f) => ({
            Attendee: f.attendeeName ?? "",
            Rating: f.rating ?? "",
            Comment: f.comment ?? "",
            SubmittedAt: new Date(f.submittedAt).toISOString(),
          })),
        },
        vendors: {
          file: "vendors",
          rows: vendorRows.map((v) => ({
            Vendor: v.name,
            Category: v.category ?? "",
            Contact: v.contactName ?? "",
            Email: v.email ?? "",
            Stall: v.stallNumber ?? "",
            Status: v.status ?? "",
            Fee: v.fee ?? "0",
            Paid: v.amountPaid ?? "0",
          })),
        },
        payments: {
          file: "payments",
          rows: paymentRows.map((p) => ({
            Reference: p.reference,
            Provider: p.provider ?? "",
            Channel: p.channel ?? "",
            Amount: p.amount,
            Fee: p.feeAmount ?? "0",
            Net: p.netAmount ?? "0",
            Status: p.status ?? "",
            PaidAt: p.paidAt ? new Date(p.paidAt).toISOString() : "",
          })),
        },
      };

      const dataset = datasets[type] ?? datasets.attendees;
      const csv = toCSV(dataset.rows);
      return new NextResponse(csv || "No data yet", {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${event.slug}-${dataset.file}.csv"`,
        },
      });
    }

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        status: event.status,
        type: event.type,
        startDate: event.startDate,
        endDate: event.endDate,
        venue: event.venue,
        city: event.city,
        capacity: event.capacity,
        completedAt: event.completedAt,
      },
      totals: analytics.totals,
      statusCounts: analytics.statusCounts,
      paymentCounts: analytics.paymentCounts,
      salesByTier: analytics.salesByTier,
      registrationTimeline: analytics.registrationTimeline,
      checkinTimeline: analytics.checkinTimeline,
      customQuestionStats: analytics.customQuestionStats,
      feedback: { ...feedbackSummary, latest: feedback.slice(0, 10) },
      vendors: {
        total: vendorRows.length,
        confirmed: vendorRows.filter((v) => v.status === "confirmed" || v.status === "checked_in").length,
        fees: vendorRows.reduce((s, v) => s + parseFloat(v.fee ?? "0"), 0),
        collected: vendorRows.reduce((s, v) => s + parseFloat(v.amountPaid ?? "0"), 0),
      },
      payments: {
        transactions: paymentRows.length,
        settled: paymentRows.filter((p) => p.status === "successful").length,
        pending: paymentRows.filter((p) => p.status === "initialized").length,
        refunded: paymentRows.filter((p) => p.status === "refunded").length,
        failed: paymentRows.filter((p) => p.status === "failed").length,
      },
      checkinLog: scans.slice(0, 50),
    });
  } catch (error) {
    return serverError(error, "Failed to build report");
  }
}
