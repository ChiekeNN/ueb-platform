import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { setSessionCookie, verifyPassword, type AuthRole, type AccountStatus } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
    }
    if (user.accountStatus === "pending") return NextResponse.json({ error: "Your account is waiting for admin approval" }, { status: 403 });
    if (user.accountStatus === "rejected" || user.accountStatus === "suspended") return NextResponse.json({ error: "This account is not active" }, { status: 403 });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, accountStatus: user.accountStatus },
    });
    setSessionCookie(response, {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role as AuthRole,
      accountStatus: user.accountStatus as AccountStatus,
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: process.env.DATABASE_URL ? "The database is configured but its schema is not ready. Run npx drizzle-kit push --force, then restart the app." : "Database is not configured. Add DATABASE_URL to .env, run npx drizzle-kit push --force, then restart the app." }, { status: 503 });
  }
}
