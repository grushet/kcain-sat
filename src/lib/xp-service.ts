import { prisma } from "@/lib/prisma";
import {
  DAILY_GOAL_XP,
  levelFromXP,
  storedStudyDay,
  studyDay,
  studyDayKey,
  studyDaysBetween,
  type LevelInfo,
  type XpSource,
} from "@/lib/xp";

/**
 * Every XP award in the app goes through grantXP, and every activity goes
 * through recordActivity. Before this, the streak was updated in exactly one
 * place: the lesson-completion route, below an early return that fired whenever
 * the lesson had been done before. So redoing a lesson did not keep a streak
 * alive, practice and tests never touched it, and once a student had finished
 * all 89 lessons nothing in the app could advance it again.
 */

export interface StreakInfo {
  current: number;
  longest: number;
  /** True when this call is what moved the streak, so the UI can celebrate it. */
  extended: boolean;
}

/**
 * Marks today as a study day. Safe to call repeatedly: the second call on the
 * same day is a no-op, so it can sit on every activity path without inflating
 * anything.
 */
export async function recordActivity(userId: string): Promise<StreakInfo> {
  const today = studyDay();
  const existing = await prisma.streak.findUnique({ where: { userId } });

  if (!existing) {
    const created = await prisma.streak.create({
      data: { userId, currentStreak: 1, longestStreak: 1, lastActiveAt: today },
    });
    return { current: created.currentStreak, longest: created.longestStreak, extended: true };
  }

  const last = storedStudyDay(existing.lastActiveAt);
  const gap = studyDaysBetween(last, today);

  if (gap <= 0) {
    // Already counted today. A row sitting at zero is still nudged to one, so a
    // streak cannot get stuck below the day the student is currently having.
    if (existing.currentStreak >= 1) {
      return {
        current: existing.currentStreak,
        longest: existing.longestStreak,
        extended: false,
      };
    }
    const fixed = await prisma.streak.update({
      where: { userId },
      data: { currentStreak: 1, longestStreak: Math.max(1, existing.longestStreak) },
    });
    return { current: fixed.currentStreak, longest: fixed.longestStreak, extended: true };
  }

  const current = gap === 1 ? existing.currentStreak + 1 : 1;
  const updated = await prisma.streak.update({
    where: { userId },
    data: {
      currentStreak: current,
      longestStreak: Math.max(current, existing.longestStreak),
      lastActiveAt: today,
    },
  });
  return { current: updated.currentStreak, longest: updated.longestStreak, extended: true };
}

/** How often a given award may be repeated. */
export type GrantScope =
  /** As many times as it happens. */
  | "always"
  /** Once ever for this source and reference, e.g. finishing a lesson. */
  | "once"
  /** Once per study day, e.g. re-answering a practice question. */
  | "daily";

export interface GrantOptions {
  amount: number;
  source: XpSource;
  reference?: string | null;
  scope?: GrantScope;
}

/**
 * Returns whether this exact award already exists within its scope.
 *
 * The daily check compares study-day keys in JS rather than filtering on a
 * timestamp range. The study day is a local calendar date, so its boundary is
 * not midnight UTC, and a range comparison would quietly credit an evening
 * session to the wrong day.
 */
async function alreadyGranted(
  userId: string,
  source: XpSource,
  reference: string | null,
  scope: GrantScope
): Promise<boolean> {
  if (scope === "always") return false;

  if (scope === "once") {
    const found = await prisma.xPRecord.findFirst({
      where: { userId, source, reference },
      select: { id: true },
    });
    return found !== null;
  }

  // A study day is never more than ~26 hours from now in either direction, so a
  // two-day window is always enough to hold every candidate.
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recent = await prisma.xPRecord.findMany({
    where: { userId, source, reference, createdAt: { gte: since } },
    select: { createdAt: true },
  });
  const today = studyDayKey();
  return recent.some((r) => studyDayKey(r.createdAt) === today);
}

export interface GrantResult {
  /** XP actually added. Zero when the scope rule declined the award. */
  awarded: number;
  source: XpSource;
  streak: StreakInfo;
}

