import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, notifications } from "@/db/schema";

/**
 * The notification feed behind the bell.
 *
 * Two audiences share one table:
 *
 *   • **Platform** rows (`userId = null`, `scope = 'platform'`) are addressed to
 *     every admin — they are how the admin bell aggregates activity from all
 *     parts of the platform: new organiser applications, signups, event
 *     submissions, payments, refunds, completed events.
 *   • **Personal** rows carry a `userId` and appear only in that person's bell
 *     (an organiser hearing about a sale, an applicant hearing the verdict).
 *
 * Writing a notification must never break the action that triggered it, so
 * every helper here swallows its own errors.
 */

export type NotificationScope = "platform" | "organiser" | "attendee";
export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export type NotificationInput = {
  scope: NotificationScope;
  /** Omit (or pass null) with `scope: "platform"` to address all admins. */
  userId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  severity?: NotificationSeverity;
  meta?: Record<string, unknown>;
};

export async function notify(input: NotificationInput): Promise<void> {
  try {
    await db.insert(notifications).values({
      scope: input.scope,
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      severity: input.severity ?? "info",
      meta: input.meta ?? {},
    });
  } catch {
    /* a missing notification is never worth failing the user's action */
  }
}

/** Broadcast to the admin bell. */
export async function notifyPlatform(input: Omit<NotificationInput, "scope" | "userId">): Promise<void> {
  await notify({ ...input, scope: "platform", userId: null });
}

/** Address one user (organiser or attendee). */
export async function notifyUser(
  userId: string,
  input: Omit<NotificationInput, "scope" | "userId"> & { scope?: NotificationScope }
): Promise<void> {
  await notify({ ...input, scope: input.scope ?? "organiser", userId });
}

/**
 * Tell an event's organiser that something happened, and copy the admin bell.
 *
 * Resolves the organiser from the event so callers only need the event id.
 */
export async function notifyEvent(
  eventId: string,
  input: {
    type: string;
    title: string;
    body?: string | null;
    link?: string | null;
    severity?: NotificationSeverity;
    meta?: Record<string, unknown>;
    /** Set false to keep it out of the admin bell (organiser-only news). */
    alsoPlatform?: boolean;
  }
): Promise<void> {
  try {
    const [event] = await db
      .select({ id: events.id, title: events.title, slug: events.slug, organiserId: events.organiserId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    if (!event) return;

    if (event.organiserId) {
      await notify({
        scope: "organiser",
        userId: event.organiserId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? `/events/${event.slug}/manage`,
        severity: input.severity,
        meta: { eventId: event.id, eventTitle: event.title, ...(input.meta ?? {}) },
      });
    }
    if (input.alsoPlatform !== false) {
      await notifyPlatform({
        type: input.type,
        title: input.title,
        body: event.organiserId ? `${event.title} — ${input.body ?? ""}`.trim() : input.body,
        link: input.link ?? `/events/${event.slug}/manage`,
        severity: input.severity,
        meta: { eventId: event.id, eventTitle: event.title, organiserId: event.organiserId, ...(input.meta ?? {}) },
      });
    }
  } catch {
    /* ignore — see file header */
  }
}

/* ─── reading ───────────────────────────────────────────────────── */

export type NotificationRow = {
  id: string;
  scope: NotificationScope;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationFeed = {
  notifications: NotificationRow[];
  unread: number;
  total: number;
};

/**
 * Feed for a signed-in user.
 *
 * Admins see the platform stream plus anything addressed to them personally;
 * everyone else sees only their own rows.
 */
export async function listNotifications(
  userId: string,
  options: { isAdmin?: boolean; limit?: number; unreadOnly?: boolean } = {}
): Promise<NotificationFeed> {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);

  try {
    const audience = options.isAdmin
      ? or(eq(notifications.userId, userId), and(isNull(notifications.userId), eq(notifications.scope, "platform")))
      : eq(notifications.userId, userId);

    const where = options.unreadOnly ? and(audience, isNull(notifications.readAt)) : audience;

    const rows = await db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    const [counts] = await db
      .select({
        total: sql<number>`count(*)`,
        unread: sql<number>`count(*) filter (where ${notifications.readAt} is null)`,
      })
      .from(notifications)
      .where(audience);

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        scope: row.scope as NotificationScope,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        severity: row.severity,
        readAt: row.readAt ? row.readAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      })),
      unread: Number(counts?.unread ?? 0),
      total: Number(counts?.total ?? 0),
    };
  } catch {
    return { notifications: [], unread: 0, total: 0 };
  }
}

/**
 * Mark notifications read. Scoped to the caller's own audience so nobody can
 * clear another account's bell by guessing ids.
 */
export async function markNotificationsRead(
  userId: string,
  options: { isAdmin?: boolean; ids?: string[]; all?: boolean } = {}
): Promise<number> {
  const audience = options.isAdmin
    ? or(eq(notifications.userId, userId), and(isNull(notifications.userId), eq(notifications.scope, "platform")))
    : eq(notifications.userId, userId);

  const filters = [audience, isNull(notifications.readAt)];
  if (!options.all) {
    if (!options.ids?.length) return 0;
    filters.push(inArray(notifications.id, options.ids.slice(0, 200)));
  }

  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...filters))
    .returning({ id: notifications.id });
  return rows.length;
}

/** Housekeeping: drop read notifications older than `days`. */
export async function pruneNotifications(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .delete(notifications)
    .where(and(lt(notifications.createdAt, cutoff), sql`${notifications.readAt} is not null`))
    .returning({ id: notifications.id });
  return rows.length;
}
