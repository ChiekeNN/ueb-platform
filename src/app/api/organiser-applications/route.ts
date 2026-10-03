import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { organiserApplications, users } from "@/db/schema";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { notifyPlatform } from "@/lib/notifications";
import { badRequest, serverError } from "@/lib/server";

export type ApplicationRow = {
  id: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  organisationName: string;
  organisationType: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  about: string | null;
  expectedEventsPerYear: string | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** Events this applicant already owns (0 unless they were an organiser before). */
  eventCount?: number;
};

/**
 * GET /api/organiser-applications
 *
 *   • platform admin → the whole queue (`status=pending|approved|rejected|all`)
 *   • everyone else  → only their own applications
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireUser();
    if ("error" in guard) return guard.error;
    const { user } = guard;

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? (user.role === "platform_admin" ? "pending" : "all");

    const filters = [];
    if (user.role !== "platform_admin") filters.push(eq(organiserApplications.userId, user.id));
    if (status !== "all") filters.push(eq(organiserApplications.status, status as "pending" | "approved" | "rejected"));

    const rows = await db
      .select({
        application: organiserApplications,
        applicantName: users.name,
        applicantEmail: users.email,
      })
      .from(organiserApplications)
      .innerJoin(users, eq(organiserApplications.userId, users.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(organiserApplications.createdAt))
      .limit(200);

    const applications: ApplicationRow[] = rows.map(({ application, applicantName, applicantEmail }) => ({
      id: application.id,
      userId: application.userId,
      applicantName,
      applicantEmail,
      organisationName: application.organisationName,
      organisationType: application.organisationType,
      website: application.website,
      phone: application.phone,
      city: application.city,
      country: application.country,
      about: application.about,
      expectedEventsPerYear: application.expectedEventsPerYear,
      status: application.status,
      reviewNote: application.reviewNote,
      reviewedAt: application.reviewedAt ? application.reviewedAt.toISOString() : null,
      createdAt: application.createdAt.toISOString(),
    }));

    return NextResponse.json({ applications, counts: countByStatus(applications) });
  } catch (error) {
    return serverError(error, "Failed to load applications");
  }
}

function countByStatus(rows: ApplicationRow[]) {
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };
}

/**
 * POST /api/organiser-applications — apply to become an event organiser.
 *
 * Re-applying after a rejection is allowed (it replaces the applicant's state
 * with a fresh pending request); applying while already pending or approved is
 * not, so the admin queue cannot be spammed by one account.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to apply." }, { status: 401 });

    if (user.role === "platform_admin") {
      return badRequest("Admins already have full access.", 409);
    }
    if (user.organiserStatus === "pending") {
      return badRequest("Your application is already awaiting review.", 409);
    }
    if (user.organiserStatus === "approved") {
      return badRequest("You are already an approved organiser.", 409);
    }

    const body = await req.json();
    // Fall back to the organisation on the account (given at signup) so an
    // application never fails purely because the field was pre-filled client-side.
    const organisationName = String(body.organisationName ?? "").trim() || (user.organisation ?? "").trim();
    if (!organisationName) return badRequest("Tell us the name you will organise under.");
    if (!String(body.about ?? "").trim()) return badRequest("Tell us briefly what kind of events you run.");

    const [application] = await db
      .insert(organiserApplications)
      .values({
        userId: user.id,
        organisationName,
        organisationType: body.organisationType ? String(body.organisationType) : null,
        website: body.website ? String(body.website) : null,
        phone: body.phone ? String(body.phone) : user.phone,
        city: body.city ? String(body.city) : null,
        country: body.country ? String(body.country) : "Nigeria",
        about: String(body.about).trim(),
        expectedEventsPerYear: body.expectedEventsPerYear ? String(body.expectedEventsPerYear) : null,
        status: "pending",
      })
      .returning();

    // The applicant is now formally in the queue.
    await db
      .update(users)
      .set({ organiserStatus: "pending", organisation: organisationName, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // …and the admin bell rings.
    await notifyPlatform({
      type: "organiser_application",
      title: `Organiser application: ${organisationName}`,
      body: `${user.name} (${user.email}) applied to organise events. Review it in the admin dashboard.`,
      link: "/admin/applications",
      severity: "warning",
      meta: { applicationId: application.id, userId: user.id },
    });

    return NextResponse.json({ application, organiserStatus: "pending" }, { status: 201 });
  } catch (error) {
    return serverError(error, "Could not submit your application");
  }
}
