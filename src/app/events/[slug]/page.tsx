"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import RegistrationModal, { type RegEvent, type RegSlot, type RegTier } from "@/components/RegistrationModal";
import { EventCover, EventRowCard, type EventCardData } from "@/components/EventCard";
import {
  EVENT_CATEGORIES,
  calculateUEBFee,
  describeRecurrence,
  eventDateLine,
  formatCurrency,
  formatDate,
  formatDuration,
  formatLabel,
  formatTime,
  getStatusColor,
  locationLine,
  priceSummaryLabel,
  timeUntil,
} from "@/lib/utils";
import { useSavedEvents } from "@/lib/useSavedEvents";

type RecurrenceRuleT = {
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  interval?: number; count?: number; until?: string | null; weekdays?: number[]; time?: string; durationMinutes?: number;
};
type Ev = RegEvent & {
  description?: string | null;
  tagline?: string | null;
  imageUrl?: string | null;
  gallery?: string[] | null;
  bannerColor?: string | null;
  address?: string | null;
  country?: string | null;
  status?: string | null;
  category?: string | null;
  highlights?: string[] | null;
  faqs?: { question: string; answer: string }[] | null;
  refundPolicy?: string | null;
  ageRestriction?: string | null;
  recurrenceRule?: RecurrenceRuleT | null;
  postEventMessage?: string | null;
  completedAt?: string | null;
  requiresApproval?: boolean | null;
  virtualLink?: string | null;
};
type Detail = {
  event: Ev;
  tiers: RegTier[];
  stats: { totalRegistrations: number; approved: number; pending: number; checkedIn: number; totalRevenue: number };
  organiser: { name: string; email: string; organisation?: string | null } | null;
  workspace?: {
    slots: RegSlot[];
    occurrences: { id: string; label?: string | null; startDate: string; endDate?: string | null }[];
    seating: { enabled: boolean; summary: { totalSeats: number; assigned: number; available: number } };
    vendors: { id: string; name: string; category?: string | null }[];
    feedback: { responses: number; averageRating: number };
  };
};

const CAT_ICONS: Record<string, string> = {
  conference: "🎤", seminar: "📚", workshop: "🔧", concert: "🎸", corporate: "💼", university: "🎓",
  church: "⛪", government: "🏛️", wedding: "💍", networking: "🤝", training: "📋", exhibition: "🖼️",
  fundraising: "💝", private: "🔒", other: "🎪",
};

