import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import { QUESTION_SELECT, rowToClientQuestion, type ClientQuestion } from "@/lib/question-store";
import { writeModuleAnswerLog } from "@/lib/attempt-service";
import { MODULE_META, countCorrect, isModuleKey } from "@/lib/test-attempt";
import { grantXP } from "@/lib/xp-service";
import { XP, XP_SOURCE } from "@/lib/xp";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** No SAT module is anywhere near this long; the cap is only there to bound a request. */
const MAX_QUESTIONS = 100;
/** Grid-in answers are a handful of characters. Anything longer is not an answer. */
const MAX_ANSWER_LENGTH = 64;

function readIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_QUESTIONS) return null;
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string" || v.length === 0 || v.length > 64) return null;
    out.push(v);
  }
  return out;
}

function readAnswers(value: unknown, length: number): (string | null)[] {
  const out = new Array<string | null>(length).fill(null);
  if (!Array.isArray(value)) return out;
  for (let i = 0; i < length; i++) {
    const v = value[i];
    if (typeof v === "string" && v.trim().length > 0) {
      out[i] = v.trim().slice(0, MAX_ANSWER_LENGTH);
    }
  }
  return out;
}

function readTimes(value: unknown, length: number): (number | null)[] {
  const out = new Array<number | null>(length).fill(null);
  if (!Array.isArray(value)) return out;
  for (let i = 0; i < length; i++) {
    const v = value[i];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[i] = Math.min(Math.round(v), 24 * 60 * 60);
    }
  }
  return out;
}

/**
 * Saves the live state of one module. The page calls this when a module starts,
 * after every confirmed answer, on a slow timer heartbeat and when the module
 * ends, so the most a crash can cost is the few seconds since the last call.
 *
 * The question list is fixed the first time it is written. Later calls only move
 * answers and the clock, which keeps a replayed or reordered request from
 * quietly swapping the questions under a student mid-module.
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const key = body.key;
  if (!isModuleKey(key)) {
    return NextResponse.json({ error: "Unknown module" }, { status: 400 });
  }

  const attempt = await prisma.testAttempt.findFirst({
    where: { id: params.id, userId, status: "in_progress" },
    select: { id: true },
  });
  if (!attempt) {
    return NextResponse.json({ error: "No test in progress" }, { status: 404 });
  }

  const existing = await prisma.testModule.findUnique({
    where: { attemptId_key: { attemptId: attempt.id, key } },
    select: { id: true, questionIds: true, status: true },
  });

  let questionIds: string[];
  if (existing) {
    const stored = existing.questionIds;
    questionIds = Array.isArray(stored) ? stored.filter((v): v is string => typeof v === "string") : [];
  } else {
    const incoming = readIds(body.questionIds);
    if (!incoming) {
      return NextResponse.json({ error: "questionIds required" }, { status: 400 });
    }
    // Every id has to name a real banked question, otherwise the review screen
    // would later render a module full of holes.
    const unique = Array.from(new Set(incoming));
    const found = await prisma.question.count({ where: { id: { in: unique } } });
    if (found !== unique.length) {
      return NextResponse.json({ error: "Unknown questions" }, { status: 400 });
    }
    questionIds = incoming;
  }

  const answers = readAnswers(body.answers, questionIds.length);
  const times = readTimes(body.times, questionIds.length);
  const completed = body.status === "completed";
  const currentIndex = Number.isInteger(body.currentIndex)
    ? Math.min(Math.max(body.currentIndex as number, 0), Math.max(questionIds.length - 1, 0))
    : 0;
  const secondsLeft =
    typeof body.secondsLeft === "number" && Number.isFinite(body.secondsLeft)
      ? Math.max(0, Math.round(body.secondsLeft))
      : null;
  const durationSeconds =
    typeof body.durationSeconds === "number" && body.durationSeconds > 0
      ? Math.round(body.durationSeconds)
      : MODULE_META[key].seconds;

  // The score is worked out from the stored questions, never taken from the
  // page, so a tampered request cannot invent a 1600.
  let rawScore: number | null = null;
  let ordered: ClientQuestion[] = [];
  let orderedAnswers: (string | null)[] = [];
  let orderedTimes: (number | null)[] = [];
  if (completed) {
    const rows = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: QUESTION_SELECT,
    });
    const byId = new Map(rows.map((r) => [r.id, rowToClientQuestion(r)]));
    // Drop a question and its answer together. Filtering only the questions
    // would shift every later answer onto the wrong question.
    questionIds.forEach((id, i) => {
      const q = byId.get(id);
      if (!q) return;
      ordered.push(q);
      orderedAnswers.push(answers[i] ?? null);
      orderedTimes.push(times[i] ?? null);
    });
    rawScore = countCorrect(ordered, orderedAnswers);
  }

  const saved = await prisma.testModule.upsert({
    where: { attemptId_key: { attemptId: attempt.id, key } },
    create: {
      attemptId: attempt.id,
      key,
      order: MODULE_META[key].order,
      harder: body.harder === true,
      questionIds,
      answers,
      times,
      currentIndex,
      secondsLeft,
      durationSeconds,
      status: completed ? "completed" : "in_progress",
      rawScore,
      completedAt: completed ? new Date() : null,
    },
    update: {
      answers,
      times,
      currentIndex,
      secondsLeft,
      // A module that has been handed in stays handed in, so a stray autosave
      // arriving after the fact cannot reopen it.
      status: completed || existing?.status === "completed" ? "completed" : "in_progress",
      ...(completed ? { rawScore, completedAt: new Date() } : {}),
    },
    select: { id: true, rawScore: true },
  });

  let xpEarned = 0;
  if (completed) {
    await writeModuleAnswerLog(userId, attempt.id, key, ordered, orderedAnswers, orderedTimes);

    // Paying per module means an abandoned test still pays for the modules that
    // were actually sat, and it counts the day for the streak even if the
    // student never reaches the end.
    const xp = await grantXP(userId, {
      amount: XP.testModule,
      source: XP_SOURCE.testModule,
      reference: `${attempt.id}:${key}`,
      scope: "once",
    });
    xpEarned = xp.awarded;
  }

  return NextResponse.json({ ok: true, rawScore: saved.rawScore, xpEarned });
}
