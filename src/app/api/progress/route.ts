import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getLesson, MATH_LESSON_IDS, READING_LESSON_IDS } from "@/lib/lessons";
import { getXpSummary } from "@/lib/xp-service";
import { DAILY_GOAL_XP, levelFromXP, xpLabel } from "@/lib/xp";

export const dynamic = "force-dynamic";

const EMPTY = {
  totalXP: 0,
  level: levelFromXP(0),
  streak: { current: 0, longest: 0, extended: false },
  dailyGoal: { target: DAILY_GOAL_XP, earned: 0, completed: false },
  streakAtRisk: false,
  completedLessonIds: [] as string[],
  mathCompleted: 0,
  readingCompleted: 0,
  lastCompleted: [] as { lessonId: string | null; title: string; completedAt: string }[],
  recentXP: [] as { source: string; label: string; amount: number; at: string }[],
};

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json(EMPTY);

  const [summary, lessonRecords, recent] = await Promise.all([
    getXpSummary(userId),
    prisma.xPRecord.findMany({
      where: { userId, source: "lesson" },
      orderBy: { createdAt: "desc" },
      select: { reference: true, createdAt: true },
    }),
    prisma.xPRecord.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { source: true, amount: true, createdAt: true },
    }),
  ]);

  const completedLessonIds = lessonRecords
    .map((r) => r.reference)
    .filter((id): id is string => typeof id === "string");
  const mathCompleted = completedLessonIds.filter((id) => MATH_LESSON_IDS.includes(id)).length;
  const readingCompleted = completedLessonIds.filter((id) => READING_LESSON_IDS.includes(id)).length;

  const lastCompleted = lessonRecords.slice(0, 5).map((r) => ({
    lessonId: r.reference,
    title: getLesson(r.reference ?? "")?.title ?? "Lesson",
    completedAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({
    ...summary,
    completedLessonIds,
    mathCompleted,
    readingCompleted,
    lastCompleted,
    recentXP: recent.map((r) => ({
      source: r.source,
      label: xpLabel(r.source),
      amount: r.amount,
      at: r.createdAt.toISOString(),
    })),
  });
}
