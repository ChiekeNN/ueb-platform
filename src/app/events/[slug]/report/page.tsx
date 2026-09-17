"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

type TierSale = { id: string; name: string; type: string; price: number; quantity?: number | null; sold: number; paidCount: number; checkedIn: number; revenue: number; remaining?: number | null };
type Timeline = { date: string; count: number }[];
type QuestionStat = { id: string; label: string; answered: number; topAnswers: { value: string; count: number }[] };
type Report = {
  event: { id: string; title: string; slug: string; status: string; type: string; startDate?: string | null; endDate?: string | null; venue?: string | null; city?: string | null; capacity?: number | null; completedAt?: string | null };
  totals: {
    registrations: number; approved: number; pending: number; checkedIn: number; noShows: number; cancelled: number;
    revenue: number; uebFees: number; organiserNet: number; attendanceRate: number; approvalRate: number;
    messagesSent: number; vendors: number; vendorRevenue: number;
  };
  statusCounts: Record<string, number>;
  paymentCounts: Record<string, number>;
  salesByTier: TierSale[];
  registrationTimeline: Timeline;
  checkinTimeline: Timeline;
  customQuestionStats: QuestionStat[];
  feedback: { responses: number; averageRating: number; positive: number; promoters: number; latest: { id: string; attendeeName?: string | null; rating?: number | null; comment?: string | null; submittedAt: string }[] };
  vendors: { total: number; confirmed: number; fees: number; collected: number };
  payments: { transactions: number; settled: number; pending: number; refunded: number; failed: number };
  checkinLog: { id: string; ticketNumber?: string | null; result: string; method?: string | null; staffName?: string | null; scannedAt: string }[];
};

