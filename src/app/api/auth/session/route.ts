import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ authenticated: false, session: null });
    return NextResponse.json({ authenticated: true, session: { userId: user.id, name: user.name, email: user.email, role: user.role, accountStatus: user.accountStatus } });
  } catch {
    return NextResponse.json({ authenticated: false, session: null });
  }
}
