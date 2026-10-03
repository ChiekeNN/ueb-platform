import { NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie, signIn } from "@/lib/auth";
import { serverError } from "@/lib/server";

/** POST /api/auth/login — verify credentials and start a session. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");
    if (!email || !password) {
      return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    }

    const result = await signIn(email, password);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const token = await createSession(result.user.id, req.headers.get("user-agent"));
    await setSessionCookie(token);

    return NextResponse.json({ user: result.user });
  } catch (error) {
    return serverError(error, "Could not sign you in");
  }
}
