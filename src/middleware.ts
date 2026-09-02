import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/auth/login" },
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