/**
 * Awards XP and, in the same breath, counts the day and moves the daily goal.
 * Those three used to live apart, which is how the app ended up with a daily
 * goal card wired to a hardcoded zero.
 */
export async function grantXP(
  userId: string,
  { amount, source, reference = null, scope = "always" }: GrantOptions
): Promise<GrantResult> {
  const streak = await recordActivity(userId);

  const value = Math.max(0, Math.round(amount));
  if (value === 0 || (await alreadyGranted(userId, source, reference, scope))) {
    return { awarded: 0, source, streak };
  }

  await prisma.xPRecord.create({ data: { userId, amount: value, source, reference } });
  await addToDailyGoal(userId, value);

  return { awarded: value, source, streak };
}

/** Grants several awards in order and reports what each one actually paid. */
export async function grantMany(
  userId: string,
  grants: GrantOptions[]
): Promise<{ total: number; awards: { source: XpSource; amount: number }[]; streak: StreakInfo }> {
  let total = 0;
  const awards: { source: XpSource; amount: number }[] = [];
  let streak: StreakInfo = { current: 0, longest: 0, extended: false };

  for (const grant of grants) {
    const result = await grantXP(userId, grant);
    streak = result.streak;
    if (result.awarded > 0) {
      total += result.awarded;
      awards.push({ source: result.source, amount: result.awarded });
    }
  }

  return { total, awards, streak };
}

export interface DailyGoalInfo {
  target: number;
  earned: number;
  completed: boolean;
}

async function addToDailyGoal(userId: string, amount: number): Promise<DailyGoalInfo> {
  const date = studyDay();
  const row = await prisma.dailyGoal.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      targetXP: DAILY_GOAL_XP,
      earnedXP: amount,
      completed: amount >= DAILY_GOAL_XP,
    },
    update: { earnedXP: { increment: amount } },
  });

  // The increment above cannot also evaluate the target, so completion is
  // settled once the new total is known.
  if (!row.completed && row.earnedXP >= row.targetXP) {
    await prisma.dailyGoal.update({ where: { id: row.id }, data: { completed: true } });
    return { target: row.targetXP, earned: row.earnedXP, completed: true };
  }

  return { target: row.targetXP, earned: row.earnedXP, completed: row.completed };
}

export async function getDailyGoal(userId: string): Promise<DailyGoalInfo> {
  const row = await prisma.dailyGoal.findUnique({
    where: { userId_date: { userId, date: studyDay() } },
  });
  return {
    target: row?.targetXP ?? DAILY_GOAL_XP,
    earned: row?.earnedXP ?? 0,
    completed: row?.completed ?? false,
  };
}

export interface XpSummary {
  totalXP: number;
  level: LevelInfo;
  streak: StreakInfo;
  dailyGoal: DailyGoalInfo;
  /** Whether today's streak is still waiting on any activity. */
  streakAtRisk: boolean;
}

/** Everything the dashboard shows about rewards, in one round trip. */
export async function getXpSummary(userId: string): Promise<XpSummary> {
  const [sum, streakRow, dailyGoal] = await Promise.all([
    prisma.xPRecord.aggregate({ where: { userId }, _sum: { amount: true } }),
    prisma.streak.findUnique({ where: { userId } }),
    getDailyGoal(userId),
  ]);

  const totalXP = sum._sum.amount ?? 0;
  const today = studyDay();
  const lastActive = streakRow ? storedStudyDay(streakRow.lastActiveAt) : null;
  const gap = lastActive ? studyDaysBetween(lastActive, today) : null;

  // A streak only survives if yesterday was the last active day. Two days back
  // and it is already gone, so there is nothing left to be at risk of losing.
  const streakAtRisk = gap === 1 && (streakRow?.currentStreak ?? 0) > 0;

  return {
    totalXP,
    level: levelFromXP(totalXP),
    streak: {
      current: gap !== null && gap > 1 ? 0 : streakRow?.currentStreak ?? 0,
      longest: streakRow?.longestStreak ?? 0,
      extended: false,
    },
    dailyGoal,
    streakAtRisk,
  };
}
