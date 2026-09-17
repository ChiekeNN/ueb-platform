"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import EventCard, { type EventCardData } from "@/components/EventCard";
import { useSavedEvents } from "@/lib/useSavedEvents";

export default function SubscriberPage() {
  const [events, setEvents] = useState<EventCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const { saved, isSaved } = useSavedEvents();

  useEffect(() => {
    fetch("/api/events?status=published&tiers=1&limit=120")
      .then((response) => response.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = useMemo(() => events.filter((event) => event.startDate && new Date(event.startDate) >= new Date()), [events]);
  const savedEvents = useMemo(() => events.filter((event) => isSaved(event.slug)), [events, isSaved]);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface)" }}>
      <Navbar />
      <header className="pt-16" style={{ background: "linear-gradient(135deg,#05251B 0%,#076044 55%,#059669 100%)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="label-caps mb-2" style={{ color: "#A7F3D0" }}>Your attendee space</p>
              <h1 className="display-2 text-white" style={{ fontSize: "clamp(2rem,4vw,3.2rem)" }}>Your events, together</h1>
              <p className="mt-3" style={{ color: "rgba(255,255,255,0.68)", maxWidth: 560, lineHeight: 1.7 }}>Save the experiences you want to attend and keep every ticket ready for the day.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/events" className="btn btn-white btn-sm">Discover events</Link>
              <Link href="/subscriber/login" className="btn btn-ghost btn-sm">Account settings</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            ["🎟️", "Tickets", "0", "var(--violet-mid)"],
            ["🔖", "Saved events", saved.length, "#B45309"],
            ["🚀", "Upcoming", upcoming.length, "var(--green)"],
            ["📍", "Cities", new Set(upcoming.map((event) => event.city).filter(Boolean)).size, "#0891B2"],
          ].map(([icon, label, value, color]) => (
            <div key={String(label)} className="card p-4">
              <span style={{ fontSize: "1.1rem" }}>{icon}</span>
              <p className="font-black mt-2" style={{ color: String(color), fontSize: "1.25rem" }}>{value}</p>
              <p style={{ color: "var(--text-3)", fontSize: "0.7rem", fontWeight: 700 }}>{label}</p>
            </div>
          ))}
        </div>

        <section className="card p-5 sm:p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="heading-2" style={{ color: "var(--text-1)", fontSize: "1.25rem" }}>My tickets</h2>
              <p className="mt-1" style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>Tickets you buy or receive on UEB will appear here.</p>
            </div>
            <Link href="/events" className="btn btn-outline btn-sm">Find an event</Link>
          </div>
          <div className="p-5 rounded-2xl text-center" style={{ background: "var(--surface)" }}>
            <div style={{ fontSize: "2rem", opacity: 0.45 }}>🎫</div>
            <p className="mt-2" style={{ color: "var(--text-2)", fontSize: "0.86rem", fontWeight: 700 }}>No tickets yet</p>
            <p className="mt-1" style={{ color: "var(--text-3)", fontSize: "0.76rem" }}>Your digital tickets and QR codes will be ready here after registration.</p>
          </div>
        </section>

        {savedEvents.length > 0 && (
          <section className="mb-8">
            <div className="flex items-end justify-between mb-4">
              <div><p className="label-caps" style={{ color: "var(--violet-mid)" }}>Your shortlist</p><h2 className="heading-2 mt-1" style={{ color: "var(--text-1)" }}>Saved events</h2></div>
              <Link href="/events" className="btn btn-outline btn-sm">Discover more</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {savedEvents.slice(0, 4).map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between mb-4">
            <div><p className="label-caps" style={{ color: "var(--violet-mid)" }}>What is next</p><h2 className="heading-2 mt-1" style={{ color: "var(--text-1)" }}>Upcoming on UEB</h2></div>
            <Link href="/events" className="btn btn-outline btn-sm">See all events</Link>
          </div>
          {loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-72 rounded-2xl" />)}</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {upcoming.slice(0, 8).map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
