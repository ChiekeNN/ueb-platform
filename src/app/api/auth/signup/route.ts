import { NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie, signUp } from "@/lib/auth";
import { notifyPlatform } from "@/lib/notifications";
import { serverError } from "@/lib/server";

/**
 * POST /api/auth/signup — create an account.
 *
 * Always creates an `attendee`. Passing `applyAsOrganiser` additionally files an
 * organiser application so the admin sees it in the approval queue immediately.
 * Nobody gets organiser powers here: only `PATCH /api/organiser-applications/[id]`
 * by a platform admin can grant them.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await signUp({
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      phone: body.phone ? String(body.phone) : null,
      organisation: body.organisation ? String(body.organisation) : null,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const user = result.user;
    const token = await createSession(user.id, req.headers.get("user-agent"));
    await setSessionCookie(token);

    await notifyPlatform({
      type: "user_signup",
      title: `New account: ${user.name}`,
      body: `${user.email} joined UEB${user.organisation ? ` (${user.organisation})` : ""}.`,
      link: "/admin/organisers",
      severity: "info",
      meta: { userId: user.id },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return serverError(error, "Could not create your account");
  }
}
