"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  eventDateWithMore,
  formatCurrency,
  locationLine,
  priceSummaryLabel,
  formatLabel,
  eventDateShort,
} from "@/lib/utils";
import { useSavedEvents } from "@/lib/useSavedEvents";

export type EventCardData = {
  id: string;
  title: string;
  slug: string;
  tagline?: string | null;
  description?: string | null;
  category?: string | null;
  type?: string | null;
  format?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  venue?: string | null;
  city?: string | null;
  imageUrl?: string | null;
  bannerColor?: string | null;
  capacity?: number | null;
  totalRegistrations?: number | null;
  soldOut?: boolean | null;
  organiserName?: string | null;
  organiserOrg?: string | null;
  organiserFollowers?: number | null;
  nextSessionDate?: string | Date | null;
  sessionCount?: number | null;
  timeSlotCount?: number | null;
  tiers?: { id: string; name: string; price: string | number | null; type?: string | null }[] | null;
};

const CAT_ICONS: Record<string, string> = {
  conference: "🎤", seminar: "📚", workshop: "🔧", concert: "🎸", corporate: "💼", university: "🎓",
  church: "⛪", government: "🏛️", wedding: "💍", networking: "🤝", training: "📋", exhibition: "🖼️",
  fundraising: "💝", private: "🔒", other: "🎪",
};

/** Renders the cover: uploaded image when present, otherwise a category-tinted banner. */
export function EventCover({ event, height = 190, rounded = "16px 16px 0 0" }: { event: EventCardData; height?: number | string; rounded?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = !!event.imageUrl && !failed;
  return (
    <div
      className="relative overflow-hidden"
      style={{
        height,
        borderRadius: rounded,
        background: event.imageUrl
          ? "var(--surface-2)"
          : `linear-gradient(135deg, ${event.bannerColor ?? "#7C3AED"} 0%, ${event.bannerColor ?? "#4C1D95"}99 100%)`,
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.imageUrl as string}
          alt={event.title}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: "2.4rem", opacity: 0.9 }}>
          {CAT_ICONS[event.category ?? "other"] ?? "🎪"}
        </div>
      )}
      {(event.soldOut || (event.capacity && event.totalRegistrations && event.totalRegistrations >= event.capacity)) && (
        <span className="badge badge-red" style={{ position: "absolute", top: 10, left: 10, fontSize: "0.62rem" }}>
          Sold out
        </span>
      )}
    </div>
  );
}

export default function EventCard({ event, onOpen }: { event: EventCardData; onOpen?: (slug: string) => void }) {
  const { isSaved, toggle } = useSavedEvents();
  const saved = isSaved(event.slug);

  const price = priceSummaryLabel(event.tiers ?? []);
  const upcoming = event.nextSessionDate ?? event.startDate;
  const extraDates = Math.max((event.sessionCount ?? 0) - 1, 0);
  const organiser = event.organiserOrg ?? event.organiserName ?? "Event organiser";

  const open = (e: React.MouseEvent) => {
    if (!onOpen) return;
    e.preventDefault();
    onOpen(event.slug);
  };

  return (
    <article className="group" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="relative">
        <Link href={`/events/${event.slug}`} onClick={open} aria-label={event.title} style={{ display: "block" }}>
          <EventCover event={event} height={186} />
        </Link>
        <button
          type="button"
          aria-label={saved ? "Remove from saved" : "Save this event"}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(event.slug); }}
          style={{
            position: "absolute", top: 10, right: 10,
            width: 34, height: 34, borderRadius: 999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)",
            border: "1px solid rgba(10,10,15,0.08)", cursor: "pointer",
            boxShadow: "0 2px 8px rgba(10,10,15,0.12)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill={saved ? "#DC2626" : "none"} stroke={saved ? "#DC2626" : "#3D3D5C"} strokeWidth="1.6">
            <path d="M8 14s-5.5-3.4-5.5-7A3.2 3.2 0 0 1 8 4.6 3.2 3.2 0 0 1 13.5 7c0 3.6-5.5 7-5.5 7z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div style={{ paddingTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.3rem", flex: 1 }}>
        <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--violet-mid)", letterSpacing: "0.01em" }}>
          {upcoming ? eventDateWithMore(upcoming, extraDates) : "Date to be announced"}
        </p>

        <Link href={`/events/${event.slug}`} onClick={open}>
          <h3
            className="truncate-2"
            style={{ fontSize: "1.02rem", fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em", lineHeight: 1.35, transition: "color 0.15s" }}
          >
            {event.title}
          </h3>
        </Link>

        <p className="truncate-2" style={{ fontSize: "0.82rem", color: "var(--text-3)", lineHeight: 1.5 }}>
          {event.tagline ?? locationLine(event.city, event.venue, event.format)}
        </p>

        <p style={{ fontSize: "0.8rem", fontWeight: 700, color: price.free ? "var(--green)" : "var(--text-1)", textDecoration: price.free ? "underline" : "none", marginTop: "0.15rem" }}>
          {price.label}
        </p>

        <div style={{ marginTop: "auto", paddingTop: "0.6rem" }}>
          <p style={{ fontSize: "0.78rem", color: "var(--text-2)", fontWeight: 600 }} className="truncate-2">
            {organiser}
          </p>
          <p style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
            {event.organiserFollowers ? `${event.organiserFollowers.toLocaleString()} followers` : formatLabel(event.format)}
          </p>
          <p style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "0.15rem" }}>
            {Number(event.totalRegistrations ?? 0).toLocaleString()} registered
          </p>
        </div>
      </div>
    </article>
  );
}

/** Small horizontal row card used in "You might also like…" rails. */
export function EventRowCard({ event, onOpen }: { event: EventCardData; onOpen?: (slug: string) => void }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(event.slug); } }}
      className="flex gap-3 items-center p-2 rounded-xl transition-colors"
      style={{ border: "1px solid var(--border)", background: "#fff" }}
    >
      <div style={{ width: 96, flexShrink: 0 }}>
        <EventCover event={event} height={68} rounded="10px" />
      </div>
      <div className="min-w-0">
        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--violet-mid)" }}>
          {eventDateShort(event.nextSessionDate ?? event.startDate)}
        </p>
        <p className="truncate-2" style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text-1)", lineHeight: 1.35 }}>
          {event.title}
        </p>
        <p style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
          {formatCurrency(priceSummaryLabel(event.tiers ?? []).minPrice)} · {locationLine(event.city, event.venue, event.format)}
        </p>
      </div>
    </Link>
  );
}
