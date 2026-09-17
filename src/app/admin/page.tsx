"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { formatDate, formatCurrency } from "@/lib/utils";

type AdminEvent = {
  id: string; title: string; slug: string; category?: string | null; status?: string | null;
  startDate?: string | null; city?: string | null; venue?: string | null;
  totalRegistrations?: number | null; totalRevenue?: string | null;
};

export default function AdminPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events?status=all&limit=120")
      .then((response) => response.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = useMemo(() => events.filter((event) => event.startDate && new Date(event.startDate) >= new Date()).sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime()), [events]);
  const published = events.filter((event) => event.status === "published").length;
  const registrations = events.reduce((sum, event) => sum + Number(event.totalRegistrations ?? 0), 0);
  const revenue = events.reduce((sum, event) => sum + Number(event.totalRevenue ?? 0), 0);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface)" }}>
      <Navbar />
      <header className="pt-16" style={{ background: "linear-gradient(135deg,#0A0A0F 0%,#25134F 55%,#4C1D95 100%)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="label-caps mb-2" style={{ color: "#C4B5FD" }}>Platform control room</p>
              <h1 className="display-2 text-white" style={{ fontSize: "clamp(2rem,4vw,3.2rem)" }}>Admin dashboard</h1>
              <p className="mt-3" style={{ color: "rgba(255,255,255,0.62)", maxWidth: 570, lineHeight: 1.7 }}>Keep the marketplace healthy, help organisers succeed and see what is happening across UEB.</p>
            </div>
            <Link href="/admin/login" className="btn btn-ghost btn-sm">Switch admin account</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            ["🗓️", "Total events", events.length, "var(--violet-mid)"],
            ["✅", "Published", published, "var(--green)"],
            ["👥", "Registrations", registrations, "#0891B2"],
            ["₦", "Gross revenue", formatCurrency(revenue), "#B45309"],
          ].map(([icon, label, value, color]) => (
            <div key={String(label)} className="card p-4">
              <span style={{ fontSize: "1.1rem" }}>{icon}</span>
              <p className="font-black mt-2" style={{ color: String(color), fontSize: "1.25rem" }}>{value}</p>
              <p style={{ color: "var(--text-3)", fontSize: "0.7rem", fontWeight: 700 }}>{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-5">
          <section className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="heading-2" style={{ color: "var(--text-1)", fontSize: "1.25rem" }}>Upcoming events</h2>
                <p className="mt-1" style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>Monitor the next experiences going live on UEB.</p>
              </div>
              <Link href="/events" className="btn btn-outline btn-sm">View marketplace</Link>
            </div>
            {loading ? <div className="skeleton h-48 rounded-2xl" /> : upcoming.length === 0 ? (
              <div className="text-center py-12" style={{ color: "var(--text-3)" }}>No upcoming events yet.</div>
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 6).map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface)" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shrink-0" style={{ background: "linear-gradient(135deg,#7C3AED,#4C1D95)" }}>{event.title.charAt(0)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate" style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>{event.title}</p>
                      <p className="truncate" style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{formatDate(event.startDate)} · {event.city ?? "Nigeria"}</p>
                    </div>
                    <span className="badge badge-green shrink-0" style={{ fontSize: "0.62rem" }}>Published</span>
                    <Link href={`/events/${event.slug}/manage`} className="btn btn-outline btn-sm hidden sm:inline-flex">Manage</Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="heading-2" style={{ color: "var(--text-1)", fontSize: "1.25rem" }}>Admin actions</h2>
            <p className="mt-1 mb-5" style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>The shortcuts you need to keep UEB moving.</p>
            <div className="space-y-2">
              {[
                ["👥", "Review organisers", "Approve or support organiser accounts"],
                ["🧾", "View reports", "Inspect sales, attendance and revenue"],
                ["🔍", "Discover as attendee", "Check the public event experience"],
                ["⚙️", "Platform settings", "Payments, notifications and roles"],
              ].map(([icon, title, copy]) => (
                <Link key={title} href={title === "Discover as attendee" ? "/events" : "/dashboard"} className="flex gap-3 p-3 rounded-xl transition-colors" style={{ background: "var(--surface)", textDecoration: "none" }}>
                  <span>{icon}</span>
                  <span><strong style={{ display: "block", fontSize: "0.82rem", color: "var(--text-1)" }}>{title}</strong><small style={{ color: "var(--text-3)", fontSize: "0.7rem" }}>{copy}</small></span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
