/**
 * Pure-logic checks for the parts of the app where a quiet mistake is expensive:
 * how an answer is graded, how a stored attempt is read back, and how XP,
 * levels and study days are worked out.
 *
 * Everything here runs without a database or a network, so it is safe anywhere.
 * Run it with `npm run check`.
 *
 * Each of these guards a bug that was actually shipped at some point:
 *  - grid-in answers marked wrong because ".2857" and "2/7" were compared as text
 *  - a stored grid-in question rendering as multiple choice
 *  - re-deriving a stored study day, which walked the date backwards and reset
 *    every streak the day after it was earned
 */

import {
  parseCorrectAnswers,
  serialiseCorrectAnswers,
  rowToClientQuestion,
} from "../src/lib/question-store";
import { isCorrect, countCorrect, resumablePhase, MODULE_META } from "../src/lib/test-attempt";
import {
  XP,
  DAILY_GOAL_XP,
  FULL_TEST_XP,
  LESSON_AVG_XP,
  levelFromXP,
  xpForLevel,
  xpToReachLevel,
  storedStudyDay,
  studyDay,
  studyDayKey,
  studyDaysBetween,
} from "../src/lib/xp";

let fails = 0;
let checks = 0;

function eq(label: string, got: unknown, want: unknown) {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) {
    fails++;
    console.log(`FAIL ${label}\n  got  ${a}\n  want ${b}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

function section(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
}

// ── Grading ───────────────────────────────────────────────────────────────
section("grading");

eq("grid-in answers round trip", parseCorrectAnswers(serialiseCorrectAnswers([".2857", "2/7"])), [
  ".2857",
  "2/7",
]);
eq("a bare stored answer still parses", parseCorrectAnswers("B"), ["B"]);
eq("an empty answer yields nothing", parseCorrectAnswers(""), []);

const spr = { correctAnswer: [".2857", "2/7"] };
eq("grid-in typed as a fraction", isCorrect(spr, "2/7"), true);
eq("grid-in typed as a decimal", isCorrect(spr, "0.2857"), true);
eq("a genuinely wrong grid-in", isCorrect(spr, "0.5"), false);
eq("a skipped question is not correct", isCorrect(spr, null), false);

const mcq = { correctAnswer: ["B"] };
eq("multiple choice, right", isCorrect(mcq, "B"), true);
eq("multiple choice is case insensitive", isCorrect(mcq, "b"), true);
eq("multiple choice, wrong", isCorrect(mcq, "C"), false);
eq("skips do not shift the count", countCorrect([mcq, spr, mcq], ["B", null, "A"]), 1);

// ── Reading an attempt back ───────────────────────────────────────────────
section("stored questions");

const gridInRow = {
  id: "q1",
  externalId: "ext-1",
  difficulty: "H",
  skillDesc: "Linear equations in one variable",
  section: "math",
  questionType: "grid_in",
  questionText: "<p>Solve</p>",
  stimulus: null,
  correctAnswer: serialiseCorrectAnswers([".2857", "2/7"]),
  explanation: "<p>Because.</p>",
  answers: [] as { optionKey: string; text: string; order: number }[],
};
const gridIn = rowToClientQuestion(gridInRow);
eq("a grid-in comes back as a grid-in", gridIn.type, "spr");
eq("a grid-in has no options to render", gridIn.answerOptions, undefined);
eq("every accepted answer survives", gridIn.correctAnswer, [".2857", "2/7"]);
eq("math maps to the math section", gridIn.domain, "math");

const mcqRow = {
  ...gridInRow,
  questionType: "multiple_choice",
  section: "rw",
  correctAnswer: serialiseCorrectAnswers(["B"]),
  answers: [
    { optionKey: "B", text: "two", order: 1 },
    { optionKey: "A", text: "one", order: 0 },
  ],
};
const mcqQuestion = rowToClientQuestion(mcqRow);
eq("multiple choice comes back as multiple choice", mcqQuestion.type, "mcq");
eq("options keep their stored order", mcqQuestion.answerOptions?.map((o) => o.key), ["A", "B"]);

// ── Resuming a test ───────────────────────────────────────────────────────
section("resume");

eq("a tab that died fetching R&W 2 lands on the break", resumablePhase("rw2_loading"), "rw1_done");
eq("same for math 2", resumablePhase("math2_loading"), "math1_done");
eq("a test that never started goes back to the intro", resumablePhase("loading"), "intro");
eq("a live module resumes into itself", resumablePhase("rw1"), "rw1");
eq(
  "modules are ordered as they are taken",
  (["rw1", "rw2", "math1", "math2"] as const).map((k) => MODULE_META[k].order),
  [0, 1, 2, 3]
);

// ── Levels ────────────────────────────────────────────────────────────────
section("levels");

let curveOk = true;
for (let level = 1; level <= 60; level++) {
  const floorXP = xpToReachLevel(level);
  if (levelFromXP(floorXP).level !== level) curveOk = false;
  if (level > 1 && levelFromXP(floorXP - 1).level !== level - 1) curveOk = false;
}
eq("the level curve is its own exact inverse, levels 1-60", curveOk, true);
eq("zero XP is level 1", levelFromXP(0).level, 1);
eq("negative XP cannot happen, but is safe", levelFromXP(-500).level, 1);
eq("the first level costs 40", xpForLevel(1), 40);
eq("each level costs 15 more than the last", xpForLevel(5) - xpForLevel(4), 15);
eq(
  "the bar and the level agree",
  (() => {
    const l = levelFromXP(377);
    return l.into + l.toNext === l.span;
  })(),
  true
);
// Finishing every lesson is 1988 XP. The old flat 50-per-level curve put that at
// level 40 and kept climbing past 100, which made the number meaningless.
eq("finishing every lesson lands mid-curve", levelFromXP(1988).level, 15);
eq("a long season of study is still climbing", levelFromXP(5000).level < 30, true);

// ── The economy ───────────────────────────────────────────────────────────
section("economy");

console.log(`  lesson (average)            ${String(LESSON_AVG_XP).padStart(4)} XP`);
console.log(`  lesson review               ${String(XP.lessonReview).padStart(4)} XP`);
const perfectSet = 25 * (XP.practiceAnswered + XP.practiceCorrectBonus) + XP.practicePerfect;
console.log(`  practice set, all correct   ${String(perfectSet).padStart(4)} XP`);
console.log(`  full test                   ${String(FULL_TEST_XP).padStart(4)} XP`);
console.log(`  full test, personal best    ${String(FULL_TEST_XP + XP.testPersonalBest).padStart(4)} XP`);
console.log(`  daily goal                  ${String(DAILY_GOAL_XP).padStart(4)} XP`);

eq("a full test is the largest single award", FULL_TEST_XP > perfectSet, true);
eq("a full test is worth about seven lessons", Math.round(FULL_TEST_XP / LESSON_AVG_XP), 7);
eq("a personal best is worth more than two lessons", XP.testPersonalBest > LESSON_AVG_XP * 2, true);
eq("one lesson nearly clears the daily goal", LESSON_AVG_XP / DAILY_GOAL_XP > 0.7, true);
eq("a review alone cannot clear the daily goal", XP.lessonReview < DAILY_GOAL_XP, true);
eq("wrong answers still pay something", XP.practiceAnswered > 0, true);
eq("being right pays more", XP.practiceCorrectBonus > 0, true);
eq("the perfect-set bonus needs a real set", XP.practicePerfectMinimum, 10);

// ── Study days ────────────────────────────────────────────────────────────
section("study days");

const midday = new Date("2026-09-01T16:00:00Z"); // Toronto midday
const evening = new Date("2026-09-02T01:30:00Z"); // 9:30pm Toronto, still Sept 1
const nextDay = new Date("2026-09-02T16:00:00Z");

eq("a study day is the local calendar date", studyDayKey(midday), "2026-09-01");
eq("an evening session counts for that evening's day", studyDayKey(evening), "2026-09-01");
eq("midday and evening are the same day", studyDay(midday).getTime(), studyDay(evening).getTime());
eq("consecutive days are one apart", studyDaysBetween(studyDay(midday), studyDay(nextDay)), 1);
eq("the same day is zero apart", studyDaysBetween(studyDay(midday), studyDay(evening)), 0);

// Reading a stored study day must not move it. Running it back through
// studyDay() reinterprets UTC midnight in a timezone behind UTC and returns the
// day before, so every read walked the date backwards and a streak reset the
// day after it was earned.
const stored = studyDay(evening);
eq("reading a stored study day leaves it alone", storedStudyDay(stored).getTime(), stored.getTime());
eq(
  "re-deriving it instead would have shifted it back a day",
  studyDaysBetween(studyDay(stored), stored),
  1
);

const beforeDst = new Date("2026-11-01T02:00:00Z"); // Oct 31 in Toronto
const afterDst = new Date("2026-11-02T17:00:00Z"); // Nov 2 in Toronto
eq("day gaps survive a clock change", studyDaysBetween(studyDay(beforeDst), studyDay(afterDst)), 2);

console.log(
  fails === 0 ? `\n${checks} checks, all passing` : `\n${fails} of ${checks} checks FAILED`
);
process.exit(fails === 0 ? 0 : 1);
