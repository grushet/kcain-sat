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
import { normaliseTasks, MAX_TEXT } from "../src/lib/planner-normalise";
import { safeCallbackUrl, DEFAULT_AFTER_LOGIN } from "../src/lib/login-redirect";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_DOMAIN } from "../src/lib/session-cookie";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

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

// ---- planner writes -------------------------------------------------------
// The planner posts from another origin, so this payload is fully client
// controlled. These check that nothing unvalidated reaches the database.

console.log("");
console.log("── planner writes ──────────────────────────────────────────────");

const okTask = { id: "a1", text: "Essay", completed: false };

eq("a plain task survives normalising", normaliseTasks([okTask]).length, 1);
eq("a task with no id is dropped", normaliseTasks([{ text: "no id" }, okTask]).map((t) => t.id), ["a1"]);
eq("a task with blank text is dropped", normaliseTasks([{ id: "b", text: "   " }, okTask]).map((t) => t.id), ["a1"]);
eq("an id with path characters is rejected", normaliseTasks([{ id: "../../etc/passwd", text: "x" }]).length, 0);
eq("a duplicate id is only written once", normaliseTasks([okTask, { id: "a1", text: "again" }]).length, 1);
eq("dropped rows leave no gap in the ordering", normaliseTasks([{ text: "dropped" }, okTask, { id: "a2", text: "second" }]).map((t) => t.sortOrder), [0, 1]);
eq("an invalid due date becomes null", normaliseTasks([{ ...okTask, dueDate: "not-a-date" }])[0].dueDate, null);
eq("a valid due date is kept as the day it names", normaliseTasks([{ ...okTask, dueDate: "2026-09-01" }])[0].dueDate, "2026-09-01");
eq("a timestamp is not accepted as a due date", normaliseTasks([{ ...okTask, dueDate: "2026-09-01T00:00:00Z" }])[0].dueDate, null);
eq("an unknown importance becomes null", normaliseTasks([{ ...okTask, importance: "critical" }])[0].importance, null);
eq("a known importance is kept", normaliseTasks([{ ...okTask, importance: "high" }])[0].importance, "high");
eq("a repeat with a bad unit is discarded whole", normaliseTasks([{ ...okTask, repeat: { n: 2, unit: "fortnights" } }]).map((t) => [t.repeatN, t.repeatUnit]), [[null, null]]);
eq("a zero repeat is discarded", normaliseTasks([{ ...okTask, repeat: { n: 0, unit: "days" } }])[0].repeatN, null);
eq("a good repeat is kept", normaliseTasks([{ ...okTask, repeat: { n: 2, unit: "weeks" } }]).map((t) => [t.repeatN, t.repeatUnit]), [[2, "weeks"]]);
eq("an invalid reminder becomes null", normaliseTasks([{ ...okTask, reminder: "9am tomorrow" }])[0].reminder, null);
eq("a wall-clock reminder is kept verbatim", normaliseTasks([{ ...okTask, reminder: "2026-09-01T09:00" }])[0].reminder, "2026-09-01T09:00");
eq("runaway text is truncated, not rejected", normaliseTasks([{ id: "a1", text: "x".repeat(5000) }])[0].text.length, MAX_TEXT);
eq("completed is coerced to a real boolean", normaliseTasks([{ ...okTask, completed: "yes" }])[0].completed, true);
eq("subtasks are normalised too", normaliseTasks([{ ...okTask, subtasks: [{ id: "s1", text: "part" }, { text: "no id" }] }])[0].subtasks.map((s) => s.id), ["s1"]);
eq("a non-array subtasks field does not throw", normaliseTasks([{ ...okTask, subtasks: "nope" }])[0].subtasks, []);
eq("a null entry in the list is skipped", normaliseTasks([null, okTask]).length, 1);

// ---- signing back in ------------------------------------------------------
// Both of these guard the outage where every signed-in student was bounced
// straight back to the login page and the planner could never save anything.
console.log("");
console.log("── login redirect ──────────────────────────────────────────────");

eq("no callbackUrl lands on the dashboard", safeCallbackUrl(null), DEFAULT_AFTER_LOGIN);
eq("a relative path is honoured", safeCallbackUrl("/history"), "/history");
eq("the planner is allowed back", safeCallbackUrl("https://tasks.cainsat.org/main_page.html"), "https://tasks.cainsat.org/main_page.html");
eq("another origin is refused", safeCallbackUrl("https://evil.example/steal"), DEFAULT_AFTER_LOGIN);
eq("a protocol-relative url is refused", safeCallbackUrl("//evil.example/steal"), DEFAULT_AFTER_LOGIN);
eq("a lookalike host is refused", safeCallbackUrl("https://tasks.cainsat.org.evil.example/"), DEFAULT_AFTER_LOGIN);
eq("junk is refused", safeCallbackUrl("javascript:alert(1)"), DEFAULT_AFTER_LOGIN);

// The middleware runs `getToken` itself and cannot import authOptions, so the
// cookie name is shared through a constant. If that link is ever broken again,
// the middleware silently reads NextAuth's default name, finds nothing, and
// every gated page redirects to /auth/login forever.
const middlewareSrc = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");
eq(
  "the middleware is told the session cookie name",
  middlewareSrc.includes("SESSION_COOKIE_NAME") && middlewareSrc.includes("sessionToken"),
  true
);
eq(
  "the cookie name and domain are set together",
  Boolean(SESSION_COOKIE_NAME) === Boolean(SESSION_COOKIE_DOMAIN),
  true
);

// ---- source hygiene -------------------------------------------------------
// A literal NUL byte sat inside what looked like a one-space string in the
// planner tasks route for its entire history. It is invisible in every editor,
// it survives the build as a \0 escape, and Postgres rejects any text parameter
// containing one (22021), so every task save 500'd and nothing was ever stored.
// Nothing else catches this, so it is checked here.
console.log("");
console.log("── source hygiene ──────────────────────────────────────────────");

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|prisma|css)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", "dist", "build"]);

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (SOURCE_EXT.test(entry.name)) found.push(full);
  }
  return found;
}

const scanned = sourceFiles(".");
const withNul = scanned.filter((f) => readFileSync(f).includes(0));
eq(`no NUL bytes in any of the ${scanned.length} source files`, withNul, []);

console.log(
  fails === 0 ? `\n${checks} checks, all passing` : `\n${fails} of ${checks} checks FAILED`
);
process.exit(fails === 0 ? 0 : 1);
