/**
 * The Web Push side of the planner reminders: VAPID setup and one send helper.
 *
 * Isolated here because it pulls in `web-push` (Node crypto, not edge-safe) and
 * reads env that only exists in a deployed environment. The reminder cron is the
 * only caller; the pure "is it due yet" logic lives in `planner-reminders.ts`
 * and stays importable from the check script.
 */
import webpush from "web-push";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@cainsat.org";

let configured = false;
if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/** False when the VAPID keys are absent -- the feature is simply off. */
export function webPushConfigured(): boolean {
  return configured;
}

/** The VAPID public key, handed to the browser so it can subscribe. */
export function vapidPublicKey(): string | null {
  return publicKey ?? null;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface ReminderPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/**
 * - `ok`: the push service accepted it.
 * - `gone`: 404/410 -- the subscription is dead and should be deleted.
 * - `error`: anything else (transient); leave the row, try again next run.
 */
export type SendResult = "ok" | "gone" | "error";

export async function sendReminderPush(
  sub: StoredSubscription,
  payload: ReminderPayload
): Promise<SendResult> {
  if (!configured) return "error";
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 3600, urgency: "normal" }
    );
    return "ok";
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[planner] push send failed", status, (err as { body?: string })?.body);
    return "error";
  }
}
