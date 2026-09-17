import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  events,
  ticketTiers,
  users,
  eventSlots,
  eventOccurrences,
  seatingSections,
  seats,
  type RecurrenceRule,
} from "@/db/schema";
import { eq, desc, ilike, or, sql } from "drizzle-orm";
import { expandRecurrence, expandSlots, seatLabels, slugify } from "@/lib/utils";
import { nanoid } from "nanoid";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const status = searchParams.get("status") ?? "published";

    const query = db
      .select({
        id: events.id,
        title: events.title,
        slug: events.slug,
        description: events.description,
        category: events.category,
        type: events.type,
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
        organiserId: events.organiserId,
        createdAt: events.createdAt,
      })
      .from(events);

    const conditions = [];
    if (status !== "all") conditions.push(eq(events.status, status as "published" | "draft" | "cancelled" | "completed"));
    if (category && category !== "all") conditions.push(eq(events.category, category as typeof events.category._.data));
    if (search) conditions.push(or(ilike(events.title, `%${search}%`), ilike(events.city, `%${search}%`)));

    const result = conditions.length > 0
      ? await query.where(sql`${conditions.reduce((a, b) => sql`${a} AND ${b}`)}` ).orderBy(desc(events.createdAt))
      : await query.orderBy(desc(events.createdAt));

    return NextResponse.json({ events: result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
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
