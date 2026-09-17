"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EventCover, type EventCardData } from "@/components/EventCard";
import RegistrationModal, { type RegEvent, type RegSlot, type RegTier } from "@/components/RegistrationModal";
import {
  eventDateLine,
  formatCurrency,
  formatDuration,
  formatLabel,
  getStatusColor,
  locationLine,
  priceSummaryLabel,
  timeUntil,
} from "@/lib/utils";
import { useSavedEvents } from "@/lib/useSavedEvents";

type Detail = {
  event: RegEvent & {
    description?: string | null;
    tagline?: string | null;
    imageUrl?: string | null;
    bannerColor?: string | null;
    address?: string | null;
    country?: string | null;
    status?: string | null;
    highlights?: string[] | null;
    refundPolicy?: string | null;
    gallery?: string[] | null;
    ageRestriction?: string | null;
  };
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

/**
 * The click-through pop-out. Mirrors Eventbrite's quick-look: cover, date,
 * location, price, organiser, overview and the CTA — with the full registration
 * flow inlined so a visitor never has to leave the page (and never leaves UEB).
 */
export default function EventDetailsModal({
  slug, initial, onClose,
}: {
  slug: string;
  initial?: EventCardData;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [copied, setCopied] = useState(false);
  const { isSaved, toggle } = useSavedEvents();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setDetail(json);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const share = async () => {
    const url = `${window.location.origin}/events/${slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: detail?.event.title ?? initial?.title ?? "Event", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const event = detail?.event;
  const tiers = detail?.tiers ?? [];
  const slots = detail?.workspace?.slots ?? [];
  const price = priceSummaryLabel(tiers.map((t) => ({ price: t.price, type: t.type })));
  const saved = isSaved(slug);
  const soldOut = !!event?.soldOut || (!!event?.capacity && (event.totalRegistrations ?? 0) >= event.capacity);
  const coverEvent: EventCardData = {
    id: event?.id ?? initial?.id ?? slug,
    title: event?.title ?? initial?.title ?? "",
    slug,
    imageUrl: event?.imageUrl ?? initial?.imageUrl ?? null,
    bannerColor: event?.bannerColor ?? initial?.bannerColor ?? null,
    category: initial?.category ?? null,
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto"
        style={{ background: "rgba(10,10,15,0.6)", backdropFilter: "blur(3px)" }}
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div
          className="anim-scaleIn relative w-full sm:max-w-3xl my-0 sm:my-6"
          style={{ background: "#fff", borderRadius: "0 0 20px 20px", boxShadow: "var(--shadow-xl)", overflow: "hidden" }}
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="p-6 space-y-4">
              <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
              <div className="skeleton h-6 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-24 w-full" />
            </div>
          ) : !event ? (
            <div className="p-10 text-center">
              <div style={{ fontSize: "2.6rem", marginBottom: "0.6rem" }}>😕</div>
              <h3 className="heading-2 mb-3" style={{ color: "var(--text-1)" }}>Event unavailable</h3>
              <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
            </div>
          ) : (
            <>
              {/* Cover */}
              <div className="relative">
                <EventCover event={coverEvent} height="clamp(190px, 32vh, 300px)" rounded="0" />
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={() => toggle(slug)}
                    aria-label={saved ? "Remove from saved" : "Save this event"}
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.94)", boxShadow: "0 2px 10px rgba(10,10,15,0.18)" }}
                  >
                    <svg width="17" height="17" viewBox="0 0 16 16" fill={saved ? "#DC2626" : "none"} stroke={saved ? "#DC2626" : "#3D3D5C"} strokeWidth="1.6">
                      <path d="M8 14s-5.5-3.4-5.5-7A3.2 3.2 0 0 1 8 4.6 3.2 3.2 0 0 1 13.5 7c0 3.6-5.5 7-5.5 7z" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    onClick={share}
                    aria-label="Share this event"
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.94)", boxShadow: "0 2px 10px rgba(10,10,15,0.18)" }}
                  >
                    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="#3D3D5C" strokeWidth="1.5">
                      <path d="M8 10.5V2m0 0L5 5m3-3l3 3M3 9.5V13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.94)", boxShadow: "0 2px 10px rgba(10,10,15,0.18)" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="#3D3D5C" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                </div>
                {soldOut && (
                  <span className="badge badge-red" style={{ position: "absolute", top: 14, left: 14 }}>Sold out</span>
                )}
              </div>

              <div className="p-5 sm:p-7">
                {registered && (
                  <div className="mb-4 p-3 rounded-xl flex items-center gap-2" style={{ background: "#D1FAE5", border: "1px solid #A7F3D0" }}>
                    <span>🎉</span>
                    <p style={{ fontSize: "0.82rem", color: "#065F46", fontWeight: 600 }}>
                      You&apos;re registered — your digital ticket is ready.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {event.format && (
                    <span className="badge badge-violet" style={{ fontSize: "0.66rem" }}>{formatLabel(event.format)}</span>
                  )}
                  {event.type && event.type !== "standard" && (
                    <span className="badge badge-blue" style={{ fontSize: "0.66rem" }}>
                      {event.type === "recurring" ? "🔁 Recurring" : event.type === "timeslot" ? "⏰ Time slots" : event.type}
                    </span>
                  )}
                  {event.status && event.status !== "published" && (
                    <span className={`badge ${getStatusColor(event.status)}`} style={{ fontSize: "0.66rem" }}>{event.status}</span>
                  )}
                  {timeUntil(event.startDate) && (
                    <span style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 600 }}>{timeUntil(event.startDate)}</span>
                  )}
                </div>

                <h2 style={{ fontSize: "clamp(1.35rem, 3vw, 1.8rem)", fontWeight: 900, letterSpacing: "-0.03em", color: "var(--text-1)", lineHeight: 1.2 }}>
                  {event.title}
                </h2>
                {event.tagline && (
                  <p style={{ fontSize: "0.92rem", color: "var(--text-2)", marginTop: "0.4rem", lineHeight: 1.6 }}>{event.tagline}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--violet-bg)" }}>📅</div>
                    <div>
                      <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)" }}>{eventDateLine(event.startDate, event.endDate)}</p>
                      {formatDuration(event.startDate, event.endDate) && (
                        <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{formatDuration(event.startDate, event.endDate)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--violet-bg)" }}>
                      {event.format === "online" ? "💻" : "📍"}
                    </div>
                    <div>
                      <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)" }}>
                        {locationLine(event.city, event.venue, event.format)}
                      </p>
                      <p className="truncate-2" style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                        {[event.address, event.country].filter(Boolean).join(", ") || "Details on the event page"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Price + CTA */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-6 p-4 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div>
                    <p className="label-caps" style={{ color: "var(--text-3)" }}>Tickets</p>
                    <p style={{ fontSize: "1.05rem", fontWeight: 900, color: price.free ? "var(--green)" : "var(--text-1)", letterSpacing: "-0.02em" }}>
                      {price.label}
                    </p>
                    {tiers.length > 1 && (
                      <p style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{tiers.length} ticket types available</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-primary"
                      style={{ padding: "0.7rem 1.4rem" }}
                      onClick={() => setRegisterOpen(true)}
                    >
                      {soldOut && event.waitlistEnabled ? "Join waitlist" : soldOut ? "Sold out" : "Get tickets"}
                    </button>
                    <Link href={`/events/${slug}`} className="btn btn-outline">Full details</Link>
                  </div>
                </div>

                {/* Overview */}
                {event.description && (
                  <div className="mt-6">
                    <h3 className="label-caps mb-2" style={{ color: "var(--text-3)" }}>About this event</h3>
                    <p
                      style={{
                        fontSize: "0.9rem", color: "var(--text-2)", lineHeight: 1.75, whiteSpace: "pre-line",
                        display: "-webkit-box", WebkitLineClamp: showAll ? "unset" : 4, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}
                    >
                      {event.description}
                    </p>
                    <button onClick={() => setShowAll((v) => !v)} style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--violet-mid)", marginTop: "0.4rem" }}>
                      {showAll ? "Show less" : "Read more"}
                    </button>
                  </div>
                )}

                {/* Highlights */}
                {event.highlights && event.highlights.length > 0 && (
                  <div className="mt-6">
                    <h3 className="label-caps mb-2" style={{ color: "var(--text-3)" }}>Good to know</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {event.highlights.slice(0, 4).map((h) => (
                        <div key={h} className="flex items-start gap-2">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginTop: 3, flexShrink: 0 }}>
                            <path d="M2 7.5l3 3 7-7.5" stroke="var(--violet-mid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span style={{ fontSize: "0.82rem", color: "var(--text-2)", lineHeight: 1.55 }}>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Organiser */}
                {detail?.organiser && (
                  <div className="flex items-center gap-3 mt-6 p-4 rounded-2xl" style={{ border: "1px solid var(--border)" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0"
                      style={{ background: "linear-gradient(135deg, #7C3AED, #4C1D95)" }}>
                      {(detail.organiser.organisation ?? detail.organiser.name).charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>By</p>
                      <p className="truncate" style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-1)" }}>
                        {detail.organiser.organisation ?? detail.organiser.name}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{detail.stats.totalRegistrations} registered</p>
                      <p style={{ fontSize: "0.72rem", color: "var(--green)", fontWeight: 700 }}>{detail.stats.checkedIn} admitted</p>
                    </div>
                  </div>
                )}

                {copied && (
                  <p style={{ fontSize: "0.75rem", color: "var(--green)", marginTop: "0.6rem" }}>Link copied to clipboard ✓</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {registerOpen && event && (
        <RegistrationModal
          event={event}
          tiers={tiers}
          slots={slots}
          onClose={() => setRegisterOpen(false)}
          onRegistered={() => { setRegistered(true); load(); }}
        />
      )}
    </>
  );
}
