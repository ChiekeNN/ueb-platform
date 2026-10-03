import { NextResponse } from "next/server";
import { clearSessionCookie, destroyCurrentSession } from "@/lib/auth";
import { serverError } from "@/lib/server";

/** POST /api/auth/logout — delete the session row and clear the cookie. */
export async function POST() {
  try {
    await destroyCurrentSession();
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Could not sign you out");
  }
}
