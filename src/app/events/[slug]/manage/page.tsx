"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  EVENT_CATEGORIES,
  MESSAGE_AUDIENCES,
  MESSAGE_CHANNELS,
  VENDOR_CATEGORIES,
  describeRecurrence,
  formatCurrency,
  formatDate,
  formatTime,
  getStatusColor,
} from "@/lib/utils";

/* ─── Types (mirror the API payloads) ─────────────────────── */
type EventT = {
  id: string; title: string; slug: string; status: string; type: string; category: string;
  description?: string | null; startDate?: string | null; endDate?: string | null;
  venue?: string | null; city?: string | null; capacity?: number | null;
  requiresApproval?: boolean | null; seatSelectionEnabled?: boolean | null;
  waitlistEnabled?: boolean | null; surveyUrl?: string | null; postEventMessage?: string | null;
  completedAt?: string | null; totalRegistrations?: number | null; totalRevenue?: string | null;
  recurrenceRule?: RecurrenceRuleT | null; customQuestions?: { id: string; label: string; type: string }[] | null;
};
type RecurrenceRuleT = {
  frequency: "daily" | "weekly" | "biweekly" | "monthly"; interval?: number; count?: number; until?: string | null;
  weekdays?: number[]; time?: string; durationMinutes?: number;
};
type Tier = {
  id: string; name: string; description?: string | null; type: string; price: string;
  quantity?: number | null; quantitySold?: number | null; groupSize?: number | null;
  isInvitationOnly?: boolean | null; accessCode?: string | null;
  soldLive?: number; checkedInLive?: number; remaining?: number | null;
};
type Reg = {
  id: string; attendeeName: string; attendeeEmail: string; attendeePhone?: string | null;
  organisation?: string | null; jobTitle?: string | null; status: string; paymentStatus: string;
  amountPaid?: string | null; ticketNumber?: string | null; checkedIn?: boolean | null;
  checkedInAt?: string | null; seatLabel?: string | null; slotLabel?: string | null;
  quantity?: number | null; groupId?: string | null; createdAt: string;
};
type Slot = { id: string; label?: string | null; startDate: string; endDate?: string | null; capacity?: number | null; booked?: number; remaining?: number | null; isActive?: boolean | null };
type Occurrence = { id: string; label?: string | null; startDate: string; endDate?: string | null; status?: string | null; capacity?: number | null };
type Seat = { id: string; label: string; rowName?: string | null; seatNumber?: number | null; status?: string | null; attendeeName?: string | null };
type Section = { id: string; name: string; rows?: number | null; seatsPerRow?: number | null; tierName?: string | null; color?: string | null; seats?: Seat[] };
type Vendor = {
  id: string; name: string; category?: string | null; contactName?: string | null;
  email?: string | null; phone?: string | null; stallNumber?: string | null;
  fee?: string | null; amountPaid?: string | null; status?: string | null; notes?: string | null;
};
type Message = { id: string; channel: string; audience: string; subject?: string | null; body: string; recipientCount?: number | null; sentAt: string; status?: string | null };
type WaitlistEntry = { id: string; name: string; email: string; phone?: string | null; status?: string | null; createdAt: string };
type Invitation = {
  id: string; name?: string | null; email: string; phone?: string | null; invitationCode?: string | null;
  maxGuests?: number | null; status?: string | null; sentAt?: string | null; registeredAt?: string | null;
};
type ConsoleData = {
  event: EventT;
  tiers: Tier[];
  registrations: Reg[];
  stats: {
    totalRegistrations: number; approved: number; pending: number; rejected: number; onHold: number;
    checkedIn: number; noShows: number; unpaid: number; totalRevenue: number; attendanceRate: number;
  };
  workspace: {
    slots: Slot[];
    occurrences: Occurrence[];
    seating: { enabled: boolean; sections: Section[]; summary: { totalSeats: number; assigned: number; available: number } };
    vendors: Vendor[];
    messages: Message[];
    feedback: { responses: number; averageRating: number };
    payments: { transactions: number; settled: number; pending: number; refunded: number };
    waitlist: { count: number; entries: WaitlistEntry[] };
  };
  organiser: { name: string; email: string; organisation?: string | null } | null;
};

type Tab = { id: string; label: string; icon: string };
const TABS: Tab[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "attendees", label: "Attendees", icon: "👥" },
  { id: "tickets", label: "Tickets", icon: "🎫" },
  { id: "invitations", label: "Invitations", icon: "💌" },
  { id: "schedule", label: "Schedule & Slots", icon: "🗓️" },
  { id: "seating", label: "Seating", icon: "🪑" },
  { id: "vendors", label: "Vendors", icon: "🏪" },
  { id: "comms", label: "Comms", icon: "📣" },
  { id: "reports", label: "Reports", icon: "🧾" },
  { id: "postevent", label: "Post-event", icon: "🏁" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const inputStyle: React.CSSProperties = { fontSize: "0.85rem", padding: "0.6rem 0.85rem" };
const labelStyle: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.03em", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" };

