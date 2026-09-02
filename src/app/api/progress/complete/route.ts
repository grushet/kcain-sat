import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/api-auth";
import { getLesson } from "@/lib/lessons";
import { getDailyGoal, grantXP } from "@/lib/xp-service";
import { XP, XP_SOURCE, levelFromXP } from "@/lib/xp";
import { prisma } from "@/lib/prisma";

/**
 * Finishing a lesson. The first time pays the lesson's own reward; after that it
 * pays a smaller review award, once per lesson per day.
 *
 * The old version returned early on an already-completed lesson, and the streak
 * update sat below that return. Redoing a lesson therefore did not keep a streak
 * alive, and once a student had finished all 89 lessons no action in the app
 * could extend one at all. Going through grantXP means every path here counts
 * the day, whether or not it happens to pay anything.
 */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { lessonId } = await request.json().catch(() => ({ lessonId: null }));
  if (!lessonId || typeof lessonId !== "string") {
    return NextResponse.json({ error: "lessonId required" }, { status: 400 });
  }

  const lesson = getLesson(lessonId);
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const firstTime =
    (await prisma.xPRecord.findFirst({
      where: { userId, source: XP_SOURCE.lesson, reference: lessonId },
      select: { id: true },
    })) === null;

  const result = firstTime
    ? await grantXP(userId, {
        amount: lesson.xpReward,
        source: XP_SOURCE.lesson,
        reference: lessonId,
        scope: "once",
      })
    : await grantXP(userId, {
        amount: XP.lessonReview,
        source: XP_SOURCE.lessonReview,
        reference: lessonId,
        scope: "daily",
      });

  const [total, dailyGoal] = await Promise.all([
    prisma.xPRecord.aggregate({ where: { userId }, _sum: { amount: true } }),
    getDailyGoal(userId),
  ]);
  const totalXP = total._sum.amount ?? 0;

  return NextResponse.json({
    ok: true,
    xpEarned: result.awarded,
    alreadyCompleted: !firstTime,
    source: result.source,
    totalXP,
    level: levelFromXP(totalXP),
    streak: result.streak,
    dailyGoal,
  });
}
