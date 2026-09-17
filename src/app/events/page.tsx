"use client";
import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import EventCard, { type EventCardData } from "@/components/EventCard";
import EventDetailsModal from "@/components/EventDetailsModal";
import { EVENT_CATEGORIES, EVENT_FORMATS, eventDateShort } from "@/lib/utils";
import Link from "next/link";

type Event = EventCardData & {
  description?: string | null;
  category?: string | null;
  status?: string | null;
  nextSessionDate?: string | null;
  sessionCount?: number | null;
  timeSlotCount?: number | null;
};

const CAT_ICONS: Record<string, string> = {
  conference: "🎤", seminar: "📚", workshop: "🔧", concert: "🎸",
  corporate: "💼", university: "🎓", church: "⛪", government: "🏛️",
  wedding: "💍", networking: "🤝", training: "📋", exhibition: "🖼️",
  fundraising: "💝", private: "🔒", other: "🎪",
};

const CITIES = [
  { value: "all", label: "All cities", icon: "🇳🇬" },
  { value: "Lagos", label: "Lagos", icon: "🌊" },
  { value: "Abuja", label: "Abuja", icon: "🏛️" },
  { value: "Port Harcourt", label: "Port Harcourt", icon: "🛢️" },
  { value: "Online", label: "Online", icon: "💻" },
];

