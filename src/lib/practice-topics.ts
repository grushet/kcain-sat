/**
 * The practice topic slugs, shared by the page and the API so a session can
 * never be filed under a label the two disagree about.
 */

export const PRACTICE_TOPIC_LABELS: Record<string, string> = {
  "math-algebra": "Math – Algebra",
  "math-problem-solving": "Math – Problem Solving",
  "math-quadratics": "Math – Quadratics",
  "math-functions": "Math – Functions",
  "math-data": "Math – Data & Statistics",
  "math-geometry": "Math – Geometry",
  "math-inequalities": "Math – Inequalities",
  "math-exponentials": "Math – Exponentials",
  "math-trigonometry": "Math – Trigonometry",
  "math-word-problems": "Math – Word Problems",
  "math-advanced": "Math – Advanced",
  "reading-evidence": "Reading – Evidence",
  "reading-words": "Reading – Words in Context",
  "reading-main-idea": "Reading – Main Idea",
  "reading-tone": "Reading – Tone",
  "reading-rhetoric": "Reading – Rhetoric",
  "reading-comprehension": "Reading – Comprehension",
  "writing-conventions": "Writing – Conventions",
  "writing-conventions-advanced": "Writing – Conventions Advanced",
  "writing-transitions": "Writing – Transitions",
};

/** Slug in the URL to the topic key the question bank stores. */
export const PRACTICE_TOPIC_MAP: Record<string, string> = {
  "math-algebra": "algebra",
  "math-problem-solving": "math",
  "math-quadratics": "quadratics",
  "math-functions": "functions",
  "math-data": "data",
  "math-geometry": "geometry",
  "math-inequalities": "inequalities",
  "math-exponentials": "exponentials",
  "math-trigonometry": "trigonometry",
  "math-word-problems": "word-problems",
  "math-advanced": "advanced-math",
  "reading-evidence": "evidence",
  "reading-words": "words",
  "reading-main-idea": "main-idea",
  "reading-tone": "tone",
  "reading-rhetoric": "rhetoric",
  "reading-comprehension": "reading",
  "writing-conventions": "grammar",
  "writing-conventions-advanced": "conventions-advanced",
  "writing-transitions": "transitions",
};

export const MATH_TOPIC_SLUGS = new Set(
  Object.keys(PRACTICE_TOPIC_MAP).filter((k) => k.startsWith("math-"))
);

export const PRACTICE_DIFFICULTIES = ["all", "easy", "medium", "hard", "very_hard"] as const;
export type PracticeDifficulty = (typeof PRACTICE_DIFFICULTIES)[number];

export function isPracticeTopicSlug(slug: unknown): slug is string {
  return (
    typeof slug === "string" &&
    Object.prototype.hasOwnProperty.call(PRACTICE_TOPIC_MAP, slug)
  );
}

export function isPracticeDifficulty(value: unknown): value is PracticeDifficulty {
  return (
    typeof value === "string" &&
    (PRACTICE_DIFFICULTIES as readonly string[]).includes(value)
  );
}

export function practiceTopicLabel(slug: string): string {
  return PRACTICE_TOPIC_LABELS[slug] ?? slug;
}

/** The section a practice topic belongs to, for grouping in the history view. */
export function practiceTopicSection(slug: string): "math" | "rw" {
  return MATH_TOPIC_SLUGS.has(slug) ? "math" : "rw";
}
