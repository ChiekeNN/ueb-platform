import { cookies } from "next/headers";
import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const scrypt = promisify(nodeScrypt);
const COOKIE_NAME = "ueb_session";
const SESSION_DAYS = 7;
const SECRET = process.env.AUTH_SECRET ?? "ueb-development-session-secret";

export type AuthRole = "platform_admin" | "org_admin" | "event_owner" | "attendee";
export type AccountStatus = "pending" | "approved" | "rejected" | "suspended";
export type AuthSession = {
  userId: string;
  name: string;
  email: string;
  role: AuthRole;
  accountStatus: AccountStatus;
  exp: number;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored?.startsWith("scrypt:")) return false;
  const [, salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function createToken(session: Omit<AuthSession, "exp">): string {
  const payload = encode(JSON.stringify({ ...session, exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined): AuthSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const session = JSON.parse(decode(payload)) as AuthSession;
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthSession | null> {
  const store = await cookies();
  return readToken(store.get(COOKIE_NAME)?.value);
}

export function setSessionCookie(response: Response, session: Omit<AuthSession, "exp">): Response {
  const token = createToken(session);
  response.headers.append("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}

export function clearSessionCookie(response: Response): Response {
  response.headers.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || user.accountStatus === "suspended" || user.accountStatus === "rejected") return null;
  return user;
}

export function canCreateEvents(session: Pick<AuthSession, "role" | "accountStatus"> | null): boolean {
  if (!session) return false;
  if (session.role === "platform_admin" || session.role === "org_admin") return session.accountStatus === "approved";
  return session.role === "event_owner" && session.accountStatus === "approved";
}

export { COOKIE_NAME };
