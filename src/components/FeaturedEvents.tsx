"use client";
import { useState } from "react";
import EventCard, { type EventCardData } from "@/components/EventCard";
import EventDetailsModal from "@/components/EventDetailsModal";

/**
 * Home-page featured list.
 *
 * Server-rendered pages can't hold click state, so this thin client wrapper
 * keeps the "click any event → details pop out" behaviour identical to the
 * Discover page: the card opens the quick-look modal in place, and visitors who
 * want the full page use the modal's "Full details" button. Nothing here ever
 * sends a visitor off UEB.
 */
export default function FeaturedEvents({ events }: { events: EventCardData[] }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((ev, i) => (
          <div key={ev.id} className="anim-fadeUp" style={{ animationDelay: `${i * 0.08}s` }}>
            <EventCard event={ev} onOpen={setOpenSlug} />
          </div>
        ))}
      </div>

      {openSlug && (
        <EventDetailsModal
          slug={openSlug}
          initial={events.find((e) => e.slug === openSlug)}
          onClose={() => setOpenSlug(null)}
        />
      )}
    </>
  );
}
