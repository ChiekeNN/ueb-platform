import { NextResponse } from "next/server";
import {
  canAccessDashboard,
  getCurrentUser,
  isApprovedOrganiser,
  isPlatformAdmin,
  latestApplication,
  type OrganiserStatus,
} from "@/lib/auth";
import { serverError } from "@/lib/server";

/**
 * GET /api/auth/session — who am I?
 *
 * Powers the navbar (which links exist), the dashboard gate and the
 * "awaiting approval" screens. `next` is what the client should do about it:
 * `signin` when signed out, `apply` when the account has no application yet,
 * `pending`/`rejected` while the admin decides, `allowed` once approved.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        user: null,
        isAdmin: false,
        isOrganiser: false,
        canAccessDashboard: false,
        next: "signin",
        application: null,
      });
    }

    const isAdmin = isPlatformAdmin(user);
    const organiser = isApprovedOrganiser(user);
    const application = await latestApplication(user.id);

    let next: "allowed" | "apply" | "pending" | "rejected" = "apply";
    if (isAdmin || organiser) next = "allowed";
    else if (user.organiserStatus === "pending") next = "pending";
    else if (user.organiserStatus === "rejected") next = "rejected";

    return NextResponse.json({
      user,
      isAdmin,
      isOrganiser: organiser,
      canAccessDashboard: canAccessDashboard(user),
      next,
      application: application
        ? {
            id: application.id,
            status: application.status,
            organisationName: application.organisationName,
            reviewNote: application.reviewNote,
            reviewedAt: application.reviewedAt ? application.reviewedAt.toISOString() : null,
            createdAt: application.createdAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    return serverError(error, "Could not read your session");
  }
}

export type SessionResponse = {
  user: import("@/lib/auth").SessionUser | null;
  isAdmin: boolean;
  isOrganiser: boolean;
  canAccessDashboard: boolean;
  next: "signin" | "apply" | "pending" | "rejected" | "allowed";
  application: {
    id: string;
    status: OrganiserStatus | string;
    organisationName: string;
    reviewNote: string | null;
    reviewedAt: string | null;
    createdAt: string;
  } | null;
};
