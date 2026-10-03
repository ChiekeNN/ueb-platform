import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, organiserApplications, payments, registrations, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { serverError } from "@/lib/server";

/**
 * GET /api/admin/overview — the numbers on the admin dashboard.
 *
 * Platform-admin only. Counts are computed in SQL so the dashboard stays one
 * round trip even once the platform has thousands of rows.
 */
export async function GET() {
  try {
    const guard = await requireUser({ roles: ["platform_admin"] });
    if ("error" in guard) return guard.error;

    const [userCounts] = await db
      .select({
        total: sql<number>`count(*)`,
        organisers: sql<number>`count(*) filter (where ${users.role} = 'event_owner')`,
        admins: sql<number>`count(*) filter (where ${users.role} = 'platform_admin')`,
        pendingApplications: sql<number>`count(*) filter (where ${users.organiserStatus} = 'pending')`,
        approvedOrganisers: sql<number>`count(*) filter (where ${users.organiserStatus} = 'approved')`,
        rejected: sql<number>`count(*) filter (where ${users.organiserStatus} = 'rejected')`,
      })
      .from(users);

    const [eventCounts] = await db
      .select({
        total: sql<number>`count(*)`,
        published: sql<number>`count(*) filter (where ${events.status} = 'published')`,
        drafts: sql<number>`count(*) filter (where ${events.status} = 'draft')`,
        completed: sql<number>`count(*) filter (where ${events.status} = 'completed')`,
        cancelled: sql<number>`count(*) filter (where ${events.status} = 'cancelled')`,
      })
      .from(events);

    const [registrationCounts] = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`count(*) filter (where ${registrations.status} = 'pending')`,
        approved: sql<number>`count(*) filter (where ${registrations.status} = 'approved')`,
        checkedIn: sql<number>`count(*) filter (where ${registrations.checkedIn})`,
      })
      .from(registrations);

    const [paymentTotals] = await db
      .select({
        transactions: sql<number>`count(*)`,
        settled: sql<number>`count(*) filter (where ${payments.status} = 'successful')`,
        refunded: sql<number>`count(*) filter (where ${payments.status} = 'refunded')`,
        failed: sql<number>`count(*) filter (where ${payments.status} = 'failed')`,
        gross: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'successful'), 0)`,
        uebRevenue: sql<string>`coalesce(sum(${payments.feeAmount}) filter (where ${payments.status} = 'successful'), 0)`,
      })
      .from(payments);

    // Newest applications still waiting, so an admin can act without leaving the page.
    const queue = await db
      .select({
        id: organiserApplications.id,
        organisationName: organiserApplications.organisationName,
        organisationType: organiserApplications.organisationType,
        city: organiserApplications.city,
        about: organiserApplications.about,
        expectedEventsPerYear: organiserApplications.expectedEventsPerYear,
        createdAt: organiserApplications.createdAt,
        applicantId: users.id,
        applicantName: users.name,
        applicantEmail: users.email,
        applicantPhone: users.phone,
      })
      .from(organiserApplications)
      .innerJoin(users, eq(organiserApplications.userId, users.id))
      .where(eq(organiserApplications.status, "pending"))
      .orderBy(desc(organiserApplications.createdAt))
      .limit(10);

    const organisers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        organisation: users.organisation,
        status: users.organiserStatus,
        role: users.role,
        createdAt: users.createdAt,
        hosted: sql<number>`(select count(*) from ${events} where ${events.organiserId} = ${users.id})`,
      })
      .from(users)
      .where(sql`${users.role} = 'event_owner' or ${users.organiserStatus} <> 'none'`)
      .orderBy(desc(users.createdAt))
      .limit(50);

    return NextResponse.json({
      users: {
        total: Number(userCounts?.total ?? 0),
        organisers: Number(userCounts?.organisers ?? 0),
        admins: Number(userCounts?.admins ?? 0),
        pendingApplications: Number(userCounts?.pendingApplications ?? 0),
        approvedOrganisers: Number(userCounts?.approvedOrganisers ?? 0),
        rejected: Number(userCounts?.rejected ?? 0),
      },
      events: {
        total: Number(eventCounts?.total ?? 0),
        published: Number(eventCounts?.published ?? 0),
        drafts: Number(eventCounts?.drafts ?? 0),
        completed: Number(eventCounts?.completed ?? 0),
        cancelled: Number(eventCounts?.cancelled ?? 0),
      },
      registrations: {
        total: Number(registrationCounts?.total ?? 0),
        pending: Number(registrationCounts?.pending ?? 0),
        approved: Number(registrationCounts?.approved ?? 0),
        checkedIn: Number(registrationCounts?.checkedIn ?? 0),
      },
      payments: {
        transactions: Number(paymentTotals?.transactions ?? 0),
        settled: Number(paymentTotals?.settled ?? 0),
        refunded: Number(paymentTotals?.refunded ?? 0),
        failed: Number(paymentTotals?.failed ?? 0),
        gross: Number(paymentTotals?.gross ?? 0),
        uebRevenue: Number(paymentTotals?.uebRevenue ?? 0),
      },
      queue: queue.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
      organisers: organisers.map((row) => ({
        ...row,
        hosted: Number(row.hosted ?? 0),
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return serverError(error, "Failed to load the admin overview");
  }
}
