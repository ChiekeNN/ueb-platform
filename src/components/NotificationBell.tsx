"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, formatTime } from "@/lib/utils";

/**
 * Notification bell.
 *
 * One component, two audiences, driven entirely by `/api/notifications`:
 *
 *   • **Admins** get the platform stream — organiser applications, signups,
 *     events, registrations, payments and refunds from every part of UEB —
 *     merged with anything addressed to them personally.
 *   • **Organisers** get notifications about their own events.
 *
 * Unread count is polled every 30 seconds so an admin working in another tab
 * still sees a newly submitted application.
 */

type Notification = {
  id: string;
  scope: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  readAt: string | null;
  createdAt: string;
};

const SEVERITY: Record<string, { dot: string; icon: string }> = {
  info: { dot: "#7C3AED", icon: "•" },
  success: { dot: "#059669", icon: "✓" },
  warning: { dot: "#D97706", icon: "!" },
  critical: { dot: "#DC2626", icon: "!" },
};

const POLL_MS = 30_000;

/** "4 min ago" for anything recent, DD/MM/YYYY once it is older. */
function when(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}

export default function NotificationBell({ align = "right" }: { align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=25", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      /* keep the last known feed */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAll = async () => {
    setUnread(0);
    setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  };

  const openItem = async (n: Notification) => {
    setOpen(false);
    if (!n.readAt) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((count) => Math.max(0, count - 1));
      void fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
        style={{ background: open ? "var(--violet-bg)" : "transparent" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3a5.5 5.5 0 0 0-5.5 5.5v3.2L5 15.5h14l-1.5-3.8V8.5A5.5 5.5 0 0 0 12 3Z"
            stroke={open ? "var(--violet-mid)" : "var(--text-2)"}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" stroke={open ? "var(--violet-mid)" : "var(--text-2)"} strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold"
            style={{ background: "#DC2626", color: "#fff", fontSize: "0.62rem", border: "2px solid #fff" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute z-50 anim-scaleIn rounded-2xl overflow-hidden"
          style={{
            [align]: 0,
            top: "calc(100% + 0.6rem)",
            width: "min(23rem, calc(100vw - 2rem))",
            background: "#fff",
            border: "1.5px solid var(--border)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="font-black" style={{ fontSize: "0.88rem", color: "var(--text-1)" }}>Notifications</p>
              <p style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>
                {unread > 0 ? `${unread} unread` : "You're all caught up"}
              </p>
            </div>
            {unread > 0 && (
              <button onClick={markAll} className="font-bold" style={{ fontSize: "0.7rem", color: "var(--violet-mid)" }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: "min(24rem, 60vh)", overflowY: "auto" }}>
            {loading ? (
              <p className="px-4 py-6 text-center" style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center" style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
                Nothing yet. Activity across the platform will show up here.
              </p>
            ) : (
              items.map((n) => {
                const meta = SEVERITY[n.severity] ?? SEVERITY.info;
                const unreadItem = !n.readAt;
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className="w-full text-left flex gap-3 px-4 py-3 border-b transition-colors"
                    style={{
                      borderColor: "var(--border)",
                      background: unreadItem ? "var(--violet-bg)" : "#fff",
                    }}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold"
                      style={{ background: `${meta.dot}1A`, color: meta.dot, fontSize: "0.7rem" }}
                    >
                      {meta.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold" style={{ fontSize: "0.8rem", color: "var(--text-1)" }}>
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="block mt-0.5" style={{ fontSize: "0.74rem", color: "var(--text-2)", lineHeight: 1.5 }}>
                          {n.body}
                        </span>
                      )}
                      <span className="block mt-1" style={{ fontSize: "0.66rem", color: "var(--text-3)" }} title={`${formatDate(n.createdAt)} ${formatTime(n.createdAt)}`}>
                        {when(n.createdAt)}
                      </span>
                    </span>
                    {unreadItem && <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: "var(--violet-mid)" }} />}
                  </button>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center font-bold border-t"
            style={{ borderColor: "var(--border)", fontSize: "0.76rem", color: "var(--violet-mid)" }}
          >
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
