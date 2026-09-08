import { withAuth } from "next-auth/middleware";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

export default withAuth({
  pages: { signIn: "/auth/login" },
  /**
   * `withAuth` does not see `authOptions` -- it calls `getToken` itself, and
   * without being told the cookie name it looks for NextAuth's default
   * `__Secure-next-auth.session-token`. Since the session cookie was renamed and
   * scoped to `.cainsat.org` for the planner, that default does not exist: every
   * signed-in student read as signed out and was redirected straight back to
   * /auth/login, which is a login loop no amount of signing in can escape.
   */
  ...(SESSION_COOKIE_NAME
    ? { cookies: { sessionToken: { name: SESSION_COOKIE_NAME } } }
    : {}),
});

/**
 * Every page inside the (app) group. Only /dashboard was listed before, so a
 * signed-out visitor could open the full test and sink two hours into a sitting
 * that had nowhere to be saved. The layout also redirects client-side; this is
 * the server-side half, which additionally avoids a flash of the page.
 */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/lessons/:path*",
    "/learn/:path*",
    "/full-test/:path*",
    "/practice/:path*",
    "/calendar/:path*",
    "/history/:path*",
  ],
};
