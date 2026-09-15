import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCurrentUserAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const COHORT_DAYS = 30;
const RETENTION_WINDOWS = [1, 3, 7] as const;

/** UTC calendar-day index, so retention math is exact arithmetic rather than a
 * timestamp diff that drifts with the hour someone happened to sign up. */
function dayIndex(d: Date): number {
  return Math.floor(d.getTime() / DAY_MS);
}

function dayKey(idx: number): string {
  return new Date(idx * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Usage/retention numbers for the admin dashboard's Usage tab. Gated the same
 * way as /api/admin/stats.
 *
 * Retention here is necessarily a proxy: `User.lastActiveAt` only holds the
 * *most recent* activity, not a daily log, so "day-N retention" is computed as
 * "came back on or after day N" (lastActiveAt's calendar day is at least N
 * days after the signup day) rather than "was active on exactly day N". A
 * cohort too young for a given window to be knowable yet reports `null` for
 * that window instead of a misleading 0%.
 */
export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = Date.now();
  const today = dayIndex(new Date(now));
  const sevenDaysAgo = new Date(now - 7 * DAY_MS);
  const thirtyDaysAgo = new Date(now - 30 * DAY_MS);
  const cohortSince = new Date((today - COHORT_DAYS + 1) * DAY_MS);

  const [
    dau,
    wau,
    tasksLast7,
    tasksLast30,
    practiceLast7,
    practiceLast30,
    answersLast7,
    answersLast30,
    cohortUsers,
  ] = await Promise.all([
    prisma.user.count({ where: { lastActiveAt: { gte: new Date(now - DAY_MS) } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
    prisma.plannerTask.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.plannerTask.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.practiceSession.count({ where: { startedAt: { gte: sevenDaysAgo } } }),
    prisma.practiceSession.count({ where: { startedAt: { gte: thirtyDaysAgo } } }),
    prisma.userQuestionAnswer.count({ where: { answeredAt: { gte: sevenDaysAgo } } }),
    prisma.userQuestionAnswer.count({ where: { answeredAt: { gte: thirtyDaysAgo } } }),
    prisma.user.findMany({
      where: { createdAt: { gte: cohortSince } },
      select: { createdAt: true, lastActiveAt: true },
    }),
  ]);

  type Bucket = { size: number; retained: Record<(typeof RETENTION_WINDOWS)[number], number> };
  const cohorts = new Map<number, Bucket>();
  for (let i = 0; i < COHORT_DAYS; i++) {
    const idx = today - COHORT_DAYS + 1 + i;
    cohorts.set(idx, { size: 0, retained: { 1: 0, 3: 0, 7: 0 } });
  }

  for (const u of cohortUsers) {
    const signupIdx = dayIndex(u.createdAt);
    const bucket = cohorts.get(signupIdx);
    if (!bucket) continue; // signed up before the window (UTC boundary edge)
    bucket.size += 1;
    if (!u.lastActiveAt) continue;
    const activeIdx = dayIndex(u.lastActiveAt);
    for (const n of RETENTION_WINDOWS) {
      if (activeIdx - signupIdx >= n) bucket.retained[n] += 1;
    }
  }

  const retention = Array.from(cohorts.entries())
    .sort(([a], [b]) => a - b)
    .map(([idx, bucket]) => ({
      date: dayKey(idx),
      cohortSize: bucket.size,
      day1: pct(bucket, idx, 1, today),
      day3: pct(bucket, idx, 3, today),
      day7: pct(bucket, idx, 7, today),
    }));

  return NextResponse.json({
    dau,
    wau,
    actions: {
      planner: { tasksCreated: { last7: tasksLast7, last30: tasksLast30 } },
      sat: {
        practiceSessions: { last7: practiceLast7, last30: practiceLast30 },
        questionsAnswered: { last7: answersLast7, last30: answersLast30 },
      },
    },
    retention,
  });
}

function pct(
  bucket: { size: number; retained: Record<number, number> },
  cohortIdx: number,
  window: number,
  todayIdx: number
): number | null {
  if (todayIdx - cohortIdx < window) return null; // not enough time has passed to know yet
  if (bucket.size === 0) return null;
  return Math.round((bucket.retained[window] / bucket.size) * 100);
}
