/**
 * Where the session cookie lives, for everything that reads it.
 *
 * The cookie is renamed and scoped to the parent domain so tasks.cainsat.org can
 * read the same session (see the comment in `auth-options`). Anything that reads
 * the session *without* going through `authOptions` -- `getToken` in the
 * middleware, in particular -- has to be told the same name, or it looks for
 * NextAuth's default, finds nothing, and bounces every signed-in student back to
 * the login page.
 *
 * This module deliberately imports nothing: the middleware runs on the edge
 * runtime and must not pull in Prisma through `auth-options`.
 */

/**
 * `.cainsat.org` in production, `undefined` on localhost. Dev keeps NextAuth's
 * defaults -- there the cookie name has no `__Secure-` prefix, and setting a
 * domain stops the cookie being stored at all.
 */
export const SESSION_COOKIE_DOMAIN = (() => {
  try {
    const host = new URL(process.env.NEXTAUTH_URL ?? "").hostname;
    return host === "cainsat.org" || host.endsWith(".cainsat.org")
      ? ".cainsat.org"
      : undefined;
  } catch {
    return undefined;
  }
})();

/**
 * Deliberately NOT NextAuth's default name. Anyone signed in before the switch
 * holds a host-only cookie under the default name; a new one scoped to
 * `.cainsat.org` is a *different* cookie, so the browser would send both and the
 * server would read whichever came first. A distinct name cannot collide, so the
 * old cookie is simply ignored and expires on its own.
 *
 * `undefined` when no domain override applies, which is exactly what both
 * NextAuth and `getToken` expect in order to fall back to their defaults.
 */
export const SESSION_COOKIE_NAME = SESSION_COOKIE_DOMAIN
  ? "__Secure-cain.session-token"
  : undefined;