export default function ManageEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<ConsoleData | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const notify = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load event");
      setData(json);
      const inv = await fetch(`/api/events/${slug}/invitations`, { cache: "no-store" });
      if (inv.ok) setInvitations((await inv.json()).invitations ?? []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load", "err");
    } finally {
      setLoading(false);
    }
  }, [slug, notify]);

  useEffect(() => { load(); }, [load]);

  /** Small wrapper: run an async action with a busy key + toast reporting. */
  const run = useCallback(
    async (key: string, fn: () => Promise<string | void>, reload = true) => {
      setBusy(key);
      try {
        const msg = await fn();
        if (reload) await load();
        if (msg) notify(msg);
        return true;
      } catch (e) {
        notify(e instanceof Error ? e.message : "Something went wrong", "err");
        return false;
      } finally {
        setBusy("");
      }
    },
    [load, notify]
  );

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      return json;
    },
    []
  );

  if (loading) {
    return (
      <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
        <Navbar />
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-28 space-y-4">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 pt-40 text-center">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>😕</div>
          <h2 className="heading-2 mb-3" style={{ color: "var(--text-1)" }}>Event not found</h2>
          <Link href="/dashboard" className="btn btn-primary">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const { event, stats, workspace } = data;

  return (
    <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
      <Navbar />

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 anim-scaleIn px-5 py-3 rounded-2xl font-semibold text-sm flex items-center gap-2"
          style={{ background: toast.type === "ok" ? "var(--ink)" : "#DC2626", color: "#fff", boxShadow: "var(--shadow-xl)" }}
        >
          {toast.type === "ok" ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="pt-16 pb-0" style={{ background: "linear-gradient(150deg,#0A0A0F 0%,#1C1C2E 45%,#2D1B69 100%)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-10 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Link href="/dashboard" className="badge glass" style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)" }}>← Dashboard</Link>
                <span className="badge" style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}>
                  {EVENT_CATEGORIES.find(c => c.value === event.category)?.label ?? event.category}
                </span>
                <span className="badge" style={{ background: event.status === "published" ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.12)", color: event.status === "published" ? "#86EFAC" : "rgba(255,255,255,0.75)" }}>
                  {event.status}
                </span>
                {event.type !== "standard" && (
                  <span className="badge" style={{ background: "rgba(167,139,250,0.2)", color: "#DDD6FE" }}>{event.type}</span>
                )}
              </div>
              <h1 className="display-2 text-white" style={{ fontSize: "clamp(1.6rem,4vw,2.5rem)" }}>{event.title}</h1>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.88rem", marginTop: "0.4rem" }}>
                {formatDate(event.startDate)} · {event.venue ?? "Venue TBD"}, {event.city ?? "—"}
                {event.recurrenceRule ? ` · ${describeRecurrence(event.recurrenceRule)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/events/${event.slug}`} className="btn btn-ghost btn-sm">View page</Link>
              <Link href={`/events/${event.slug}/report`} className="btn btn-ghost btn-sm">Report</Link>
              <Link href={`/checkin?event=${event.id}&slug=${event.slug}`} className="btn btn-white btn-sm">Check-in desk</Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="shrink-0 px-4 py-3 rounded-t-xl font-semibold transition-all duration-200 flex items-center gap-2"
                style={{
                  fontSize: "0.82rem",
                  background: tab === t.id ? "var(--surface)" : "transparent",
                  color: tab === t.id ? "var(--text-1)" : "rgba(255,255,255,0.65)",
                }}
              >
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        {tab === "overview" && <Overview data={data} api={api} run={run} busy={busy} />}
        {tab === "attendees" && <Attendees data={data} api={api} run={run} busy={busy} />}
        {tab === "tickets" && <Tickets data={data} api={api} run={run} busy={busy} />}
        {tab === "invitations" && (
          <Invitations data={data} invitations={invitations} api={api} run={run} busy={busy} />
        )}
        {tab === "schedule" && <Schedule data={data} api={api} run={run} busy={busy} />}
        {tab === "seating" && <Seating data={data} api={api} run={run} busy={busy} />}
        {tab === "vendors" && <Vendors data={data} api={api} run={run} busy={busy} />}
        {tab === "comms" && <Comms data={data} api={api} run={run} busy={busy} />}
        {tab === "reports" && <Reports data={data} />}
        {tab === "postevent" && <PostEvent data={data} api={api} run={run} busy={busy} />}
      </div>
    </div>
  );
}

/* ─── Shared bits ─────────────────────────────────────────── */

type RunFn = (key: string, fn: () => Promise<string | void>, reload?: boolean) => Promise<boolean>;
type ApiFn = (path: string, init?: RequestInit) => Promise<Record<string, never> & Record<string, unknown>>;

function Card({ title, action, children, subtitle }: { title?: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-5 sm:p-6">
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            {title && <h3 className="font-bold" style={{ fontSize: "1rem", color: "var(--text-1)" }}>{title}</h3>}
            {subtitle && <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: "0.2rem" }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: string; label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="p-4 rounded-xl" style={{ background: "var(--surface)" }}>
      <div style={{ fontSize: "1.05rem" }}>{icon}</div>
      <div className="font-black" style={{ fontSize: "1.05rem", color, letterSpacing: "-0.02em", marginTop: "0.15rem" }}>{value}</div>
      <div style={{ fontSize: "0.68rem", color: "var(--text-3)", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-10">
      <div style={{ fontSize: "2.2rem", marginBottom: "0.5rem", opacity: 0.35 }}>{icon}</div>
      <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>{text}</p>
    </div>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress-track" style={{ flex: 1 }}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/* ─── Overview ────────────────────────────────────────────── */

function Overview({ data, api, run, busy }: { data: ConsoleData; api: ApiFn; run: RunFn; busy: string }) {
  const { event, stats, workspace } = data;
  const [seatMode, setSeatMode] = useState(!!event.seatSelectionEnabled);
  const [waitlistMode, setWaitlistMode] = useState(!!event.waitlistEnabled);

  const pendingCount = stats.pending;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon="📋" label="Registrations" value={stats.totalRegistrations} color="var(--violet-mid)" />
        <Stat icon="✅" label="Approved" value={stats.approved} color="var(--green)" />
        <Stat icon="⏳" label="Pending review" value={pendingCount} color="var(--amber)" />
        <Stat icon="📱" label="Checked in" value={stats.checkedIn} color="#0891B2" />
        <Stat icon="💰" label="Revenue" value={formatCurrency(stats.totalRevenue)} color="#B45309" />
        <Stat icon="📈" label="Attendance" value={`${stats.attendanceRate}%`} color={stats.attendanceRate > 70 ? "var(--green)" : "var(--amber)"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Needs your attention" subtitle="The queue that keeps the event moving">
            <div className="space-y-3">
              {[
                { label: "Registrations awaiting approval", value: pendingCount, href: "attendees", cta: "Review now", tone: "#FEF3C7" },
                { label: "Unpaid registrations", value: stats.unpaid, href: "attendees", cta: "See who", tone: "#FEE2E2" },
                { label: "Guests on the waitlist", value: workspace.waitlist.count, href: "attendees", cta: "View list", tone: "#EFF6FF" },
                { label: "No-shows after the doors opened", value: stats.noShows, href: "postevent", cta: "Follow up", tone: "#F1F5F9" },
                { label: "Payments still pending", value: workspace.payments.pending, href: "reports", cta: "Reconcile", tone: "#EDE9FE" },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3 p-3.5 rounded-xl" style={{ background: row.tone }}>
                  <span className="font-black" style={{ fontSize: "1.1rem", color: "var(--text-1)", minWidth: 32 }}>{row.value}</span>
                  <span className="flex-1" style={{ fontSize: "0.84rem", color: "var(--text-2)", fontWeight: 600 }}>{row.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Event configuration" subtitle="Switch capabilities on or off without leaving this page">
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-4 p-3.5 rounded-xl" style={{ background: "var(--surface)" }}>
                <span>
                  <span className="block font-bold" style={{ fontSize: "0.86rem", color: "var(--text-1)" }}>Require approval for registrations</span>
                  <span className="block" style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Guests join a review queue before tickets are issued</span>
                </span>
                <Toggle
                  checked={!!event.requiresApproval}
                  onChange={v => run("approval", async () => {
                    await api(`/api/events/${event.slug}`, { method: "PATCH", body: JSON.stringify({ requiresApproval: v }) });
                    return v ? "Approval workflow on" : "Approval workflow off";
                  })}
                />
              </label>

              <label className="flex items-center justify-between gap-4 p-3.5 rounded-xl" style={{ background: "var(--surface)" }}>
                <span>
                  <span className="block font-bold" style={{ fontSize: "0.86rem", color: "var(--text-1)" }}>Seat selection &amp; seating plan</span>
                  <span className="block" style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                    {workspace.seating.summary.totalSeats} seats configured · {workspace.seating.summary.assigned} assigned
                  </span>
                </span>
                <Toggle
                  checked={seatMode}
                  onChange={async v => {
                    setSeatMode(v);
                    await run("seats-toggle", async () => {
                      await api(`/api/events/${event.slug}/seating`, { method: "PATCH", body: JSON.stringify({ action: "toggle_selection", seatSelectionEnabled: v }) });
                      return v ? "Seating enabled" : "Seating disabled";
                    });
                  }}
                />
              </label>

              <label className="flex items-center justify-between gap-4 p-3.5 rounded-xl" style={{ background: "var(--surface)" }}>
                <span>
                  <span className="block font-bold" style={{ fontSize: "0.86rem", color: "var(--text-1)" }}>Waitlist when full</span>
                  <span className="block" style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Guests join a waitlist instead of being turned away at capacity</span>
                </span>
                <Toggle
                  checked={waitlistMode}
                  onChange={async v => {
                    setWaitlistMode(v);
                    await run("waitlist-toggle", async () => {
                      await api(`/api/events/${event.slug}`, { method: "PATCH", body: JSON.stringify({ waitlistEnabled: v }) });
                      return v ? "Waitlist enabled" : "Waitlist disabled";
                    });
                  }}
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  className="btn btn-outline btn-sm"
                  disabled={busy === "publish"}
                  onClick={() => run("publish", async () => {
                    const next = event.status === "published" ? "draft" : "published";
                    await api(`/api/events/${event.slug}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
                    return next === "published" ? "Event published" : "Event unpublished";
                  })}
                >
                  {event.status === "published" ? "Unpublish event" : "Publish event"}
                </button>
                <a className="btn btn-outline btn-sm" href={`/api/events/${event.slug}/registrations?format=csv`}>⬇ Attendee CSV</a>
                <a className="btn btn-outline btn-sm" href={`/api/events/${event.slug}/report?format=csv&type=sales`}>⬇ Sales CSV</a>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Live snapshot">
            <div className="space-y-3">
              {[
                { label: "Ticket types", value: data.tiers.length, icon: "🎫" },
                { label: "Time slots", value: workspace.slots.length, icon: "⏰" },
                { label: "Recurring sessions", value: workspace.occurrences.length, icon: "🔁" },
                { label: "Vendors", value: workspace.vendors.length, icon: "🏪" },
                { label: "Messages sent", value: workspace.messages.reduce((s, m) => s + (m.recipientCount ?? 0), 0), icon: "📣" },
                { label: "Feedback responses", value: workspace.feedback.responses, icon: "⭐" },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span style={{ fontSize: "0.84rem", color: "var(--text-2)" }}>{row.icon} {row.label}</span>
                  <span className="font-bold" style={{ fontSize: "0.88rem", color: "var(--text-1)" }}>{row.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Check-in desk" subtitle="Staff links for the venue">
            <div className="space-y-2">
              <Link href={`/checkin?event=${event.id}&slug=${event.slug}`} className="btn btn-primary w-full justify-center btn-sm">Open check-in desk</Link>
              <p style={{ fontSize: "0.74rem", color: "var(--text-3)", lineHeight: 1.6 }}>
                Staff scan or type ticket numbers, and every attempt lands in the scan audit log.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-track" />
    </span>
  );
}

/* ─── Attendees (approvals, attendance, payments) ─────────── */

function Attendees({ data, api, run, busy }: { data: ConsoleData; api: ApiFn; run: RunFn; busy: string }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const rows = useMemo(() => {
    const list = data.registrations ?? [];
    return list.filter(r => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [r.attendeeName, r.attendeeEmail, r.organisation, r.ticketNumber, r.seatLabel]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });
  }, [data.registrations, filter, search]);

  const allSelected = rows.length > 0 && selected.length === rows.length;

  const bulk = (action: string, notify = true, extra: Record<string, unknown> = {}) =>
    run(`bulk-${action}`, async () => {
      const res = await api(`/api/events/${data.event.slug}/registrations`, {
        method: "PATCH",
        body: JSON.stringify({ ids: selected, action, notify, ...extra }),
      });
      setSelected([]);
      return `${String(res.processed ?? selected.length)} attendee(s) updated${res.ticketsIssued ? ` · ${res.ticketsIssued} tickets issued` : ""}`;
    });

  const single = (id: string, body: Record<string, unknown>, msg: string) =>
    run(`row-${id}`, async () => {
      await api(`/api/registrations/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      return msg;
    });

  const remove = (reg: Reg) =>
    run(`del-${reg.id}`, async () => {
      if (!confirm(`Delete ${reg.attendeeName}'s registration?`)) return;
      await api(`/api/registrations/${reg.id}`, { method: "DELETE" });
      return "Registration deleted";
    });

  return (
    <div className="space-y-5">
      <Card
        title={`Attendees (${rows.length})`}
        subtitle="Search, approve in bulk, record payments and admit guests"
        action={
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-outline btn-sm" href={`/api/events/${data.event.slug}/registrations?format=csv`}>⬇ CSV</a>
            <button className="btn btn-outline btn-sm" onClick={() => run("refresh", async () => "Refreshed", false)}>⟳</button>
          </div>
        }
      >
        <div className="flex flex-col lg:flex-row gap-3 mb-4">
          <input className="input" style={inputStyle} placeholder="Search name, email, ticket, seat…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {[
              { value: "all", label: `All ${data.registrations.length}` },
              { value: "pending", label: `Pending ${data.stats.pending}` },
              { value: "approved", label: `Approved ${data.stats.approved}` },
              { value: "on_hold", label: `Hold ${data.stats.onHold}` },
              { value: "rejected", label: `Rejected ${data.stats.rejected}` },
            ].map(t => (
              <button
                key={t.value}
                onClick={() => setFilter(t.value)}
                className="shrink-0 px-3 py-1.5 rounded-lg font-semibold"
                style={{ fontSize: "0.74rem", background: filter === t.value ? "var(--violet-mid)" : "var(--surface)", color: filter === t.value ? "#fff" : "var(--text-2)" }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl mb-4" style={{ background: "var(--violet-bg)", border: "1px solid var(--violet-rim)" }}>
            <span className="font-bold" style={{ fontSize: "0.8rem", color: "var(--violet-low)" }}>{selected.length} selected</span>
            <button className="btn btn-sm" style={{ background: "#D1FAE5", color: "#065F46" }} disabled={busy.startsWith("bulk")} onClick={() => bulk("approve")}>✓ Approve + issue tickets</button>
            <button className="btn btn-sm" style={{ background: "#FEF3C7", color: "#92400E" }} disabled={busy.startsWith("bulk")} onClick={() => bulk("hold")}>⏸ Hold</button>
            <button className="btn btn-sm" style={{ background: "#FEE2E2", color: "#991B1B" }} disabled={busy.startsWith("bulk")} onClick={() => bulk("reject")}>✕ Reject</button>
            <button className="btn btn-sm" style={{ background: "#EFF6FF", color: "#1E40AF" }} disabled={busy.startsWith("bulk")} onClick={() => bulk("mark_paid")}>₦ Mark paid</button>
            <button className="btn btn-sm" style={{ background: "#F1F5F9", color: "#475569" }} disabled={busy.startsWith("bulk")} onClick={() => bulk("check_in", false)}>📱 Check in</button>
            <button className="btn btn-outline btn-sm" disabled={busy.startsWith("bulk")} onClick={() => bulk("approve", true)}>✉ Approve &amp; notify</button>
            <button className="btn btn-sm" style={{ background: "var(--surface-2)", color: "var(--text-3)" }} onClick={() => setSelected([])}>Clear</button>
          </div>
        )}

        {rows.length === 0 ? (
          <Empty icon="📭" text="No registrations match this view yet" />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0.4rem" }}>
                    <input type="checkbox" checked={allSelected} onChange={e => setSelected(e.target.checked ? rows.map(r => r.id) : [])} />
                  </th>
                  {["Attendee", "Ticket", "Payment", "Seat / Slot", "Status", "Actions"].map(h => (
                    <th key={h} style={{ ...labelStyle, marginBottom: 0, padding: "0.5rem 0.4rem" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.6rem 0.4rem" }}>
                      <input
                        type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={e => setSelected(s => (e.target.checked ? [...s, r.id] : s.filter(x => x !== r.id)))}
                      />
                    </td>
                    <td style={{ padding: "0.6rem 0.4rem", minWidth: 190 }}>
                      <div className="font-bold" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{r.attendeeName}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
                        {r.attendeeEmail}{r.organisation ? ` · ${r.organisation}` : ""}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem 0.4rem" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.74rem", color: "var(--text-2)" }}>{r.ticketNumber ?? "— not issued"}</span>
                      {r.quantity && r.quantity > 1 ? <span className="badge badge-violet ml-2" style={{ fontSize: "0.62rem" }}>group ×{r.quantity}</span> : null}
                    </td>
                    <td style={{ padding: "0.6rem 0.4rem" }}>
                      <span className={`badge ${getStatusColor(r.paymentStatus)}`} style={{ fontSize: "0.62rem" }}>{r.paymentStatus}</span>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "0.2rem" }}>{formatCurrency(parseFloat(r.amountPaid ?? "0"))}</div>
                    </td>
                    <td style={{ padding: "0.6rem 0.4rem", fontSize: "0.75rem", color: "var(--text-2)" }}>
                      {r.seatLabel ?? "—"}{r.slotLabel ? <div style={{ color: "var(--text-3)" }}>{r.slotLabel}</div> : null}
                    </td>
                    <td style={{ padding: "0.6rem 0.4rem" }}>
                      <span className={`badge ${getStatusColor(r.status)}`} style={{ fontSize: "0.62rem" }}>{r.status}</span>
                      {r.checkedIn ? <span className="badge badge-green ml-1" style={{ fontSize: "0.62rem" }}>✓ in</span> : null}
                    </td>
                    <td style={{ padding: "0.6rem 0.4rem" }}>
                      <div className="flex flex-wrap gap-1">
                        {r.status !== "approved" && (
                          <button title="Approve & issue ticket" className="w-7 h-7 rounded-lg font-bold text-xs" style={{ background: "#D1FAE5", color: "#065F46" }} onClick={() => single(r.id, { status: "approved" }, "Approved & ticket issued")}>✓</button>
                        )}
                        {r.status === "pending" && (
                          <button title="Hold" className="w-7 h-7 rounded-lg font-bold text-xs" style={{ background: "#FEF3C7", color: "#92400E" }} onClick={() => single(r.id, { status: "on_hold" }, "Put on hold")}>⏸</button>
                        )}
                        {r.status !== "rejected" && (
                          <button title="Reject" className="w-7 h-7 rounded-lg font-bold text-xs" style={{ background: "#FEE2E2", color: "#991B1B" }} onClick={() => single(r.id, { status: "rejected" }, "Rejected")}>✕</button>
                        )}
                        {r.paymentStatus !== "paid" && (
                          <button title="Mark as paid" className="w-7 h-7 rounded-lg font-bold text-xs" style={{ background: "#EFF6FF", color: "#1E40AF" }} onClick={() => single(r.id, { paymentStatus: "paid", amountPaid: r.amountPaid && parseFloat(r.amountPaid) > 0 ? r.amountPaid : "0" }, "Payment recorded")}>₦</button>
                        )}
                        <button
                          title={r.checkedIn ? "Undo check-in" : "Check in"}
                          className="w-7 h-7 rounded-lg font-bold text-xs"
                          style={{ background: r.checkedIn ? "var(--surface-2)" : "#E0F2FE", color: r.checkedIn ? "var(--text-3)" : "#0369A1" }}
                          onClick={() => single(r.id, { checkedIn: !r.checkedIn }, r.checkedIn ? "Check-in reversed" : "Checked in")}
                        >📱</button>
                        <button title="Email ticket / decision" className="w-7 h-7 rounded-lg font-bold text-xs" style={{ background: "var(--violet-bg)", color: "var(--violet-low)" }} onClick={() => run(`notify-${r.id}`, async () => {
                          await api(`/api/events/${data.event.slug}/messages`, {
                            method: "POST",
                            body: JSON.stringify({
                              channel: "email",
                              audience: "approved",
                              subject: `Your ticket for ${data.event.title}`,
                              body: r.ticketNumber
                                ? `Hello ${r.attendeeName}, your ticket ${r.ticketNumber} for ${data.event.title} is confirmed.`
                                : `Hello ${r.attendeeName}, here is an update about ${data.event.title}.`,
                            }),
                          });
                          return "Message queued";
                        })}>✉</button>
                        <button title="Delete" className="w-7 h-7 rounded-lg font-bold text-xs" style={{ background: "var(--surface-2)", color: "var(--text-3)" }} onClick={() => remove(r)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data.workspace.waitlist.count > 0 && (
        <Card title={`Waitlist (${data.workspace.waitlist.count})`} subtitle="Guests waiting for capacity to free up">
          <div className="space-y-2">
            {data.workspace.waitlist.entries.map(w => (
              <div key={w.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--surface)" }}>
                <div>
                  <div className="font-bold" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{w.name}</div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>{w.email}{w.phone ? ` · ${w.phone}` : ""}</div>
                </div>
                <span className="badge badge-gray" style={{ fontSize: "0.65rem" }}>{w.status ?? "waiting"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── Tickets ─────────────────────────────────────────────── */

function Tickets({ data, api, run, busy }: { data: ConsoleData; api: ApiFn; run: RunFn; busy: string }) {
  const [form, setForm] = useState({ name: "", type: "paid", price: "", quantity: "", groupSize: "1", isInvitationOnly: false, accessCode: "" });
  const [edits, setEdits] = useState<Record<string, { price?: string; quantity?: string }>>({});

  const save = (tier: Tier) =>
    run(`tier-${tier.id}`, async () => {
      const edit = edits[tier.id] ?? {};
      await api(`/api/events/${data.event.slug}/tiers`, {
        method: "PATCH",
        body: JSON.stringify({
          id: tier.id,
          ...(edit.price !== undefined ? { price: edit.price } : {}),
          ...(edit.quantity !== undefined ? { quantity: edit.quantity } : {}),
        }),
      });
      setEdits(e => ({ ...e, [tier.id]: {} }));
      return "Ticket type updated";
    });

  return (
    <div className="space-y-5">
      <Card title="Ticket types" subtitle="Pricing, inventory and invitation-only access">
        <div className="space-y-3">
          {data.tiers.map(t => {
            const sold = t.soldLive ?? t.quantitySold ?? 0;
            const total = t.quantity ?? null;
            return (
              <div key={t.id} className="p-4 rounded-xl" style={{ background: "var(--surface)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ fontSize: "0.9rem", color: "var(--text-1)" }}>{t.name}</span>
                      <span className="badge badge-violet" style={{ fontSize: "0.62rem" }}>{t.type.replace(/_/g, " ")}</span>
                      {t.isInvitationOnly ? <span className="badge badge-gold" style={{ fontSize: "0.62rem" }}>invite only</span> : null}
                      {t.groupSize && t.groupSize > 1 ? <span className="badge badge-blue" style={{ fontSize: "0.62rem" }}>group of {t.groupSize}</span> : null}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.2rem" }}>
                      {parseFloat(t.price ?? "0") === 0 ? "Free" : formatCurrency(parseFloat(t.price ?? "0"))}
                      {" · "}{sold} sold{total ? ` of ${total}` : ""}
                      {t.checkedInLive ? ` · ${t.checkedInLive} admitted` : ""}
                      {t.accessCode ? ` · code ${t.accessCode}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="input"
                      style={{ ...inputStyle, width: 110 }}
                      placeholder="Price ₦"
                      value={edits[t.id]?.price ?? ""}
                      onChange={e => setEdits(s => ({ ...s, [t.id]: { ...s[t.id], price: e.target.value } }))}
                    />
                    <input
                      className="input"
                      style={{ ...inputStyle, width: 110 }}
                      placeholder="Inventory"
                      value={edits[t.id]?.quantity ?? ""}
                      onChange={e => setEdits(s => ({ ...s, [t.id]: { ...s[t.id], quantity: e.target.value } }))}
                    />
                    <button className="btn btn-primary btn-sm" disabled={busy === `tier-${t.id}`} onClick={() => save(t)}>Save</button>
                    {sold === 0 && (
                      <button className="btn btn-sm" style={{ background: "#FEE2E2", color: "var(--red)" }} onClick={() => run(`tier-del-${t.id}`, async () => {
                        await api(`/api/events/${data.event.slug}/tiers?id=${t.id}`, { method: "DELETE" });
                        return "Ticket type removed";
                      })}>🗑</button>
                    )}
                  </div>
                </div>
                {total ? (
                  <div className="flex items-center gap-3 mt-3">
                    <Bar value={sold} max={total} color="linear-gradient(90deg,var(--violet),var(--violet-hi))" />
                    <span style={{ fontSize: "0.7rem", color: "var(--text-3)", minWidth: 90, textAlign: "right" }}>{Math.max(total - sold, 0)} remaining</span>
                  </div>
                ) : null}
              </div>
            );
          })}
          {data.tiers.length === 0 && <Empty icon="🎫" text="No ticket types yet" />}
        </div>
      </Card>

      <Card title="Add a ticket type" subtitle="Free, paid, VIP, early-bird, group or invitation-only">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label style={labelStyle}>Name</label>
            <input className="input" style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VIP table" />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select className="input" style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {["free", "paid", "vip", "early_bird", "group", "invitation_only"].map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Price (₦)</label>
            <input className="input" style={inputStyle} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <label style={labelStyle}>Inventory</label>
            <input className="input" style={inputStyle} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Unlimited" />
          </div>
          <div>
            <label style={labelStyle}>Group size</label>
            <input className="input" style={inputStyle} value={form.groupSize} onChange={e => setForm(f => ({ ...f, groupSize: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Access code (invite only)</label>
            <input className="input" style={inputStyle} value={form.accessCode} onChange={e => setForm(f => ({ ...f, accessCode: e.target.value.toUpperCase() }))} placeholder="VIP2027" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <label className="flex items-center gap-2" style={{ fontSize: "0.82rem", color: "var(--text-2)" }}>
            <input type="checkbox" checked={form.isInvitationOnly} onChange={e => setForm(f => ({ ...f, isInvitationOnly: e.target.checked }))} />
            Invitation only
          </label>
          <button
            className="btn btn-primary btn-sm"
            disabled={busy === "tier-new"}
            onClick={() => run("tier-new", async () => {
              await api(`/api/events/${data.event.slug}/tiers`, { method: "POST", body: JSON.stringify(form) });
              setForm({ name: "", type: "paid", price: "", quantity: "", groupSize: "1", isInvitationOnly: false, accessCode: "" });
              return "Ticket type added";
            })}
          >
            + Add ticket type
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ─── Invitations ─────────────────────────────────────────── */

function Invitations({ data, invitations, api, run, busy }: { data: ConsoleData; invitations: Invitation[]; api: ApiFn; run: RunFn; busy: string }) {
  const [raw, setRaw] = useState("");
  const [tierId, setTierId] = useState("");
  const [maxGuests, setMaxGuests] = useState("1");
  const [message, setMessage] = useState("");

  const parsed = useMemo(
    () =>
      raw
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean)
        .map(line => {
          const [name, email, phone] = line.split(",").map(p => (p ?? "").trim());
          return { name: name && name.includes("@") ? "" : name, email: (name && name.includes("@") ? name : email) ?? "", phone: phone ?? "" };
        })
        .filter(g => g.email?.includes("@")),
    [raw]
  );

  const summary = useMemo(() => ({
    total: invitations.length,
    sent: invitations.filter(i => ["sent", "opened", "registered"].includes(i.status ?? "")).length,
    registered: invitations.filter(i => i.status === "registered").length,
  }), [invitations]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat icon="💌" label="Invitations" value={summary.total} color="var(--violet-mid)" />
        <Stat icon="📤" label="Delivered" value={summary.sent} color="#0891B2" />
        <Stat icon="✅" label="Converted" value={summary.registered} color="var(--green)" />
      </div>

      <Card title="Invite guests" subtitle="One guest per line — name, email, phone">
        <textarea
          className="input"
          style={{ ...inputStyle, minHeight: 140, fontFamily: "inherit" }}
          placeholder={"Adaeze Okafor, adaeze@company.com, 08031234567\nTunde Bakare, tunde@company.com"}
          value={raw}
          onChange={e => setRaw(e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div>
            <label style={labelStyle}>Ticket type</label>
            <select className="input" style={inputStyle} value={tierId} onChange={e => setTierId(e.target.value)}>
              <option value="">Any / invitation-only</option>
              {data.tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Guests per invitation</label>
            <input className="input" style={inputStyle} value={maxGuests} onChange={e => setMaxGuests(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Personal note (optional)</label>
            <input className="input" style={inputStyle} value={message} onChange={e => setMessage(e.target.value)} placeholder="We'd love you to join us…" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
          <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{parsed.length} guest(s) parsed</span>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" disabled={parsed.length === 0 || busy === "invite-draft"} onClick={() => run("invite-draft", async () => {
              await api(`/api/events/${data.event.slug}/invitations`, {
                method: "POST",
                body: JSON.stringify({ guests: parsed, send: false, tierId: tierId || null, maxGuests }),
              });
              setRaw("");
              return "Invitations saved as drafts";
            })}>Save as drafts</button>
            <button className="btn btn-primary btn-sm" disabled={parsed.length === 0 || busy === "invite-send"} onClick={() => run("invite-send", async () => {
              const res = await api(`/api/events/${data.event.slug}/invitations`, {
                method: "POST",
                body: JSON.stringify({ guests: parsed, send: true, tierId: tierId || null, maxGuests, message: message || undefined }),
              });
              setRaw(""); setMessage("");
              return `${String(res.count ?? parsed.length)} invitation(s) sent`;
            })}>✉ Send invitations</button>
          </div>
        </div>
      </Card>

      <Card title="Guest list" subtitle="Invite codes, delivery status and conversions">
        {invitations.length === 0 ? (
          <Empty icon="💌" text="No invitations sent yet" />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  {["Guest", "Invite code", "Status", "Guests", "Actions"].map(h => (
                    <th key={h} style={{ ...labelStyle, marginBottom: 0, padding: "0.5rem 0.4rem", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.6rem 0.4rem" }}>
                      <div className="font-bold" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{inv.name ?? "—"}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{inv.email}</div>
                    </td>
                    <td style={{ padding: "0.6rem 0.4rem" }}>
                      <button
                        className="badge badge-violet"
                        style={{ fontFamily: "monospace", fontSize: "0.7rem", cursor: "pointer" }}
                        onClick={() => navigator.clipboard?.writeText(inv.invitationCode ?? "")}
                        title="Copy code"
                      >
                        {inv.invitationCode}
                      </button>
                    </td>
                    <td style={{ padding: "0.6rem 0.4rem" }}>
                      <span className={`badge ${inv.status === "registered" ? "badge-green" : inv.status === "opened" ? "badge-blue" : inv.status === "cancelled" ? "badge-red" : "badge-gray"}`} style={{ fontSize: "0.62rem" }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 0.4rem", fontSize: "0.78rem", color: "var(--text-2)" }}>{inv.maxGuests ?? 1}</td>
                    <td style={{ padding: "0.6rem 0.4rem" }}>
                      <div className="flex gap-1">
                        <button className="btn btn-outline btn-sm" onClick={() => run(`inv-resend-${inv.id}`, async () => {
                          await api(`/api/events/${data.event.slug}/invitations`, { method: "PATCH", body: JSON.stringify({ ids: [inv.id], action: "resend" }) });
                          return "Invitation re-sent";
                        })}>Resend</button>
                        <button className="btn btn-sm" style={{ background: "#FEE2E2", color: "var(--red)" }} onClick={() => run(`inv-del-${inv.id}`, async () => {
                          const res = await fetch(`/api/events/${data.event.slug}/invitations?id=${inv.id}`, { method: "DELETE" });
                          if (!res.ok) throw new Error("Could not remove invitation");
                          return "Invitation removed";
                        })}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Schedule: recurring series + appointment slots ──────── */

function Schedule({ data, api, run, busy }: { data: ConsoleData; api: ApiFn; run: RunFn; busy: string }) {
  const existing = data.event.recurrenceRule;
  const anchorDay = data.event.startDate ? new Date(data.event.startDate).getDay() : 3;
  const [rule, setRule] = useState<RecurrenceRuleT>({
    frequency: existing?.frequency ?? "weekly",
    interval: existing?.interval ?? 1,
    count: existing?.count ?? 8,
    until: existing?.until ?? "",
    weekdays: existing?.weekdays ?? [anchorDay],
    time: existing?.time ?? "09:00",
    durationMinutes: existing?.durationMinutes ?? 120,
  });
  const [slotForm, setSlotForm] = useState({ dates: "", startTime: "09:00", endTime: "17:00", durationMinutes: "30", capacity: "1" });

  const toggleDay = (d: number) =>
    setRule(r => ({ ...r, weekdays: r.weekdays?.includes(d) ? r.weekdays.filter(x => x !== d) : [...(r.weekdays ?? []), d] }));

  return (
    <div className="space-y-5">
      <Card title="Recurring series" subtitle="Expand the rule into dated sessions guests can book">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label style={labelStyle}>Repeats</label>
            <select className="input" style={inputStyle} value={rule.frequency} onChange={e => setRule(r => ({ ...r, frequency: e.target.value as RecurrenceRuleT["frequency"] }))}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Every</label>
            <input className="input" style={inputStyle} value={rule.interval ?? 1} onChange={e => setRule(r => ({ ...r, interval: parseInt(e.target.value || "1", 10) }))} />
          </div>
          <div>
            <label style={labelStyle}>Number of sessions</label>
            <input className="input" style={inputStyle} value={rule.count ?? 8} onChange={e => setRule(r => ({ ...r, count: parseInt(e.target.value || "1", 10) }))} />
          </div>
          <div>
            <label style={labelStyle}>Start time</label>
            <input type="time" className="input" style={inputStyle} value={rule.time ?? "09:00"} onChange={e => setRule(r => ({ ...r, time: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Session length (minutes)</label>
            <input className="input" style={inputStyle} value={rule.durationMinutes ?? 120} onChange={e => setRule(r => ({ ...r, durationMinutes: parseInt(e.target.value || "60", 10) }))} />
          </div>
          <div>
            <label style={labelStyle}>Ends by (optional)</label>
            <input type="date" className="input" style={inputStyle} value={rule.until ?? ""} onChange={e => setRule(r => ({ ...r, until: e.target.value }))} />
          </div>
        </div>

        <div className="mt-4">
          <label style={labelStyle}>Repeat on</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d, i) => (
              <button
                key={d}
                onClick={() => toggleDay(i)}
                className="px-3 py-1.5 rounded-lg font-semibold"
                style={{
                  fontSize: "0.75rem",
                  background: rule.weekdays?.includes(i) ? "var(--violet-mid)" : "var(--surface)",
                  color: rule.weekdays?.includes(i) ? "#fff" : "var(--text-2)",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button className="btn btn-primary btn-sm" disabled={busy === "gen-occurrences"} onClick={() => run("gen-occurrences", async () => {
            const res = await api(`/api/events/${data.event.slug}/occurrences`, {
              method: "POST",
              body: JSON.stringify({ rule: { ...rule, until: rule.until || null } }),
            });
            return `${String(res.count ?? 0)} session(s) scheduled — ${describeRecurrence(rule)}`;
          })}>🔁 Generate schedule</button>
          <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{describeRecurrence(rule)}</span>
        </div>

        <div className="mt-5 space-y-2">
          {data.workspace.occurrences.length === 0 ? (
            <Empty icon="🗓️" text="No sessions generated yet" />
          ) : (
            data.workspace.occurrences.map(o => (
              <div key={o.id} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: "var(--surface)" }}>
                <div>
                  <div className="font-bold" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{o.label ?? "Session"}</div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>{formatDate(o.startDate)} · {formatTime(o.startDate)}{o.endDate ? ` – ${formatTime(o.endDate)}` : ""}</div>
                </div>
                <button className="btn btn-sm" style={{ background: "#FEE2E2", color: "var(--red)" }} onClick={() => run(`occ-${o.id}`, async () => {
                  await api(`/api/events/${data.event.slug}/occurrences?id=${o.id}`, { method: "DELETE" });
                  return "Session removed";
                })}>✕</button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card title="Appointment / time-slot windows" subtitle="Guests pick a slot instead of a single start time">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label style={labelStyle}>Dates (comma separated)</label>
            <input className="input" style={inputStyle} placeholder="2027-03-15, 2027-03-16" value={slotForm.dates} onChange={e => setSlotForm(f => ({ ...f, dates: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Day starts</label>
            <input type="time" className="input" style={inputStyle} value={slotForm.startTime} onChange={e => setSlotForm(f => ({ ...f, startTime: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Day ends</label>
            <input type="time" className="input" style={inputStyle} value={slotForm.endTime} onChange={e => setSlotForm(f => ({ ...f, endTime: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Slot length (min)</label>
            <input className="input" style={inputStyle} value={slotForm.durationMinutes} onChange={e => setSlotForm(f => ({ ...f, durationMinutes: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Capacity per slot</label>
            <input className="input" style={inputStyle} value={slotForm.capacity} onChange={e => setSlotForm(f => ({ ...f, capacity: e.target.value }))} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn btn-primary btn-sm" disabled={busy === "gen-slots"} onClick={() => run("gen-slots", async () => {
            const dates = slotForm.dates.split(",").map(d => d.trim()).filter(Boolean);
            const res = await api(`/api/events/${data.event.slug}/slots`, {
              method: "POST",
              body: JSON.stringify({ dates, startTime: slotForm.startTime, endTime: slotForm.endTime, durationMinutes: slotForm.durationMinutes, capacity: slotForm.capacity }),
            });
            return `${String(res.count ?? 0)} slot(s) created`;
          })}>⏰ Generate slots</button>
          <button className="btn btn-outline btn-sm" onClick={() => run("slots-toggle", async () => {
            await api(`/api/events/${data.event.slug}/slots`, { method: "PATCH", body: JSON.stringify({ id: "__all__", isActive: true }) });
            return "All slots activated";
          })}>Activate all</button>
          <button className="btn btn-outline btn-sm" onClick={() => run("slots-off", async () => {
            await api(`/api/events/${data.event.slug}/slots`, { method: "PATCH", body: JSON.stringify({ id: "__all__", isActive: false }) });
            return "All slots paused";
          })}>Pause all</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-5">
          {data.workspace.slots.length === 0 ? (
            <div className="sm:col-span-3"><Empty icon="⏰" text="No time slots yet" /></div>
          ) : (
            data.workspace.slots.map(s => (
              <div key={s.id} className="p-3 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: s.isActive ? 1 : 0.55 }}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold" style={{ fontSize: "0.82rem", color: "var(--text-1)" }}>{formatDate(s.startDate)}</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>{s.label ?? formatTime(s.startDate)}</div>
                  </div>
                  <span className="badge badge-violet" style={{ fontSize: "0.62rem" }}>{s.booked ?? 0}/{s.capacity ?? 1}</span>
                </div>
                <div className="flex gap-1 mt-2">
                  <button className="btn btn-outline btn-sm" style={{ fontSize: "0.68rem" }} onClick={() => run(`slot-${s.id}`, async () => {
                    await api(`/api/events/${data.event.slug}/slots`, { method: "PATCH", body: JSON.stringify({ id: s.id, isActive: !s.isActive }) });
                    return s.isActive ? "Slot paused" : "Slot activated";
                  })}>{s.isActive ? "Pause" : "Activate"}</button>
                  <button className="btn btn-sm" style={{ fontSize: "0.68rem", background: "#FEE2E2", color: "var(--red)" }} onClick={() => run(`slot-del-${s.id}`, async () => {
                    await api(`/api/events/${data.event.slug}/slots?id=${s.id}`, { method: "DELETE" });
                    return "Slot removed";
                  })}>Remove</button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

/* ─── Seating ─────────────────────────────────────────────── */

function Seating({ data, api, run, busy }: { data: ConsoleData; api: ApiFn; run: RunFn; busy: string }) {
  const [form, setForm] = useState({ name: "Main Hall", rows: "5", seatsPerRow: "10", tierName: "" });
  const [assignTo, setAssignTo] = useState("");
  const { sections, summary } = data.workspace.seating;
  const unseated = (data.registrations ?? []).filter(r => r.status === "approved" && !r.seatLabel);

  const seatColor = (status?: string | null) =>
    status === "assigned" ? "#7C3AED" : status === "held" ? "#F59E0B" : status === "blocked" ? "#94A3B8" : "#E2E8F0";
  const seatText = (status?: string | null) => (status === "assigned" || status === "blocked" ? "#fff" : "var(--text-2)");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat icon="🪑" label="Seats configured" value={summary.totalSeats} color="var(--violet-mid)" />
        <Stat icon="✅" label="Assigned" value={summary.assigned} color="var(--green)" />
        <Stat icon="🟢" label="Still available" value={summary.available} color="#0891B2" />
      </div>

      <Card title="Seating plan" subtitle="Click a seat to block it, or assign it to a waiting attendee">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <select className="input" style={{ ...inputStyle, maxWidth: 280 }} value={assignTo} onChange={e => setAssignTo(e.target.value)}>
            <option value="">Assign next seat to…</option>
            {unseated.map(r => <option key={r.id} value={r.id}>{r.attendeeName}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" disabled={busy === "auto-assign"} onClick={() => run("auto-assign", async () => {
            const res = await api(`/api/events/${data.event.slug}/seating`, { method: "PATCH", body: JSON.stringify({ action: "auto_assign" }) });
            return `${String(res.assigned ?? 0)} seat(s) assigned`;
          })}>⚡ Auto-assign approved guests</button>
          <button className="btn btn-outline btn-sm" onClick={() => run("clear-seats", async () => {
            if (!confirm("Release every assigned seat?")) return;
            await api(`/api/events/${data.event.slug}/seating`, { method: "PATCH", body: JSON.stringify({ action: "clear_all" }) });
            return "All seats released";
          })}>Release all</button>
        </div>

        {sections.length === 0 ? (
          <Empty icon="🪑" text="No seating sections yet — create one below" />
        ) : (
          <div className="space-y-6">
            {sections.map(sec => (
              <div key={sec.id}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded" style={{ background: sec.color ?? "#7C3AED" }} />
                    <span className="font-bold" style={{ fontSize: "0.88rem", color: "var(--text-1)" }}>{sec.name}</span>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>
                      {sec.rows} rows × {sec.seatsPerRow}{sec.tierName ? ` · ${sec.tierName}` : ""}
                    </span>
                  </div>
                  <button className="btn btn-sm" style={{ background: "#FEE2E2", color: "var(--red)", fontSize: "0.7rem" }} onClick={() => run(`sec-del-${sec.id}`, async () => {
                    await api(`/api/events/${data.event.slug}/seating?id=${sec.id}`, { method: "DELETE" });
                    return "Section deleted";
                  })}>Delete section</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(sec.seats ?? []).map(seat => (
                    <button
                      key={seat.id}
                      title={`${seat.label}${seat.attendeeName ? ` · ${seat.attendeeName}` : ""}`}
                      onClick={() => run(`seat-${seat.id}`, async () => {
                        if (seat.status === "assigned") {
                          await api(`/api/events/${data.event.slug}/seating`, { method: "PATCH", body: JSON.stringify({ action: "release", seatId: seat.id }) });
                          return `Released ${seat.label}`;
                        }
                        if (assignTo) {
                          await api(`/api/events/${data.event.slug}/seating`, { method: "PATCH", body: JSON.stringify({ action: "assign", seatId: seat.id, registrationId: assignTo }) });
                          return `Assigned ${seat.label}`;
                        }
                        await api(`/api/events/${data.event.slug}/seating`, { method: "PATCH", body: JSON.stringify({ action: assignTo ? "assign" : seat.status === "blocked" ? "release" : "assign", seatId: seat.id }) });
                        return seat.status === "blocked" ? `Unblocked ${seat.label}` : `Blocked ${seat.label}`;
                      })}
                      className="w-9 h-9 rounded-lg font-bold transition-transform hover:scale-110"
                      style={{ fontSize: "0.6rem", background: seatColor(seat.status), color: seatText(seat.status), border: "1px solid rgba(0,0,0,0.05)" }}
                    >
                      {seat.rowName}{seat.seatNumber}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Add a section" subtitle="Rows are auto-labelled A, B, C… and seats numbered across each row">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label style={labelStyle}>Section name</label>
            <input className="input" style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Rows</label>
            <input className="input" style={inputStyle} value={form.rows} onChange={e => setForm(f => ({ ...f, rows: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Seats per row</label>
            <input className="input" style={inputStyle} value={form.seatsPerRow} onChange={e => setForm(f => ({ ...f, seatsPerRow: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Reserved for ticket type</label>
            <select className="input" style={inputStyle} value={form.tierName} onChange={e => setForm(f => ({ ...f, tierName: e.target.value }))}>
              <option value="">Any</option>
              {data.tiers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-primary btn-sm mt-4" disabled={busy === "new-section"} onClick={() => run("new-section", async () => {
          const res = await api(`/api/events/${data.event.slug}/seating`, { method: "POST", body: JSON.stringify(form) });
          return `${String(res.seats ?? 0)} seats created in ${form.name}`;
        })}>+ Create section</button>
      </Card>
    </div>
  );
}

/* ─── Vendors ─────────────────────────────────────────────── */

function Vendors({ data, api, run, busy }: { data: ConsoleData; api: ApiFn; run: RunFn; busy: string }) {
  const [form, setForm] = useState({ name: "", category: VENDOR_CATEGORIES[0], contactName: "", email: "", phone: "", stallNumber: "", fee: "", status: "invited" });
  const vendors = data.workspace.vendors;
  const fees = vendors.reduce((s, v) => s + parseFloat(v.fee ?? "0"), 0);
  const collected = vendors.reduce((s, v) => s + parseFloat(v.amountPaid ?? "0"), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon="🏪" label="Vendors" value={vendors.length} color="var(--violet-mid)" />
        <Stat icon="✅" label="Confirmed" value={vendors.filter(v => v.status === "confirmed" || v.status === "checked_in").length} color="var(--green)" />
        <Stat icon="₦" label="Fees billed" value={formatCurrency(fees)} color="#B45309" />
        <Stat icon="💰" label="Collected" value={formatCurrency(collected)} color="#0891B2" />
      </div>

      <Card title="Vendor & exhibitor roster" subtitle="Stall allocations, fees and payments">
        {vendors.length === 0 ? (
          <Empty icon="🏪" text="No vendors added yet" />
        ) : (
          <div className="space-y-2">
            {vendors.map(v => (
              <div key={v.id} className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl" style={{ background: "var(--surface)" }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ fontSize: "0.86rem", color: "var(--text-1)" }}>{v.name}</span>
                    {v.stallNumber ? <span className="badge badge-blue" style={{ fontSize: "0.6rem" }}>stall {v.stallNumber}</span> : null}
                  </div>
                  <div style={{ fontSize: "0.73rem", color: "var(--text-3)" }}>
                    {[v.category, v.contactName, v.email, v.phone].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <select
                  className="input"
                  style={{ ...inputStyle, width: 140 }}
                  value={v.status ?? "invited"}
                  onChange={e => run(`vendor-${v.id}`, async () => {
                    await api(`/api/vendors/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: e.target.value }) });
                    return "Vendor updated";
                  })}
                >
                  {["invited", "confirmed", "declined", "checked_in", "cancelled"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
                <input
                  className="input"
                  style={{ ...inputStyle, width: 110 }}
                  placeholder="Fee ₦"
                  defaultValue={v.fee ?? "0"}
                  onBlur={e => run(`vendor-fee-${v.id}`, async () => {
                    await api(`/api/vendors/${v.id}`, { method: "PATCH", body: JSON.stringify({ fee: e.target.value || "0" }) });
                    return "Fee updated";
                  })}
                />
                <input
                  className="input"
                  style={{ ...inputStyle, width: 110 }}
                  placeholder="Paid ₦"
                  defaultValue={v.amountPaid ?? "0"}
                  onBlur={e => run(`vendor-paid-${v.id}`, async () => {
                    await api(`/api/vendors/${v.id}`, { method: "PATCH", body: JSON.stringify({ amountPaid: e.target.value || "0" }) });
                    return "Payment updated";
                  })}
                />
                <button className="btn btn-sm" style={{ background: "#FEE2E2", color: "var(--red)" }} disabled={busy === `vendor-del-${v.id}`} onClick={() => run(`vendor-del-${v.id}`, async () => {
                  await api(`/api/vendors/${v.id}`, { method: "DELETE" });
                  return "Vendor removed";
                })}>✕</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Add a vendor" subtitle="Exhibitors, caterers, AV, security, sponsors…">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label style={labelStyle}>Name</label>
            <input className="input" style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Mama's Kitchen" />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select className="input" style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {VENDOR_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Stall number</label>
            <input className="input" style={inputStyle} value={form.stallNumber} onChange={e => setForm(f => ({ ...f, stallNumber: e.target.value }))} placeholder="A12" />
          </div>
          <div>
            <label style={labelStyle}>Contact person</label>
            <input className="input" style={inputStyle} value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input className="input" style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input className="input" style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Fee (₦)</label>
            <input className="input" style={inputStyle} value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} placeholder="50000" />
          </div>
        </div>
        <button className="btn btn-primary btn-sm mt-4" disabled={busy === "new-vendor"} onClick={() => run("new-vendor", async () => {
          await api(`/api/events/${data.event.slug}/vendors`, { method: "POST", body: JSON.stringify(form) });
          setForm({ name: "", category: VENDOR_CATEGORIES[0], contactName: "", email: "", phone: "", stallNumber: "", fee: "", status: "invited" });
          return "Vendor added";
        })}>+ Add vendor</button>
      </Card>
    </div>
  );
}

/* ─── Comms ───────────────────────────────────────────────── */

function Comms({ data, api, run, busy }: { data: ConsoleData; api: ApiFn; run: RunFn; busy: string }) {
  const [form, setForm] = useState({ channel: "email", audience: "approved", subject: "", body: "" });
  const [preview, setPreview] = useState<{ count: number; sample: { name: string; email: string }[] } | null>(null);

  const previewCount = () =>
    run("preview", async () => {
      const res = await api(`/api/events/${data.event.slug}/messages`, {
        method: "POST",
        body: JSON.stringify({ ...form, previewOnly: true }),
      });
      setPreview({ count: Number(res.recipientCount ?? 0), sample: (res.recipients as { name: string; email: string }[]) ?? [] });
      return `${String(res.recipientCount ?? 0)} recipient(s) match`;
    }, false);

  const send = () =>
    run("send", async () => {
      const res = await api(`/api/events/${data.event.slug}/messages`, { method: "POST", body: JSON.stringify(form) });
      setForm(f => ({ ...f, subject: "", body: "" }));
      setPreview(null);
      return `Sent to ${String(res.recipientCount ?? 0)} attendee(s)`;
    });

  const templates = [
    { label: "Reminder", subject: `Reminder: ${data.event.title}`, body: "This is a friendly reminder that the event is coming up. Please arrive 30 minutes early with your QR code ready." },
    { label: "Directions", subject: `Getting to ${data.event.title}`, body: `Here is how to find us at ${data.event.venue ?? "the venue"}. Save this message for the day.` },
    { label: "Ticket ready", subject: "Your ticket is ready", body: "Your ticket has been approved. Open your digital ticket and save the QR code to your phone." },
    { label: "Thank you", subject: `Thank you for attending ${data.event.title}`, body: "Thank you for joining us! We would love your feedback — reply to this message with your thoughts." },
  ];

  return (
    <div className="space-y-5">
      <Card title="Send an announcement" subtitle="Email, SMS or WhatsApp — to any segment of your guest list">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label style={labelStyle}>Channel</label>
            <select className="input" style={inputStyle} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
              {MESSAGE_CHANNELS.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label style={labelStyle}>Audience</label>
            <select className="input" style={inputStyle} value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}>
              {MESSAGE_AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label style={labelStyle}>Subject</label>
          <input className="input" style={inputStyle} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder={`About ${data.event.title}`} />
        </div>
        <div className="mt-3">
          <label style={labelStyle}>Message</label>
          <textarea className="input" style={{ ...inputStyle, minHeight: 120 }} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your announcement…" />
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {templates.map(t => (
            <button key={t.label} className="btn btn-outline btn-sm" style={{ fontSize: "0.7rem" }} onClick={() => setForm(f => ({ ...f, subject: t.subject, body: t.body }))}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button className="btn btn-outline btn-sm" disabled={busy === "preview"} onClick={previewCount}>👁 Preview audience</button>
          <button className="btn btn-primary btn-sm" disabled={!form.body.trim() || busy === "send"} onClick={send}>📣 Send now</button>
          {preview && (
            <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
              {preview.count} recipient(s){preview.sample.length ? ` · e.g. ${preview.sample.slice(0, 2).map(s => s.name || s.email).join(", ")}` : ""}
            </span>
          )}
        </div>
      </Card>

      <Card title="Communication history" subtitle="Every campaign sent from this event">
        {data.workspace.messages.length === 0 ? (
          <Empty icon="📣" text="No messages sent yet" />
        ) : (
          <div className="space-y-2">
            {data.workspace.messages.map(m => (
              <div key={m.id} className="p-3.5 rounded-xl" style={{ background: "var(--surface)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-violet" style={{ fontSize: "0.6rem" }}>{m.channel}</span>
                      <span className="font-bold truncate" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{m.subject ?? "(no subject)"}</span>
                    </div>
                    <p style={{ fontSize: "0.76rem", color: "var(--text-3)", marginTop: "0.25rem" }}>{m.body}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold" style={{ fontSize: "0.8rem", color: "var(--text-1)" }}>{m.recipientCount ?? 0} sent</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{formatDate(m.sentAt)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Reports ─────────────────────────────────────────────── */

function Reports({ data }: { data: ConsoleData }) {
  const { stats, event } = data;
  const maxTierSold = Math.max(1, ...data.tiers.map(t => t.soldLive ?? t.quantitySold ?? 0));

  return (
    <div className="space-y-5">
      <Card title="Event performance" subtitle="Live numbers, updated as guests register and arrive">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon="👥" label="Registrations" value={stats.totalRegistrations} color="var(--violet-mid)" />
          <Stat icon="✅" label="Approved" value={stats.approved} color="var(--green)" />
          <Stat icon="📱" label="Attended" value={stats.checkedIn} color="#0891B2" />
          <Stat icon="🚫" label="No-shows" value={stats.noShows} color="var(--amber)" />
          <Stat icon="💰" label="Gross revenue" value={formatCurrency(stats.totalRevenue)} color="#B45309" />
          <Stat icon="🏦" label="UEB fees (est.)" value={formatCurrency(Math.round(stats.totalRevenue * 0.08))} color="var(--text-2)" />
          <Stat icon="📈" label="Attendance rate" value={`${stats.attendanceRate}%`} color="var(--violet-mid)" />
          <Stat icon="💳" label="Payments settled" value={`${data.workspace.payments.settled}/${data.workspace.payments.transactions}`} color="#0891B2" />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Sales by ticket type">
          {data.tiers.length === 0 ? <Empty icon="🎫" text="No ticket types yet" /> : (
            <div className="space-y-4">
              {data.tiers.map(t => {
                const sold = t.soldLive ?? t.quantitySold ?? 0;
                return (
                  <div key={t.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{t.name}</span>
                      <span style={{ fontSize: "0.76rem", color: "var(--text-3)" }}>
                        {sold} sold · {formatCurrency(sold * parseFloat(t.price ?? "0"))}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Bar value={sold} max={maxTierSold} color="linear-gradient(90deg,var(--violet),var(--violet-hi))" />
                      <span style={{ fontSize: "0.7rem", color: "var(--text-3)", minWidth: 80, textAlign: "right" }}>
                        {t.checkedInLive ?? 0} admitted
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Attendance & status" subtitle="Where the guest list stands right now">
          <div className="space-y-3">
            {[
              { label: "Approved", value: stats.approved, color: "var(--green)" },
              { label: "Pending approval", value: stats.pending, color: "var(--amber)" },
              { label: "On hold", value: stats.onHold, color: "#0891B2" },
              { label: "Rejected", value: stats.rejected, color: "var(--red)" },
              { label: "Checked in", value: stats.checkedIn, color: "var(--violet-mid)" },
              { label: "Unpaid", value: stats.unpaid, color: "#B45309" },
              { label: "Waitlist", value: data.workspace.waitlist.count, color: "var(--text-2)" },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3">
                <span style={{ fontSize: "0.82rem", color: "var(--text-2)", minWidth: 140 }}>{row.label}</span>
                <Bar value={row.value} max={Math.max(1, stats.totalRegistrations)} color={row.color} />
                <span className="font-bold" style={{ fontSize: "0.82rem", color: "var(--text-1)", minWidth: 32, textAlign: "right" }}>{row.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Export reports" subtitle="CSV files ready for Excel, accounting or funder reporting">
        <div className="flex flex-wrap gap-2">
          {[
            { type: "attendees", label: "Attendee list" },
            { type: "sales", label: "Ticket sales" },
            { type: "checkins", label: "Check-in log" },
            { type: "feedback", label: "Feedback" },
            { type: "vendors", label: "Vendors" },
            { type: "payments", label: "Payments" },
          ].map(exp => (
            <a key={exp.type} className="btn btn-outline btn-sm" href={`/api/events/${event.slug}/report?format=csv&type=${exp.type}`}>
              ⬇ {exp.label}
            </a>
          ))}
          <Link className="btn btn-primary btn-sm" href={`/events/${event.slug}/report`}>Open full report →</Link>
        </div>
      </Card>

      {data.event.customQuestions && data.event.customQuestions.length > 0 && (
        <Card title="Custom question answers" subtitle="What attendees told you during registration">
          <div className="space-y-3">
            {data.event.customQuestions.map(q => {
              const answers = data.registrations
                .map(r => (r as unknown as { customAnswers?: Record<string, string> }).customAnswers?.[q.id])
                .filter((v): v is string => !!v);
              const top = answers.slice(0, 6);
              return (
                <div key={q.id} className="p-3.5 rounded-xl" style={{ background: "var(--surface)" }}>
                  <div className="font-bold" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{q.label}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
                    {answers.length} answer(s){top.length ? ` · ${top.join(" · ")}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── Post-event ──────────────────────────────────────────── */

function PostEvent({ data, api, run, busy }: { data: ConsoleData; api: ApiFn; run: RunFn; busy: string }) {
  const { event, stats, workspace } = data;
  const [surveyUrl, setSurveyUrl] = useState(event.surveyUrl ?? "");
  const [message, setMessage] = useState(event.postEventMessage ?? "");

  const checklist = [
    { label: "All registrations reviewed", done: stats.pending === 0 },
    { label: "Attendance captured at the door", done: stats.checkedIn > 0 },
    { label: "Payments reconciled", done: stats.unpaid === 0 },
    { label: "At least one message sent", done: workspace.messages.length > 0 },
    { label: "Survey link shared", done: !!event.surveyUrl },
    { label: "Event marked as completed", done: !!event.completedAt },
  ];
  const doneCount = checklist.filter(c => c.done).length;

  return (
    <div className="space-y-5">
      <Card title="Close-out checklist" subtitle={`${doneCount} of ${checklist.length} steps complete`}>
        <div className="space-y-2.5">
          {checklist.map(c => (
            <div key={c.label} className="flex items-center gap-3">
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center font-bold"
                style={{ fontSize: "0.7rem", background: c.done ? "#D1FAE5" : "var(--surface-2)", color: c.done ? "#065F46" : "var(--text-3)" }}
              >
                {c.done ? "✓" : "○"}
              </span>
              <span style={{ fontSize: "0.85rem", color: c.done ? "var(--text-2)" : "var(--text-1)", fontWeight: c.done ? 500 : 700 }}>{c.label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <button className="btn btn-primary btn-sm" disabled={busy === "complete"} onClick={() => run("complete", async () => {
            await api(`/api/events/${data.event.slug}/post-event`, { method: "POST", body: JSON.stringify({ action: "complete", message: message || undefined, surveyUrl: surveyUrl || undefined }) });
            return "Event marked completed";
          })}>🏁 Mark event completed</button>
          {event.completedAt && (
            <button className="btn btn-outline btn-sm" onClick={() => run("reopen", async () => {
              await api(`/api/events/${data.event.slug}/post-event`, { method: "POST", body: JSON.stringify({ action: "reopen" }) });
              return "Event re-opened";
            })}>Re-open event</button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => run("certificates", async () => {
            const res = await api(`/api/events/${data.event.slug}/post-event`, { method: "POST", body: JSON.stringify({ action: "issue_certificates" }) });
            return `${String(res.certified ?? 0)} certificates queued`;
          })}>🎓 Queue certificates</button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Thank-you & follow-up messages" subtitle="Send the post-event sequence in one click">
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Survey / feedback link</label>
              <input className="input" style={inputStyle} value={surveyUrl} onChange={e => setSurveyUrl(e.target.value)} placeholder="https://forms.example.com/ueb-feedback" />
            </div>
            <div>
              <label style={labelStyle}>Post-event note (shown on the event page)</label>
              <textarea className="input" style={{ ...inputStyle, minHeight: 90 }} value={message} onChange={e => setMessage(e.target.value)} placeholder="Thank you for making this event unforgettable…" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary btn-sm" disabled={busy === "thanks"} onClick={() => run("thanks", async () => {
                const res = await api(`/api/events/${data.event.slug}/post-event`, {
                  method: "POST",
                  body: JSON.stringify({ action: "announce", audience: "approved", message: message || undefined, surveyUrl: surveyUrl || undefined }),
                });
                await api(`/api/events/${data.event.slug}`, { method: "PATCH", body: JSON.stringify({ postEventMessage: message, surveyUrl }) });
                return `Thank-you sent to ${String(res.recipientCount ?? 0)} attendee(s)`;
              })}>💌 Send thank-you</button>
              <button className="btn btn-outline btn-sm" disabled={!surveyUrl || busy === "survey"} onClick={() => run("survey", async () => {
                const res = await api(`/api/events/${data.event.slug}/post-event`, {
                  method: "POST",
                  body: JSON.stringify({ action: "survey", audience: "approved", surveyUrl }),
                });
                return `Survey link sent to ${String(res.recipientCount ?? 0)} attendee(s)`;
              })}>⭐ Send survey</button>
              <button className="btn btn-outline btn-sm" disabled={busy === "followup"} onClick={() => run("followup", async () => {
                const res = await api(`/api/events/${data.event.slug}/post-event`, {
                  method: "POST",
                  body: JSON.stringify({ action: "follow_up", audience: "not_checked_in" }),
                });
                return `Follow-up sent to ${String(res.recipientCount ?? 0)} no-show(s)`;
              })}>🤝 Follow up no-shows</button>
            </div>
          </div>
        </Card>

        <Card title="Feedback" subtitle={workspace.feedback.responses > 0 ? `${workspace.feedback.responses} response(s) · average ${workspace.feedback.averageRating}/5` : "No responses yet"}>
          {workspace.feedback.responses === 0 ? (
            <Empty icon="⭐" text="Share the survey link to start collecting feedback" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: "1.8rem" }}>{"★".repeat(Math.round(workspace.feedback.averageRating))}{"☆".repeat(5 - Math.round(workspace.feedback.averageRating))}</span>
                <span className="font-black" style={{ fontSize: "1.2rem", color: "var(--text-1)" }}>{workspace.feedback.averageRating}</span>
              </div>
              <Link className="btn btn-outline btn-sm" href={`/api/events/${event.slug}/report?format=csv&type=feedback`}>⬇ Feedback CSV</Link>
            </div>
          )}
        </Card>
      </div>

      {stats.noShows > 0 && (
        <Card title={`No-shows (${stats.noShows})`} subtitle="Approved guests who never scanned in">
          <div className="flex flex-wrap gap-2">
            {data.registrations.filter(r => r.status === "approved" && !r.checkedIn).slice(0, 30).map(r => (
              <span key={r.id} className="badge badge-gray" style={{ fontSize: "0.68rem" }}>{r.attendeeName}</span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
