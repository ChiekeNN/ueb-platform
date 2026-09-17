import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { badRequest, serverError } from "@/lib/server";

/** PATCH /api/vendors/[id] — update status, fees, payments or contact details. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!vendor) return badRequest("Vendor not found", 404);

    const [updated] = await db
      .update(vendors)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.contactName !== undefined ? { contactName: body.contactName } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.stallNumber !== undefined ? { stallNumber: body.stallNumber } : {}),
        ...(body.fee !== undefined ? { fee: String(body.fee) } : {}),
        ...(body.amountPaid !== undefined ? { amountPaid: String(body.amountPaid) } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      })
      .where(eq(vendors.id, id))
      .returning();

    return NextResponse.json({ vendor: updated, success: true });
  } catch (error) {
    return serverError(error, "Failed to update vendor");
  }
}

/** DELETE /api/vendors/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(vendors).where(eq(vendors.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Failed to delete vendor");
  }
}
