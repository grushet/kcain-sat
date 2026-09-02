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
 * A phase such as "rw2_loading" is a transient screen that cannot be resumed
 * into, because the questions it was fetching were never saved. Resuming lands
 * on the last screen that has state behind it.
 */
export function resumablePhase(phase: Phase): Phase {
  if (phase === "loading") return "intro";
  if (phase === "rw2_loading") return "rw1_done";
  if (phase === "math2_loading") return "math1_done";
  return phase;
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
