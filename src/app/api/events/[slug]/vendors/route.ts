import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { badRequest, getEventBySlug, serverError } from "@/lib/server";

/** GET /api/events/[slug]/vendors — vendor/exhibitor roster with fees. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const rows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.eventId, event.id))
      .orderBy(desc(vendors.createdAt));

    const totalFees = rows.reduce((s, v) => s + parseFloat(v.fee ?? "0"), 0);
    const collected = rows.reduce((s, v) => s + parseFloat(v.amountPaid ?? "0"), 0);

    return NextResponse.json({
      vendors: rows,
      summary: {
        total: rows.length,
        confirmed: rows.filter((v) => v.status === "confirmed" || v.status === "checked_in").length,
        totalFees,
        collected,
        outstanding: Math.max(totalFees - collected, 0),
      },
    });
  } catch (error) {
    return serverError(error, "Failed to load vendors");
  }
}

/** POST /api/events/[slug]/vendors — add one or many vendors. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) return badRequest("Event not found", 404);

    const body = await req.json();
    const list = Array.isArray(body.vendors) ? body.vendors : [body];
    const clean = list.filter((v: { name?: string }) => (v.name ?? "").trim().length > 0);
    if (clean.length === 0) return badRequest("Vendor name is required");

    const rows = await db
      .insert(vendors)
      .values(
        clean.map((v: Record<string, unknown>) => ({
          eventId: event.id,
          name: String(v.name).trim(),
          category: (v.category as string) ?? null,
          contactName: (v.contactName as string) ?? null,
          email: (v.email as string) ?? null,
          phone: (v.phone as string) ?? null,
          stallNumber: (v.stallNumber as string) ?? null,
          fee: v.fee ? String(v.fee) : "0",
          amountPaid: v.amountPaid ? String(v.amountPaid) : "0",
          status: (v.status as string) ?? "invited",
          notes: (v.notes as string) ?? null,
        }))
      )
      .returning();

    return NextResponse.json({ vendors: rows, count: rows.length, success: true }, { status: 201 });
  } catch (error) {
    return serverError(error, "Failed to add vendors");
  }
}
