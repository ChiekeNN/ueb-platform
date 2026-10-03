import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { events, organiserApplications, sessions, users } from "@/db/schema";

/**
 * Email + password accounts for UEB.
 *
 * Design notes:
 *   • Passwords are stored as `scrypt:<salt>:<hash>` — node's built-in scrypt,
 *     so there is no native dependency to install.
 *   • The session cookie holds a 32-byte random token; the database stores only
 *     its SHA-256 hash. A stolen database dump therefore contains no usable
 *     session tokens, and logging out deletes the row server-side.
 *   • `role` answers "what may this account do", `organiserStatus` answers
 *     "has the admin approved them yet". Only `platform_admin` may approve.
 */

export const SESSION_COOKIE = "ueb_session";
const SESSION_TTL_DAYS = 30;
const SCRYPT_KEYLEN = 64;

export type UserRole =
  | "platform_admin"
  | "org_admin"
  | "event_owner"
  | "event_staff"
  | "checkin_staff"
  | "finance_staff"
  | "attendee";

export type OrganiserStatus = "none" | "pending" | "approved" | "rejected";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  organiserStatus: OrganiserStatus;
  organisation: string | null;
  createdAt: string;
};

/* ─── passwords ─────────────────────────────────────────────────── */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  // Constant-time compare stops the response time leaking how much matched.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Registration password policy — long enough to matter, no composition theatre. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(password)) return "Password must include at least one letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  return null;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/* ─── sessions ──────────────────────────────────────────────────── */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent?: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    userAgent: userAgent?.slice(0, 300) ?? null,
    expiresAt,
  });
  return token;
}

/** Writes the session cookie. Only callable from a route handler or action. */
export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

/**
 * Delete the session cookie. The attributes must mirror `setSessionCookie` —
 * browsers key a cookie on name + domain + path, and a mismatched deletion
 * silently leaves the old cookie in place, which is how a "signed out" visitor
 * keeps being recognised as signed in.
 */
export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function toSessionUser(row: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  organiserStatus: string;
  organisation: string | null;
  createdAt: Date;
}): SessionUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role as UserRole,
    organiserStatus: row.organiserStatus as OrganiserStatus,
    organisation: row.organisation,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The signed-in user, or `null`. Safe to call anywhere on the server. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        organiserStatus: users.organiserStatus,
        organisation: users.organisation,
        createdAt: users.createdAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
      .limit(1);

    return row ? toSessionUser(row) : null;
  } catch {
    // A database blip must never take the public site down.
    return null;
  }
}

export async function destroyCurrentSession(): Promise<void> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  } catch {
    /* the cookie is cleared by the caller regardless */
  }
}

/** Housekeeping: drop expired session rows. */
export async function pruneExpiredSessions(): Promise<number> {
  const rows = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning({ id: sessions.id });
  return rows.length;
}

/* ─── authorisation ─────────────────────────────────────────────── */

export function isPlatformAdmin(user: SessionUser | null): boolean {
  return user?.role === "platform_admin";
}

/** An organiser who has actually been approved by an admin. */
export function isApprovedOrganiser(user: SessionUser | null): boolean {
  return !!user && (user.role === "event_owner" || user.role === "org_admin") && user.organiserStatus === "approved";
}

/** May see the organiser dashboard: approved organisers and platform admins. */
export function canAccessDashboard(user: SessionUser | null): boolean {
  return isPlatformAdmin(user) || isApprovedOrganiser(user);
}

type Guarded = { user: SessionUser } | { error: NextResponse };

/**
 * Route-handler guard.
 *
 *   const guard = await requireUser();
 *   if ("error" in guard) return guard.error;
 *   guard.user.id
 *
 * Pass `roles` to narrow access (e.g. `["platform_admin"]`), or `organiser`
 * to demand an approved organiser account.
 */
export async function requireUser(): Promise<Guarded>;
export async function requireUser(options: { roles?: UserRole[]; organiser?: boolean }): Promise<Guarded>;
export async function requireUser(options?: { roles?: UserRole[]; organiser?: boolean }): Promise<Guarded> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
  }
  if (options?.organiser && !isApprovedOrganiser(user)) {
    return {
      error: NextResponse.json(
        {
          error:
            user.organiserStatus === "pending"
              ? "Your organiser account is still awaiting approval."
              : "Only approved organisers can do this.",
          organiserStatus: user.organiserStatus,
        },
        { status: 403 }
      ),
    };
  }
  if (options?.roles && !options.roles.includes(user.role)) {
    return { error: NextResponse.json({ error: "You do not have access to this action." }, { status: 403 }) };
  }
  return { user };
}

/* ─── accounts ──────────────────────────────────────────────────── */

export async function findUserByEmail(email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, normaliseEmail(email))).limit(1);
  return row ?? null;
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  organisation?: string | null;
  /** Applicants land straight in the admin approval queue as `pending`. */
  applyAsOrganiser?: boolean;
}): Promise<{ user: SessionUser } | { error: string; status: number }> {
  const email = normaliseEmail(input.email);
  if (!input.name.trim()) return { error: "Tell us your name.", status: 400 };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address.", status: 400 };

  const problem = passwordProblem(input.password);
  if (problem) return { error: problem, status: 400 };

  if (await findUserByEmail(email)) {
    return { error: "An account with that email already exists — sign in instead.", status: 409 };
  }

  const [created] = await db
    .insert(users)
    .values({
      name: input.name.trim(),
      email,
      phone: input.phone?.trim() || null,
      organisation: input.organisation?.trim() || null,
      passwordHash: hashPassword(input.password),
      role: "attendee",
      organiserStatus: "none",
    })
    .returning();

  return { user: toSessionUser(created) };
}

export async function signIn(
  email: string,
  password: string
): Promise<{ user: SessionUser } | { error: string; status: number }> {
  const row = await findUserByEmail(email);
  // Same message whether the email or the password is wrong — no account probing.
  if (!row || !verifyPassword(password, row.passwordHash)) {
    return { error: "Email or password is incorrect.", status: 401 };
  }
  return { user: toSessionUser(row) };
}

export async function userById(id: string): Promise<SessionUser | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toSessionUser(row) : null;
}

/** The applicant's newest application — the one the admin queue acts on. */
export async function latestApplication(userId: string) {
  const [row] = await db
    .select()
    .from(organiserApplications)
    .where(eq(organiserApplications.userId, userId))
    .orderBy(desc(organiserApplications.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Guard for everything that touches one event's private data — the roster,
 * seating, vendors, comms, reports and settings.
 *
 * Allowed: platform admins, and the organiser who owns the event. Anyone else
 * gets a 403 (signed in) or 401 (signed out), which is what stops an attendee
 * from reading another organiser's guest list by guessing a slug.
 */
export async function requireEventAccess(
  slug: string
): Promise<{ user: SessionUser; event: typeof events.$inferSelect } | { error: NextResponse }> {
  const guard = await requireUser();
  if ("error" in guard) return guard;

  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) };

  if (guard.user.role !== "platform_admin" && event.organiserId !== guard.user.id) {
    return {
      error: NextResponse.json({ error: "You do not have access to this event." }, { status: 403 }),
    };
  }
  return { user: guard.user, event };
}