export default function EventReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}/report`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load report");
      setReport(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
        <Navbar />
        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-28 space-y-4">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 pt-40 text-center">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📉</div>
          <h2 className="heading-2 mb-3" style={{ color: "var(--text-1)" }}>{error || "Report unavailable"}</h2>
          <Link href="/dashboard" className="btn btn-primary">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const { event, totals, salesByTier, registrationTimeline, checkinTimeline, feedback, vendors, payments, customQuestionStats, checkinLog } = report;
  const maxRegistration = Math.max(1, ...registrationTimeline.map(t => t.count));
  const maxCheckin = Math.max(1, ...checkinTimeline.map(t => t.count));
  const maxSold = Math.max(1, ...salesByTier.map(t => t.sold));

  return (
    <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
      <Navbar />

      {/* Header */}
      <div className="pt-16" style={{ background: "linear-gradient(150deg,#0A0A0F 0%,#1C1C2E 45%,#2D1B69 100%)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-12 pb-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="badge glass" style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>Event report</span>
            <span className="badge" style={{ background: event.completedAt ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.12)", color: event.completedAt ? "#86EFAC" : "rgba(255,255,255,0.75)" }}>
              {event.completedAt ? "completed" : event.status}
            </span>
            <span className="badge" style={{ background: "rgba(167,139,250,0.2)", color: "#DDD6FE" }}>{event.type}</span>
          </div>
          <h1 className="display-2 text-white" style={{ fontSize: "clamp(1.7rem,4vw,2.6rem)" }}>{event.title}</h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            {formatDate(event.startDate)} · {event.venue ?? "Venue TBD"}, {event.city ?? "—"}
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            <Link href={`/events/${event.slug}/manage`} className="btn btn-white btn-sm">Organiser console</Link>
            <a href={`/api/events/${event.slug}/report?format=csv&type=attendees`} className="btn btn-ghost btn-sm">⬇ Attendees</a>
            <a href={`/api/events/${event.slug}/report?format=csv&type=sales`} className="btn btn-ghost btn-sm">⬇ Sales</a>
            <button onClick={() => window.print()} className="btn btn-ghost btn-sm">🖨 Print / PDF</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: "👥", label: "Registrations", value: totals.registrations, color: "var(--violet-mid)" },
            { icon: "✅", label: "Approved", value: totals.approved, color: "var(--green)" },
            { icon: "📱", label: "Attended", value: totals.checkedIn, color: "#0891B2" },
            { icon: "🚫", label: "No-shows", value: totals.noShows, color: "var(--amber)" },
            { icon: "💰", label: "Gross revenue", value: formatCurrency(totals.revenue), color: "#B45309" },
            { icon: "📈", label: "Attendance rate", value: `${totals.attendanceRate}%`, color: "var(--violet-mid)" },
          ].map(k => (
            <div key={k.label} className="card p-4 text-center">
              <div style={{ fontSize: "1.2rem" }}>{k.icon}</div>
              <div className="font-black" style={{ fontSize: "1.1rem", color: k.color, letterSpacing: "-0.02em", marginTop: "0.15rem" }}>{k.value}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-3)", fontWeight: 600 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Money */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card p-6 lg:col-span-2">
            <h3 className="font-bold mb-5" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Ticket sales by type</h3>
            {salesByTier.length === 0 ? (
              <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>No ticket types configured.</p>
            ) : (
              <div className="space-y-4">
                {salesByTier.map(t => (
                  <div key={t.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold" style={{ fontSize: "0.86rem", color: "var(--text-1)" }}>
                        {t.name} <span style={{ fontWeight: 500, color: "var(--text-3)" }}>· {t.price === 0 ? "Free" : formatCurrency(t.price)}</span>
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
                        {t.sold} sold · {formatCurrency(t.revenue)} · {t.checkedIn} admitted
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${Math.min(100, Math.round((t.sold / maxSold) * 100))}%`, background: "linear-gradient(90deg,var(--violet),var(--violet-hi))" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-bold mb-5" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Money movement</h3>
            <div className="space-y-3">
              {[
                { label: "Gross revenue", value: formatCurrency(totals.revenue) },
                { label: "UEB fees (8% + ₦100)", value: `− ${formatCurrency(totals.uebFees)}` },
                { label: "Organiser net", value: formatCurrency(totals.organiserNet) },
                { label: "Vendor fees billed", value: formatCurrency(vendors.fees) },
                { label: "Vendor payments collected", value: formatCurrency(vendors.collected) },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span style={{ fontSize: "0.83rem", color: "var(--text-2)" }}>{row.label}</span>
                  <span className="font-bold" style={{ fontSize: "0.86rem", color: "var(--text-1)" }}>{row.value}</span>
                </div>
              ))}
              <div className="divider-gradient" />
              <div className="flex items-center justify-between">
                <span style={{ fontSize: "0.83rem", color: "var(--text-2)" }}>Transactions</span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
                  {payments.settled} settled · {payments.pending} pending · {payments.failed} failed · {payments.refunded} refunded
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Timelines */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-6">
            <h3 className="font-bold mb-5" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Registrations over time</h3>
            {registrationTimeline.length === 0 ? (
              <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>No registrations yet.</p>
            ) : (
              <div className="flex items-end gap-1.5" style={{ height: 140 }}>
                {registrationTimeline.map(t => (
                  <div key={t.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${t.date}: ${t.count}`}>
                    <span style={{ fontSize: "0.62rem", color: "var(--text-3)" }}>{t.count}</span>
                    <div style={{ width: "100%", height: `${Math.max(4, (t.count / maxRegistration) * 100)}%`, background: "linear-gradient(180deg,var(--violet-hi),var(--violet))", borderRadius: 6 }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-bold mb-5" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Check-in velocity</h3>
            {checkinTimeline.length === 0 ? (
              <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>No check-ins recorded yet.</p>
            ) : (
              <div className="flex items-end gap-1.5" style={{ height: 140 }}>
                {checkinTimeline.map(t => (
                  <div key={t.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${t.date}: ${t.count}`}>
                    <span style={{ fontSize: "0.62rem", color: "var(--text-3)" }}>{t.count}</span>
                    <div style={{ width: "100%", height: `${Math.max(4, (t.count / maxCheckin) * 100)}%`, background: "linear-gradient(180deg,#4ADE80,#059669)", borderRadius: 6 }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Feedback + questions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-6">
            <h3 className="font-bold mb-2" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Attendee feedback</h3>
            {feedback.responses === 0 ? (
              <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>No responses collected yet — send the survey from the console.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span style={{ fontSize: "1.6rem" }}>{"★".repeat(Math.round(feedback.averageRating))}{"☆".repeat(Math.max(0, 5 - Math.round(feedback.averageRating)))}</span>
                  <span className="font-black" style={{ fontSize: "1.15rem", color: "var(--text-1)" }}>{feedback.averageRating}/5</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{feedback.responses} response(s) · {feedback.promoters} 5-star</span>
                </div>
                <div className="space-y-3">
                  {feedback.latest.filter(f => f.comment).slice(0, 5).map(f => (
                    <div key={f.id} className="p-3.5 rounded-xl" style={{ background: "var(--surface)" }}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold" style={{ fontSize: "0.82rem", color: "var(--text-1)" }}>{f.attendeeName ?? "Attendee"}</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{f.rating ? "★".repeat(f.rating) : ""}</span>
                      </div>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-2)", marginTop: "0.25rem", lineHeight: 1.6 }}>{f.comment}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-bold mb-5" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Custom registration answers</h3>
            {customQuestionStats.length === 0 ? (
              <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>This event did not collect custom information.</p>
            ) : (
              <div className="space-y-4">
                {customQuestionStats.map(q => (
                  <div key={q.id}>
                    <div className="font-bold mb-2" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{q.label}</div>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-3)", marginBottom: "0.4rem" }}>{q.answered} answer(s)</div>
                    <div className="flex flex-wrap gap-2">
                      {q.topAnswers.map(a => (
                        <span key={a.value} className="badge badge-violet" style={{ fontSize: "0.68rem" }}>{a.value} · {a.count}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Check-in log */}
        <div className="card p-6">
          <h3 className="font-bold mb-5" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Recent scan log</h3>
          {checkinLog.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>No scans recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {checkinLog.slice(0, 12).map(log => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--surface)" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-2)" }}>{log.ticketNumber ?? "—"}</span>
                  <span className={`badge ${log.result === "VALID" ? "badge-green" : log.result === "ALREADY_USED" ? "badge-amber" : "badge-red"}`} style={{ fontSize: "0.62rem" }}>{log.result}</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{formatTime(log.scannedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