export default function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [related, setRelated] = useState<EventCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerTier, setRegisterTier] = useState<string | null>(null);
  const [registerQty, setRegisterQty] = useState(1);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [showBar, setShowBar] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState({ rating: 5, comment: "", ticketNumber: "", sent: false, busy: false });
  const { isSaved, toggle } = useSavedEvents();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Event not found");
      setDetail(json);
      // "More events you might like" — same category first, then newest
      const r = await fetch(`/api/events?status=published&tiers=1&category=${json.event.category ?? "all"}&limit=6`);
      const rd = await r.json();
      setRelated((rd.events ?? []).filter((e: EventCardData) => e.slug !== slug).slice(0, 4));
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // Floating action bar (Eventbrite pins this once the hero scrolls away)
  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const share = async () => {
    const url = `${window.location.origin}/events/${slug}`;
    try {
      if (navigator.share) { await navigator.share({ title: detail?.event.title ?? "Event", url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* dismissed */ }
  };

  const submitFeedback = async () => {
    if (!detail) return;
    setFeedback((f) => ({ ...f, busy: true }));
    try {
      await fetch(`/api/events/${detail.event.slug}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: feedback.rating, comment: feedback.comment, ticketNumber: feedback.ticketNumber || undefined }),
      });
      setFeedback((f) => ({ ...f, sent: true, busy: false }));
      load();
    } catch {
      setFeedback((f) => ({ ...f, busy: false }));
    }
  };

  const tiers = detail?.tiers ?? [];
  const price = useMemo(() => priceSummaryLabel(tiers.map((t) => ({ price: t.price, type: t.type }))), [tiers]);
  const cartTotal = useMemo(
    () => tiers.reduce((sum, t) => sum + (qty[t.id] ?? 0) * parseFloat(String(t.price ?? 0)), 0),
    [tiers, qty]
  );
  const cartCount = Object.values(qty).reduce((a, b) => a + b, 0);

  const openRegister = (tierId?: string, quantity = 1) => {
    setRegisterTier(tierId ?? null);
    setRegisterQty(quantity);
    setRegisterOpen(true);
  };

  if (loading) {
    return (
      <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
        <Navbar />
        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-24 space-y-5">
          <div className="skeleton" style={{ height: 320, borderRadius: 20 }} />
          <div className="skeleton h-8 w-2/3" />
          <div className="skeleton h-5 w-1/3" />
          <div className="skeleton h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ background: "var(--surface)", minHeight: "100dvh" }}>
        <Navbar />
        <div className="flex items-center justify-center" style={{ height: "80vh" }}>
          <div className="text-center">
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>😕</div>
            <h2 className="heading-2 mb-2" style={{ color: "var(--text-1)" }}>Event not found</h2>
            <Link href="/events" className="btn btn-primary mt-4">← Browse Events</Link>
          </div>
        </div>
      </div>
    );
  }

  const { event, stats, organiser, workspace } = detail;
  const catLabel = EVENT_CATEGORIES.find((c) => c.value === event.category)?.label ?? event.category;
  const catIcon = CAT_ICONS[event.category ?? "other"] ?? "🎪";
  const saved = isSaved(slug);
  const soldOut = !!event.soldOut || (!!event.capacity && (event.totalRegistrations ?? 0) >= event.capacity);
  const isPast = event.endDate ? new Date(event.endDate) < new Date() : false;
  const sessionCount = workspace?.occurrences.length ?? 0;
  const openSlots = (workspace?.slots ?? []).filter((s) => s.isActive !== false);
  const coverEvent: EventCardData = {
    id: event.id, title: event.title, slug, imageUrl: event.imageUrl, bannerColor: event.bannerColor,
    category: event.category, soldOut: event.soldOut, capacity: event.capacity, totalRegistrations: event.totalRegistrations,
  };

  return (
    <div style={{ background: "#fff", minHeight: "100dvh" }}>
      <Navbar />

      {/* ── Floating action bar ── */}
      {showBar && (
        <div
          className="fixed left-0 right-0 z-40 anim-fadeIn"
          style={{ top: 64, background: "rgba(255,255,255,0.98)", backdropFilter: "blur(18px)", borderBottom: "1px solid var(--border)", boxShadow: "0 2px 18px rgba(10,10,15,0.07)" }}
        >
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-2.5 flex items-center gap-4">
            <div className="hidden sm:block shrink-0" style={{ width: 52 }}>
              <EventCover event={coverEvent} height={38} rounded="8px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate" style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.01em" }}>
                {event.title}
              </p>
              <p className="truncate" style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>
                {formatDate(event.startDate)} · {locationLine(event.city, event.venue, event.format)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => toggle(slug)} aria-label="Save" className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ border: "1px solid var(--border)" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill={saved ? "#DC2626" : "none"} stroke={saved ? "#DC2626" : "#3D3D5C"} strokeWidth="1.6">
                  <path d="M8 14s-5.5-3.4-5.5-7A3.2 3.2 0 0 1 8 4.6 3.2 3.2 0 0 1 13.5 7c0 3.6-5.5 7-5.5 7z" strokeLinejoin="round" />
                </svg>
              </button>
              <button onClick={share} aria-label="Share" className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ border: "1px solid var(--border)" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#3D3D5C" strokeWidth="1.5">
                  <path d="M8 10.5V2m0 0L5 5m3-3l3 3M3 9.5V13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => openRegister()} disabled={soldOut && !event.waitlistEnabled} style={{ padding: "0.55rem 1.2rem" }}>
                {soldOut ? (event.waitlistEnabled ? "Join waitlist" : "Sold out") : "Get tickets"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <div className="relative">
        <EventCover event={coverEvent} height="clamp(260px, 44vh, 460px)" rounded="0" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.35) 100%)" }} />

        <div className="absolute top-20 left-5 sm:left-8">
          <Link href="/events" className="glass flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm font-semibold">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            All events
          </Link>
        </div>

        <div className="absolute top-20 right-5 sm:right-8 flex items-center gap-2">
          <button onClick={share} className="glass px-3 py-1.5 rounded-full text-white text-sm font-semibold flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 10.5V2m0 0L5 5m3-3l3 3M3 9.5V13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Share
          </button>
          <button onClick={() => toggle(slug)} aria-label="Save event" className="glass w-9 h-9 rounded-full flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill={saved ? "#F87171" : "none"} stroke={saved ? "#F87171" : "#fff"} strokeWidth="1.7">
              <path d="M8 14s-5.5-3.4-5.5-7A3.2 3.2 0 0 1 8 4.6 3.2 3.2 0 0 1 13.5 7c0 3.6-5.5 7-5.5 7z" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="absolute bottom-5 left-5 right-5 sm:left-8 sm:right-8 flex flex-wrap items-center gap-2">
          <span className="badge glass text-white" style={{ fontSize: "0.68rem" }}>{catIcon} {catLabel}</span>
          <span className="badge glass text-white" style={{ fontSize: "0.68rem" }}>{event.format === "online" ? "💻" : "📍"} {formatLabel(event.format)}</span>
          {event.type && event.type !== "standard" && (
            <span className="badge glass text-white" style={{ fontSize: "0.68rem" }}>
              {event.type === "recurring" ? "🔁 Recurring" : event.type === "timeslot" ? "⏰ Time slots" : event.type}
            </span>
          )}
          {soldOut && <span className="badge badge-red" style={{ fontSize: "0.68rem" }}>Sold out</span>}
          {!soldOut && !isPast && timeUntil(event.startDate) && (
            <span className="badge glass text-white" style={{ fontSize: "0.68rem" }}>{timeUntil(event.startDate)}</span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* ── LEFT: content ── */}
          <div className="lg:col-span-2">
            {registered && (
              <div className="mb-5 p-4 rounded-2xl flex items-center gap-3" style={{ background: "#D1FAE5", border: "1px solid #A7F3D0" }}>
                <span style={{ fontSize: "1.3rem" }}>🎉</span>
                <div>
                  <p style={{ fontSize: "0.86rem", fontWeight: 700, color: "#065F46" }}>You&apos;re on the list</p>
                  <p style={{ fontSize: "0.78rem", color: "#047857" }}>Your digital ticket with the QR code is ready.</p>
                </div>
              </div>
            )}

            <h1 style={{ fontSize: "clamp(1.6rem, 3.6vw, 2.3rem)", fontWeight: 900, letterSpacing: "-0.035em", color: "var(--text-1)", lineHeight: 1.15 }}>
              {event.title}
            </h1>
            {event.tagline && (
              <p style={{ fontSize: "1rem", color: "var(--text-2)", marginTop: "0.5rem", lineHeight: 1.65 }}>{event.tagline}</p>
            )}

            {/* Organiser row */}
            <div className="flex items-center gap-3 mt-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #7C3AED, #4C1D95)", fontSize: "1rem" }}>
                {(organiser?.organisation ?? organiser?.name ?? "U").charAt(0)}
              </div>
              <div className="min-w-0">
                <p style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
                  By <strong style={{ color: "var(--text-2)" }}>{organiser?.organisation ?? organiser?.name ?? "UEB organiser"}</strong>
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                  {stats.totalRegistrations} registered · {stats.checkedIn} admitted · {stats.approved} approved
                </p>
              </div>
            </div>

            {/* Date / location */}
            <div className="mt-5 space-y-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--violet-bg)" }}>📅</div>
                <div>
                  <p style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-1)" }}>{eventDateLine(event.startDate, event.endDate)}</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
                    {formatDuration(event.startDate, event.endDate)}
                    {event.recurrenceRule ? ` · ${describeRecurrence(event.recurrenceRule)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--violet-bg)" }}>
                  {event.format === "online" ? "💻" : "📍"}
                </div>
                <div>
                  <p style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-1)" }}>{locationLine(event.city, event.venue, event.format)}</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>{[event.address, event.country].filter(Boolean).join(", ") || "Address shown on your ticket"}</p>
                  {event.format !== "online" && (event.address || event.venue) && (
                    <a
                      style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--violet-mid)" }}
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.venue, event.address, event.city].filter(Boolean).join(", "))}`}
                      target="_blank" rel="noopener noreferrer"
                    >
                      Show map →
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Good to know */}
            <div className="mt-7">
              <h2 className="heading-2 mb-3" style={{ color: "var(--text-1)", fontSize: "1.15rem" }}>Good to know</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <p className="label-caps mb-2" style={{ color: "var(--text-3)" }}>Highlights</p>
                  <ul className="space-y-1.5">
                    {[
                      formatDuration(event.startDate, event.endDate),
                      formatLabel(event.format),
                      event.ageRestriction,
                      ...(event.highlights ?? []),
                    ].filter((v): v is string => !!v && v.length > 0).slice(0, 6).map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <span style={{ color: "var(--violet-mid)", marginTop: -1 }}>•</span>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-2)", lineHeight: 1.55 }}>{h}</span>
                      </li>
                    ))}
                    {!(event.highlights ?? []).length && !formatDuration(event.startDate, event.endDate) && (
                      <li style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>Details on the event page</li>
                    )}
                  </ul>
                </div>
                <div className="p-4 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <p className="label-caps mb-2" style={{ color: "var(--text-3)" }}>Refund policy</p>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-2)", lineHeight: 1.6 }}>
                    {event.refundPolicy ?? "No refunds — contact the organiser for exceptional cases."}
                  </p>
                  {event.requiresApproval && (
                    <p style={{ fontSize: "0.78rem", color: "var(--amber)", fontWeight: 700, marginTop: "0.5rem" }}>
                      ⏳ Registration requires organiser approval
                    </p>
                  )}
                  {workspace?.seating.enabled && workspace.seating.summary.totalSeats > 0 && (
                    <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: "0.5rem" }}>
                      🪑 Reserved seating · {workspace.seating.summary.available} of {workspace.seating.summary.totalSeats} seats free
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Overview */}
            {event.description && (
              <div className="mt-8">
                <h2 className="heading-2 mb-3" style={{ color: "var(--text-1)", fontSize: "1.15rem" }}>Overview</h2>
                <p
                  style={{
                    fontSize: "0.94rem", color: "var(--text-2)", lineHeight: 1.85, whiteSpace: "pre-line",
                    ...(showAll ? {} : { display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties),
                  }}
                >
                  {event.description}
                </p>
                <button onClick={() => setShowAll((v) => !v)} className="btn btn-outline btn-sm mt-3">
                  {showAll ? "Show less" : "Read more"}
                </button>
              </div>
            )}

            {/* Agenda: recurring sessions or appointment slots */}
            {sessionCount > 0 && (
              <div className="mt-8">
                <h2 className="heading-2 mb-1" style={{ color: "var(--text-1)", fontSize: "1.15rem" }}>Agenda</h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text-3)", marginBottom: "1rem" }}>
                  {sessionCount} session{sessionCount === 1 ? "" : "s"} in this series — your ticket covers every session.
                </p>
                <div className="space-y-2">
                  {workspace!.occurrences.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)" }}>{o.label ?? "Session"}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
                        {formatDate(o.startDate)} · {formatTime(o.startDate)}{o.endDate ? ` – ${formatTime(o.endDate)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {openSlots.length > 0 && (
              <div className="mt-8">
                <h2 className="heading-2 mb-1" style={{ color: "var(--text-1)", fontSize: "1.15rem" }}>Time slots</h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text-3)", marginBottom: "1rem" }}>
                  {openSlots.filter((s) => (s.remaining ?? 1) > 0).length} appointment{openSlots.filter((s) => (s.remaining ?? 1) > 0).length === 1 ? "" : "s"} still available — pick one when you register.
                </p>
                <div className="flex flex-wrap gap-2">
                  {openSlots.slice(0, 24).map((s) => {
                    const full = (s.remaining ?? 1) <= 0;
                    return (
                      <button
                        key={s.id}
                        disabled={full}
                        onClick={() => openRegister()}
                        className="px-3 py-2 rounded-xl font-semibold"
                        style={{
                          fontSize: "0.78rem",
                          background: full ? "var(--surface-2)" : "var(--violet-bg)",
                          color: full ? "var(--text-3)" : "var(--violet-low)",
                          border: `1px solid ${full ? "var(--border)" : "var(--violet-rim)"}`,
                          textDecoration: full ? "line-through" : "none",
                          cursor: full ? "not-allowed" : "pointer",
                        }}
                      >
                        {s.label ?? `${formatDate(s.startDate)} ${formatTime(s.startDate)}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vendors */}
            {!!workspace?.vendors.length && (
              <div className="mt-8">
                <h2 className="heading-2 mb-3" style={{ color: "var(--text-1)", fontSize: "1.15rem" }}>Vendors &amp; exhibitors</h2>
                <div className="flex flex-wrap gap-2">
                  {workspace.vendors.map((v) => (
                    <span key={v.id} className="badge badge-violet" style={{ fontSize: "0.74rem" }}>
                      🏪 {v.name}{v.category ? ` · ${v.category}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ */}
            {!!(event.faqs ?? []).length && (
              <div className="mt-8">
                <h2 className="heading-2 mb-3" style={{ color: "var(--text-1)", fontSize: "1.15rem" }}>Frequently asked questions</h2>
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  {(event.faqs ?? []).map((f, i) => (
                    <div key={f.question} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                      <button
                        className="w-full text-left flex items-center justify-between gap-3 p-4"
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        style={{ background: openFaq === i ? "var(--surface)" : "#fff" }}
                      >
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-1)" }}>{f.question}</span>
                        <span style={{ color: "var(--text-3)", transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
                      </button>
                      {openFaq === i && (
                        <p style={{ padding: "0 1rem 1rem", fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.7 }}>{f.answer}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Post-event feedback */}
            {(isPast || event.completedAt) && (
              <div className="mt-8 p-5 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <h2 className="heading-2 mb-1" style={{ color: "var(--text-1)", fontSize: "1.15rem" }}>How was it?</h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text-3)", marginBottom: "1rem" }}>
                  {workspace?.feedback.responses
                    ? `${workspace.feedback.responses} attendees rated this event ${workspace.feedback.averageRating}/5`
                    : "Be the first to share feedback"}
                </p>
                {feedback.sent ? (
                  <p className="font-bold" style={{ fontSize: "0.88rem", color: "var(--green)" }}>Thank you for your feedback 💜</p>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setFeedback((f) => ({ ...f, rating: star }))} aria-label={`${star} stars`}
                          style={{ fontSize: "1.6rem", background: "none", border: "none", cursor: "pointer", opacity: star <= feedback.rating ? 1 : 0.3 }}>★</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input className="input" style={{ fontSize: "0.85rem" }} placeholder="Ticket number (optional)"
                        value={feedback.ticketNumber} onChange={(e) => setFeedback((f) => ({ ...f, ticketNumber: e.target.value.toUpperCase() }))} />
                      <input className="input sm:col-span-2" style={{ fontSize: "0.85rem" }} placeholder="What worked, what could be better?"
                        value={feedback.comment} onChange={(e) => setFeedback((f) => ({ ...f, comment: e.target.value }))} />
                    </div>
                    <button className="btn btn-primary btn-sm mt-3" disabled={feedback.busy} onClick={submitFeedback}>
                      {feedback.busy ? "Sending…" : "Submit feedback"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Organiser tools — kept out of the attendee path */}
            <div className="mt-10 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="label-caps mb-3" style={{ color: "var(--text-3)" }}>Organiser tools</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/events/${event.slug}/manage`} className="btn btn-outline btn-sm">⚙ Manage event</Link>
                <Link href={`/events/${event.slug}/report`} className="btn btn-outline btn-sm">🧾 Event report</Link>
                <Link href={`/checkin?event=${event.id}&slug=${event.slug}`} className="btn btn-outline btn-sm">📱 Check-in desk</Link>
              </div>
            </div>
          </div>

          {/* ── RIGHT: sticky ticket rail ── */}
          <div className="lg:col-span-1">
            <div className="lg:sticky" style={{ top: 96 }}>
              <div className="p-5 rounded-3xl" style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="label-caps" style={{ color: "var(--text-3)" }}>Tickets</p>
                    <p style={{ fontSize: "1.3rem", fontWeight: 900, color: price.free ? "var(--green)" : "var(--text-1)", letterSpacing: "-0.03em" }}>
                      {price.label}
                    </p>
                  </div>
                  {event.status && <span className={`badge ${getStatusColor(event.status)}`} style={{ fontSize: "0.64rem" }}>{event.status}</span>}
                </div>

                <div className="space-y-2 mb-4">
                  {tiers.map((t) => {
                    const tPrice = parseFloat(String(t.price ?? 0));
                    const tFee = tPrice > 0 ? calculateUEBFee(tPrice) : 0;
                    const full = !!(t.quantity && (t.quantitySold ?? 0) >= t.quantity);
                    const selected = (qty[t.id] ?? 0) > 0;
                    return (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl"
                        style={{
                          border: `1.5px solid ${selected ? "var(--violet-mid)" : "var(--border)"}`,
                          background: selected ? "var(--violet-bg)" : "#fff",
                          opacity: full ? 0.55 : 1,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "var(--text-1)" }}>{t.name}</span>
                              {t.isInvitationOnly ? <span className="badge badge-gold" style={{ fontSize: "0.56rem" }}>invite only</span> : null}
                              {t.groupSize && t.groupSize > 1 ? <span className="badge badge-blue" style={{ fontSize: "0.56rem" }}>group</span> : null}
                            </div>
                            {t.quantity ? (
                              <p style={{ fontSize: "0.7rem", color: full ? "var(--red)" : "var(--text-3)", fontWeight: 600, marginTop: "0.1rem" }}>
                                {full ? "Sold out" : `${t.quantity - (t.quantitySold ?? 0)} left`}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right shrink-0">
                            <p style={{ fontSize: "0.86rem", fontWeight: 800, color: "var(--text-1)" }}>
                              {tPrice === 0 ? "Free" : formatCurrency(event.feeAbsorbedByOrganiser ? tPrice : tPrice + tFee)}
                            </p>
                            {tPrice > 0 && !event.feeAbsorbedByOrganiser && (
                              <p style={{ fontSize: "0.64rem", color: "var(--text-3)" }}>incl. ₦{tFee.toLocaleString()}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              className="w-7 h-7 rounded-lg font-bold"
                              disabled={full || (qty[t.id] ?? 0) === 0}
                              onClick={() => setQty((q) => ({ ...q, [t.id]: Math.max(0, (q[t.id] ?? 0) - 1) }))}
                              style={{ background: "var(--surface-2)", color: "var(--text-2)", opacity: full || (qty[t.id] ?? 0) === 0 ? 0.5 : 1 }}
                            >−</button>
                            <span style={{ minWidth: 20, textAlign: "center", fontWeight: 800, fontSize: "0.85rem", color: "var(--text-1)" }}>{qty[t.id] ?? 0}</span>
                            <button
                              className="w-7 h-7 rounded-lg font-bold"
                              disabled={full || (qty[t.id] ?? 0) >= 20}
                              onClick={() => setQty((q) => ({ ...q, [t.id]: Math.min(20, (q[t.id] ?? 0) + 1) }))}
                              style={{ background: "var(--surface-2)", color: "var(--text-2)", opacity: full ? 0.5 : 1 }}
                            >+</button>
                          </div>
                          <button
                            className="btn btn-outline btn-sm"
                            disabled={full}
                            style={{ fontSize: "0.72rem", padding: "0.35rem 0.8rem" }}
                            onClick={() => openRegister(t.id, Math.max(1, qty[t.id] ?? 1))}
                          >
                            Register
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {tiers.length === 0 && (
                    <p style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>Ticket types are being finalised.</p>
                  )}
                </div>

                {cartCount > 0 && (
                  <div className="p-3.5 rounded-xl mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: "0.82rem", color: "var(--text-2)" }}>{cartCount} ticket{cartCount === 1 ? "" : "s"}</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-1)" }}>{cartTotal === 0 ? "Free" : formatCurrency(cartTotal)}</span>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-primary w-full justify-center"
                  style={{ padding: "0.85rem" }}
                  onClick={() => {
                    const firstTier = tiers.find((t) => (qty[t.id] ?? 0) > 0);
                    openRegister(firstTier?.id, Math.max(1, firstTier ? qty[firstTier.id] : 1));
                  }}
                  disabled={soldOut && !event.waitlistEnabled}
                >
                  {soldOut ? (event.waitlistEnabled ? "Join the waitlist" : "Sold out") : cartCount > 0 ? `Get ${cartCount} ticket${cartCount === 1 ? "" : "s"}` : "Get tickets"}
                </button>

                <p style={{ fontSize: "0.72rem", color: "var(--text-3)", textAlign: "center", marginTop: "0.7rem", lineHeight: 1.6 }}>
                  {event.requiresApproval ? "⏳ Approved before tickets are issued · " : "✅ Instant confirmation · "}
                  {event.feeAbsorbedByOrganiser ? "fees included" : "8% + ₦100 fee shown at checkout"}
                </p>

                {event.capacity && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>
                        {event.totalRegistrations ?? 0} / {event.capacity} registered
                      </span>
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-3)" }}>
                        {Math.max(0, event.capacity - (event.totalRegistrations ?? 0))} spots left
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{
                        width: `${Math.min(100, Math.round(((event.totalRegistrations ?? 0) / event.capacity) * 100))}%`,
                        background: (event.totalRegistrations ?? 0) / event.capacity >= 0.8 ? "linear-gradient(90deg,#DC2626,#EF4444)" : "linear-gradient(90deg,var(--violet),var(--violet-hi))",
                      }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Share */}
              <div className="p-4 rounded-2xl mt-4" style={{ border: "1px solid var(--border)" }}>
                <p className="label-caps mb-3" style={{ color: "var(--text-3)" }}>Share this event</p>
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${event.title} — ${eventDateLine(event.startDate, event.endDate)}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold"
                    style={{ fontSize: "0.75rem", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)" }}
                  >💬 WhatsApp</a>
                  <button onClick={share} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold"
                    style={{ fontSize: "0.75rem", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)" }}>
                    {copied ? "✓ Copied" : "🔗 Copy link"}
                  </button>
                  <button onClick={() => toggle(slug)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold"
                    style={{ fontSize: "0.75rem", background: saved ? "#FEE2E2" : "var(--surface)", border: "1px solid var(--border)", color: saved ? "#991B1B" : "var(--text-2)" }}>
                    {saved ? "♥ Saved" : "♡ Save"}
                  </button>
                </div>
              </div>

              {/* Organiser card */}
              {organiser && (
                <div className="p-4 rounded-2xl mt-4" style={{ border: "1px solid var(--border)" }}>
                  <p className="label-caps mb-3" style={{ color: "var(--text-3)" }}>Organised by</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shrink-0"
                      style={{ background: "linear-gradient(135deg, #7C3AED, #4C1D95)" }}>
                      {(organiser.organisation ?? organiser.name).charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text-1)" }}>
                        {organiser.organisation ?? organiser.name}
                      </p>
                      <p className="truncate" style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>{organiser.email}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: "0.74rem", color: "var(--text-3)", marginTop: "0.7rem", lineHeight: 1.6 }}>
                    All events on UEB are run by verified organisers. Questions? Message the organiser before you buy.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── More events ── */}
        {related.length > 0 && (
          <div className="mt-14 pt-8" style={{ borderTop: "1px solid var(--border)" }}>
            <h2 className="heading-2 mb-1" style={{ color: "var(--text-1)" }}>You might also like…</h2>
            <p style={{ fontSize: "0.84rem", color: "var(--text-3)", marginBottom: "1.1rem" }}>
              More events with similar dates, prices and formats.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((ev) => (
                <EventRowCard key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        )}
      </div>

      {registerOpen && (
        <RegistrationModal
          event={event}
          tiers={tiers}
          slots={workspace?.slots ?? []}
          initialTierId={registerTier}
          initialQuantity={registerQty}
          onClose={() => setRegisterOpen(false)}
          onRegistered={() => { setRegistered(true); load(); }}
        />
      )}
    </div>
  );
}
