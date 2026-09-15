import { prisma } from "@/lib/prisma";

const THROTTLE_MS = 60 * 60 * 1000;

/**
 * Records that this user is currently active, at most once per hour.
 *
 * Called from the NextAuth `session` callback, which runs on effectively every
 * signed-in request from both apps (cainsat.org's own useSession polling, and
 * the planner's /api/planner/session). A plain `update` would write on every
 * one of those; the WHERE clause here turns it into a no-op row scan the rest
 * of the time, so the throttle lives in the query itself rather than in any
 * per-request state that a serverless function can't hold onto anyway.
 */
export async function touchLastActive(userId: string): Promise<void> {
  const staleBefore = new Date(Date.now() - THROTTLE_MS);
  await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: staleBefore } }],
    },
    data: { lastActiveAt: new Date() },
  });
}
