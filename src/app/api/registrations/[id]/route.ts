import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { registrations, events } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const [reg] = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
    if (!reg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updateData: Partial<typeof registrations.$inferInsert> = {};

    if (body.status) updateData.status = body.status;
    if (body.paymentStatus) updateData.paymentStatus = body.paymentStatus;
    if (body.notes !== undefined) updateData.notes = body.notes;
    updateData.updatedAt = new Date();

    // Handle check-in
    if (body.checkedIn === true && !reg.checkedIn) {
      updateData.checkedIn = true;
      updateData.checkedInAt = new Date();
      // Update event check-in count
      await db.update(events)
        .set({ totalCheckins: sql`${events.totalCheckins} + 1` })
        .where(eq(events.id, reg.eventId));
    }

    if (body.checkedIn === false && reg.checkedIn) {
      updateData.checkedIn = false;
      updateData.checkedInAt = undefined;
      await db.update(events)
        .set({ totalCheckins: sql`GREATEST(${events.totalCheckins} - 1, 0)` })
        .where(eq(events.id, reg.eventId));
    }

    const [updated] = await db.update(registrations)
      .set(updateData)
      .where(eq(registrations.id, id))
      .returning();

    return NextResponse.json({ registration: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(registrations).where(eq(registrations.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
