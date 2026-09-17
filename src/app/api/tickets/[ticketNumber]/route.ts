import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, payments, registrations, ticketTiers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { badRequest, serverError } from "@/lib/server";

/** GET /api/tickets/[ticketNumber] — a single digital ticket with its event and payment. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketNumber: string }> }
) {
  try {
    const { ticketNumber } = await params;
    const [registration] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.ticketNumber, ticketNumber.toUpperCase()))
      .limit(1);

    if (!registration) return badRequest("Ticket not found", 404);

    const [event] = await db.select().from(events).where(eq(events.id, registration.eventId)).limit(1);
    const [tier] = registration.ticketTierId
      ? await db.select().from(ticketTiers).where(eq(ticketTiers.id, registration.ticketTierId)).limit(1)
      : [null];
    const [payment] = registration.paymentReference
      ? await db.select().from(payments).where(eq(payments.reference, registration.paymentReference)).limit(1)
      : [null];

    return NextResponse.json({
      registration,
      event: event
        ? {
            id: event.id,
            title: event.title,
            slug: event.slug,
            venue: event.venue,
            address: event.address,
            city: event.city,
            country: event.country,
            startDate: event.startDate,
            endDate: event.endDate,
            bannerColor: event.bannerColor,
            customConfirmationMessage: event.customConfirmationMessage,
            refundPolicy: event.refundPolicy,
            status: event.status,
          }
        : null,
      tier,
      payment,
    });
  } catch (error) {
    return serverError(error, "Failed to load ticket");
  }
}
