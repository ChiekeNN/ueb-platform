import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organiserApplications, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { notifyPlatform, notifyUser } from "@/lib/notifications";
import { badRequest, serverError } from "@/lib/server";

/**
 * PATCH /api/organiser-applications/[id]
 *
 * The admin decision. `body: { action: "approve" | "reject", note?: string }`
 *
 * Approving is the only thing in the platform that grants organiser powers:
 * it flips `users.role` to `event_owner`, sets `organiser_status = approved`
 * (which is what unlocks /dashboard and /events/create) and notifies the
 * applicant. Rejecting leaves them an attendee and sends the admin's note back
 * so they can improve and re-apply.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireUser({ roles: ["platform_admin"] });
    if ("error" in guard) return guard.error;
    const admin = guard.user;

    const { id } = await params;
    const body = await req.json();
    const action = String(body.action ?? "");
    if (action !== "approve" && action !== "reject") {
      return badRequest("action must be 'approve' or 'reject'");
    }
    const note = body.note ? String(body.note).trim() : null;

    const [application] = await db.select().from(organiserApplications).where(eq(organiserApplications.id, id)).limit(1);
    if (!application) return badRequest("Application not found", 404);
    if (application.status !== "pending") {
      return badRequest(`This application was already ${application.status}.`, 409);
    }

    const [applicant] = await db.select().from(users).where(eq(users.id, application.userId)).limit(1);
    if (!applicant) return badRequest("Applicant account no longer exists", 404);

    const approved = action === "approve";

    await db
      .update(organiserApplications)
      .set({
        status: approved ? "approved" : "rejected",
        reviewNote: note,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(organiserApplications.id, id));

    await db
      .update(users)
      .set({
        role: approved ? "event_owner" : applicant.role === "event_owner" ? "attendee" : applicant.role,
        organiserStatus: approved ? "approved" : "rejected",
        updatedAt: new Date(),
      })
      .where(eq(users.id, applicant.id));

    // Tell the applicant, and record the decision in the admin feed.
    await notifyUser(applicant.id, {
      scope: "attendee",
      type: approved ? "application_approved" : "application_rejected",
      title: approved ? "You're approved as an event organiser 🎉" : "Your organiser application was declined",
      body: approved
        ? `Welcome aboard, ${applicant.name}. Create your first event from the dashboard.`
        : note || "You can update your details and apply again at any time.",
      link: approved ? "/dashboard" : "/become-organiser",
      severity: approved ? "success" : "warning",
      meta: { applicationId: id, reviewedBy: admin.id },
    });

    await notifyPlatform({
      type: "application_decision",
      title: `${application.organisationName} ${approved ? "approved" : "declined"}`,
      body: `${admin.name} ${approved ? "approved" : "declined"} ${applicant.name}'s organiser application.`,
      link: "/admin/applications",
      severity: approved ? "success" : "info",
      meta: { applicationId: id, applicantId: applicant.id },
    });

    return NextResponse.json({
      ok: true,
      status: approved ? "approved" : "rejected",
      applicant: { id: applicant.id, name: applicant.name, email: applicant.email },
    });
  } catch (error) {
    return serverError(error, "Could not record the decision");
  }
}
