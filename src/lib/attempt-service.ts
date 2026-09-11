import { prisma } from "@/lib/prisma";
import {
  QUESTION_SELECT,
  rowToClientQuestion,
  type ClientQuestion,
} from "@/lib/question-store";
import {
  MODULE_META,
  countCorrect,
  isCorrect,
  isModuleKey,
  isPhase,
  resumeScreen,
  type AttemptModulePayload,
  type AttemptPayload,
  type ModuleKey,
  type Phase,
} from "@/lib/test-attempt";
import { estimateSectionScore } from "@/lib/scoring";

/** A JSON column comes back as Prisma.JsonValue, so every read is narrowed. */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? v : ""));
}

function asAnswerArray(value: unknown, length: number): (string | null)[] {
  const out = new Array<string | null>(length).fill(null);
  if (!Array.isArray(value)) return out;
  for (let i = 0; i < length; i++) {
    const v = value[i];
    out[i] = typeof v === "string" && v.length > 0 ? v : null;
  }
  return out;
}

function asTimeArray(value: unknown, length: number): (number | null)[] {
  const out = new Array<number | null>(length).fill(null);
  if (!Array.isArray(value)) return out;
  for (let i = 0; i < length; i++) {
    const v = value[i];
    out[i] = typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  }
  return out;
}

type ModuleRow = {
  key: string;
  harder: boolean;
  questionIds: unknown;
  answers: unknown;
  times: unknown;
  currentIndex: number;
  secondsLeft: number | null;
  durationSeconds: number;
  status: string;
  rawScore: number | null;
};

type AttemptRow = {
  id: string;
  status: string;
  phase: string;
  startedAt: Date;
  completedAt: Date | null;
  rwRaw: number | null;
  rwMax: number | null;
  mathRaw: number | null;
  mathMax: number | null;
  rwScaled: number | null;
  mathScaled: number | null;
  totalScaled: number | null;
  modules: ModuleRow[];
};

export const ATTEMPT_INCLUDE = {
  modules: {
    orderBy: { order: "asc" },
    select: {
      key: true,
      harder: true,
      questionIds: true,
      answers: true,
      times: true,
      currentIndex: true,
      secondsLeft: true,
      durationSeconds: true,
      status: true,
      rawScore: true,
    },
  },
} as const;

/**
 * Turns stored rows back into the exact shape the test and review screens
 * render. A question that has since been deleted from the bank is dropped along
 * with its answer, so positions stay aligned rather than silently shifting.
 */
export async function hydrateAttempt(attempt: AttemptRow): Promise<AttemptPayload> {
  const allIds = new Set<string>();
  for (const mod of attempt.modules) {
    for (const id of asStringArray(mod.questionIds)) allIds.add(id);
  }

  const rows =
    allIds.size > 0
      ? await prisma.question.findMany({
          where: { id: { in: Array.from(allIds) } },
          select: QUESTION_SELECT,
        })
      : [];

  const byId = new Map<string, ClientQuestion>();
  for (const row of rows) byId.set(row.id, rowToClientQuestion(row));

  const modules: AttemptModulePayload[] = [];
  for (const mod of attempt.modules) {
    if (!isModuleKey(mod.key)) continue;
    const ids = asStringArray(mod.questionIds);
    const answers = asAnswerArray(mod.answers, ids.length);
    const times = asTimeArray(mod.times, ids.length);

    const questions: ClientQuestion[] = [];
    const keptAnswers: (string | null)[] = [];
    const keptTimes: (number | null)[] = [];
    ids.forEach((id, i) => {
      const q = byId.get(id);
      if (!q) return;
      questions.push(q);
      keptAnswers.push(answers[i] ?? null);
      keptTimes.push(times[i] ?? null);
    });

    modules.push({
      key: mod.key,
      harder: mod.harder,
      questions,
      answers: keptAnswers,
      times: keptTimes,
      currentIndex: Math.min(Math.max(mod.currentIndex, 0), Math.max(questions.length - 1, 0)),
      secondsLeft: mod.secondsLeft,
      durationSeconds: mod.durationSeconds || MODULE_META[mod.key].seconds,
      status: mod.status === "completed" ? "completed" : "in_progress",
      rawScore: mod.rawScore,
    });
  }

  return {
    id: attempt.id,
    status:
      attempt.status === "completed"
        ? "completed"
        : attempt.status === "abandoned"
        ? "abandoned"
        : "in_progress",
    phase: resumeScreen(modules, isPhase(attempt.phase) ? attempt.phase : "intro"),
    startedAt: attempt.startedAt.toISOString(),
    completedAt: attempt.completedAt ? attempt.completedAt.toISOString() : null,
    rwRaw: attempt.rwRaw,
    rwMax: attempt.rwMax,
    mathRaw: attempt.mathRaw,
    mathMax: attempt.mathMax,
    rwScaled: attempt.rwScaled,
    mathScaled: attempt.mathScaled,
    totalScaled: attempt.totalScaled,
    modules,
  };
}

/**
 * Replaces the flat answer log for one module. Rewriting rather than appending
 * keeps a module that is submitted twice (a retried request, a double click)
 * from doubling every answer in the log.
 */
export async function writeModuleAnswerLog(
  userId: string,
  attemptId: string,
  key: ModuleKey,
  questions: ClientQuestion[],
  answers: (string | null)[],
  times: (number | null)[]
): Promise<void> {
  await prisma.$transaction([
    prisma.userQuestionAnswer.deleteMany({ where: { attemptId, moduleKey: key } }),
    prisma.userQuestionAnswer.createMany({
      data: questions.map((q, i) => ({
        userId,
        questionId: q.id,
        source: "full_test",
        attemptId,
        moduleKey: key,
        orderIndex: i,
        selectedAnswer: answers[i] ?? null,
        isCorrect: isCorrect(q, answers[i] ?? null),
        timeSpent: times[i] ?? null,
      })),
    }),
  ]);
}

export interface AttemptScores {
  rwRaw: number;
  rwMax: number;
  mathRaw: number;
  mathMax: number;
  rwScaled: number;
  mathScaled: number;
  totalScaled: number;
}

/**
 * Scores an attempt from what is stored, never from numbers the page sends.
 * A module that was never reached counts as zero out of zero rather than being
 * skipped, so an abandoned attempt still produces a coherent score.
 */
export function scoreAttempt(payload: AttemptPayload): AttemptScores {
  let rwRaw = 0;
  let rwMax = 0;
  let mathRaw = 0;
  let mathMax = 0;

  for (const mod of payload.modules) {
    const correct = countCorrect(mod.questions, mod.answers);
    if (MODULE_META[mod.key].section === "rw") {
      rwRaw += correct;
      rwMax += mod.questions.length;
    } else {
      mathRaw += correct;
      mathMax += mod.questions.length;
    }
  }

  const rwScaled = estimateSectionScore(rwRaw, rwMax, "reading_writing");
  const mathScaled = estimateSectionScore(mathRaw, mathMax, "math");

  return {
    rwRaw,
    rwMax,
    mathRaw,
    mathMax,
    rwScaled,
    mathScaled,
    totalScaled: rwScaled + mathScaled,
  };
}

export { asStringArray, asAnswerArray, asTimeArray };
export type { Phase };
