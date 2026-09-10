import { prisma } from "@/lib/prisma";
import {
  sendReminderPush,
  webPushConfigured,
  type ReminderPayload,
} from "@/lib/planner-push";
import { reminderStatus, DEFAULT_TIME_ZONE } from "@/lib/planner-reminders";

export const dynamic = "force-dynamic";
// web-push needs Node crypto; this must not run on the edge.
export const runtime = "nodejs";

const PLANNER_URL = "https://tasks.cainsat.org/main_page.html";

/**
 * Driven every few minutes by an external pinger (cron-job.org), which sends
 * `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron sends that same header on
 * its own calls and would work identically, but the Hobby plan rejects any
 * schedule finer than daily, so vercel.json deliberately carries no `crons`.
 *
 * A `?key=` query param is accepted as a fallback for pingers that cannot set a
 * header. Without CRON_SECRET configured the route refuses outright rather than
 * run unauthenticated.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!webPushConfigured()) {
    return Response.json({ error: "Web push not configured" }, { status: 503 });
  }

  const now = new Date();

  // Everything that could still fire. The set is small -- one student's pending
  // reminders -- so this is a cheap scan, and reminderFired keeps it shrinking.
  const tasks = await prisma.plannerTask.findMany({
    where: { reminder: { not: null }, reminderFired: false, completed: false },
    select: { id: true, userId: true, text: true, reminder: true },
  });

  const summary = { checked: tasks.length, due: 0, sent: 0, pruned: 0, fired: 0 };
  if (tasks.length === 0) return Response.json(summary);

  const userIds = Array.from(new Set(tasks.map((t) => t.userId)));
  const subs = await prisma.plannerPushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  const byUser = new Map<string, typeof subs>();
  for (const s of subs) {
    const list = byUser.get(s.userId);
    if (list) list.push(s);
    else byUser.set(s.userId, [s]);
  }

  for (const task of tasks) {
    const userSubs = byUser.get(task.userId) ?? [];
    // One reminder, one reminderFired flag, but a student could have devices in
    // two zones. Use the first subscription's zone to decide; they are the same
    // zone in every realistic case.
    const zone = userSubs[0]?.timeZone || DEFAULT_TIME_ZONE;
    const status = reminderStatus(task.reminder!, zone, now);

    if (status === "pending") continue;

    if (status === "due" && userSubs.length === 0) {
      // Nothing to notify yet. Leave it be in case they grant push within the
      // staleness window; once past that it comes back as "stale" and retires.
      continue;
    }

    summary.due++;

    let okThisTask = 0;
    let goneThisTask = 0;
    let errThisTask = 0;

    if (status === "due") {
      const payload: ReminderPayload = {
        title: task.text,
        body: "Task reminder",
        url: PLANNER_URL,
        tag: `task-${task.id}`,
      };
      for (const s of userSubs) {
        const result = await sendReminderPush(s, payload);
        if (result === "ok") {
          okThisTask++;
        } else if (result === "gone") {
          await prisma.plannerPushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => {});
          goneThisTask++;
        } else {
          errThisTask++;
        }
      }
      summary.sent += okThisTask;
      summary.pruned += goneThisTask;
    }

    // Fire-once: mark it whether it was sent, retired as stale, or had only
    // dead endpoints left. The one case we do not mark is when every send this
    // run failed transiently, so the next run retries it.
    const onlyTransientFailures =
      status === "due" && okThisTask === 0 && goneThisTask === 0 && errThisTask > 0;
    if (!onlyTransientFailures) {
      await prisma.plannerTask.update({
        where: { id: task.id },
        data: { reminderFired: true },
      });
      summary.fired++;
    }
  }

  return Response.json(summary);
}
