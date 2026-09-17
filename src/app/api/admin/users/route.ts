import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && (user.role === "platform_admin" || user.role === "org_admin") && user.accountStatus === "approved" ? user : null;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  try {
    const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, accountStatus: users.accountStatus, organisation: users.organisation, createdAt: users.createdAt })
      .from(users)
      .where(and(eq(users.accountStatus, "pending"), eq(users.role, "event_owner")))
      .orderBy(desc(users.createdAt));
    return NextResponse.json({ users: rows });
  } catch {
    return NextResponse.json({ error: "Database is not connected" }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  try {
    const body = await req.json() as { userId?: string; accountStatus?: "approved" | "rejected" };
    if (!body.userId || !body.accountStatus) return NextResponse.json({ error: "User and decision are required" }, { status: 400 });
    const [updated] = await db.update(users).set({ accountStatus: body.accountStatus }).where(eq(users.id, body.userId)).returning({ id: users.id, name: users.name, accountStatus: users.accountStatus });
    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: "Database is not connected" }, { status: 503 });
  }
}
