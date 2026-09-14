"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Zap,
  AlertCircle,
  BookOpen,
  Calculator,
  ArrowRight,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trophy,
  RefreshCw,
  History,
  CloudOff,
  Play,
  Bookmark,
  Eye,
  EyeOff,
  Undo2,
} from "lucide-react";
import { estimateSectionScore, estimateSectionRange } from "@/lib/scoring";
import { Calculator as DesmosCalculator } from "@/components/Calculator";
import { ReferenceSheet } from "@/components/ReferenceSheet";
import { Skeleton } from "@/components/Skeleton";
import {
  QuestionMenuModal,
  type QuestionStatus,
} from "@/components/full-test/QuestionMenu";
import { ModuleReview } from "@/components/full-test/ModuleReview";
import type { ClientQuestion } from "@/lib/question-store";
import {
  MODULE_META,
  TIME_MULTIPLIERS,
  countCorrect,
  resumeScreen,
  isTimeMultiplier,
  type AttemptPayload,
  type ModuleKey,
  type Phase,
  type TimeMultiplier,
} from "@/lib/test-attempt";
import {
  QuestionReview,
  DiffBadge,
  type ReviewGroup,
} from "@/components/review/QuestionReview";

/** Bluebook's Answer Eliminator icon: "ABC" struck through. No lucide icon for this. */
function EliminatorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        ABC
      </text>
      <line x1="2" y1="12.5" x2="22" y2="12.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

// ─── Types

interface CompletedModule {
  questions: ClientQuestion[];
  answers: (string | null)[];
}

/** Everything about the module in progress, mirrored into a ref for autosaving. */
interface LiveModule {
  key: ModuleKey | null;
  questions: ClientQuestion[];
  answers: (string | null)[];
  times: (number | null)[];
  marked: boolean[];
  crossedOut: string[][];
  currentIdx: number;
  secondsLeft: number | null;
  harder: boolean;
}

// ─── Helpers

const PHASE_TO_MODULE: Partial<Record<Phase, ModuleKey>> = {
  rw1: "rw1",
  rw2: "rw2",
  math1: "math1",
  math2: "math2",
};

/** A module's clock, adjusted for the student's chosen extended-time setting. */
function moduleDurationSeconds(key: ModuleKey, multiplier: TimeMultiplier): number {
  return Math.round(MODULE_META[key].seconds * multiplier);
}

function calcScore(mod: CompletedModule): number {
  return countCorrect(mod.questions, mod.answers);
}

function formatClock(total: number): string {
  const safe = Math.max(0, total);
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

async function fetchModuleQuestions(
  section: "rw" | "math",
  module: "1" | "2",
  harder?: boolean,
  excludeIds?: string[]
): Promise<ClientQuestion[]> {
  const p = new URLSearchParams({ section, module });
  if (module === "2") p.set("harder", harder ? "true" : "false");
  if (excludeIds?.length) p.set("excludeIds", JSON.stringify(excludeIds));
  const r = await fetch(`/api/full-test?${p}`);
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.questions?.length) {
    throw new Error(
      d?.error ?? "No questions came back. Collegeboard may be temporarily unavailable."
    );
  }
  return d.questions as ClientQuestion[];
}

/**
 * Writes one module's state to the server. A save that fails is reported but
 * never thrown: losing the ability to resume is bad, losing the running test
 * because the network blipped would be worse. The timeout is there so a dead
 * connection cannot freeze a student between modules.
 */
async function saveModuleState(
  attemptId: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; xpEarned: number }> {
  try {
    const r = await fetch(`/api/full-test/attempt/${attemptId}/module`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, xpEarned: 0 };
    const d = await r.json().catch(() => null);
    return { ok: true, xpEarned: typeof d?.xpEarned === "number" ? d.xpEarned : 0 };
  } catch {
    return { ok: false, xpEarned: 0 };
  }
}

