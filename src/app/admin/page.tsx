"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import NotificationBell from "@/components/NotificationBell";
import { useSession } from "@/components/SessionProvider";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

/**
 * Admin dashboard — platform admin only.
 *
 * Three jobs, in priority order:
 *   1. **Applications** — approve or decline organisers. Nothing else in UEB
 *      can grant organiser powers, so this is the gate the whole platform
 *      depends on, and it sits at the top of the page with an unread-style
 *      count on its tab.
 *   2. **Overview** — users, events, registrations and money across UEB.
 *   3. **Organisers** — everyone who has an application or an organiser role.
 *
 * The notification bell in the header is the platform feed: applications,
 * signups, event submissions, registrations, payments and refunds.
 */

type Overview = {
  users: { total: number; organisers: number; admins: number; pendingApplications: number; approvedOrganisers: number; rejected: number };
  events: { total: number; published: number; drafts: number; completed: number; cancelled: number };
  registrations: { total: number; pending: number; approved: number; checkedIn: number };
  payments: { transactions: number; settled: number; refunded: number; failed: number; gross: number; uebRevenue: number };
  queue: QueueItem[];
  organisers: OrganiserRow[];
};

type QueueItem = {
  id: string;
  organisationName: string;
  organisationType: string | null;
  city: string | null;
  about: string | null;
  expectedEventsPerYear: string | null;
  createdAt: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
};

type OrganiserRow = {
  id: string; name: string; email: string; organisation: string | null;
  status: string; role: string; hosted: number; createdAt: string;
};

type Application = {
  id: string; userId: string; applicantName: string; applicantEmail: string;
  organisationName: string; organisationType: string | null; website: string | null;
  phone: string | null; city: string | null; country: string | null; about: string | null;
  expectedEventsPerYear: string | null; status: string; reviewNote: string | null;
  reviewedAt: string | null; createdAt: string;
};

const TABS = [
  { value: "applications", label: "Applications" },
  { value: "overview", label: "Overview" },
  { value: "organisers", label: "Organisers" },
];

