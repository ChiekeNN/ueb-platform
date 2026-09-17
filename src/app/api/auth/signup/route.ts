import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, setSessionCookie, type AuthRole } from "@/lib/auth";

const ROLES: Record<string, { role: AuthRole; status: "pending" | "approved" }> = {
  admin: { role: "platform_admin", status: "pending" },
  organizer: { role: "event_owner", status: "pending" },
  subscriber: { role: "attendee", status: "approved" },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; email?: string; password?: string; organisation?: string; role?: string };
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const roleConfig = body.role ? ROLES[body.role] : null;

    if (!name || !email || !password || !roleConfig) return NextResponse.json({ error: "Name, email, password and account type are required" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

    const [user] = await db.insert(users).values({
      name,
      email,
      passwordHash: await hashPassword(password),
      role: roleConfig.role,
      accountStatus: roleConfig.status,
      organisation: body.organisation?.trim() || null,
    }).returning({ id: users.id, name: users.name, email: users.email, role: users.role, accountStatus: users.accountStatus });

    const response = NextResponse.json({
      success: true,
      pendingApproval: roleConfig.status === "pending",
      message: roleConfig.status === "pending" ? "Your account request has been sent for admin approval." : "Your account is ready.",
      user,
    }, { status: 201 });

    if (roleConfig.status === "approved") {
      setSessionCookie(response, {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role as AuthRole,
        accountStatus: user.accountStatus as "approved",
      });
    }
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Database is not connected. Add DATABASE_URL before creating an account." }, { status: 503 });
  }
}
