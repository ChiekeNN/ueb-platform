"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useSession } from "@/components/SessionProvider";
import { formatDate, formatTime } from "@/lib/utils";

/**
 * Full notification history — the bell's "see all" destination.
 *
 * Same feed as the bell (platform-wide for admins, own events for organisers),
 * with filters and bulk actions.
 */

type Notification = {
  id: string; scope: string; type: string; title: string; body: string | null;
  link: string | null; severity: string; readAt: string | null; createdAt: string;
};

const SEVERITY: Record<string, { dot: string; bg: string; icon: string; label: string }> = {
  info: { dot: "#7C3AED", bg: "#F5F3FF", icon: "•", label: "Info" },
  success: { dot: "#059669", bg: "#D1FAE5", icon: "✓", label: "Success" },
  warning: { dot: "#D97706", bg: "#FEF3C7", icon: "!", label: "Attention" },
  critical: { dot: "#DC2626", bg: "#FEE2E2", icon: "!", label: "Critical" },
};

const TYPE_LABELS: Record<string, string> = {
  organiser_application: "Organiser application",
  application_decision: "Application decision",
  application_approved: "Approved",
  application_rejected: "Declined",
  user_signup: "New account",
  event_created: "New event",
  registration: "Registration",
  payment: "Payment",
  refund: "Refund",
  event_completed: "Event completed",
};

export default function NotificationsPage() {
  const router = useRouter();
  const session = useSession();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?limit=100${filter === "unread" ? "&unread=1" : ""}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications ?? []);
        setUnread(data.unread ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (session.loading) return;
    if (!session.user) {
      router.replace("/login?next=/notifications");
      return;
    }
    void load();
  }, [session.loading, session.user, router, load]);

  const markAll = async () => {
    setUnread(0);
    setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => {});
    void load();
  };

  const openItem = async (n: Notification) => {
    if (!n.readAt) {
      setUnread((c) => Math.max(0, c - 1));
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      void fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  };

  return (
    <div className="min-h-dvh" style={{ background: "var(--surface)" }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-5 sm:px-8 pt-24 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="label-caps mb-1" style={{ color: "var(--violet-mid)" }}>
              {session.isAdmin ? "Platform activity" : "Your activity"}
            </p>
            <h1 className="heading-1" style={{ fontSize: "1.8rem" }}>Notifications</h1>
            <p className="mt-1" style={{ fontSize: "0.86rem", color: "var(--text-3)" }}>
              {session.isAdmin
                ? "Everything happening across UEB — applications, signups, events, sales and refunds."
                : "Registrations, payments and decisions on your events."}
            </p>
          </div>
          {unread > 0 && (
            <button className="btn btn-outline btn-sm" onClick={markAll}>Mark all read ({unread})</button>
          )}
        </div>

        <div className="flex gap-1 mb-5 p-1 rounded-2xl w-fit" style={{ background: "var(--surface-2)" }}>
          {(["all", "unread"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className="px-4 py-2 rounded-xl font-bold"
              style={{
                fontSize: "0.8rem",
                background: filter === value ? "#fff" : "transparent",
                color: filter === value ? "var(--violet-mid)" : "var(--text-2)",
                boxShadow: filter === value ? "var(--shadow-sm)" : "none",
              }}
            >
              {value === "all" ? "All" : `Unread${unread ? ` (${unread})` : ""}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card p-10 text-center" style={{ color: "var(--text-3)" }}>Loading notifications…</div>
        ) : items.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">🔔</div>
            <p className="font-bold" style={{ color: "var(--text-1)" }}>
              {filter === "unread" ? "Nothing unread" : "No notifications yet"}
            </p>
            <p className="mt-1" style={{ fontSize: "0.84rem", color: "var(--text-3)" }}>
              {session.isAdmin
                ? "As activity happens across the platform it will appear here."
                : "Registrations and payments for your events will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((n) => {
              const meta = SEVERITY[n.severity] ?? SEVERITY.info;
              return (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className="card p-4 w-full text-left flex gap-4 transition-transform"
                  style={{
                    background: n.readAt ? "#fff" : "var(--violet-bg)",
                    borderColor: n.readAt ? "var(--border)" : "var(--violet-rim)",
                    cursor: n.link ? "pointer" : "default",
                  }}
                >
                  <span
                    className="w-9 h-9 rounded-2xl flex items-center justify-center font-black shrink-0"
                    style={{ background: meta.bg, color: meta.dot, fontSize: "0.85rem" }}
                  >
                    {meta.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold" style={{ fontSize: "0.88rem", color: "var(--text-1)" }}>{n.title}</span>
                      <span className="badge" style={{ fontSize: "0.58rem", background: "var(--surface-2)", color: "var(--text-3)" }}>
                        {TYPE_LABELS[n.type] ?? n.type.replace(/_/g, " ")}
                      </span>
                    </span>
                    {n.body && (
                      <span className="block mt-1" style={{ fontSize: "0.8rem", color: "var(--text-2)", lineHeight: 1.6 }}>{n.body}</span>
                    )}
                    <span className="block mt-1.5" style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
                      {formatDate(n.createdAt)} at {formatTime(n.createdAt)}
                    </span>
                  </span>
                  {!n.readAt && <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: "var(--violet-mid)" }} />}
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-center" style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
          {session.isAdmin ? (
            <>Review pending organisers in the <Link href="/admin" className="font-bold" style={{ color: "var(--violet-mid)" }}>admin dashboard</Link>.</>
          ) : (
            <>Manage your events from the <Link href="/dashboard" className="font-bold" style={{ color: "var(--violet-mid)" }}>dashboard</Link>.</>
          )}
        </p>
      </div>
    </div>
  );
}
