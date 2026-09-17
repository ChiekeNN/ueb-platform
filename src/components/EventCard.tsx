import Link from "next/link";
import { formatDate, formatCurrency, EVENT_CATEGORIES } from "@/lib/utils";

type EventCardProps = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  startDate?: Date | string | null;
  venue?: string | null;
  city?: string | null;
  imageUrl?: string | null;
  bannerColor?: string | null;
  totalRegistrations?: number | null;
  capacity?: number | null;
  status?: string | null;
  tiers?: { type: string; price: string }[];
};

const CAT_ICONS: Record<string, string> = {
  conference: "🎤", seminar: "📚", workshop: "🔧", concert: "🎸",
  corporate: "💼", university: "🎓", church: "⛪", government: "🏛️",
  wedding: "💍", networking: "🤝", training: "📋", exhibition: "🖼️",
  fundraising: "💝", private: "🔒", other: "🎪",
};

export default function EventCard({ event }: { event: EventCardProps }) {
  const categoryLabel = EVENT_CATEGORIES.find(c => c.value === event.category)?.label ?? "Event";
  const catIcon = CAT_ICONS[event.category ?? "other"] ?? "🎪";
  const lowestPaid = event.tiers?.filter(t => parseFloat(t.price) > 0).sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
  const hasFree = !event.tiers?.length || event.tiers.some(t => parseFloat(t.price) === 0);
  const priceLabel = hasFree ? "Free" : lowestPaid ? `From ${formatCurrency(parseFloat(lowestPaid.price))}` : "Free";
  const isFree = priceLabel === "Free";

  const pct = event.capacity && event.totalRegistrations
    ? Math.min(100, Math.round((event.totalRegistrations / event.capacity) * 100))
    : 0;
  const nearFull = pct >= 80;

  return (
    <Link href={`/events/${event.slug}`} className="block group card card-lift">
      {/* Image / Banner */}
      <div
        className="relative overflow-hidden"
        style={{
          height: 168,
          background: event.imageUrl
            ? `url(${event.imageUrl}) center/cover no-repeat`
            : `linear-gradient(145deg, ${event.bannerColor ?? "#6D28D9"}CC, ${event.bannerColor ?? "#4C1D95"})`,
          borderRadius: "20px 20px 0 0",
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.55) 100%)" }} />

        {/* Top row */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between">
          <span
            className="flex items-center gap-1.5 label-caps text-white/90 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)" }}
          >
            <span>{catIcon}</span> {categoryLabel}
          </span>
          <span
            className="font-bold text-xs px-2.5 py-1 rounded-full"
            style={{
              background: isFree ? "rgba(5,150,105,0.9)" : "rgba(255,255,255,0.95)",
              color: isFree ? "#fff" : "#4C1D95",
              backdropFilter: "blur(8px)",
            }}
          >
            {priceLabel}
          </span>
        </div>

        {/* Hover overlay */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
          style={{ background: "rgba(109,40,217,0.15)" }}
        >
          <span
            className="btn btn-white px-5"
            style={{ fontSize: "0.8rem", padding: "0.5rem 1.25rem", transform: "translateY(6px)", transition: "transform 0.3s cubic-bezier(.22,.68,0,1.2)" }}
          >
            View Event →
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <h3
          className="font-bold leading-snug mb-2 truncate-2 group-hover:text-violet-600 transition-colors duration-200"
          style={{ fontSize: "0.97rem", color: "var(--text-1)", letterSpacing: "-0.015em" }}
        >
          {event.title}
        </h3>

        {event.description && (
          <p className="truncate-2 mb-3" style={{ fontSize: "0.8rem", color: "var(--text-3)", lineHeight: 1.55 }}>
            {event.description}
          </p>
        )}

        <div className="space-y-1.5 mb-4">
          {event.startDate && (
            <div className="flex items-center gap-2" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: "var(--violet-hi)", flexShrink: 0 }}>
                <rect x="1" y="2" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M1 5h11M4 1v2M9 1v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span className="font-medium">{formatDate(event.startDate)}</span>
            </div>
          )}
          {(event.venue || event.city) && (
            <div className="flex items-center gap-2" style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>
              <svg width="11" height="13" viewBox="0 0 11 13" fill="none" style={{ color: "var(--violet-hi)", flexShrink: 0 }}>
                <path d="M5.5 1C3.015 1 1 3.015 1 5.5c0 3.25 4.5 7 4.5 7s4.5-3.75 4.5-7C10 3.015 7.985 1 5.5 1z" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
              <span className="truncate font-medium">{[event.venue, event.city].filter(Boolean).join(", ")}</span>
            </div>
          )}
        </div>

        {/* Capacity bar */}
        {event.capacity ? (
          <div>
            <div className="flex justify-between mb-1" style={{ fontSize: "0.72rem" }}>
              <span style={{ color: "var(--text-3)" }}>{event.totalRegistrations ?? 0} registered</span>
              <span style={{ color: nearFull ? "var(--red)" : "var(--text-3)", fontWeight: 600 }}>
                {nearFull ? `${100 - pct}% left` : `${event.capacity} spots`}
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${pct}%`,
                  background: nearFull
                    ? "linear-gradient(90deg, #DC2626, #EF4444)"
                    : "linear-gradient(90deg, var(--violet), var(--violet-hi))",
                }}
              />
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5"
            style={{ fontSize: "0.75rem", color: "var(--text-3)" }}
          >
            <span style={{ color: "var(--green)" }}>●</span>
            <span>{event.totalRegistrations ?? 0} registered · Open capacity</span>
          </div>
        )}
      </div>
    </Link>
  );
}