const DATES = [
  { value: "any", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "This weekend" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

const PRICES = [
  { value: "any", label: "Any price" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [city, setCity] = useState("all");
  const [format, setFormat] = useState("all");
  const [when, setWhen] = useState("any");
  const [price, setPrice] = useState("any");
  const [sort, setSort] = useState("date");
  const [seeding, setSeeding] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ status: "published", tiers: "1", sort });
      if (category !== "all") p.set("category", category);
      if (city !== "all") p.set("city", city);
      if (format !== "all") p.set("format", format);
      if (when !== "any") p.set("when", when);
      if (search) p.set("search", search);
      const res = await fetch(`/api/events?${p}`);
      const data = await res.json();
      setDemoMode(Boolean(data.demo));
      let list: Event[] = data.events ?? [];
      // Free/paid is a client-side refinement on the tier payload.
      if (price === "free") list = list.filter((e) => (e.tiers ?? []).some((t) => Number(t.price ?? 0) === 0));
      if (price === "paid") list = list.filter((e) => (e.tiers ?? []).length > 0 && (e.tiers ?? []).every((t) => Number(t.price ?? 0) > 0));
      setEvents(list);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [category, city, format, when, price, search, sort]);

  useEffect(() => {
    const t = setTimeout(fetchEvents, 280);
    return () => clearTimeout(t);
  }, [fetchEvents]);

  const seedData = async () => {
    setSeeding(true);
    await fetch("/api/seed", { method: "POST" });
    await fetchEvents();
    setSeeding(false);
  };

  const resetAll = () => {
    setSearch(""); setCategory("all"); setCity("all"); setFormat("all"); setWhen("any"); setPrice("any");
  };

  const activeFilters = [category !== "all", city !== "all", format !== "all", when !== "any", price !== "any", !!search].filter(Boolean).length;
  const trimmed = events.slice(0, 40);
  const nearby = events.slice(0, 4);

  return (
    <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
      <Navbar />

      {/* ── Page header (Eventbrite keeps this light; we keep the UEB tint) ── */}
      <div className="pt-16" style={{ background: "linear-gradient(120deg,#0A0A0F 0%,#1C1C2E 55%,#2D1B69 100%)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-10 pb-8">
          <h1 className="display-2 text-white" style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)" }}>Find your next event</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.95rem", marginTop: "0.4rem" }}>
            Conferences, workshops, concerts, church events, appointments and more — across Nigeria.
          </p>
        </div>
      </div>

      {/* ── Sticky filter rail ── */}
      <div className="sticky z-40" style={{ top: 64, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)", boxShadow: "0 2px 14px rgba(10,10,15,0.05)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3">
          {/* Row 1: search + city tabs + sort */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 min-w-0">
            <div className="flex-1 relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="var(--text-3)" strokeWidth="1.5" />
                  <path d="M11 11l3 3" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search events, organisers or venues…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input"
                style={{ paddingLeft: "2.5rem", background: "#fff", border: "1.5px solid var(--border)" }}
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 flex-none lg:flex-none">
              {CITIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCity(c.value)}
                  className="shrink-0 px-3.5 py-2 rounded-lg font-semibold transition-all"
                  style={{
                    fontSize: "0.78rem",
                    background: city === c.value ? "var(--violet-mid)" : "transparent",
                    color: city === c.value ? "#fff" : "var(--text-2)",
                  }}
                >
                  <span style={{ marginRight: 4 }}>{c.icon}</span>{c.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label style={{ fontSize: "0.76rem", color: "var(--text-3)", fontWeight: 600 }}>Sort by</label>
              <select className="input" style={{ width: "auto", fontSize: "0.8rem", padding: "0.5rem 0.75rem", cursor: "pointer" }} value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="date">Date</option>
                <option value="newest">Newest</option>
              </select>
              <Link href="/events/create" className="btn btn-primary btn-sm" style={{ whiteSpace: "nowrap" }}>+ Create</Link>
            </div>
          </div>

          {/* Row 2: quick filters */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <FilterSelect icon="🗓️" value={when} onChange={setWhen} options={DATES} />
            <FilterSelect icon="🎟️" value={price} onChange={setPrice} options={PRICES} />
            <FilterSelect
              icon="📍"
              value={format}
              onChange={setFormat}
              options={[{ value: "all", label: "Any format" }, ...EVENT_FORMATS.map((f) => ({ value: f.value, label: `${f.icon} ${f.label}` }))]}
            />
            <FilterSelect
              icon="🏷️"
              value={category}
              onChange={setCategory}
              options={[{ value: "all", label: "All categories" }, ...EVENT_CATEGORIES.map((c) => ({ value: c.value, label: `${CAT_ICONS[c.value] ?? ""} ${c.label}` }))]}
            />
            {activeFilters > 0 && (
              <button onClick={resetAll} className="btn btn-sm" style={{ background: "var(--surface-2)", color: "var(--text-2)", fontSize: "0.75rem" }}>
                Clear filters ({activeFilters})
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        {/* Results header */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h2 className="heading-2" style={{ color: "var(--text-1)" }}>
              {events.length} {events.length === 1 ? "event" : "events"}
              {city !== "all" ? ` in ${city}` : " in Nigeria"}
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-3)", marginTop: "0.2rem" }}>
              {search ? `Matching “${search}”` : "Curated from organisers across the country"}
            </p>
          </div>
          {events.length > 0 && (
            <p style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
              Click any event to preview details and register without leaving this page
            </p>
          )}
        </div>

        {demoMode && (
          <div className="mb-6 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
            <p style={{ fontSize: "0.78rem", color: "#92400E", lineHeight: 1.5 }}>
              Showing UEB&apos;s local demo catalogue. Connect PostgreSQL and run <strong>POST /api/seed</strong> to enable live registrations, payments and tickets.
            </p>
            <Link href="/dashboard" className="btn btn-sm" style={{ background: "#92400E", color: "#fff" }}>Open organiser dashboard</Link>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton" style={{ height: 186, borderRadius: 16 }} />
                <div className="skeleton h-4 w-32 mt-3" />
                <div className="skeleton h-5 w-full mt-2" />
                <div className="skeleton h-4 w-2/3 mt-2" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-24 rounded-3xl" style={{ background: "#fff", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem", opacity: 0.3 }}>🎪</div>
            <h3 className="heading-2 mb-2" style={{ color: "var(--text-1)" }}>No events match those filters</h3>
            <p style={{ color: "var(--text-3)", marginBottom: "2rem", fontSize: "0.9rem" }}>
              {activeFilters > 0 ? "Try widening the date, price or city filters." : "Be the first to create an event on UEB."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {activeFilters > 0 && <button onClick={resetAll} className="btn btn-primary">Clear all filters</button>}
              <Link href="/events/create" className="btn btn-outline">Create an Event</Link>
              <button onClick={seedData} disabled={seeding} className="btn btn-outline" style={{ opacity: seeding ? 0.6 : 1 }}>
                {seeding ? "Loading demo data…" : "Load Demo Events"}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {trimmed.map((ev, i) => (
              <div key={ev.id} className="anim-fadeUp" style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
                <EventCard event={ev} onOpen={setOpenSlug} />
              </div>
            ))}
          </div>
        )}

        {/* Nearby/trending rail */}
        {!loading && events.length > 0 && (
          <div className="mt-12">
            <h3 className="heading-2 mb-4" style={{ color: "var(--text-1)" }}>More events you might like</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {nearby.map((ev) => (
                <button
                  key={`near-${ev.id}`}
                  onClick={() => setOpenSlug(ev.slug)}
                  className="text-left p-3.5 rounded-2xl transition-all"
                  style={{ background: "#fff", border: "1px solid var(--border)" }}
                >
                  <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--violet-mid)" }}>
                    {eventDateShort(ev.nextSessionDate ?? ev.startDate)}
                  </p>
                  <p className="truncate-2" style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-1)", lineHeight: 1.35, marginTop: "0.15rem" }}>
                    {ev.title}
                  </p>
                  <p style={{ fontSize: "0.74rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
                    {ev.format === "online" ? "Online event" : ev.city ?? "Nigeria"}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {openSlug && (
        <EventDetailsModal
          slug={openSlug}
          initial={events.find((e) => e.slug === openSlug)}
          onClose={() => setOpenSlug(null)}
        />
      )}
    </div>
  );
}

function FilterSelect({
  icon, value, onChange, options,
}: {
  icon: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = value !== "all" && value !== "any";
  return (
    <div className="relative">
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: "0.78rem",
          padding: "0.5rem 0.75rem 0.5rem 2rem",
          width: "auto",
          cursor: "pointer",
          background: active ? "var(--violet-bg)" : "#fff",
          borderColor: active ? "var(--violet-rim)" : "var(--border)",
          color: active ? "var(--violet-low)" : "var(--text-2)",
          fontWeight: 600,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: "0.8rem", pointerEvents: "none" }}>{icon}</span>
    </div>
  );
}
