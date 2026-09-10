import { NextResponse } from "next/server";

/**
 * The planner is served as static files from tasks.cainsat.org, so its calls to
 * these routes are cross-origin even though they are same-site. Same-site is
 * what matters for the session cookie (both hosts sit under cainsat.org, so a
 * SameSite=Lax cookie is still sent); cross-origin is what makes CORS apply.
 *
 * The allowlist is exact-match on purpose. A wildcard cannot be combined with
 * credentialed requests, and reflecting whatever Origin arrives would hand any
 * site the ability to read a signed-in student's tasks.
 */
const ALLOWED_ORIGINS = new Set([
  "https://tasks.cainsat.org",
  // Live Server, for running the planner against a local `next dev`.
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

export function plannerOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
}

/** Adds the CORS headers to a response, when the caller is one we allow. */
export function withCors<T extends NextResponse>(res: T, origin: string | null): T {
  if (!origin) return res;
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  // Origin decides the body, so caches must not serve one site's response to another.
  res.headers.set("Vary", "Origin");
  return res;
}

export function corsJson(req: Request, body: unknown, init?: ResponseInit) {
  return withCors(NextResponse.json(body, init), plannerOrigin(req));
}

/** Preflight. Every planner route re-exports this as its OPTIONS handler. */
export function plannerPreflight(req: Request) {
  const origin = plannerOrigin(req);
  if (!origin) return new NextResponse(null, { status: 403 });
  const res = withCors(new NextResponse(null, { status: 204 }), origin);
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}
