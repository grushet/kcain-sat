import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Enough answers to make the skill breakdown meaningful without unbounded reads. */
const SKILL_SAMPLE = 2000;

export interface HistoryAttempt {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  completedAt: string | null;
  rwRaw: number | null;
  rwMax: number | null;
  mathRaw: number | null;
  mathMax: number | null;
  rwScaled: number | null;
  mathScaled: number | null;
  totalScaled: number | null;
  modulesCompleted: number;
}

export interface HistoryPracticeSession {
  id: string;
  topicSlug: string;
  topicLabel: string;
  difficulty: string;
  totalQuestions: number;
  answered: number;
  correct: number;
  startedAt: string;
  completedAt: string | null;
}

export interface SkillBreakdown {
  skill: string;
  section: "math" | "rw";
  total: number;
  correct: number;
}

/**
 * Everything the history page shows: past sittings, practice runs, and the skill
 * breakdown. The breakdown is only possible because answers point at a shared
 * question bank, so a skill label means the same thing across every test.
 */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [attemptRows, practiceRows, answerRows] = await Promise.all([
    prisma.testAttempt.findMany({
      where: { userId, status: { in: ["completed", "in_progress"] } },
      orderBy: { startedAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        rwRaw: true,
        rwMax: true,
        mathRaw: true,
        mathMax: true,
        rwScaled: true,
        mathScaled: true,
        totalScaled: true,
        modules: { where: { status: "completed" }, select: { id: true } },
      },
    }),
    prisma.practiceSession.findMany({
      where: { userId, answered: { gt: 0 } },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
    prisma.userQuestionAnswer.findMany({
      where: { userId },
      orderBy: { answeredAt: "desc" },
      take: SKILL_SAMPLE,
      select: {
        isCorrect: true,
        question: { select: { skillDesc: true, topic: true, section: true } },
      },
    }),
  ]);

  const attempts: HistoryAttempt[] = attemptRows.map((a) => ({
    id: a.id,
    status:
      a.status === "completed" ? "completed" : a.status === "abandoned" ? "abandoned" : "in_progress",
    startedAt: a.startedAt.toISOString(),
    completedAt: a.completedAt ? a.completedAt.toISOString() : null,
    rwRaw: a.rwRaw,
    rwMax: a.rwMax,
    mathRaw: a.mathRaw,
    mathMax: a.mathMax,
    rwScaled: a.rwScaled,
    mathScaled: a.mathScaled,
    totalScaled: a.totalScaled,
    modulesCompleted: a.modules.length,
  }));

  const practiceSessions: HistoryPracticeSession[] = practiceRows.map((p) => ({
    id: p.id,
    topicSlug: p.topicSlug,
    topicLabel: p.topicLabel,
    difficulty: p.difficulty,
    totalQuestions: p.totalQuestions,
    answered: p.answered,
    correct: p.correct,
    startedAt: p.startedAt.toISOString(),
    completedAt: p.completedAt ? p.completedAt.toISOString() : null,
  }));

  const bySkill = new Map<string, SkillBreakdown>();
  for (const row of answerRows) {
    const skill = row.question.skillDesc?.trim() || row.question.topic?.trim();
    if (!skill) continue;
    const entry = bySkill.get(skill) ?? {
      skill,
      section: row.question.section === "math" ? ("math" as const) : ("rw" as const),
      total: 0,
      correct: 0,
    };
    entry.total += 1;
    if (row.isCorrect) entry.correct += 1;
    bySkill.set(skill, entry);
  }

  // A skill seen once or twice says nothing about a weakness, so the ranking
  // only considers skills with enough attempts behind them to mean something.
  const skills = Array.from(bySkill.values())
    .filter((s) => s.total >= 3)
    .sort((a, b) => a.correct / a.total - b.correct / b.total);

  return NextResponse.json({ attempts, practiceSessions, skills });
}
