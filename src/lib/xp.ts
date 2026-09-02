/**
 * The reward economy, in one place.
 *
 * Everything here is anchored to one measured number: the 89 lessons carry 1988
 * XP between them, averaging 22 XP for roughly ten minutes of work. That is the
 * exchange rate, and every other award is priced against it so the numbers mean
 * the same thing wherever a student sees them.
 *
 * Nothing in this file touches the database, so both the pages and the API read
 * the same constants and can never disagree about what something is worth.
 */

/** What an XPRecord.source can be. The ledger is explained back to the student. */
export const XP_SOURCE = {
  lesson: "lesson",
  lessonReview: "lesson_review",
  practice: "practice",
  practicePerfect: "practice_perfect",
  testModule: "test_module",
  testComplete: "test_complete",
  testPersonalBest: "test_personal_best",
} as const;

export type XpSource = (typeof XP_SOURCE)[keyof typeof XP_SOURCE];

export const XP = {
  /** A lesson pays its own xpReward the first time; see LESSON_AVG for the scale. */
  lessonReview: 5,

  /**
   * Practice pays for turning up and pays double for being right. Rewarding only
   * correct answers would pay the strongest students the most, which is backwards
   * for the people the app exists to help.
   */
  practiceAnswered: 1,
  practiceCorrectBonus: 1,
  /** A clean sweep of a real set, not of three questions. */
  practicePerfect: 10,
  practicePerfectMinimum: 10,

  /**
   * A full test is 98 questions over 134 minutes. Paying per module means an
   * abandoned test still pays for the work actually done, and the completion
   * bonus is what makes finishing the whole thing worth it.
   */
  testModule: 25,
  testComplete: 50,
  /**
   * Beating your own best. Available to every student at every level, unlike a
   * bonus keyed to the absolute score, which would pay the least to the students
   * with the most to gain. A first ever test counts, so the first one lands at 200.
   */
  testPersonalBest: 50,
} as const;

/** Roughly one lesson, or twenty practice questions. Fifteen minutes of work. */
export const DAILY_GOAL_XP = 30;

/** The average lesson award, for pricing anything new against the same scale. */
export const LESSON_AVG_XP = 22;

/** A finished full test, before any personal best. */
export const FULL_TEST_XP = XP.testModule * 4 + XP.testComplete;

// ── Levels ────────────────────────────────────────────────────────────────

/**
 * Level n costs `40 + 15(n-1)` XP, so levels come quickly at the start and cost
 * a little more each time without ever becoming a wall.
 *
 * The old curve was a flat 50 XP per level forever, which put a student at level
 * 40 for finishing the lessons and level 101 at 5000 XP. A number that only ever
 * goes up in a straight line stops meaning anything.
 */
const LEVEL_BASE = 40;
const LEVEL_STEP = 15;

/** XP needed to go from level n to n+1. */
export function xpForLevel(level: number): number {
  return LEVEL_BASE + LEVEL_STEP * (Math.max(1, level) - 1);
}

/** Total XP needed to reach the given level from zero. */
export function xpToReachLevel(level: number): number {
  const m = Math.max(0, level - 1);
  return LEVEL_BASE * m + (LEVEL_STEP * m * (m - 1)) / 2;
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level costs in total. */
  span: number;
  /** XP still needed to reach the next level. */
  toNext: number;
  /** 0-100, for the progress bar. */
  percent: number;
}

/**
 * The exact inverse of xpToReachLevel, so the level shown and the bar under it
 * are always the same arithmetic rather than two rounding decisions.
 */
export function levelFromXP(totalXP: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXP));
  // Solving LEVEL_BASE*m + STEP*m*(m-1)/2 <= xp for m, where m = level - 1.
  const a = LEVEL_STEP / 2;
  const b = LEVEL_BASE - LEVEL_STEP / 2;
  const m = Math.floor((-b + Math.sqrt(b * b + 4 * a * xp)) / (2 * a));

  const level = m + 1;
  const floorXP = xpToReachLevel(level);
  const span = xpForLevel(level);
  const into = xp - floorXP;

  return {
    level,
    into,
    span,
    toNext: Math.max(0, span - into),
    percent: span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 0,
  };
}

// ── Study days ────────────────────────────────────────────────────────────

/**
 * Streaks and daily goals need a definition of "today" that matches when the
 * student is actually studying. Server-local time is UTC on Vercel, which would
 * roll a Canadian student's evening session over into tomorrow and break the
 * streak they just earned. One constant, easy to change if the audience moves.
 */
export const STUDY_TIMEZONE = "America/Toronto";

/** The calendar date in the study timezone, as YYYY-MM-DD. */
export function studyDayKey(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** That study day as UTC midnight, which is how it is stored and compared. */
export function studyDay(at: Date = new Date()): Date {
  return new Date(`${studyDayKey(at)}T00:00:00.000Z`);
}

/**
 * Reads a study day back out of the database.
 *
 * This is NOT studyDay(). studyDay() converts an instant into the study day it
 * falls in; a value already written by it is UTC midnight, and running it
 * through studyDay() again would reinterpret that midnight in a timezone behind
 * UTC and hand back the previous day. Every read would walk the date backwards,
 * so two consecutive days would measure as a two-day gap and reset the streak
 * that was just earned.
 *
 * Truncating to UTC midnight is idempotent on a correct value, and still yields
 * a whole day for any stray wall-clock timestamp.
 */
export function storedStudyDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/** Whole days between two study days. Both must be study days, not instants. */
export function studyDaysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

// ── Presentation ──────────────────────────────────────────────────────────

/** How an award is described wherever the ledger is shown to a student. */
export const XP_LABELS: Record<string, string> = {
  [XP_SOURCE.lesson]: "Lesson completed",
  [XP_SOURCE.lessonReview]: "Lesson reviewed",
  [XP_SOURCE.practice]: "Practice",
  [XP_SOURCE.practicePerfect]: "Perfect practice set",
  [XP_SOURCE.testModule]: "Test module finished",
  [XP_SOURCE.testComplete]: "Full test completed",
  [XP_SOURCE.testPersonalBest]: "New personal best",
};

export function xpLabel(source: string): string {
  return XP_LABELS[source] ?? "XP earned";
}
