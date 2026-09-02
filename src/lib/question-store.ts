import { prisma } from "@/lib/prisma";

/**
 * The Question table is a bank shared by every student rather than a per-attempt
 * snapshot. A Collegeboard item is immutable and the local practice bank is
 * static, so the same question is written once and every attempt that uses it
 * stores nothing but the letter the student picked. Snapshotting the HTML per
 * attempt instead would cost 1-3 MB for a single full test.
 */

export type QuestionSource = "collegeboard" | "practice_bank" | "lesson";

export interface BankQuestionInput {
  /** Identity in the question's own source. "bank:pq1" for the local bank. */
  externalId: string;
  source: QuestionSource;
  section?: string | null;
  topic: string;
  difficulty: string;
  skillDesc?: string | null;
  stimulus?: string | null;
  questionText: string;
  /** "multiple_choice" | "grid_in" */
  questionType: string;
  /** Every accepted answer. Grid-ins have several forms of the same value. */
  correctAnswers: string[];
  explanation?: string | null;
  options: { key: string; text: string }[];
}

/** The shape the review and test screens render. Mirrors the full-test API. */
export interface ClientQuestion {
  id: string;
  externalId: string;
  difficulty: string;
  skill_desc: string;
  domain: "rw" | "math";
  type: string;
  stem: string;
  stimulus?: string;
  answerOptions?: { key: string; text: string }[];
  correctAnswer: string[];
  rationale?: string;
}

/**
 * Correct answers are stored as a JSON array because a grid-in legitimately has
 * more than one accepted form ("2/7" and ".2857" are the same answer) and a
 * single column cannot hold both. Bare strings are accepted on read so that a
 * row written by anything that predates this encoding still parses.
 */
export function parseCorrectAnswers(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v)).filter((v) => v.length > 0);
      }
    } catch {
      // Fall through and treat it as a literal answer.
    }
  }
  return trimmed ? [trimmed] : [];
}

export function serialiseCorrectAnswers(answers: string[]): string {
  return JSON.stringify(answers.filter((a) => a.trim().length > 0));
}

/** Postgres rejects a NUL byte in text, and Collegeboard HTML occasionally has one. */
function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\u0000/g, "");
}

type QuestionRow = {
  id: string;
  externalId: string | null;
  difficulty: string;
  skillDesc: string | null;
  section: string | null;
  questionType: string;
  questionText: string;
  stimulus: string | null;
  correctAnswer: string;
  explanation: string | null;
  answers: { optionKey: string; text: string; order: number }[];
};

export function rowToClientQuestion(row: QuestionRow): ClientQuestion {
  const options = [...row.answers]
    .sort((a, b) => a.order - b.order)
    .map((a) => ({ key: a.optionKey, text: a.text }));

  return {
    id: row.id,
    externalId: row.externalId ?? row.id,
    difficulty: row.difficulty,
    skill_desc: row.skillDesc ?? "",
    domain: row.section === "math" ? "math" : "rw",
    // The bank stores the portable name; the test UI branches on Collegeboard's.
    type: row.questionType === "grid_in" ? "spr" : "mcq",
    stem: row.questionText,
    stimulus: row.stimulus ?? undefined,
    answerOptions: options.length > 0 ? options : undefined,
    correctAnswer: parseCorrectAnswers(row.correctAnswer),
    rationale: row.explanation ?? undefined,
  };
}

export const QUESTION_SELECT = {
  id: true,
  externalId: true,
  difficulty: true,
  skillDesc: true,
  section: true,
  questionType: true,
  questionText: true,
  stimulus: true,
  correctAnswer: true,
  explanation: true,
  answers: { select: { optionKey: true, text: true, order: true } },
} as const;

/**
 * Adds any question not already banked and returns externalId -> Question.id for
 * every input. Existing rows are left untouched: the content is immutable at the
 * source, so rewriting it on every sighting would be pure write traffic.
 */
export async function upsertQuestions(
  inputs: BankQuestionInput[]
): Promise<Map<string, string>> {
  const byExternalId = new Map<string, BankQuestionInput>();
  for (const input of inputs) {
    if (input.externalId) byExternalId.set(input.externalId, input);
  }
  const ids = Array.from(byExternalId.keys());
  if (ids.length === 0) return new Map();

  const existing = await prisma.question.findMany({
    where: { externalId: { in: ids } },
    select: { id: true, externalId: true },
  });

  const map = new Map<string, string>();
  for (const row of existing) {
    if (row.externalId) map.set(row.externalId, row.id);
  }

  const missing = ids.filter((id) => !map.has(id));
  for (const externalId of missing) {
    const input = byExternalId.get(externalId)!;
    try {
      const created = await prisma.question.create({
        data: {
          externalId,
          source: input.source,
          section: input.section ?? null,
          topic: clean(input.topic) || "general",
          difficulty: input.difficulty || "M",
          skillDesc: clean(input.skillDesc) || null,
          stimulus: input.stimulus ? clean(input.stimulus) : null,
          questionText: clean(input.questionText),
          questionType: input.questionType,
          correctAnswer: serialiseCorrectAnswers(input.correctAnswers),
          explanation: input.explanation ? clean(input.explanation) : null,
          answers: {
            create: input.options.map((opt, i) => ({
              optionKey: opt.key,
              text: clean(opt.text),
              order: i,
            })),
          },
        },
        select: { id: true },
      });
      map.set(externalId, created.id);
    } catch (err) {
      // Two students can start a test on the same item at the same moment. The
      // unique index makes the loser's insert fail, and the row it wanted now
      // exists, so re-reading is the whole recovery.
      const existingRow = await prisma.question.findUnique({
        where: { externalId },
        select: { id: true },
      });
      if (existingRow) {
        map.set(externalId, existingRow.id);
      } else {
        console.error(`Could not bank question ${externalId}:`, err);
      }
    }
  }

  return map;
}
