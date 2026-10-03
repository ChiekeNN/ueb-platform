import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side gate for the private area (Next.js `proxy`, the file that used to
 * be called `middleware`).
 *
 * Why this exists: the organiser Dashboard / Admin links and screens were gated
 * only by client-side session state. That means anything that made the client
 * believe a session existed — a leftover `ueb_session` cookie from an earlier
 * visit, a cached `/api/auth/session` response, a sign-out request that never
 * landed — was enough to show "Dashboard" in the top menu to someone who had
 * not signed in. The navbar is now gated on `!session.loading && user`, and
 * this proxy refuses the private routes before any of their UI is even served.
 *
 * The cookie name is duplicated from `src/lib/auth.ts` on purpose: that module
 * pulls in `node:crypto` and the Postgres pool, neither of which belongs here.
 *
 * Presence of the cookie is a cheap first filter — it is not proof of a valid
 * session. The token is still verified against the database by `getCurrentUser`
 * (page-level gates) and by `requireUser` on every API route, so an expired or
 * forged cookie gets bounced by the client gate a moment later and can never
 * read data.
 */
const SESSION_COOKIE = "ueb_session";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(loginUrl);
}

export default proxy;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/notifications/:path*",
    "/events/create",
    "/events/:slug/manage/:path*",
    "/events/:slug/report/:path*",
  ],
};
