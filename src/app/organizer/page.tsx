"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { formatCurrency, formatDate } from "@/lib/utils";

type OrganizerEvent = {
  id: string; title: string; slug: string; status?: string | null; category?: string | null;
  startDate?: string | null; city?: string | null; venue?: string | null;
  totalRegistrations?: number | null; totalRevenue?: string | null;
};

export default function OrganizerPage() {
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events?status=all&limit=120")
      .then((response) => response.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = useMemo(() => events.filter((event) => event.startDate && new Date(event.startDate) >= new Date()).sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime()), [events]);
  const registrations = events.reduce((sum, event) => sum + Number(event.totalRegistrations ?? 0), 0);
  const revenue = events.reduce((sum, event) => sum + Number(event.totalRevenue ?? 0), 0);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface)" }}>
      <Navbar />
      <header className="pt-16" style={{ background: "linear-gradient(135deg,#06252B 0%,#0E5966 55%,#0891B2 100%)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="label-caps mb-2" style={{ color: "#A5F3FC" }}>Organizer workspace</p>
              <h1 className="display-2 text-white" style={{ fontSize: "clamp(2rem,4vw,3.2rem)" }}>Run your events</h1>
              <p className="mt-3" style={{ color: "rgba(255,255,255,0.68)", maxWidth: 580, lineHeight: 1.7 }}>Create, publish, review, sell and report without leaving UEB.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/events/create" className="btn btn-white btn-sm">+ Create event</Link>
              <Link href="/dashboard" className="btn btn-ghost btn-sm">Full operations dashboard</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            ["🗓️", "My events", events.length, "#0891B2"],
            ["🚀", "Upcoming", upcoming.length, "var(--violet-mid)"],
            ["👥", "Registrations", registrations, "var(--green)"],
            ["₦", "Revenue", formatCurrency(revenue), "#B45309"],
          ].map(([icon, label, value, color]) => (
            <div key={String(label)} className="card p-4">
              <span style={{ fontSize: "1.1rem" }}>{icon}</span>
              <p className="font-black mt-2" style={{ color: String(color), fontSize: "1.25rem" }}>{value}</p>
              <p style={{ color: "var(--text-3)", fontSize: "0.7rem", fontWeight: 700 }}>{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] gap-5">
          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="heading-2" style={{ color: "var(--text-1)", fontSize: "1.25rem" }}>Upcoming events</h2>
                <p className="mt-1" style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>Keep your next event moving forward.</p>
              </div>
              <Link href="/events/create" className="btn btn-primary btn-sm">Create new</Link>
            </div>
            {loading ? <div className="skeleton h-48 rounded-2xl" /> : upcoming.length === 0 ? (
              <div className="text-center py-12">
                <div style={{ fontSize: "2.4rem", opacity: 0.35 }}>🗓️</div>
                <p className="mt-2" style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>Create your first upcoming event.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {upcoming.slice(0, 8).map((event) => (
                  <div key={event.id} className="p-4 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="badge badge-violet" style={{ fontSize: "0.62rem" }}>{event.category ?? "Event"}</span>
                      <span className="badge badge-green" style={{ fontSize: "0.62rem" }}>{event.status ?? "published"}</span>
                    </div>
                    <h3 className="font-bold mt-3 truncate-2" style={{ color: "var(--text-1)", fontSize: "0.92rem", lineHeight: 1.4 }}>{event.title}</h3>
                    <p className="mt-1" style={{ color: "var(--text-3)", fontSize: "0.74rem" }}>{formatDate(event.startDate)} · {event.city ?? "Nigeria"}</p>
                    <div className="flex gap-2 mt-4">
                      <Link href={`/events/${event.slug}/manage`} className="btn btn-dark btn-sm">Manage</Link>
                      <Link href={`/events/${event.slug}`} className="btn btn-outline btn-sm">View</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className="card p-5">
              <h2 className="heading-2" style={{ color: "var(--text-1)", fontSize: "1.2rem" }}>Your next moves</h2>
              <div className="space-y-2 mt-4">
                {[
                  ["💌", "Send invitations", "/dashboard"],
                  ["👥", "Review attendees", "/dashboard"],
                  ["📱", "Open check-in desk", "/checkin"],
                  ["🧾", "Prepare a report", "/dashboard"],
                ].map(([icon, label, href]) => (
                  <Link key={label} href={href} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface)", textDecoration: "none" }}>
                    <span>{icon}</span><span style={{ color: "var(--text-2)", fontSize: "0.8rem", fontWeight: 700 }}>{label}</span><span className="ml-auto" style={{ color: "var(--violet-mid)" }}>→</span>
                  </Link>
                ))}
              </div>
            </section>
            <section className="p-5 rounded-2xl" style={{ background: "linear-gradient(135deg,var(--violet-bg),#EDE9FE)", border: "1px solid var(--violet-rim)" }}>
              <p className="label-caps" style={{ color: "var(--violet-mid)" }}>Need a hand?</p>
              <h3 className="font-black mt-2" style={{ color: "var(--text-1)" }}>The operations dashboard has the detail.</h3>
              <p className="mt-2" style={{ color: "var(--text-2)", fontSize: "0.78rem", lineHeight: 1.6 }}>Invitations, seating, vendors, communications and reports are all inside each event workspace.</p>
              <Link href="/dashboard" className="btn btn-primary btn-sm mt-4">Open operations →</Link>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
