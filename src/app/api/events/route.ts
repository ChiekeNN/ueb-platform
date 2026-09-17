import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  events,
  ticketTiers,
  users,
  organisations,
  eventSlots,
  eventOccurrences,
  seatingSections,
  seats,
  type RecurrenceRule,
} from "@/db/schema";
import { eq, desc, asc, ilike, or, sql, and, gte, lte, inArray } from "drizzle-orm";
import { expandRecurrence, expandSlots, seatLabels, slugify } from "@/lib/utils";
import { filterDemoEvents } from "@/lib/demo-events";
import { nanoid } from "nanoid";

/** GET /api/events — discovery feed with Eventbrite-style facets. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const status = searchParams.get("status") ?? "published";
    const city = searchParams.get("city");
    const format = searchParams.get("format");
    const price = searchParams.get("price");            // any | free | paid
    const when = searchParams.get("when");              // today | tomorrow | weekend | week | month
    const sort = searchParams.get("sort") ?? "date";    // date | newest
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "60", 10) || 60, 120);
    const withTiers = searchParams.get("tiers") === "1";

    const conditions = [];
    if (status !== "all") {
      conditions.push(eq(events.status, status as "published" | "draft" | "cancelled" | "completed"));
      conditions.push(eq(events.listed, true));
    }
    if (category && category !== "all") conditions.push(eq(events.category, category as typeof events.category._.data));
    if (city && city !== "all") conditions.push(ilike(events.city, `%${city}%`));
    if (format && format !== "all") conditions.push(eq(events.format, format));
    if (search) {
      conditions.push(or(ilike(events.title, `%${search}%`), ilike(events.city, `%${search}%`), ilike(events.venue, `%${search}%`)));
    }

    // Date window
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    if (when && when !== "any") {
      if (when === "today") {
        const end = new Date(startOfToday); end.setHours(23, 59, 59, 999);
        conditions.push(gte(events.startDate, startOfToday), lte(events.startDate, end));
      } else if (when === "tomorrow") {
        const start = new Date(startOfToday); start.setDate(start.getDate() + 1);
        const end = new Date(start); end.setHours(23, 59, 59, 999);
        conditions.push(gte(events.startDate, start), lte(events.startDate, end));
      } else if (when === "weekend") {
        const day = startOfToday.getDay();
        const saturday = new Date(startOfToday);
        saturday.setDate(saturday.getDate() + ((6 - day + 7) % 7 || 7));
        const end = new Date(saturday); end.setDate(end.getDate() + 2); end.setHours(0, 0, 0, 0);
        conditions.push(gte(events.startDate, saturday), lte(events.startDate, end));
      } else if (when === "week") {
        const end = new Date(startOfToday); end.setDate(end.getDate() + 7);
        conditions.push(gte(events.startDate, startOfToday), lte(events.startDate, end));
      } else if (when === "month") {
        const end = new Date(startOfToday); end.setDate(end.getDate() + 31);
        conditions.push(gte(events.startDate, startOfToday), lte(events.startDate, end));
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const order = sort === "newest" ? desc(events.createdAt) : asc(events.startDate);

    const rows = await db
      .select({
        id: events.id,
        title: events.title,
        tagline: events.tagline,
        slug: events.slug,
        description: events.description,
        category: events.category,
        type: events.type,
        format: events.format,
        status: events.status,
        startDate: events.startDate,
        endDate: events.endDate,
        venue: events.venue,
        city: events.city,
        country: events.country,
        imageUrl: events.imageUrl,
        bannerColor: events.bannerColor,
        capacity: events.capacity,
        totalRegistrations: events.totalRegistrations,
        totalCheckins: events.totalCheckins,
        totalRevenue: events.totalRevenue,
        requiresApproval: events.requiresApproval,
        soldOut: events.soldOut,
        organiserId: events.organiserId,
        organisationId: events.organisationId,
        createdAt: events.createdAt,
        organiserName: users.name,
        organiserOrg: organisations.name,
        organiserFollowers: organisations.followers,
        organiserLogo: organisations.logo,
      })
      .from(events)
      .leftJoin(users, eq(events.organiserId, users.id))
      .leftJoin(organisations, eq(events.organisationId, organisations.id))
      .where(where)
      .orderBy(order)
      .limit(limit);

    if (rows.length === 0) {
      const fallback = filterDemoEvents(new URL(req.url).searchParams).slice(0, limit);
      return NextResponse.json({ events: fallback, count: fallback.length, demo: true });
    }

    if (!withTiers) {
      return NextResponse.json({ events: rows, count: rows.length });
    }

    // Attach ticket tiers + upcoming sessions so cards can render price labels,
    // "Free / From ₦X" and "+N more" without an extra round-trip per card.
    const ids = rows.map((r) => r.id);
    const [tiers, slots, occurrences] = await Promise.all([
      ids.length ? db.select().from(ticketTiers).where(inArray(ticketTiers.eventId, ids)) : Promise.resolve([]),
      ids.length ? db.select().from(eventSlots).where(inArray(eventSlots.eventId, ids)) : Promise.resolve([]),
      ids.length ? db.select().from(eventOccurrences).where(inArray(eventOccurrences.eventId, ids)) : Promise.resolve([]),
    ]);

    const nowMs = now.getTime();
    const enriched = rows.map((r) => {
      const eventTiers = tiers.filter((t) => t.eventId === r.id);
      const openSlots = slots
        .filter((s) => s.eventId === r.id && s.isActive && new Date(s.startDate).getTime() >= nowMs)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const sessions = occurrences
        .filter((o) => o.eventId === r.id && new Date(o.startDate).getTime() >= nowMs)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      return {
        ...r,
        tiers: eventTiers.map((t) => ({
          id: t.id,
          name: t.name,
          price: t.price,
          type: t.type,
          quantity: t.quantity,
          quantitySold: t.quantitySold,
          isInvitationOnly: t.isInvitationOnly,
          groupSize: t.groupSize,
        })),
        nextSessionDate: openSlots[0]?.startDate ?? sessions[0]?.startDate ?? r.startDate,
        sessionCount: openSlots.length || sessions.length,
        timeSlotCount: openSlots.length,
        priceFilter: price,
      };
    });

    return NextResponse.json({ events: enriched, count: enriched.length });
  } catch (error) {
    // The read-only discovery feed stays useful in a fresh preview even when
    // PostgreSQL has not been connected yet. These are UEB-owned local events,
    // not a handoff to an external marketplace.
    console.warn("Discovery database unavailable; serving the first-party catalogue");
    const params = new URL(req.url).searchParams;
    const limit = Math.min(parseInt(params.get("limit") ?? "60", 10) || 60, 120);
    const events = filterDemoEvents(params).slice(0, limit);
    return NextResponse.json({ events, count: events.length, demo: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Ensure organiser exists or create a demo one
    let organiserId = body.organiserId;
    if (!organiserId) {
      const existing = await db.select().from(users).where(eq(users.email, "demo@ueb.ng")).limit(1);
      if (existing.length > 0) {
        organiserId = existing[0].id;
      } else {
        const [newUser] = await db.insert(users).values({
          name: "Demo Organiser",
          email: "demo@ueb.ng",
          role: "event_owner",
          organisation: "UEB Demo",
        }).returning();
        organiserId = newUser.id;
      }
    }

    const slug = slugify(body.title) + "-" + nanoid(6);

    const recurrenceRule: RecurrenceRule | null = body.recurrenceRule ?? null;
    const startDate = body.startDate ? new Date(body.startDate) : null;
    const endDate = body.endDate ? new Date(body.endDate) : null;

    const [event] = await db.insert(events).values({
      title: body.title,
      slug,
      description: body.description,
      category: body.category,
      type: body.type ?? (recurrenceRule ? "recurring" : "standard"),
      status: body.status ?? "draft",
      startDate,
      endDate,
      venue: body.venue,
      city: body.city,
      country: body.country ?? "Nigeria",
      address: body.address,
      capacity: body.capacity ? parseInt(body.capacity) : null,
      imageUrl: body.imageUrl,
      bannerColor: body.bannerColor ?? "#7C3AED",
      organiserId,
      requiresApproval: body.requiresApproval ?? false,
      refundPolicy: body.refundPolicy,
      customConfirmationMessage: body.customConfirmationMessage,
      customQuestions: body.customQuestions ?? [],
      feeAbsorbedByOrganiser: body.feeAbsorbedByOrganiser ?? false,
      recurrenceRule,
      seatSelectionEnabled: !!body.seatSelectionEnabled || !!body.seating,
      waitlistEnabled: !!body.waitlistEnabled,
      surveyUrl: body.surveyUrl ?? null,
      postEventMessage: body.postEventMessage ?? null,
    }).returning();

    /* ── Recurring schedule: expand the rule into dated occurrences ── */
    if (recurrenceRule && startDate) {
      const dates = expandRecurrence(startDate, recurrenceRule, 120);
      if (dates.length > 0) {
        await db.insert(eventOccurrences).values(
          dates.map((d, i) => ({
            eventId: event.id,
            label: `Session ${i + 1}`,
            startDate: d.start,
            endDate: d.end,
            capacity: event.capacity ?? null,
            status: "scheduled",
          }))
        );
      }
    }

    /* ── Appointment / time-slot availability ── */
    if (body.slots && typeof body.slots === "object" && !Array.isArray(body.slots)) {
      const cfg = body.slots as {
        dates?: string[]; date?: string; startTime?: string; endTime?: string;
        durationMinutes?: number | string; capacity?: number | string;
      };
      const days = (cfg.dates ?? (cfg.date ? [cfg.date] : [])).map((d) => new Date(d));
      const duration = parseInt(String(cfg.durationMinutes ?? 30), 10);
      const generated = days.flatMap((day) =>
        expandSlots(day, {
          startTime: cfg.startTime ?? "09:00",
          endTime: cfg.endTime ?? "17:00",
          durationMinutes: duration,
        })
      );
      if (generated.length > 0) {
        await db.insert(eventSlots).values(
          generated.map((s) => ({
            eventId: event.id,
            label: `${s.start.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })} – ${s.end.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}`,
            startDate: s.start,
            endDate: s.end,
            capacity: cfg.capacity ? parseInt(String(cfg.capacity), 10) : 1,
          }))
        );
        await db.update(events).set({ type: "timeslot" }).where(eq(events.id, event.id));
      }
    }

    /* ── Seating sections ── */
    if (Array.isArray(body.seating) && body.seating.length > 0) {
      for (const section of body.seating) {
        const rows = Math.max(1, parseInt(String(section.rows ?? 1), 10));
        const perRow = Math.max(1, parseInt(String(section.seatsPerRow ?? 1), 10));
        if (rows * perRow > 5000) continue;
        const [created] = await db
          .insert(seatingSections)
          .values({
            eventId: event.id,
            name: section.name ?? "Floor",
            rows,
            seatsPerRow: perRow,
            tierName: section.tierName ?? null,
            color: section.color ?? "#7C3AED",
          })
          .returning();
        await db.insert(seats).values(
          seatLabels(rows, perRow, created.name).map((s) => ({
            eventId: event.id,
            sectionId: created.id,
            label: s.label,
            rowName: s.rowName,
            seatNumber: s.seatNumber,
            status: "available",
          }))
        );
      }
      await db.update(events).set({ seatSelectionEnabled: true }).where(eq(events.id, event.id));
    }

    // Create ticket tiers
    if (body.ticketTiers && Array.isArray(body.ticketTiers)) {
      for (const tier of body.ticketTiers) {
        await db.insert(ticketTiers).values({
          eventId: event.id,
          name: tier.name,
          description: tier.description,
          type: tier.type ?? "free",
          price: tier.price?.toString() ?? "0",
          quantity: tier.quantity ? parseInt(tier.quantity) : null,
          groupSize: tier.groupSize ?? 1,
          isInvitationOnly: tier.isInvitationOnly ?? false,
          accessCode: tier.accessCode,
          saleStartDate: tier.saleStartDate ? new Date(tier.saleStartDate) : null,
          saleEndDate: tier.saleEndDate ? new Date(tier.saleEndDate) : null,
        });
      }
    } else {
      // Default free ticket
      await db.insert(ticketTiers).values({
        eventId: event.id,
        name: "General Admission",
        type: "free",
        price: "0",
      });
    }

    return NextResponse.json({ event, success: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
