import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";
import { serverError } from "@/lib/server";

/**
 * GET /api/notifications — the bell's feed.
 *
 * Admins get the platform stream (everything happening across UEB) merged with
 * their own messages; organisers get notifications for their events; attendees
 * get account-level messages such as an application decision.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireUser();
    if ("error" in guard) return guard.error;
    const { user } = guard;

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? 30);
    const unreadOnly = url.searchParams.get("unread") === "1";

    const feed = await listNotifications(user.id, {
      isAdmin: user.role === "platform_admin",
      limit: Number.isFinite(limit) ? limit : 30,
      unreadOnly,
    });

    return NextResponse.json(feed);
  } catch (error) {
    return serverError(error, "Failed to load notifications");
  }
}

/**
 * PATCH /api/notifications — mark as read.
 * body: { ids?: string[] } | { all: true }
 */
export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireUser();
    if ("error" in guard) return guard.error;
    const { user } = guard;

    const body = await req.json().catch(() => ({}));
    const marked = await markNotificationsRead(user.id, {
      isAdmin: user.role === "platform_admin",
      ids: Array.isArray(body.ids) ? body.ids.map(String) : undefined,
      all: body.all === true,
    });

    return NextResponse.json({ marked });
  } catch (error) {
    return serverError(error, "Failed to update notifications");
  }
}