async function savePhase(attemptId: string, phase: Phase): Promise<void> {
  try {
    await fetch(`/api/full-test/attempt/${attemptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // The module state is what matters; the phase is a convenience.
  }
}

/** How a paused attempt is described on the resume card. */
function describeResume(attempt: AttemptPayload): string {
  const active = attempt.modules.find((m) => m.status === "in_progress" && m.questions.length > 0);
  if (active && PHASE_TO_MODULE[attempt.phase] === active.key) {
    const answered = active.answers.filter((a) => a !== null).length;
    const left = active.secondsLeft !== null ? ` · ${formatClock(active.secondsLeft)} left` : "";
    return `${MODULE_META[active.key].label} · ${answered}/${active.questions.length} answered${left}`;
  }
  const doneCount = attempt.modules.filter((m) => m.status === "completed").length;
  return `${doneCount} of 4 modules finished`;
}

/**
 * Mirrors the headline numbers into localStorage. The calendar reads the
 * database now, so this is only a safety net: if the save failed, the student
 * still sees their most recent score somewhere.
 */
function cacheLastTestLocally(
  rw1: CompletedModule,
  rw2: CompletedModule,
  math1: CompletedModule,
  math2: CompletedModule
): void {
  const rwRaw = countCorrect(rw1.questions, rw1.answers) + countCorrect(rw2.questions, rw2.answers);
  const mathRaw =
    countCorrect(math1.questions, math1.answers) + countCorrect(math2.questions, math2.answers);
  const rwMax = rw1.questions.length + rw2.questions.length;
  const mathMax = math1.questions.length + math2.questions.length;
  const readingScaled = estimateSectionScore(rwRaw, rwMax, "reading_writing");
  const mathScaled = estimateSectionScore(mathRaw, mathMax, "math");
  try {
    window.localStorage.setItem(
      "cain:lastFullTest",
      JSON.stringify({
        readingRaw: rwRaw,
        mathRaw,
        readingScaled,
        mathScaled,
        totalScaled: readingScaled + mathScaled,
        computedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Private browsing and full quotas both land here; neither is worth surfacing.
  }
}

interface XpAward {
  source: string;
  label: string;
  amount: number;
}

interface XpResult {
  total: number;
  streak: { current: number; longest: number; extended: boolean };
  isPersonalBest: boolean;
  previousBest: number | null;
  awards: XpAward[];
}

const SAVE_WARNING =
  "Your progress is not saving right now. Check your connection; the test will keep running.";

// ─── Main Page

export default function FullTestPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // The sitting this page is writing to. Kept in a ref as well because the
  // autosave timer and the finish handlers read it outside of a render.
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const attemptIdRef = useRef<string | null>(null);

  const [resumable, setResumable] = useState<AttemptPayload | null>(null);
  const [checkingResume, setCheckingResume] = useState(true);

  // Extended time, read from and written to the student's account settings.
  const [timeMultiplier, setTimeMultiplier] = useState<TimeMultiplier>(1);
  const [timeMultiplierLoaded, setTimeMultiplierLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && isTimeMultiplier(d?.timeMultiplier)) setTimeMultiplier(d.timeMultiplier);
      })
      .catch(() => {
        // Standard time is the safe default if this fails to load.
      })
      .finally(() => {
        if (!cancelled) setTimeMultiplierLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTimeMultiplierChange(value: TimeMultiplier) {
    setTimeMultiplier(value);
    try {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeMultiplier: value }),
      });
    } catch {
      // The chosen value still applies to this sitting even if the save failed.
    }
  }
  const [completedAttempt, setCompletedAttempt] = useState<AttemptPayload | null>(null);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  /** XP paid for the module just handed in, shown on the break screen. */
  const [moduleXp, setModuleXp] = useState(0);

  // Pre-fetched module questions
  const [math1Qs, setMath1Qs] = useState<ClientQuestion[]>([]);

  // Active module state
  const [activeQs, setActiveQs] = useState<ClientQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [times, setTimes] = useState<(number | null)[]>([]);
  const [marked, setMarked] = useState<boolean[]>([]);
  const [crossedOut, setCrossedOut] = useState<string[][]>([]);
  const [activeHarder, setActiveHarder] = useState(false);

  // A grid-in's typing is held here rather than written into `answers` on
  // every keystroke, which would fire a save per keystroke. It syncs from
  // `answers` on arrival and flushes back into `answers` (and the server) on
  // every way of leaving the question: Back, Next, a menu jump, time-up, or
  // opening the review screen. Unused for MCQ, where clicking a choice is
  // itself the commit, exactly like the real test.
  const [sprDraft, setSprDraft] = useState("");

  // Testing-tool UI state. None of this is scored, so unlike answers/marks it
  // is never persisted -- a resumed test simply starts with the defaults.
  const [eliminatorOn, setEliminatorOn] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /** On the end-of-module review screen rather than looking at a question. */
  const [reviewing, setReviewing] = useState(false);
  const [submittingModule, setSubmittingModule] = useState(false);
  /** Which way the question-card slide animation should run. */
  const [navDir, setNavDir] = useState<1 | -1>(1);

  // Completed modules
  const [rw1Done, setRw1Done] = useState<CompletedModule | null>(null);
  const [rw2Done, setRw2Done] = useState<CompletedModule | null>(null);
  const [math1Done, setMath1Done] = useState<CompletedModule | null>(null);
  const [math2Done, setMath2Done] = useState<CompletedModule | null>(null);

  const inModule =
    phase === "rw1" || phase === "rw2" || phase === "math1" || phase === "math2";

  const currentQ = activeQs[currentIdx] ?? null;
  const isMCQ = currentQ ? currentQ.type !== "spr" : true;

  // ── Autosave plumbing

  const liveRef = useRef<LiveModule>({
    key: null,
    questions: [],
    answers: [],
    times: [],
    marked: [],
    crossedOut: [],
    currentIdx: 0,
    secondsLeft: null,
    harder: false,
  });

  useEffect(() => {
    liveRef.current = {
      key: PHASE_TO_MODULE[phase] ?? null,
      questions: activeQs,
      answers,
      times,
      marked,
      crossedOut,
      currentIdx,
      secondsLeft,
      harder: activeHarder,
    };
  });

  /**
   * Raised while a module is being handed in. The heartbeat still counts as
   * "in this module" during that await, and a beat landing after the final save
   * would write the pre-submission answers back over it, throwing away the last
   * answer of every module all over again.
   */
  const finishing = useRef(false);

  /** Seconds the student has been looking at the question now on screen. */
  const questionEnteredAt = useRef<number>(Date.now());
  useEffect(() => {
    questionEnteredAt.current = Date.now();
  }, [currentIdx, phase]);

  // Free navigation means a grid-in's draft can be re-visited, so it has to be
  // reloaded from the stored answer every time the student arrives back on it.
  useEffect(() => {
    if (currentQ && currentQ.type === "spr") {
      setSprDraft(answers[currentIdx] ?? "");
    }
    // Only the arrival at a (possibly different) question should resync the
    // draft; `answers`/`currentQ` changing as a result of typing must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, phase]);

  function timesWithCurrent(base: (number | null)[], index: number): (number | null)[] {
    const spent = Math.max(0, Math.round((Date.now() - questionEnteredAt.current) / 1000));
    const out = [...base];
    out[index] = (out[index] ?? 0) + spent;
    return out;
  }

  /**
   * Flushes whatever the student was doing on the question now on screen --
   * a grid-in's in-progress typing, and the time spent -- before that screen
   * changes underneath them. Every way of leaving a question (Back, Next, a
   * menu jump, opening the review screen, time running out) goes through
   * this first, the same role `handleConfirmAnswer` used to play alone.
   */
  function commitCurrentQuestion(): {
    answers: (string | null)[];
    times: (number | null)[];
  } {
    let nextAnswers = answers;
    if (currentQ && currentQ.type === "spr" && sprDraft !== (answers[currentIdx] ?? "")) {
      nextAnswers = [...answers];
      nextAnswers[currentIdx] = sprDraft.trim() ? sprDraft : null;
      setAnswers(nextAnswers);
    }
    const nextTimes = timesWithCurrent(times, currentIdx);
    setTimes(nextTimes);
    questionEnteredAt.current = Date.now();
    return { answers: nextAnswers, times: nextTimes };
  }

  const persistModule = useCallback(
    async (
      over: Partial<LiveModule> & { status?: "in_progress" | "completed"; phase?: Phase } = {}
    ) => {
      const id = attemptIdRef.current;
      const live = { ...liveRef.current, ...over };
      if (!id || !live.key || live.questions.length === 0) return false;

      const { ok, xpEarned } = await saveModuleState(id, {
        key: live.key,
        harder: live.harder,
        questionIds: live.questions.map((q) => q.id),
        answers: live.answers,
        times: live.times,
        marked: live.marked,
        crossedOut: live.crossedOut,
        currentIndex: live.currentIdx,
        secondsLeft: live.secondsLeft,
        durationSeconds: moduleDurationSeconds(live.key, timeMultiplier),
        status: over.status ?? "in_progress",
        ...(over.phase ? { phase: over.phase } : {}),
      });
      setSaveWarning(ok ? null : SAVE_WARNING);
      if (xpEarned > 0) setModuleXp(xpEarned);
      return ok;
    },
    [timeMultiplier]
  );

  // A heartbeat so the clock and any half-finished question survive a crash even
  // if the student sits on one question for a long stretch without answering.
  useEffect(() => {
    if (!inModule || !attemptId) return;
    const t = setInterval(() => {
      if (finishing.current) return;
      void persistModule();
    }, 15000);
    return () => clearInterval(t);
  }, [inModule, attemptId, persistModule]);

  // ── Resume

  /** Rebuilds the page from a stored attempt. */
  const applyAttempt = useCallback((a: AttemptPayload) => {
    setAttemptId(a.id);
    attemptIdRef.current = a.id;

    const byKey = new Map(a.modules.map((m) => [m.key, m]));
    const completed = (k: ModuleKey): CompletedModule | null => {
      const m = byKey.get(k);
      return m && m.status === "completed"
        ? { questions: m.questions, answers: m.answers }
        : null;
    };

    setRw1Done(completed("rw1"));
    setRw2Done(completed("rw2"));
    setMath1Done(completed("math1"));
    setMath2Done(completed("math2"));

    // Math module 1 is fetched at the very start of the test, so it is already
    // stored by the time a student reaches the break before it.
    const math1 = byKey.get("math1");
    setMath1Qs(math1?.questions ?? []);

    // The stored phase can lag the module state (see resumeScreen), so the
    // screen to resume into is derived from the modules themselves rather
    // than trusted directly off the attempt.
    const derivedPhase = resumeScreen(a.modules, a.phase);
    const key = PHASE_TO_MODULE[derivedPhase];
    const live = key ? byKey.get(key) : undefined;
    if (key && live && live.status === "in_progress" && live.questions.length > 0) {
      setActiveQs(live.questions);
      setAnswers(live.answers);
      setTimes(live.times);
      setMarked(live.marked);
      setCrossedOut(live.crossedOut);
      setCurrentIdx(live.currentIndex);
      setSecondsLeft(live.secondsLeft ?? live.durationSeconds);
      setActiveHarder(live.harder);
      setReviewing(false);
      setMenuOpen(false);
      setEliminatorOn(false);
      setHideTimer(false);
      setSubmittingModule(false);
      setPhase(derivedPhase);
      return;
    }

    // The stored phase points at a module with nothing behind it, which happens
    // if the tab died while module 2 was still being fetched. Drop back to the
    // last screen that does have state.
    if (key) {
      setPhase(key === "rw2" ? "rw1_done" : key === "math2" ? "math1_done" : "math_intro");
      return;
    }
    setPhase(derivedPhase);
  }, []);

  // Ask once on load whether there is a test to pick back up.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/full-test/attempt")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const attempt = d?.attempt as AttemptPayload | null | undefined;
        const hasWork =
          attempt && attempt.modules.some((m) => m.questions.length > 0);
        setResumable(hasWork ? attempt : null);
      })
      .catch(() => {
        // No resume offer is the right failure mode: it only costs a fresh start.
      })
      .finally(() => {
        if (!cancelled) setCheckingResume(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleResume() {
    if (!resumable) return;
    setLoadError(null);
    applyAttempt(resumable);
    setResumable(null);
  }

  async function handleDiscardResume() {
    const id = resumable?.id;
    setResumable(null);
    if (!id) return;
    try {
      await fetch(`/api/full-test/attempt/${id}`, { method: "DELETE" });
    } catch {
      // Starting a new test retires the old one server-side anyway.
    }
  }

  // ── Module helpers

  function startModule(qs: ClientQuestion[], seconds: number, harder: boolean) {
    finishing.current = false;
    setModuleXp(0);
    setActiveQs(qs);
    setCurrentIdx(0);
    setAnswers(new Array(qs.length).fill(null));
    setTimes(new Array(qs.length).fill(null));
    setMarked(new Array(qs.length).fill(false));
    setCrossedOut(qs.map(() => []));
    setSprDraft("");
    setSecondsLeft(seconds);
    setActiveHarder(harder);
    setReviewing(false);
    setMenuOpen(false);
    setEliminatorOn(false);
    setHideTimer(false);
    setSubmittingModule(false);
    setNavDir(1);
    questionEnteredAt.current = Date.now();
  }

  // ── Phase transitions

  async function handleStartTest() {
    setPhase("loading");
    setLoadError(null);
    setSaveWarning(null);
    setCompletedAttempt(null);
    setResumable(null);

    // The attempt row is created before a single question is fetched. An attempt
    // that only appears once the student finishes is exactly what used to make a
    // two-hour sitting disappear on refresh.
    let id: string | null = null;
    try {
      const r = await fetch("/api/full-test/attempt", { method: "POST" });
      const d = await r.json().catch(() => null);
      id = typeof d?.attempt?.id === "string" ? d.attempt.id : null;
    } catch {
      id = null;
    }
    setAttemptId(id);
    attemptIdRef.current = id;
    if (!id) setSaveWarning(SAVE_WARNING);

    try {
      const [rw1, math1] = await Promise.all([
        fetchModuleQuestions("rw", "1"),
        fetchModuleQuestions("math", "1"),
      ]);
      setMath1Qs(math1);

      if (id) {
        // Both first modules are registered up front, so a crash during the
        // reading section still leaves the math questions waiting on resume.
        const registered = await Promise.all([
          saveModuleState(id, {
            key: "rw1",
            harder: false,
            questionIds: rw1.map((q) => q.id),
            answers: new Array(rw1.length).fill(null),
            times: new Array(rw1.length).fill(null),
            currentIndex: 0,
            secondsLeft: moduleDurationSeconds("rw1", timeMultiplier),
            durationSeconds: moduleDurationSeconds("rw1", timeMultiplier),
            status: "in_progress",
          }),
          saveModuleState(id, {
            key: "math1",
            harder: false,
            questionIds: math1.map((q) => q.id),
            answers: new Array(math1.length).fill(null),
            times: new Array(math1.length).fill(null),
            currentIndex: 0,
            secondsLeft: moduleDurationSeconds("math1", timeMultiplier),
            durationSeconds: moduleDurationSeconds("math1", timeMultiplier),
            status: "in_progress",
          }),
        ]);
        if (registered.some((r) => !r.ok)) setSaveWarning(SAVE_WARNING);
        void savePhase(id, "rw1");
      }

      startModule(rw1, moduleDurationSeconds("rw1", timeMultiplier), false);
      setPhase("rw1");
    } catch (e) {
      setLoadError((e as Error).message);
      setPhase("intro");
    }
  }

  /**
   * Selecting an MCQ choice, or leaving a grid-in field, writes straight into
   * `answers` -- there is no separate "confirm" step, matching the real test
   * where picking a choice simply is the answer. `updated` is built from the
   * given `base` rather than the `answers` state directly so a cross-out that
   * needs to clear the same answer in the same tick can chain off it.
   */
  function setAnswerAt(
    index: number,
    value: string | null,
    base: (string | null)[] = answers
  ): (string | null)[] {
    const updated = [...base];
    updated[index] = value;
    setAnswers(updated);
    void persistModule({ answers: updated });
    return updated;
  }

  function toggleMark(index: number) {
    const updated = [...marked];
    updated[index] = !updated[index];
    setMarked(updated);
    void persistModule({ marked: updated });
  }

  /**
   * The real test does not let a struck-out choice sit there selected, so
   * crossing out the student's current answer clears it in the same write.
   */
  function toggleCrossOut(index: number, key: string) {
    const current = crossedOut[index] ?? [];
    const isCrossed = current.includes(key);
    const updated = [...crossedOut];
    updated[index] = isCrossed ? current.filter((k) => k !== key) : [...current, key];
    setCrossedOut(updated);

    if (!isCrossed && answers[index] === key) {
      const updatedAnswers = setAnswerAt(index, null);
      void persistModule({ crossedOut: updated, answers: updatedAnswers });
    } else {
      void persistModule({ crossedOut: updated });
    }
  }

  /** Moves to any question within the current module, in either direction. */
  function goToIndex(newIndex: number) {
    if (newIndex < 0 || newIndex >= activeQs.length) return;
    setNavDir(newIndex > currentIdx ? 1 : -1);
    const { answers: a, times: t } = commitCurrentQuestion();
    setReviewing(false);
    setCurrentIdx(newIndex);
    void persistModule({ answers: a, times: t, currentIdx: newIndex });
  }

  function handleBack() {
    goToIndex(currentIdx - 1);
  }

  /** "Next" on the last question opens the review screen rather than submitting. */
  function handleNext() {
    if (currentIdx < activeQs.length - 1) {
      goToIndex(currentIdx + 1);
    } else {
      openReview();
    }
  }

  function openReview() {
    const { answers: a, times: t } = commitCurrentQuestion();
    setReviewing(true);
    setMenuOpen(false);
    void persistModule({ answers: a, times: t });
  }

  function handleBackToQuestions() {
    setReviewing(false);
    questionEnteredAt.current = Date.now();
  }

  /** Jumping from the Question Menu behaves differently mid-module vs. on the review screen. */
  function handleMenuJump(index: number) {
    if (reviewing) {
      setNavDir(index > currentIdx ? 1 : -1);
      const { times: t } = commitCurrentQuestion();
      setReviewing(false);
      setCurrentIdx(index);
      void persistModule({ times: t, currentIdx: index });
    } else {
      goToIndex(index);
    }
  }

  async function handleSubmitModule() {
    if (submittingModule) return;
    setSubmittingModule(true);
    const { answers: a, times: t } = commitCurrentQuestion();
    await finishModule(a, t);
  }

  /** Ends the active module using the given answers and advances the phase. */
  async function finishModule(
    finalAnswers: (string | null)[],
    finalTimes: (number | null)[]
  ) {
    const done: CompletedModule = { questions: activeQs, answers: finalAnswers };
    const endingPhase = phase;
    const nextPhase: Phase | undefined =
      endingPhase === "rw1"
        ? "rw1_done"
        : endingPhase === "rw2"
        ? "rw2_done"
        : endingPhase === "math1"
        ? "math1_done"
        : undefined;
    setSecondsLeft(null);
    finishing.current = true;

    // Waiting on this one save is deliberate: a module is only really finished
    // once it is stored, and everything after this point depends on that. The
    // next phase rides along in the same request (rather than a separate,
    // unawaited PATCH) so the stored phase cannot lag the "completed" write.
    await persistModule({
      answers: finalAnswers,
      times: finalTimes,
      secondsLeft: 0,
      status: "completed",
      phase: nextPhase,
    });

    if (endingPhase === "rw1") {
      setRw1Done(done);
      setPhase("rw1_done");
    } else if (endingPhase === "rw2") {
      setRw2Done(done);
      setPhase("rw2_done");
    } else if (endingPhase === "math1") {
      setMath1Done(done);
      setPhase("math1_done");
    } else if (endingPhase === "math2") {
      await finishMath2(done);
    }
  }

  /** Called when a module timer runs out; keeps any answer already selected. */
  function handleTimeUp() {
    if (finishing.current) return;
    const { answers: a, times: t } = commitCurrentQuestion();
    void finishModule(a, t);
  }

  async function handleContinueToRw2() {
    if (!rw1Done) return;
    setPhase("rw2_loading");
    setLoadError(null);
    const score = calcScore(rw1Done);
    const harder = score / (rw1Done.questions.length || 27) >= 0.7;
    const excludeIds = rw1Done.questions.map((q) => q.externalId);
    try {
      const rw2 = await fetchModuleQuestions("rw", "2", harder, excludeIds);
      const id = attemptIdRef.current;
      if (id) {
        const { ok } = await saveModuleState(id, {
          key: "rw2",
          harder,
          questionIds: rw2.map((q) => q.id),
          answers: new Array(rw2.length).fill(null),
          times: new Array(rw2.length).fill(null),
          currentIndex: 0,
          secondsLeft: moduleDurationSeconds("rw2", timeMultiplier),
          durationSeconds: moduleDurationSeconds("rw2", timeMultiplier),
          status: "in_progress",
        });
        if (!ok) setSaveWarning(SAVE_WARNING);
        void savePhase(id, "rw2");
      }
      startModule(rw2, moduleDurationSeconds("rw2", timeMultiplier), harder);
      setPhase("rw2");
    } catch (e) {
      setLoadError((e as Error).message);
      setPhase("rw1_done");
    }
  }

  function handleContinueToMathIntro() {
    setPhase("math_intro");
    const id = attemptIdRef.current;
    if (id) void savePhase(id, "math_intro");
  }

  function handleStartMath1() {
    startModule(math1Qs, moduleDurationSeconds("math1", timeMultiplier), false);
    setPhase("math1");
    const id = attemptIdRef.current;
    if (id) void savePhase(id, "math1");
  }

  async function handleContinueToMath2() {
    if (!math1Done) return;
    setPhase("math2_loading");
    setLoadError(null);
    const score = calcScore(math1Done);
    const harder = score / (math1Done.questions.length || 22) >= 0.7;
    const excludeIds = math1Done.questions.map((q) => q.externalId);
    try {
      const math2 = await fetchModuleQuestions("math", "2", harder, excludeIds);
      const id = attemptIdRef.current;
      if (id) {
        const { ok } = await saveModuleState(id, {
          key: "math2",
          harder,
          questionIds: math2.map((q) => q.id),
          answers: new Array(math2.length).fill(null),
          times: new Array(math2.length).fill(null),
          currentIndex: 0,
          secondsLeft: moduleDurationSeconds("math2", timeMultiplier),
          durationSeconds: moduleDurationSeconds("math2", timeMultiplier),
          status: "in_progress",
        });
        if (!ok) setSaveWarning(SAVE_WARNING);
        void savePhase(id, "math2");
      }
      startModule(math2, moduleDurationSeconds("math2", timeMultiplier), harder);
      setPhase("math2");
    } catch (e) {
      setLoadError((e as Error).message);
      setPhase("math1_done");
    }
  }

  async function finishMath2(done: CompletedModule) {
    setMath2Done(done);
    setPhase("math2_done");
    if (rw1Done && rw2Done && math1Done) {
      cacheLastTestLocally(rw1Done, rw2Done, math1Done, done);
    }

    const id = attemptIdRef.current;
    if (!id) {
      setSaveWarning(SAVE_WARNING);
      return;
    }

    try {
      const r = await fetch(`/api/full-test/attempt/${id}/complete`, { method: "POST" });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.attempt) {
        setCompletedAttempt(d.attempt as AttemptPayload);
        if (d.xp) setXpResult(d.xp as XpResult);
        setSaveWarning(null);
      } else {
        setSaveWarning(SAVE_WARNING);
      }
    } catch {
      setSaveWarning(SAVE_WARNING);
    }
  }

  function handleContinueToResults() {
    setPhase("results");
    const id = attemptIdRef.current;
    if (id) void savePhase(id, "results");
  }

  function resetTest() {
    setPhase("intro");
    setLoadError(null);
    setSaveWarning(null);
    setAttemptId(null);
    attemptIdRef.current = null;
    setCompletedAttempt(null);
    setXpResult(null);
    setModuleXp(0);
    setMath1Qs([]);
    setActiveQs([]);
    setAnswers([]);
    setTimes([]);
    setMarked([]);
    setCrossedOut([]);
    setSprDraft("");
    setReviewing(false);
    setMenuOpen(false);
    setEliminatorOn(false);
    setHideTimer(false);
    setSubmittingModule(false);
    setRw1Done(null);
    setRw2Done(null);
    setMath1Done(null);
    setMath2Done(null);
    setSecondsLeft(null);
  }

  // Tick the module clock down once a second.
  useEffect(() => {
    if (!inModule || secondsLeft === null || secondsLeft <= 0) return;
    const t = setTimeout(
      () => setSecondsLeft((s) => (s === null ? null : s - 1)),
      1000
    );
    return () => clearTimeout(t);
  }, [inModule, secondsLeft]);

  // Submit the module automatically when the clock runs out.
  useEffect(() => {
    if (inModule && secondsLeft === 0) handleTimeUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inModule, secondsLeft]);

  function moduleLabel(): string {
    if (phase === "rw1") return "Reading & Writing · Module 1";
    if (phase === "rw2") return "Reading & Writing · Module 2";
    if (phase === "math1") return "Math · Module 1";
    if (phase === "math2") return "Math · Module 2";
    return "";
  }

  const moduleXpPill =
    moduleXp > 0 ? (
      <motion.p
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-sat-primary bg-sat-primary/10 rounded-full px-3 py-1"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
      >
        <Zap className="w-3.5 h-3.5" /> +{moduleXp} XP
      </motion.p>
    ) : null;

  const saveBanner = saveWarning ? (
    <div className="mb-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5">
      <CloudOff className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 dark:text-amber-200">{saveWarning}</p>
    </div>
  ) : null;

  // RENDERS

  // 1. Intro
  if (phase === "intro") {
    return (
      <motion.div
        className="max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl md:text-3xl font-display font-bold mb-2 text-sat-gray-900 dark:text-white">
          Full-Length Practice Test
        </h1>
        <p className="text-sat-gray-600 dark:text-sat-gray-400 mb-8">
          98 questions from College Board&apos;s public Educator Question Bank, randomized every time.
        </p>

        {loadError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">
              {loadError}. Check your connection and try again.
            </p>
          </div>
        )}

        {resumable && (
          <motion.div
            className="mb-6 card p-5 border-2 border-sat-primary/40 bg-sat-primary/5"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-sat-primary/15 flex items-center justify-center flex-shrink-0">
                <Play className="w-5 h-5 text-sat-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-bold dark:text-white">
                  You have a test in progress
                </h2>
                <p className="text-sm text-sat-gray-600 dark:text-sat-gray-400 mt-0.5">
                  {describeResume(resumable)}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button type="button" onClick={handleResume} className="btn-primary text-sm py-2 px-4">
                    Resume test
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardResume}
                    className="btn-secondary text-sm py-2 px-4"
                  >
                    Discard it
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="card p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span className="font-semibold text-sm text-sky-800 dark:text-sky-200">
                  Reading &amp; Writing
                </span>
              </div>
              <p className="text-xs text-sky-700 dark:text-sky-300">54 questions · 2 modules · 27 each</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="font-semibold text-sm text-amber-800 dark:text-amber-200">
                  Math
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">44 questions · 2 modules · 22 each</p>
            </div>
          </div>

          <ul className="space-y-1.5 text-sm text-sat-gray-600 dark:text-sat-gray-400">
            <li>• Module 2 difficulty adapts to your Module 1 score (≥70% → harder)</li>
            <li>• Questions are shuffled, so every test is unique</li>
            <li>• Your answers save as you go, so a refresh will not lose the test</li>
            <li>• Every score and every question is kept in your history</li>
          </ul>

          <div>
            <label className="block text-sm font-medium text-sat-gray-700 dark:text-sat-gray-300 mb-2">
              Timing
            </label>
            {timeMultiplierLoaded ? (
              <div className="flex flex-wrap gap-2">
                {TIME_MULTIPLIERS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => void handleTimeMultiplierChange(m)}
                    className={`text-sm py-2 px-4 rounded-xl border-2 transition-colors ${
                      timeMultiplier === m
                        ? "border-sat-primary bg-sat-primary/10 text-sat-primary font-semibold"
                        : "border-sat-gray-200 dark:border-sat-gray-600 text-sat-gray-600 dark:text-sat-gray-400"
                    }`}
                  >
                    {m === 1 ? "Standard" : m === 1.5 ? "Time and a half" : "Double time"}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-9 w-24 rounded-xl" />
                <Skeleton className="h-9 w-36 rounded-xl" />
                <Skeleton className="h-9 w-32 rounded-xl" />
              </div>
            )}
          </div>

          <motion.button
            type="button"
            onClick={handleStartTest}
            disabled={checkingResume}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-60"
            whileHover={{ scale: checkingResume ? 1 : 1.01 }}
            whileTap={{ scale: checkingResume ? 1 : 0.99 }}
          >
            {resumable ? "Start a new test" : "Start Test"} <ArrowRight className="w-5 h-5" />
          </motion.button>
        </div>

        <ul className="space-y-2 text-sat-gray-700 dark:text-sat-gray-300 mt-6">
          <li className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-500" />
            Timed sections: Math and Reading &amp; Writing
          </li>
          <li className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-500" />
            Get a score estimate and review answers
          </li>
          <li className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-500" />
            <Link href="/history" className="text-sky-600 dark:text-sky-400 hover:underline">
              See your past scores and mistakes
            </Link>
          </li>
        </ul>
      </motion.div>
    );
  }

  // 2. Loading screens
  if (phase === "loading" || phase === "rw2_loading" || phase === "math2_loading") {
    const msg =
      phase === "loading"
        ? "Generating your full-length practice test…"
        : phase === "rw2_loading"
        ? "Loading Reading & Writing Module 2…"
        : "Loading Math Module 2…";
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 text-center">
        <Loader2 className="w-12 h-12 text-sat-primary animate-spin" />
        <p className="text-sat-gray-700 dark:text-sat-gray-300 font-medium">{msg}</p>
        <p className="text-xs text-sat-gray-500 dark:text-sat-gray-500 max-w-xs">
          Fetching official practice questions from College Board. This takes a moment.
        </p>
      </div>
    );
  }

  // 3. Active module: the question view, or its end-of-module review screen
  if (inModule && currentQ) {
    const isMathModule = phase === "math1" || phase === "math2";
    const statuses: QuestionStatus[] = activeQs.map((_, i) => ({
      answered: answers[i] !== null,
      marked: marked[i] ?? false,
    }));
    const isMarked = marked[currentIdx] ?? false;
    const optionsCrossed = crossedOut[currentIdx] ?? [];
    const timerForceShown = secondsLeft !== null && secondsLeft <= 300;

    return (
      <div className="max-w-3xl mx-auto">
        {saveBanner}
        {isMathModule && (
          <>
            {/* Keyed on the module, not the question: the student's work should
                survive moving between questions and only clear on a new module. */}
            <DesmosCalculator
              positionClassName="bottom-24 right-4 sm:bottom-6 sm:right-6"
              resetKey={phase}
            />
            <ReferenceSheet positionClassName="bottom-24 left-4 sm:bottom-6 sm:left-6" />
          </>
        )}

        <QuestionMenuModal
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          statuses={statuses}
          currentIdx={reviewing ? -1 : currentIdx}
          onJump={handleMenuJump}
        />

        {reviewing ? (
          <ModuleReview
            moduleLabel={moduleLabel()}
            answers={answers}
            marked={marked}
            onJump={handleMenuJump}
            onBackToQuestions={handleBackToQuestions}
            onSubmit={handleSubmitModule}
            submitting={submittingModule}
          />
        ) : (
          <>
            {/* Module header */}
            <div className="mb-5">
              <div className="flex items-center justify-between flex-wrap gap-y-2 mb-2">
                <div className="flex items-center gap-2">
                  {isMathModule ? (
                    <Calculator className="w-4 h-4 text-amber-500" />
                  ) : (
                    <BookOpen className="w-4 h-4 text-sky-500" />
                  )}
                  <span className="text-sm font-semibold text-sat-gray-700 dark:text-sat-gray-300">
                    {moduleLabel()}
                  </span>
                </div>

                {/* Mark for Review / Answer Eliminator — grouped, icon-only */}
                <div className="flex items-center rounded border border-sat-gray-300 dark:border-sat-gray-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleMark(currentIdx)}
                    aria-pressed={isMarked}
                    title={isMarked ? "Unmark for Review" : "Mark for Review"}
                    aria-label={isMarked ? "Unmark for Review" : "Mark for Review"}
                    className={`p-1.5 transition-colors ${
                      isMarked
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
                        : "text-sat-gray-500 dark:text-sat-gray-400 hover:bg-sat-gray-100 dark:hover:bg-sat-gray-700"
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isMarked ? "fill-amber-500" : ""}`} />
                  </button>
                  {isMCQ && currentQ.answerOptions && (
                    <button
                      type="button"
                      onClick={() => setEliminatorOn((v) => !v)}
                      aria-pressed={eliminatorOn}
                      title={eliminatorOn ? "Turn off Answer Eliminator" : "Turn on Answer Eliminator"}
                      aria-label={eliminatorOn ? "Turn off Answer Eliminator" : "Turn on Answer Eliminator"}
                      className={`p-1.5 border-l border-sat-gray-300 dark:border-sat-gray-600 transition-colors ${
                        eliminatorOn
                          ? "bg-sat-primary/10 text-sat-primary"
                          : "text-sat-gray-500 dark:text-sat-gray-400 hover:bg-sat-gray-100 dark:hover:bg-sat-gray-700"
                      }`}
                    >
                      <EliminatorIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <DiffBadge d={currentQ.difficulty} />
                  {secondsLeft !== null && (
                    <div className="flex items-center gap-1">
                      {hideTimer && !timerForceShown ? null : (
                        <span
                          className={`text-sm font-semibold tabular-nums px-2 py-0.5 rounded-md ${
                            timerForceShown
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-sat-gray-100 text-sat-gray-700 dark:bg-sat-gray-700 dark:text-sat-gray-200"
                          }`}
                          aria-label="Time remaining in this module"
                        >
                          {formatClock(secondsLeft)}
                        </span>
                      )}
                      {!timerForceShown && (
                        <button
                          type="button"
                          onClick={() => setHideTimer((h) => !h)}
                          className="p-1 rounded-md hover:bg-sat-gray-100 dark:hover:bg-sat-gray-700 text-sat-gray-400 dark:text-sat-gray-500"
                          title={hideTimer ? "Show timer" : "Hide timer"}
                          aria-label={hideTimer ? "Show timer" : "Hide timer"}
                        >
                          {hideTimer ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setMenuOpen(true)}
                    className="text-sm text-sat-gray-500 dark:text-sat-gray-400 hover:text-sat-primary dark:hover:text-sat-primary transition-colors underline decoration-dotted underline-offset-2"
                  >
                    {currentIdx + 1} / {activeQs.length}
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentIdx}
                initial={{ opacity: 0, x: 16 * navDir }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 * navDir }}
                transition={{ duration: 0.18 }}
              >
                {/* Stimulus (reading passage) */}
                {currentQ.stimulus && (
                  <div
                    className="card p-5 mb-4 max-h-72 overflow-y-auto text-sm leading-relaxed text-sat-gray-700 dark:text-sat-gray-300 [&_p]:mb-3 [&_strong]:font-semibold [&_em]:italic [&_h2]:font-bold [&_h2]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-sat-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic"
                    dangerouslySetInnerHTML={{ __html: currentQ.stimulus }}
                  />
                )}

                {/* Question card */}
                <div className="card p-6 md:p-8">
                  {/* Stem */}
                  <div
                    className="text-sat-gray-900 dark:text-white mb-6 leading-relaxed [&_p]:mb-3 [&_strong]:font-semibold [&_em]:italic [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-sat-gray-200 [&_td]:p-2 [&_td]:text-sm [&_th]:border [&_th]:border-sat-gray-200 [&_th]:p-2 [&_th]:text-sm [&_th]:bg-sat-gray-50 dark:[&_th]:bg-sat-gray-700 [&_img]:max-w-full [&_img]:h-auto"
                    dangerouslySetInnerHTML={{ __html: currentQ.stem }}
                  />

                  {/* MCQ Options */}
                  {isMCQ && currentQ.answerOptions && (
                    <>
                      <div className="space-y-2.5 mb-6">
                        {currentQ.answerOptions.map((opt) => {
                          const isSelected = answers[currentIdx] === opt.key;
                          const isCrossed = optionsCrossed.includes(opt.key);

                          return (
                            <div key={opt.key} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isCrossed) setAnswerAt(currentIdx, opt.key);
                                }}
                                disabled={isCrossed}
                                className={`flex-1 text-left px-4 py-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                                  isCrossed
                                    ? "border-sat-gray-200 dark:border-sat-gray-700 opacity-50 cursor-not-allowed"
                                    : isSelected
                                    ? "border-sat-primary bg-sat-primary/10"
                                    : "border-sat-gray-200 dark:border-sat-gray-600 hover:border-sat-primary/50 dark:hover:border-sat-primary/50"
                                }`}
                              >
                                <span
                                  className={`w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${
                                    isSelected && !isCrossed
                                      ? "border-sat-primary text-sat-primary"
                                      : "border-sat-gray-400 text-sat-gray-500"
                                  }`}
                                >
                                  {opt.key}
                                </span>
                                <div
                                  className={`flex-1 text-sm text-sat-gray-800 dark:text-sat-gray-200 [&_p]:m-0 [&_img]:max-w-full [&_img]:h-auto ${
                                    isCrossed ? "line-through opacity-70" : ""
                                  }`}
                                  dangerouslySetInnerHTML={{ __html: opt.text }}
                                />
                              </button>
                              {eliminatorOn && (
                                <button
                                  type="button"
                                  onClick={() => toggleCrossOut(currentIdx, opt.key)}
                                  className={`w-9 h-9 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                    isCrossed
                                      ? "border-sat-primary text-sat-primary bg-sat-primary/10"
                                      : "border-sat-gray-300 dark:border-sat-gray-600 text-sat-gray-500 dark:text-sat-gray-400 hover:border-sat-primary/50"
                                  }`}
                                  title={isCrossed ? `Undo cross-out of ${opt.key}` : `Cross out ${opt.key}`}
                                  aria-label={isCrossed ? `Undo cross-out of ${opt.key}` : `Cross out ${opt.key}`}
                                >
                                  {isCrossed ? (
                                    <Undo2 className="w-4 h-4" />
                                  ) : (
                                    <span className="text-xs font-bold line-through">{opt.key}</span>
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* SPR Input */}
                  {!isMCQ && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-sat-gray-700 dark:text-sat-gray-300 mb-2">
                        Your answer:
                      </label>
                      <input
                        type="text"
                        value={sprDraft}
                        onChange={(e) => setSprDraft(e.target.value)}
                        onBlur={() => setAnswerAt(currentIdx, sprDraft.trim() ? sprDraft : null)}
                        placeholder="Enter your answer…"
                        className="w-full max-w-xs px-4 py-2.5 rounded-xl border-2 border-sat-gray-200 dark:border-sat-gray-600 dark:bg-sat-gray-800 dark:text-white focus:ring-2 focus:ring-sat-primary outline-none text-sm"
                      />
                    </div>
                  )}

                  {/* Back / Next */}
                  <div className="flex gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={currentIdx === 0}
                      className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <motion.button
                      type="button"
                      onClick={handleNext}
                      className="btn-primary flex items-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {currentIdx < activeQs.length - 1 ? "Next" : "Review"}{" "}
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </div>

                  {!currentQ.externalId.startsWith("bank:") && (
                    <p className="text-xs text-sat-gray-500 dark:text-sat-gray-500 mt-4">
                      Question © College Board
                    </p>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    );
  }

  // 4. RW Module 1 done
  if (phase === "rw1_done" && rw1Done) {
    const score = calcScore(rw1Done);
    const pct = Math.round((score / rw1Done.questions.length) * 100);
    const goingHarder = pct >= 70;
    return (
      <motion.div
        className="max-w-md mx-auto text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {saveBanner}
        <div className="card p-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl dark:text-white mb-1">
              R&amp;W Module 1 Complete
            </h2>
            <p className="text-sat-gray-500 dark:text-sat-gray-400 text-sm">
              Reading &amp; Writing
            </p>
          </div>
          <p className="text-5xl font-display font-bold text-sat-primary">
            {score}
            <span className="text-2xl text-sat-gray-500">/{rw1Done.questions.length}</span>
          </p>
          {moduleXpPill}
          <p className="text-sm text-sat-gray-600 dark:text-sat-gray-400">
            {goingHarder
              ? "Great work! Module 2 will include more challenging questions."
              : "Keep going! Module 2 will reinforce the fundamentals."}
          </p>
          {loadError && (
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          )}
          <button
            type="button"
            onClick={handleContinueToRw2}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Continue to Module 2 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  // 5. RW Module 2 done
  if (phase === "rw2_done" && rw1Done && rw2Done) {
    const score = calcScore(rw2Done);
    const sectionScore = calcScore(rw1Done) + score;
    const sectionTotal = rw1Done.questions.length + rw2Done.questions.length;
    return (
      <motion.div
        className="max-w-md mx-auto text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {saveBanner}
        <div className="card p-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl dark:text-white mb-1">
              R&amp;W Module 2 Complete
            </h2>
            <p className="text-sat-gray-500 dark:text-sat-gray-400 text-sm">
              Reading &amp; Writing
            </p>
          </div>
          <p className="text-5xl font-display font-bold text-sat-primary">
            {score}
            <span className="text-2xl text-sat-gray-500">/{rw2Done.questions.length}</span>
          </p>
          {moduleXpPill}
          <p className="text-sm text-sat-gray-600 dark:text-sat-gray-400">
            {sectionScore}/{sectionTotal} correct across both R&amp;W modules. Up next: Math.
          </p>
          {loadError && (
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          )}
          <button
            type="button"
            onClick={handleContinueToMathIntro}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Continue to Math <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  // 6. Math intro (break between RW and Math)
  if (phase === "math_intro") {
    return (
      <motion.div
        className="max-w-md mx-auto text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {saveBanner}
        <div className="card p-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto">
            <Calculator className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl dark:text-white mb-1">
              Reading &amp; Writing Done!
            </h2>
            <p className="text-sat-gray-500 dark:text-sat-gray-400 text-sm">
              Up next: Math Section
            </p>
          </div>
          {moduleXpPill}
          <ul className="text-sm text-sat-gray-600 dark:text-sat-gray-400 space-y-1 text-left">
            <li>• 44 questions across 2 modules</li>
            <li>• 22 questions per module</li>
            <li>• Module 2 adapts to your Module 1 performance</li>
          </ul>
          <button
            type="button"
            onClick={handleStartMath1}
            disabled={math1Qs.length === 0}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            Begin Math Section <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  // 7. Math Module 1 done
  if (phase === "math1_done" && math1Done) {
    const score = calcScore(math1Done);
    const pct = Math.round((score / math1Done.questions.length) * 100);
    const goingHarder = pct >= 70;
    return (
      <motion.div
        className="max-w-md mx-auto text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {saveBanner}
        <div className="card p-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto">
            <Calculator className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl dark:text-white mb-1">
              Math Module 1 Complete
            </h2>
          </div>
          <p className="text-5xl font-display font-bold text-sat-primary">
            {score}
            <span className="text-2xl text-sat-gray-500">/{math1Done.questions.length}</span>
          </p>
          {moduleXpPill}
          <p className="text-sm text-sat-gray-600 dark:text-sat-gray-400">
            {goingHarder
              ? "Excellent! Module 2 will be more challenging."
              : "Module 2 will help reinforce core concepts."}
          </p>
          {loadError && (
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          )}
          <button
            type="button"
            onClick={handleContinueToMath2}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Continue to Module 2 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  // 8. Math Module 2 done
  if (phase === "math2_done" && math1Done && math2Done) {
    const score = calcScore(math2Done);
    const sectionScore = calcScore(math1Done) + score;
    const sectionTotal = math1Done.questions.length + math2Done.questions.length;
    return (
      <motion.div
        className="max-w-md mx-auto text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {saveBanner}
        <div className="card p-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto">
            <Calculator className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl dark:text-white mb-1">
              Math Module 2 Complete
            </h2>
          </div>
          <p className="text-5xl font-display font-bold text-sat-primary">
            {score}
            <span className="text-2xl text-sat-gray-500">/{math2Done.questions.length}</span>
          </p>
          {moduleXpPill}
          <p className="text-sm text-sat-gray-600 dark:text-sat-gray-400">
            {sectionScore}/{sectionTotal} correct across both Math modules. That&apos;s the test done!
          </p>
          {loadError && (
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          )}
          <button
            type="button"
            onClick={handleContinueToResults}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            See Results <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  // 9. Results
  if (phase === "results" && rw1Done && rw2Done && math1Done && math2Done) {
    const rwRaw = calcScore(rw1Done) + calcScore(rw2Done);
    const mathRaw = calcScore(math1Done) + calcScore(math2Done);
    const rwTotal = rw1Done.questions.length + rw2Done.questions.length;
    const mathTotal = math1Done.questions.length + math2Done.questions.length;

    const rwRange = estimateSectionRange(rwRaw, rwTotal, "reading_writing");
    const mathRange = estimateSectionRange(mathRaw, mathTotal, "math");
    const totalRange = { lower: rwRange.lower + mathRange.lower, upper: rwRange.upper + mathRange.upper };

    const groups: ReviewGroup[] = (
      [
        ["rw1", rw1Done],
        ["rw2", rw2Done],
        ["math1", math1Done],
        ["math2", math2Done],
      ] as const
    ).map(([key, mod]) => ({
      label: MODULE_META[key].label,
      items: mod.questions.map((q, i) => ({ question: q, answer: mod.answers[i] ?? null })),
    }));

    return (
      <motion.div
        className="max-w-3xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {saveBanner}

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-7 h-7 text-amber-500" />
          <h1 className="text-2xl font-display font-bold dark:text-white">Test Complete!</h1>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
          <div className="card p-5 text-center">
            <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">
              Reading &amp; Writing
            </p>
            <p className="text-3xl font-display font-bold text-sky-600 dark:text-sky-400">
              {rwRange.lower}–{rwRange.upper}
            </p>
            <p className="text-xs text-sat-gray-500 mt-1">{rwRaw}/{rwTotal} correct</p>
          </div>
          <div className="card p-5 text-center ring-2 ring-sat-primary">
            <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">Total Score</p>
            <p className="text-3xl font-display font-bold text-sat-primary">
              {totalRange.lower}–{totalRange.upper}
            </p>
            <p className="text-xs text-sat-gray-500 mt-1">out of 1600</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">Math</p>
            <p className="text-3xl font-display font-bold text-amber-600 dark:text-amber-400">
              {mathRange.lower}–{mathRange.upper}
            </p>
            <p className="text-xs text-sat-gray-500 mt-1">{mathRaw}/{mathTotal} correct</p>
          </div>
        </div>
        <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-8">
          Estimate based on College Board&apos;s published conversion tables. The real test is
          adaptive, so your official score may differ.
        </p>

        {xpResult && xpResult.total > 0 && (
          <motion.div
            className="card p-5 mb-6 border-2 border-sat-primary/30 bg-sat-primary/5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-sat-primary flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-display font-bold text-2xl text-sat-gray-900 dark:text-white leading-none">
                  +{xpResult.total} XP
                </p>
                <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mt-1">
                  {xpResult.isPersonalBest
                    ? xpResult.previousBest === null
                      ? "Your first full test. Everything from here is measured against it."
                      : `New personal best, up from ${xpResult.previousBest}.`
                    : "Earned for this sitting"}
                </p>
              </div>
            </div>
            <ul className="space-y-1 border-t border-sat-primary/20 pt-3">
              {xpResult.awards.map((a) => (
                <li key={a.source} className="flex items-center justify-between text-sm">
                  <span className="text-sat-gray-700 dark:text-sat-gray-300">{a.label}</span>
                  <span className="font-semibold text-sat-gray-900 dark:text-white tabular-nums">
                    +{a.amount}
                  </span>
                </li>
              ))}
            </ul>
            {xpResult.streak.current > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-3">
                {xpResult.streak.current} day streak
                {xpResult.streak.extended ? " and counting" : ""}
              </p>
            )}
          </motion.div>
        )}

        {!saveWarning && (
          <p className="text-sm text-sat-gray-500 dark:text-sat-gray-400 mb-6">
            Saved to your{" "}
            <Link href="/history" className="text-sky-600 dark:text-sky-400 hover:underline">
              test history
            </Link>
            . You can come back to this breakdown any time.
          </p>
        )}

        {/* Question review */}
        <h2 className="font-display font-bold text-lg dark:text-white mb-3">Question Review</h2>
        <QuestionReview groups={groups} idPrefix="results" />

        <div className="mt-4 pb-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={resetTest}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Take Another Test
          </button>
          <Link href="/history" className="btn-secondary flex items-center gap-2">
            <History className="w-4 h-4" /> View Past Tests
          </Link>
        </div>
      </motion.div>
    );
  }

  return null;
}
