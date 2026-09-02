import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import { getPracticeQuestionById } from "@/lib/questions";
import {
  QUESTION_SELECT,
  rowToClientQuestion,
  upsertQuestions,
} from "@/lib/question-store";
import { practiceTopicSection } from "@/lib/practice-topics";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "E",
  medium: "M",
  hard: "H",
  very_hard: "H",
};

/**
 * One practice run in full, so the review screen can show the exact questions
 * that were missed alongside the explanation for each.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.practiceSession.findFirst({
    where: { id: params.id, userId },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.userQuestionAnswer.findMany({
    where: { practiceSessionId: session.id },
    orderBy: [{ orderIndex: "asc" }, { answeredAt: "asc" }],
    select: {
      selectedAnswer: true,
      isCorrect: true,
      timeSpent: true,
      answeredAt: true,
      question: { select: QUESTION_SELECT },
    },
  });

  return NextResponse.json({
    session: {
      id: session.id,
      topicSlug: session.topicSlug,
      topicLabel: session.topicLabel,
      difficulty: session.difficulty,
      totalQuestions: session.totalQuestions,
      answered: session.answered,
      correct: session.correct,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    },
    answers: rows.map((row) => ({
      question: rowToClientQuestion(row.question),
      selectedAnswer: row.selectedAnswer,
      isCorrect: row.isCorrect,
      timeSpent: row.timeSpent,
      answeredAt: row.answeredAt.toISOString(),
    })),
  });
}

/**
 * Records one practice answer. The page sends the question id and the letter it
 * picked; grading happens here against the bank, so the stored result is the
 * real one and not whatever the page believed.
 *
 * Answering the same position twice replaces the earlier row rather than adding
 * one, which keeps a double-click or a retried request from inflating the count.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const session = await prisma.practiceSession.findFirst({
    where: { id: params.id, userId },
    select: { id: true, topicSlug: true },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bankQuestion =
    typeof body.questionId === "string" ? getPracticeQuestionById(body.questionId) : undefined;
  if (!bankQuestion) {
    return NextResponse.json({ error: "Unknown question" }, { status: 400 });
  }

  const selected =
    typeof body.selectedAnswer === "string" && body.selectedAnswer.trim().length > 0
      ? body.selectedAnswer.trim().slice(0, 64)
      : null;
  const orderIndex = Number.isInteger(body.orderIndex) ? (body.orderIndex as number) : null;
  const timeSpent =
    typeof body.timeSpent === "number" && Number.isFinite(body.timeSpent) && body.timeSpent >= 0
      ? Math.min(Math.round(body.timeSpent), 24 * 60 * 60)
      : null;

  // The local bank is static, so "bank:" plus its own id is a stable identity.
  const externalId = `bank:${bankQuestion.id}`;
  const banked = await upsertQuestions([
    {
      externalId,
      source: "practice_bank",
      section: practiceTopicSection(session.topicSlug),
      topic: bankQuestion.topic,
      difficulty: DIFFICULTY_LABEL[bankQuestion.difficulty] ?? "M",
      skillDesc: bankQuestion.topic,
      questionText: bankQuestion.question,
      questionType: "multiple_choice",
      correctAnswers: [bankQuestion.correctKey],
      explanation: bankQuestion.explanation,
      options: bankQuestion.options,
    },
  ]);

  const questionId = banked.get(externalId);
  if (!questionId) {
    return NextResponse.json({ error: "Could not bank question" }, { status: 500 });
  }

  const isCorrect = selected === bankQuestion.correctKey;

  await prisma.$transaction([
    prisma.userQuestionAnswer.deleteMany({
      where: { practiceSessionId: session.id, questionId },
    }),
    prisma.userQuestionAnswer.create({
      data: {
        userId,
        questionId,
        source: "practice",
        practiceSessionId: session.id,
        orderIndex,
        selectedAnswer: selected,
        isCorrect,
        timeSpent,
      },
    }),
  ]);

  // Recount from the log instead of incrementing, so a replaced answer or a
  // retried request can never drift the totals away from the stored rows.
  const [answered, correct] = await Promise.all([
    prisma.userQuestionAnswer.count({ where: { practiceSessionId: session.id } }),
    prisma.userQuestionAnswer.count({
      where: { practiceSessionId: session.id, isCorrect: true },
    }),
  ]);

  await prisma.practiceSession.update({
    where: { id: session.id },
    data: { answered, correct },
  });

  return NextResponse.json({ ok: true, isCorrect, answered, correct });
}

/** Marks a run finished, which is what separates it from one simply left open. */
export async function PATCH(_req: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.practiceSession.updateMany({
    where: { id: params.id, userId, completedAt: null },
    data: { completedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
