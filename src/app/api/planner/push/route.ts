import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import { corsJson, plannerPreflight } from "@/lib/planner-cors";
import { webPushConfigured, vapidPublicKey } from "@/lib/planner-push";
import { isValidTimeZone } from "@/lib/planner-reminders";

export const dynamic = "force-dynamic";

export const OPTIONS = plannerPreflight;

/**
 * Public config the planner needs before it can subscribe: whether push is set
 * up on the server at all, and the VAPID public key to hand to
 * pushManager.subscribe(). No session required -- the key is not a secret.
 */
export async function GET(req: Request) {
  return corsJson(req, {
    enabled: webPushConfigured(),
    publicKey: vapidPublicKey(),
  });
}

/**
 * Register (or refresh) one browser's push endpoint for the signed-in student.
 * Body is PushSubscription.toJSON() plus the device's IANA time zone:
 *   { endpoint, keys: { p256dh, auth }, timeZone }
 *
 * Keyed on the endpoint, so re-subscribing from the same browser updates the
 * row rather than adding another.
 */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return corsJson(req, { error: "Not signed in" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return corsJson(req, { error: "Malformed JSON" }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const keys = (body.keys ?? {}) as Record<string, unknown>;
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys.auth === "string" ? keys.auth : "";
  const timeZone = isValidTimeZone(body.timeZone) ? body.timeZone : null;

  // A push endpoint is always https and reasonably short; reject anything else
  // before it reaches the database as a unique key.
  if (
    !/^https:\/\/[^\s]+$/.test(endpoint) ||
    endpoint.length > 1024 ||
    !p256dh ||
    !auth ||
    p256dh.length > 256 ||
    auth.length > 256
  ) {
    return corsJson(req, { error: "Invalid subscription" }, { status: 400 });
  }

  try {
    await prisma.plannerPushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh, auth, timeZone },
      // Re-point the row at whoever is signed in now: a shared browser may have
      // changed hands since the last subscribe.
      update: { userId, p256dh, auth, timeZone },
    });
  } catch (err) {
    console.error("[planner] push subscribe failed", err);
    return corsJson(req, { error: "Could not save subscription" }, { status: 500 });
  }

  return corsJson(req, { ok: true });
}

/**
 * Drop a subscription -- the browser called pushManager.unsubscribe(), or the
 * planner noticed its stored key no longer matches the server's. Endpoint comes
 * in the query string or a JSON body. Scoped to the caller so one account
 * cannot delete another's row by guessing an endpoint.
 */
export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return corsJson(req, { error: "Not signed in" }, { status: 401 });

  let endpoint = new URL(req.url).searchParams.get("endpoint") ?? "";
  if (!endpoint) {
    try {
      const body = (await req.json()) as { endpoint?: unknown };
      if (typeof body.endpoint === "string") endpoint = body.endpoint;
    } catch {
      /* no body is fine */
    }
  }
  if (!endpoint) {
    return corsJson(req, { error: "Missing endpoint" }, { status: 400 });
  }

  try {
    await prisma.plannerPushSubscription.deleteMany({ where: { endpoint, userId } });
  } catch (err) {
    console.error("[planner] push unsubscribe failed", err);
    return corsJson(req, { error: "Could not remove subscription" }, { status: 500 });
  }

  return corsJson(req, { ok: true });
}
