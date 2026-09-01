import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getLesson, MATH_LESSON_IDS, READING_LESSON_IDS } from "@/lib/lessons";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ totalXP: 0, completedLessonIds: [], streak: 0, mathCompleted: 0, readingCompleted: 0, lastCompleted: [] });
  }

  const userId = session.user.id as string;

  const [xpRecords, streakRow] = await Promise.all([
    prisma.xPRecord.findMany({ where: { userId, source: "lesson" }, orderBy: { createdAt: "desc" } }),
    prisma.streak.findUnique({ where: { userId } }),
  ]);

  const totalXP = (await prisma.xPRecord.aggregate({ where: { userId }, _sum: { amount: true } }))._sum.amount ?? 0;
  const completedLessonIds = xpRecords.map((r) => r.reference).filter(Boolean) as string[];
  const mathCompleted = completedLessonIds.filter((id) => MATH_LESSON_IDS.includes(id)).length;
  const readingCompleted = completedLessonIds.filter((id) => READING_LESSON_IDS.includes(id)).length;
  const lastCompleted = xpRecords.slice(0, 5).map((r) => {
    const lesson = getLesson(r.reference ?? "");
    return { lessonId: r.reference, title: lesson?.title ?? "Lesson", completedAt: r.createdAt };
  });

  return NextResponse.json({
    totalXP,
    completedLessonIds,
    streak: streakRow?.currentStreak ?? 0,
    mathCompleted,
    readingCompleted,
    lastCompleted,
  });
}
