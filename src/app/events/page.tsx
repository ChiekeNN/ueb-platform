"use client";
import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import EventCard from "@/components/EventCard";
import { EVENT_CATEGORIES } from "@/lib/utils";
import Link from "next/link";

type Event = {
  id: string; title: string; slug: string; description?: string | null;
  category?: string | null; startDate?: string | null; venue?: string | null;
  city?: string | null; imageUrl?: string | null; bannerColor?: string | null;
  totalRegistrations?: number | null; capacity?: number | null; status?: string | null;
};

const CAT_ICONS: Record<string, string> = {
  conference: "🎤", seminar: "📚", workshop: "🔧", concert: "🎸",
  corporate: "💼", university: "🎓", church: "⛪", government: "🏛️",
  wedding: "💍", networking: "🤝", training: "📋", exhibition: "🖼️",
  fundraising: "💝", private: "🔒", other: "🎪",
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [seeding, setSeeding] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ status: "published" });
      if (category !== "all") p.set("category", category);
      if (search) p.set("search", search);
      const res = await fetch(`/api/events?${p}`);
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [category, search]);

  useEffect(() => {
    const t = setTimeout(fetchEvents, 300);
    return () => clearTimeout(t);
  }, [fetchEvents]);

  const seedData = async () => {
    setSeeding(true);
    await fetch("/api/seed", { method: "POST" });
    await fetchEvents();
    setSeeding(false);
  };

  return (
    <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
      <Navbar />

      {/* Page header */}
      <div
        className="relative overflow-hidden pt-28 pb-14"
        style={{ background: "linear-gradient(160deg, #0A0A0F 0%, #1C1C2E 50%, #2D1B69 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8">
          <p className="label-caps mb-3" style={{ color: "rgba(167,139,250,0.8)" }}>Discover</p>
          <h1 className="display-2 text-white mb-4">Find your next event</h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "1rem", maxWidth: 480 }}>
            Browse conferences, workshops, concerts, church events and more — all in one place.
          </p>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-16" style={{ background: "linear-gradient(to bottom, transparent, var(--surface))" }} />
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        {/* Search & filter bar */}
        <div
          className="flex flex-col sm:flex-row gap-3 mb-8 p-3 rounded-2xl"
          style={{ background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
        >
          <div className="flex-1 relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="var(--text-3)" strokeWidth="1.5"/>
                <path d="M11 11l3 3" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search events, cities, venues…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input"
              style={{ paddingLeft: "2.5rem", border: "none", boxShadow: "none", background: "var(--surface)", borderRadius: "var(--radius-md)" }}
            />
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="input"
            style={{ width: "auto", minWidth: 180, background: "var(--surface)", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer" }}
          >
            <option value="all">All Categories</option>
            {EVENT_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{CAT_ICONS[c.value]} {c.label}</option>
            ))}
          </select>
          <Link href="/events/create" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
            + Create Event
          </Link>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8 pb-1">
          {[{ value: "all", label: "All Events" }, ...EVENT_CATEGORIES].map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className="flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full font-semibold transition-all duration-200"
              style={{
                fontSize: "0.78rem",
                background: category === c.value ? "var(--violet-mid)" : "#fff",
                color: category === c.value ? "#fff" : "var(--text-2)",
                border: `1.5px solid ${category === c.value ? "var(--violet-mid)" : "var(--border)"}`,
                boxShadow: category === c.value ? "var(--shadow-v)" : "none",
              }}
            >
              {c.value !== "all" && <span>{CAT_ICONS[c.value]}</span>}
              {c.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <div className="skeleton" style={{ height: 168 }} />
                <div className="p-5 space-y-3" style={{ background: "#fff" }}>
                  <div className="skeleton h-5 w-3/4" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div
            className="text-center py-24 rounded-3xl"
            style={{ background: "#fff", border: "1px solid var(--border)" }}
          >
            <div style={{ fontSize: "4rem", marginBottom: "1rem", opacity: 0.3 }}>🎪</div>
            <h3 className="heading-2 mb-2" style={{ color: "var(--text-1)" }}>No events found</h3>
            <p style={{ color: "var(--text-3)", marginBottom: "2rem", fontSize: "0.9rem" }}>
              {search || category !== "all" ? "Try adjusting your search or category filter" : "Be the first to create an event on UEB"}
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/events/create" className="btn btn-primary">Create an Event</Link>
              <button onClick={seedData} disabled={seeding} className="btn btn-outline" style={{ opacity: seeding ? 0.6 : 1 }}>
                {seeding ? "Loading demo data…" : "Load Demo Events"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <p style={{ fontSize: "0.85rem", color: "var(--text-3)", fontWeight: 500 }}>
                {events.length} event{events.length !== 1 ? "s" : ""} found
              </p>
              {events.length === 0 && (
                <button onClick={seedData} disabled={seeding} className="btn btn-outline btn-sm">
                  Load Demo Data
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((ev, i) => (
                <div key={ev.id} className="anim-fadeUp" style={{ animationDelay: `${i * 0.06}s` }}>
                  <EventCard event={ev} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
