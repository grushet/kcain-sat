import { answersMatch } from "@/lib/scoring";
import type { ClientQuestion } from "@/lib/question-store";

/** The four modules of a digital SAT, in the order they are taken. */
export const MODULE_KEYS = ["rw1", "rw2", "math1", "math2"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && (MODULE_KEYS as readonly string[]).includes(value);
}

/** Official digital SAT module lengths, in seconds. */
export const MODULE_SECONDS = { rw: 32 * 60, math: 35 * 60 } as const;

/** Extended-time settings a student can choose for the full test. */
export const TIME_MULTIPLIERS = [1, 1.5, 2] as const;
export type TimeMultiplier = (typeof TIME_MULTIPLIERS)[number];

export function isTimeMultiplier(value: unknown): value is TimeMultiplier {
  return typeof value === "number" && (TIME_MULTIPLIERS as readonly number[]).includes(value);
}

export const MODULE_META: Record<
  ModuleKey,
  { label: string; shortLabel: string; section: "rw" | "math"; order: number; seconds: number }
> = {
  rw1: { label: "R&W Module 1", shortLabel: "R&W 1", section: "rw", order: 0, seconds: MODULE_SECONDS.rw },
  rw2: { label: "R&W Module 2", shortLabel: "R&W 2", section: "rw", order: 1, seconds: MODULE_SECONDS.rw },
  math1: { label: "Math Module 1", shortLabel: "Math 1", section: "math", order: 2, seconds: MODULE_SECONDS.math },
  math2: { label: "Math Module 2", shortLabel: "Math 2", section: "math", order: 3, seconds: MODULE_SECONDS.math },
};

/**
 * Every screen of the test. Persisted on the attempt so a resumed test lands on
 * the screen the student left rather than restarting the module.
 */
export const PHASES = [
  "intro",
  "loading",
  "rw1",
  "rw1_done",
  "rw2_loading",
  "rw2",
  "math_intro",
  "math1",
  "math1_done",
  "math2_loading",
  "math2",
  "results",
] as const;
export type Phase = (typeof PHASES)[number];

export function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && (PHASES as readonly string[]).includes(value);
}

/**
 * Derives the screen a resumed attempt should land on from the state of its
 * modules, not from the attempt's stored `phase`. The stored phase can lag
 * behind the module state (a "completed" module write can land before, or
 * without, the phase write that was meant to follow it), so trusting it
 * directly can send a student back into a module they already finished or
 * skip a module they never reached. `storedPhase` is consulted only where the
 * module state genuinely cannot decide.
 */
export function resumeScreen(modules: AttemptModulePayload[], storedPhase: Phase): Phase {
  const byKey = new Map(modules.map((m) => [m.key, m]));
  const rw1 = byKey.get("rw1");
  const rw2 = byKey.get("rw2");
  const math1 = byKey.get("math1");
  const math2 = byKey.get("math2");

  const hasQuestions = (m?: AttemptModulePayload): boolean => !!m && m.questions.length > 0;
  const isDone = (m?: AttemptModulePayload): boolean => !!m && m.status === "completed";
  const showsProgress = (m: AttemptModulePayload): boolean =>
    m.answers.some((a) => a !== null) ||
    m.currentIndex > 0 ||
    (m.secondsLeft !== null && m.secondsLeft < m.durationSeconds);

  if (!isDone(rw1)) {
    return hasQuestions(rw1) ? "rw1" : "intro";
  }

  if (!hasQuestions(rw2)) {
    return "rw1_done";
  }

  if (!isDone(rw2)) {
    return "rw2";
  }

  if (!isDone(math1)) {
    // math1 is registered (in_progress, with questions) the instant the test
    // starts, so its mere presence does not mean the student has reached it.
    if (!math1) return storedPhase === "math1" ? "math1" : "math_intro";
    return showsProgress(math1) ? "math1" : "math_intro";
  }

  if (!hasQuestions(math2)) {
    return "math1_done";
  }

  if (!isDone(math2)) {
    return "math2";
  }

  return "results";
}

export function isCorrect(q: { correctAnswer: string[] }, answer: string | null): boolean {
  if (!answer) return false;
  return q.correctAnswer.some((ca) => answersMatch(ca, answer));
}

export function countCorrect(
  questions: { correctAnswer: string[] }[],
  answers: (string | null)[]
): number {
  return questions.reduce((n, q, i) => (isCorrect(q, answers[i] ?? null) ? n + 1 : n), 0);
}

/**
 * A module that has already been handed in must stay handed in. A per-answer
 * autosave from before the "completed" write can arrive after it (the client
 * timeout is 8s), and without this guard it would silently replace the final
 * stored answers with the older, incomplete array. A repeated "completed"
 * write for the same module is still accepted, since it is idempotent.
 */
export function shouldAcceptModuleWrite(
  existingStatus: "in_progress" | "completed" | undefined,
  incomingStatus: "in_progress" | "completed"
): boolean {
  return existingStatus !== "completed" || incomingStatus === "completed";
}

/**
 * A module's clock is only ever standard or extended by the student's time
 * multiplier (1x, 1.5x, 2x), so a valid duration is never below the base
 * length and never more than double it. Anything outside that band, or not a
 * usable number, falls back to the base so a bad request cannot hand out an
 * unbounded clock.
 */
export function clampDurationSeconds(value: unknown, baseSeconds: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return baseSeconds;
  const rounded = Math.round(value);
  if (rounded < baseSeconds || rounded > baseSeconds * 2) return baseSeconds;
  return rounded;
}

// ── Wire shapes shared by the API routes and the pages ────────────────────

export interface AttemptModulePayload {
  key: ModuleKey;
  harder: boolean;
  questions: ClientQuestion[];
  answers: (string | null)[];
  times: (number | null)[];
  currentIndex: number;
  secondsLeft: number | null;
  durationSeconds: number;
  status: "in_progress" | "completed";
  rawScore: number | null;
}

export interface AttemptPayload {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  phase: Phase;
  startedAt: string;
  completedAt: string | null;
  rwRaw: number | null;
  rwMax: number | null;
  mathRaw: number | null;
  mathMax: number | null;
  rwScaled: number | null;
  mathScaled: number | null;
  totalScaled: number | null;
  modules: AttemptModulePayload[];
}
