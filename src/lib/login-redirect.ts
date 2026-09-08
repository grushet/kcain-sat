/**
 * Where to send someone once they have signed in.
 *
 * The planner at tasks.cainsat.org has no accounts of its own: it sends students
 * to /auth/login with ?callbackUrl=<planner page> and expects them back. The
 * login page used to ignore that and always land on /dashboard, which stranded
 * everyone who arrived from the planner -- they never got back, so the planner
 * never loaded, and because it refuses to save before its first load, nothing
 * they typed was ever stored.
 *
 * NextAuth's `redirect` callback applies the same allowlist server-side, but the
 * credentials path navigates client-side and never reaches it. Kept apart from
 * the page so it can be exercised without rendering React.
 */

export const PLANNER_ORIGIN = "https://tasks.cainsat.org";
export const DEFAULT_AFTER_LOGIN = "/dashboard";

/**
 * The requested destination if we are willing to send a signed-in student there,
 * otherwise the dashboard. Anything not on this app or the planner is discarded
 * rather than followed: this value comes straight from the query string, so an
 * unchecked one is an open redirect worth phishing with.
 */
export function safeCallbackUrl(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_AFTER_LOGIN;
  // A protocol-relative "//evil.com" also starts with "/", so it has to be ruled
  // out before the relative-path case can accept it as one of ours.
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    return new URL(raw).origin === PLANNER_ORIGIN ? raw : DEFAULT_AFTER_LOGIN;
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
}