export default function AdminPage() {
  const router = useRouter();
  const session = useSession();
  const [tab, setTab] = useState("applications");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async (status = statusFilter) => {
    try {
      const [overviewRes, appsRes] = await Promise.all([
        fetch("/api/admin/overview", { cache: "no-store" }),
        fetch(`/api/organiser-applications?status=${status}`, { cache: "no-store" }),
      ]);
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (appsRes.ok) setApplications((await appsRes.json()).applications ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Gate: only a platform admin may be here.
  useEffect(() => {
    if (session.loading) return;
    if (!session.user) router.replace("/login?next=/admin");
    else if (!session.isAdmin) router.replace("/dashboard");
  }, [session.loading, session.user, session.isAdmin, router]);

  useEffect(() => {
    if (!session.isAdmin) return;
    void load(statusFilter);
  }, [session.isAdmin, statusFilter, load]);

  const decide = async (application: Application, action: "approve" | "reject") => {
    if (action === "reject" && !notes[application.id]?.trim()) {
      showToast("Add a short reason so the applicant knows what to fix.", "err");
      return;
    }
    setBusy(application.id);
    try {
      const res = await fetch(`/api/organiser-applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: notes[application.id] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not record the decision");
      showToast(`${application.applicantName} ${action === "approve" ? "approved as an organiser" : "was declined"}`);
      await load(statusFilter);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not record the decision", "err");
    } finally {
      setBusy(null);
    }
  };

  if (session.loading || (!session.isAdmin && !session.user)) {
    return (
      <div className="min-h-dvh" style={{ background: "var(--surface)" }}>
        <Navbar />
        <div className="max-w-3xl mx-auto px-5 pt-32 text-center" style={{ color: "var(--text-3)" }}>Checking your access…</div>
      </div>
    );
  }

  const pendingCount = overview?.users.pendingApplications ?? 0;

  return (
    <div className="min-h-dvh" style={{ background: "var(--surface)" }}>
      <Navbar />

      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-24 pb-16">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div>
            <p className="label-caps mb-1" style={{ color: "var(--violet-mid)" }}>Platform administration</p>
            <h1 className="heading-1" style={{ fontSize: "1.9rem" }}>Admin dashboard</h1>
            <p className="mt-1" style={{ fontSize: "0.88rem", color: "var(--text-3)" }}>
              Signed in as {session.user?.name} · approvals, platform health and notifications.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button className="btn btn-outline btn-sm" onClick={() => load(statusFilter)}>↻ Refresh</button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {[
            { label: "Pending applications", value: pendingCount, accent: pendingCount > 0 ? "var(--amber)" : "var(--text-3)", icon: "📝" },
            { label: "Approved organisers", value: overview?.users.approvedOrganisers ?? 0, accent: "var(--green)", icon: "🎪" },
            { label: "Registered accounts", value: overview?.users.total ?? 0, accent: "var(--violet-mid)", icon: "👥" },
            { label: "UEB fee revenue", value: formatCurrency(overview?.payments.uebRevenue ?? 0), accent: "var(--gold)", icon: "💰" },
          ].map((stat) => (
            <div key={stat.label} className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: "1.1rem" }}>{stat.icon}</span>
              </div>
              <p className="font-black" style={{ fontSize: "1.5rem", color: stat.accent, letterSpacing: "-0.03em" }}>{stat.value}</p>
              <p style={{ fontSize: "0.76rem", color: "var(--text-3)", fontWeight: 600 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-2xl w-fit" style={{ background: "var(--surface-2)" }}>
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className="px-4 py-2 rounded-xl font-bold transition-all"
              style={{
                fontSize: "0.82rem",
                background: tab === t.value ? "#fff" : "transparent",
                color: tab === t.value ? "var(--violet-mid)" : "var(--text-2)",
                boxShadow: tab === t.value ? "var(--shadow-sm)" : "none",
              }}
            >
              {t.label}
              {t.value === "applications" && pendingCount > 0 && (
                <span className="badge badge-amber ml-2" style={{ fontSize: "0.6rem" }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Applications ─────────────────────────────────────── */}
        {tab === "applications" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {["pending", "approved", "rejected", "all"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className="btn btn-sm"
                  style={{
                    background: statusFilter === status ? "var(--violet)" : "#fff",
                    color: statusFilter === status ? "#fff" : "var(--text-2)",
                    border: "1.5px solid var(--border)",
                  }}
                >
                  {status[0].toUpperCase() + status.slice(1)}
                </button>
              ))}
              <span className="ml-auto" style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
                {applications.length} {applications.length === 1 ? "application" : "applications"}
              </span>
            </div>

            {loading ? (
              <div className="card p-8 text-center" style={{ color: "var(--text-3)" }}>Loading applications…</div>
            ) : applications.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="font-bold" style={{ color: "var(--text-1)" }}>
                  {statusFilter === "pending" ? "No applications waiting" : `No ${statusFilter} applications`}
                </p>
                <p className="mt-1" style={{ fontSize: "0.84rem", color: "var(--text-3)" }}>
                  New organiser requests land here and ring the bell.
                </p>
              </div>
            ) : (
              applications.map((application) => {
                const open = expanded === application.id;
                return (
                  <div key={application.id} className="card p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center font-black shrink-0"
                          style={{ background: "linear-gradient(135deg,#7C3AED,#4C1D95)", color: "#fff", fontSize: "0.95rem" }}
                        >
                          {application.applicantName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black" style={{ fontSize: "1rem", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
                              {application.organisationName}
                            </p>
                            <span
                              className="badge"
                              style={{
                                fontSize: "0.62rem",
                                background: application.status === "pending" ? "#FEF3C7" : application.status === "approved" ? "#D1FAE5" : "#FEE2E2",
                                color: application.status === "pending" ? "#92400E" : application.status === "approved" ? "#065F46" : "#991B1B",
                              }}
                            >
                              {application.status}
                            </span>
                          </div>
                          <p className="mt-1 truncate" style={{ fontSize: "0.82rem", color: "var(--text-2)" }}>
                            {application.applicantName} · {application.applicantEmail}
                          </p>
                          <p className="mt-0.5" style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>
                            Submitted {formatDate(application.createdAt)} at {formatTime(application.createdAt)}
                            {application.organisationType ? ` · ${application.organisationType}` : ""}
                            {application.city ? ` · ${application.city}` : ""}
                          </p>
                        </div>
                      </div>

                      <button className="btn btn-outline btn-sm shrink-0" onClick={() => setExpanded(open ? null : application.id)}>
                        {open ? "Hide details" : "Review details"}
                      </button>
                    </div>

                    {open && (
                      <div className="mt-5 rounded-2xl p-5 space-y-3 anim-fadeIn" style={{ background: "var(--surface)" }}>
                        {[
                          { l: "What they'll host", v: application.about || "—" },
                          { l: "Events per year", v: application.expectedEventsPerYear || "—" },
                          { l: "Website", v: application.website || "—" },
                          { l: "Phone", v: application.phone || "—" },
                          { l: "Country", v: application.country || "Nigeria" },
                          ...(application.reviewNote ? [{ l: "Previous note", v: application.reviewNote }] : []),
                        ].map((row) => (
                          <div key={row.l}>
                            <p className="label-caps mb-0.5" style={{ color: "var(--text-3)", fontSize: "0.62rem" }}>{row.l}</p>
                            <p style={{ fontSize: "0.85rem", color: "var(--text-1)", lineHeight: 1.6 }}>{row.v}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {application.status === "pending" ? (
                      <div className="mt-5 space-y-3">
                        <input
                          className="input"
                          placeholder="Note to the applicant (required when declining)"
                          value={notes[application.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [application.id]: e.target.value }))}
                          style={{ fontSize: "0.85rem" }}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={busy === application.id}
                            onClick={() => decide(application, "approve")}
                          >
                            {busy === application.id ? "Working…" : "✓ Approve organiser"}
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ color: "var(--red)", borderColor: "#FECACA" }}
                            disabled={busy === application.id}
                            onClick={() => decide(application, "reject")}
                          >
                            Decline
                          </button>
                          <a className="btn btn-ghost btn-sm" href={`mailto:${application.applicantEmail}`}>Email applicant</a>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4" style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
                        {application.status === "approved" ? "Approved" : "Declined"}
                        {application.reviewedAt ? ` on ${formatDate(application.reviewedAt)} at ${formatTime(application.reviewedAt)}` : ""}
                        {application.reviewNote ? ` — “${application.reviewNote}”` : ""}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Overview ─────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-6">
              <h3 className="font-bold mb-5" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Events across the platform</h3>
              <div className="space-y-3">
                {[
                  { l: "Published", v: overview?.events.published ?? 0, c: "var(--green)" },
                  { l: "Drafts", v: overview?.events.drafts ?? 0, c: "var(--text-2)" },
                  { l: "Completed", v: overview?.events.completed ?? 0, c: "#2563EB" },
                  { l: "Cancelled", v: overview?.events.cancelled ?? 0, c: "var(--red)" },
                ].map((row) => (
                  <div key={row.l} className="flex items-center justify-between">
                    <span style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>{row.l}</span>
                    <span className="font-black" style={{ fontSize: "1.05rem", color: row.c }}>{row.v}</span>
                  </div>
                ))}
                <div className="divider-gradient my-3" style={{ opacity: 0.2 }} />
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>Total</span>
                  <span className="font-black" style={{ fontSize: "1.15rem", color: "var(--violet-mid)" }}>{overview?.events.total ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-bold mb-5" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Registrations & attendance</h3>
              <div className="space-y-3">
                {[
                  { l: "Registrations", v: overview?.registrations.total ?? 0, c: "var(--violet-mid)" },
                  { l: "Awaiting approval", v: overview?.registrations.pending ?? 0, c: "var(--amber)" },
                  { l: "Approved", v: overview?.registrations.approved ?? 0, c: "var(--green)" },
                  { l: "Checked in", v: overview?.registrations.checkedIn ?? 0, c: "#2563EB" },
                ].map((row) => (
                  <div key={row.l} className="flex items-center justify-between">
                    <span style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>{row.l}</span>
                    <span className="font-black" style={{ fontSize: "1.05rem", color: row.c }}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-bold mb-5" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Money</h3>
              <div className="space-y-3">
                {[
                  { l: "Gross ticket sales", v: formatCurrency(overview?.payments.gross ?? 0), c: "var(--text-1)" },
                  { l: "UEB fees earned", v: formatCurrency(overview?.payments.uebRevenue ?? 0), c: "var(--gold)" },
                  { l: "Settled payments", v: overview?.payments.settled ?? 0, c: "var(--green)" },
                  { l: "Refunded", v: overview?.payments.refunded ?? 0, c: "var(--amber)" },
                  { l: "Failed", v: overview?.payments.failed ?? 0, c: "var(--red)" },
                ].map((row) => (
                  <div key={row.l} className="flex items-center justify-between">
                    <span style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>{row.l}</span>
                    <span className="font-black" style={{ fontSize: "1.05rem", color: row.c }}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-bold mb-5" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Accounts</h3>
              <div className="space-y-3">
                {[
                  { l: "Total accounts", v: overview?.users.total ?? 0, c: "var(--violet-mid)" },
                  { l: "Approved organisers", v: overview?.users.approvedOrganisers ?? 0, c: "var(--green)" },
                  { l: "Pending applications", v: overview?.users.pendingApplications ?? 0, c: "var(--amber)" },
                  { l: "Declined applications", v: overview?.users.rejected ?? 0, c: "var(--red)" },
                  { l: "Platform admins", v: overview?.users.admins ?? 0, c: "var(--text-1)" },
                ].map((row) => (
                  <div key={row.l} className="flex items-center justify-between">
                    <span style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>{row.l}</span>
                    <span className="font-black" style={{ fontSize: "1.05rem", color: row.c }}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Organisers ───────────────────────────────────────── */}
        {tab === "organisers" && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-bold" style={{ fontSize: "1rem", color: "var(--text-1)" }}>Organisers & applicants</h3>
              <p style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>Everyone with an organiser role or a pending/rejected application.</p>
            </div>
            {loading ? (
              <p className="px-6 py-8 text-center" style={{ color: "var(--text-3)" }}>Loading…</p>
            ) : (overview?.organisers ?? []).length === 0 ? (
              <p className="px-6 py-10 text-center" style={{ color: "var(--text-3)" }}>No organisers yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 640 }}>
                  <thead>
                    <tr style={{ background: "var(--surface)" }}>
                      {["Account", "Organisation", "Status", "Events", "Joined"].map((h) => (
                        <th key={h} className="text-left px-6 py-3 label-caps" style={{ color: "var(--text-3)", fontSize: "0.64rem" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(overview?.organisers ?? []).map((row) => (
                      <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-6 py-3.5">
                          <p className="font-bold" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{row.name}</p>
                          <p style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>{row.email}</p>
                        </td>
                        <td className="px-6 py-3.5" style={{ fontSize: "0.82rem", color: "var(--text-2)" }}>{row.organisation ?? "—"}</td>
                        <td className="px-6 py-3.5">
                          <span
                            className="badge"
                            style={{
                              fontSize: "0.62rem",
                              background: row.status === "approved" ? "#D1FAE5" : row.status === "pending" ? "#FEF3C7" : row.status === "rejected" ? "#FEE2E2" : "var(--surface-2)",
                              color: row.status === "approved" ? "#065F46" : row.status === "pending" ? "#92400E" : row.status === "rejected" ? "#991B1B" : "var(--text-2)",
                            }}
                          >
                            {row.role === "platform_admin" ? "admin" : row.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-bold" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{row.hosted}</td>
                        <td className="px-6 py-3.5" style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{formatDate(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 anim-fadeUp rounded-2xl px-5 py-3 font-bold z-100"
          style={{
            background: toast.type === "ok" ? "var(--ink)" : "var(--red)",
            color: "#fff",
            fontSize: "0.84rem",
            boxShadow: "var(--shadow-xl)",
            zIndex: 100,
          }}
          role="status"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
