"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileQuestion, Clock, Zap, AlertCircle, BookOpen, Calculator, ArrowRight, Loader2, ChevronRight, Check, X, Trophy, RefreshCw } from "lucide-react";
import { estimateSectionScore, answersMatch } from "@/lib/scoring";

// ─── Types 

interface TQuestion {
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

interface CompletedModule {
  questions: TQuestion[];
  answers: (string | null)[];
}

/** Official digital SAT module lengths, in seconds. */
const MODULE_SECONDS = { rw: 32 * 60, math: 35 * 60 };

type Phase =
  | "intro"
  | "loading"
  | "rw1"
  | "rw1_done"
  | "rw2_loading"
  | "rw2"
  | "math_intro"
  | "math1"
  | "math1_done"
  | "math2_loading"
  | "math2"
  | "results";

// ─── Helpers 

function calcScore(mod: CompletedModule): number {
  return mod.questions.reduce(
    (n, q, i) => (isCorrect(q, mod.answers[i]) ? n + 1 : n),
    0
  );
}

function formatClock(total: number): string {
  const safe = Math.max(0, total);
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function isCorrect(q: TQuestion, answer: string | null): boolean {
  if (!answer) return false;
  return q.correctAnswer.some((ca) => answersMatch(ca, answer));
}

async function fetchModuleQuestions(
  section: "rw" | "math",
  module: "1" | "2",
  harder?: boolean,
  excludeIds?: string[]
): Promise<TQuestion[]> {
  const p = new URLSearchParams({ section, module });
  if (module === "2") p.set("harder", harder ? "true" : "false");
  if (excludeIds?.length) p.set("excludeIds", JSON.stringify(excludeIds));
  const r = await fetch(`/api/full-test?${p}`);
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.questions?.length) {
    throw new Error(
      d?.error ??
        "No questions came back. Collegeboard may be temporarily unavailable."
    );
  }
  return d.questions as TQuestion[];
}

// ─── Diff Badge 

function DiffBadge({ d }: { d: string }) {
  const label = d === "E" ? "Easy" : d === "M" ? "Medium" : d === "H" ? "Hard" : d;
  const cls =
    d === "E"
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
      : d === "M"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
      : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Main Page 

export default function FullTestPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Pre-fetched module questions
  const [rw1Qs, setRw1Qs] = useState<TQuestion[]>([]);
  const [math1Qs, setMath1Qs] = useState<TQuestion[]>([]);

  // Active module state
  const [activeQs, setActiveQs] = useState<TQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [pendingAns, setPendingAns] = useState<string | null>(null);

  // Completed modules
  const [rw1Done, setRw1Done] = useState<CompletedModule | null>(null);
  const [rw2Done, setRw2Done] = useState<CompletedModule | null>(null);
  const [math1Done, setMath1Done] = useState<CompletedModule | null>(null);
  const [math2Done, setMath2Done] = useState<CompletedModule | null>(null);

  // Results review
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Module helpers

  function startModule(qs: TQuestion[], seconds: number) {
    setActiveQs(qs);
    setCurrentIdx(0);
    setAnswers(new Array(qs.length).fill(null));
    setPendingAns(null);
    setSecondsLeft(seconds);
  }

  // ── Phase transitions

  async function handleStartTest() {
    setPhase("loading");
    setLoadError(null);
    try {
      const [rw1, math1] = await Promise.all([
        fetchModuleQuestions("rw", "1"),
        fetchModuleQuestions("math", "1"),
      ]);
      setRw1Qs(rw1);
      setMath1Qs(math1);
      startModule(rw1, MODULE_SECONDS.rw);
      setPhase("rw1");
    } catch (e) {
      setLoadError((e as Error).message);
      setPhase("intro");
    }
  }

  function handleConfirmAnswer() {
    // An unanswered question is recorded as a skip. The real test lets you
    // move on, and with a module clock running a student must not be trapped
    // on a question they cannot answer.
    const updated = [...answers];
    updated[currentIdx] = pendingAns?.trim() ? pendingAns : null;
    setAnswers(updated);

    if (currentIdx === activeQs.length - 1) {
      // Hand the freshly updated array straight to the finisher. Reading
      // `answers` here instead would use the pre-update render's value and
      // silently throw away the student's final answer of every module.
      finishModule(updated);
    } else {
      handleNextQuestion();
    }
  }

  function handleNextQuestion() {
    setPendingAns(null);
    setCurrentIdx((i) => i + 1);
  }

  /** Ends the active module using the given answers and advances the phase. */
  function finishModule(finalAnswers: (string | null)[]) {
    const done: CompletedModule = { questions: activeQs, answers: finalAnswers };
    setSecondsLeft(null);

    if (phase === "rw1") {
      setRw1Done(done);
      setPhase("rw1_done");
    } else if (phase === "rw2") {
      setRw2Done(done);
      setPhase("math_intro");
    } else if (phase === "math1") {
      setMath1Done(done);
      setPhase("math1_done");
    } else if (phase === "math2") {
      finishMath2(done);
    }
  }

  /** Called when a module timer runs out; keeps any answer already selected. */
  function handleTimeUp() {
    const finalAnswers = [...answers];
    if (pendingAns?.trim()) finalAnswers[currentIdx] = pendingAns;
    finishModule(finalAnswers);
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
      startModule(rw2, MODULE_SECONDS.rw);
      setPhase("rw2");
    } catch (e) {
      setLoadError((e as Error).message);
      setPhase("rw1_done");
    }
  }

  function handleStartMath1() {
    startModule(math1Qs, MODULE_SECONDS.math);
    setPhase("math1");
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
      startModule(math2, MODULE_SECONDS.math);
      setPhase("math2");
    } catch (e) {
      setLoadError((e as Error).message);
      setPhase("math1_done");
    }
  }

  function finishMath2(done: CompletedModule) {
    setMath2Done(done);

    // Save last test to localStorage for calendar integration
    if (rw1Done && rw2Done && math1Done) {
      const rwRaw = calcScore(rw1Done) + calcScore(rw2Done);
      const mathRaw = calcScore(math1Done) + calcScore(done);
      const rwMax = rw1Done.questions.length + rw2Done.questions.length;
      const mathMax = math1Done.questions.length + done.questions.length;
      const rwScaled = estimateSectionScore(rwRaw, rwMax, "reading_writing");
      const mathScaled = estimateSectionScore(mathRaw, mathMax, "math");
      try {
        window.localStorage.setItem(
          "cain:lastFullTest",
          JSON.stringify({
            readingRaw: rwRaw,
            mathRaw,
            readingScaled: rwScaled,
            mathScaled,
            totalScaled: rwScaled + mathScaled,
            computedAt: new Date().toISOString(),
          })
        );
      } catch {
        // ignore storage errors
      }
    }

    setPhase("results");
  }

  function resetTest() {
    setPhase("intro");
    setLoadError(null);
    setRw1Qs([]);
    setMath1Qs([]);
    setActiveQs([]);
    setAnswers([]);
    setPendingAns(null);
    setRw1Done(null);
    setRw2Done(null);
    setMath1Done(null);
    setMath2Done(null);
    setExpandedId(null);
    setSecondsLeft(null);
  }

  // ── Derived values for active module

  const currentQ = activeQs[currentIdx] ?? null;
  const isLastQ = currentIdx === activeQs.length - 1;
  const isMCQ = currentQ ? currentQ.type !== "spr" : true;
  const currentIsCorrect = currentQ ? isCorrect(currentQ, pendingAns) : false;
  const inModule =
    phase === "rw1" || phase === "rw2" || phase === "math1" || phase === "math2";

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
          98 real SAT questions pulled live from Collegeboard, randomized every time.
        </p>

        {loadError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">
              {loadError}. Check your connection and try again.
            </p>
          </div>
        )}

        <div className="card p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span className="font-semibold text-sm text-sky-800 dark:text-sky-200">
                  Reading & Writing
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
            <li>• See correct/incorrect per question as you go</li>
            <li>• Full explanations available in the results review</li>
          </ul>

          <motion.button
            type="button"
            onClick={handleStartTest}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            Start Test <ArrowRight className="w-5 h-5" />
          </motion.button>
        </div>

        <ul className="space-y-2 text-sat-gray-700 dark:text-sat-gray-300">
          <li className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-500" />
            Timed sections: Math and Reading &amp; Writing
          </li>
          <li className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-500" />
            Get a score estimate and review answers
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
        <p className="text-xs text-sat-gray-400 dark:text-sat-gray-500 max-w-xs">
          Fetching real questions from Collegeboard. This takes a moment.
        </p>
      </div>
    );
  }

  // 3. Active module question view
  const isModulePhase = inModule;

  if (isModulePhase && currentQ) {
    const isMathModule = phase === "math1" || phase === "math2";

    return (
      <div className="max-w-3xl mx-auto">
        {/* Module header */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
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
            <div className="flex items-center gap-2">
              <DiffBadge d={currentQ.difficulty} />
              {secondsLeft !== null && (
                <span
                  className={`text-sm font-semibold tabular-nums px-2 py-0.5 rounded-md ${
                    secondsLeft <= 300
                      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      : "bg-sat-gray-100 text-sat-gray-700 dark:bg-sat-gray-700 dark:text-sat-gray-200"
                  }`}
                  aria-label="Time remaining in this module"
                >
                  {formatClock(secondsLeft)}
                </span>
              )}
              <span className="text-sm text-sat-gray-500 dark:text-sat-gray-400">
                {currentIdx + 1} / {activeQs.length}
              </span>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-sat-gray-200 dark:bg-sat-gray-700 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-sat-primary"
              animate={{ width: `${((currentIdx + 1) / activeQs.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
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
                <div className="space-y-2.5 mb-6">
                  {currentQ.answerOptions.map((opt) => {
                    const isSelected = pendingAns === opt.key;

                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setPendingAns(opt.key)}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                          isSelected
                            ? "border-sat-primary bg-sat-primary/10"
                            : "border-sat-gray-200 dark:border-sat-gray-600 hover:border-sat-primary/50 dark:hover:border-sat-primary/50"
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${
                            isSelected
                              ? "border-sat-primary text-sat-primary"
                              : "border-sat-gray-400 text-sat-gray-400"
                          }`}
                        >
                          {opt.key}
                        </span>
                        <div
                          className="flex-1 text-sm text-sat-gray-800 dark:text-sat-gray-200 [&_p]:m-0 [&_img]:max-w-full [&_img]:h-auto"
                          dangerouslySetInnerHTML={{ __html: opt.text }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* SPR Input */}
              {!isMCQ && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-sat-gray-700 dark:text-sat-gray-300 mb-2">
                    Your answer:
                  </label>
                  <input
                    type="text"
                    value={pendingAns ?? ""}
                    onChange={(e) => setPendingAns(e.target.value)}
                    placeholder="Enter your answer…"
                    className="w-full max-w-xs px-4 py-2.5 rounded-xl border-2 border-sat-gray-200 dark:border-sat-gray-600 dark:bg-sat-gray-800 dark:text-white focus:ring-2 focus:ring-sat-primary outline-none text-sm"
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 flex-wrap">
                {currentIdx < activeQs.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleConfirmAnswer}
                    className="btn-primary flex items-center gap-2"
                  >
                    {pendingAns?.trim() ? "Next" : "Skip"}{" "}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={handleConfirmAnswer}
                    className="btn-primary flex items-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Finish Module <ChevronRight className="w-4 h-4" />
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
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
        <div className="card p-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl dark:text-white mb-1">
              R&W Module 1 Complete
            </h2>
            <p className="text-sat-gray-500 dark:text-sat-gray-400 text-sm">
              Reading & Writing
            </p>
          </div>
          <p className="text-5xl font-display font-bold text-sat-primary">
            {score}
            <span className="text-2xl text-sat-gray-400">/{rw1Done.questions.length}</span>
          </p>
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

  // 5. Math intro (break between RW and Math)
  if (phase === "math_intro") {
    return (
      <motion.div
        className="max-w-md mx-auto text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="card p-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto">
            <Calculator className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl dark:text-white mb-1">
              Reading & Writing Done!
            </h2>
            <p className="text-sat-gray-500 dark:text-sat-gray-400 text-sm">
              Up next: Math Section
            </p>
          </div>
          <ul className="text-sm text-sat-gray-600 dark:text-sat-gray-400 space-y-1 text-left">
            <li>• 44 questions across 2 modules</li>
            <li>• 22 questions per module</li>
            <li>• Module 2 adapts to your Module 1 performance</li>
          </ul>
          <button
            type="button"
            onClick={handleStartMath1}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Begin Math Section <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  // 6. Math Module 1 done
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
            <span className="text-2xl text-sat-gray-400">/{math1Done.questions.length}</span>
          </p>
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

  // 7. Results
  if (phase === "results" && rw1Done && rw2Done && math1Done && math2Done) {
    const rwRaw = calcScore(rw1Done) + calcScore(rw2Done);
    const mathRaw = calcScore(math1Done) + calcScore(math2Done);
    const rwTotal = rw1Done.questions.length + rw2Done.questions.length;
    const mathTotal = math1Done.questions.length + math2Done.questions.length;
    const rwScaled = estimateSectionScore(rwRaw, rwTotal, "reading_writing");
    const mathScaled = estimateSectionScore(mathRaw, mathTotal, "math");
    const total = rwScaled + mathScaled;

    const sections = [
      { label: "R&W Module 1", mod: rw1Done },
      { label: "R&W Module 2", mod: rw2Done },
      { label: "Math Module 1", mod: math1Done },
      { label: "Math Module 2", mod: math2Done },
    ] as const;

    return (
      <motion.div
        className="max-w-3xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-7 h-7 text-amber-500" />
          <h1 className="text-2xl font-display font-bold dark:text-white">
            Test Complete!
          </h1>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="card p-5 text-center">
            <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">
              Reading & Writing
            </p>
            <p className="text-3xl font-display font-bold text-sky-600 dark:text-sky-400">
              {rwScaled}
            </p>
            <p className="text-xs text-sat-gray-400 mt-1">{rwRaw}/{rwTotal} correct</p>
          </div>
          <div className="card p-5 text-center ring-2 ring-sat-primary">
            <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">
              Total Score
            </p>
            <p className="text-3xl font-display font-bold text-sat-primary">
              {total}
            </p>
            <p className="text-xs text-sat-gray-400 mt-1">out of 1600</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">
              Math
            </p>
            <p className="text-3xl font-display font-bold text-amber-600 dark:text-amber-400">
              {mathScaled}
            </p>
            <p className="text-xs text-sat-gray-400 mt-1">{mathRaw}/{mathTotal} correct</p>
          </div>
        </div>

        {/* Question review */}
        <h2 className="font-display font-bold text-lg dark:text-white mb-1">
          Question Review
        </h2>
        <p className="text-sm text-sat-gray-500 dark:text-sat-gray-400 mb-5">
          Click any question to see the full explanation.
        </p>

        {sections.map(({ label, mod }) => (
          <div key={label} className="mb-8">
            <h3 className="text-xs font-semibold text-sat-gray-500 dark:text-sat-gray-400 uppercase tracking-widest mb-3">
              {label}: {calcScore(mod)}/{mod.questions.length} correct
            </h3>
            <div className="space-y-2">
              {mod.questions.map((q, i) => {
                const userAns = mod.answers[i];
                const correct = isCorrect(q, userAns);
                const key = `${label}-${i}`;
                const isOpen = expandedId === key;
                return (
                  <div key={q.id} className="card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : key)}
                      className="w-full p-4 flex items-center gap-3 text-left hover:bg-sat-gray-50 dark:hover:bg-sat-gray-700/40 transition-colors"
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          correct
                            ? "bg-green-100 dark:bg-green-900/40"
                            : "bg-red-100 dark:bg-red-900/40"
                        }`}
                      >
                        {correct ? (
                          <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-sat-gray-600 dark:text-sat-gray-400">
                        Q{i + 1}
                      </span>
                      <DiffBadge d={q.difficulty} />
                      {q.skill_desc && (
                        <span className="text-xs text-sat-gray-400 dark:text-sat-gray-500 truncate hidden sm:block">
                          {q.skill_desc}
                        </span>
                      )}
                      <span className="ml-auto text-sat-gray-400 text-xs">
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-sat-gray-100 dark:border-sat-gray-700"
                        >
                          <div className="p-5 space-y-4">
                            {q.stimulus && (
                              <div
                                className="text-sm text-sat-gray-700 dark:text-sat-gray-300 max-h-52 overflow-y-auto bg-sat-gray-50 dark:bg-sat-gray-800 rounded-lg p-4 leading-relaxed [&_p]:mb-2"
                                dangerouslySetInnerHTML={{ __html: q.stimulus }}
                              />
                            )}
                            <div
                              className="text-sat-gray-900 dark:text-white leading-relaxed [&_p]:mb-2 [&_strong]:font-semibold [&_img]:max-w-full [&_img]:h-auto"
                              dangerouslySetInnerHTML={{ __html: q.stem }}
                            />

                            {q.answerOptions && (
                              <div className="space-y-1.5">
                                {q.answerOptions.map((opt) => {
                                  const ck = q.correctAnswer[0]?.toUpperCase();
                                  const isCorrectOpt =
                                    opt.key.toUpperCase() === ck;
                                  const isUserOpt =
                                    userAns?.toUpperCase() ===
                                    opt.key.toUpperCase();
                                  return (
                                    <div
                                      key={opt.key}
                                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                                        isCorrectOpt
                                          ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                                          : isUserOpt && !isCorrectOpt
                                          ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                                          : "text-sat-gray-600 dark:text-sat-gray-400"
                                      }`}
                                    >
                                      <span className="font-bold flex-shrink-0">
                                        {opt.key}.
                                      </span>
                                      <div
                                        className="flex-1 [&_p]:m-0 [&_img]:max-w-full [&_img]:h-auto"
                                        dangerouslySetInnerHTML={{
                                          __html: opt.text,
                                        }}
                                      />
                                      {isCorrectOpt && (
                                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                      )}
                                      {isUserOpt && !isCorrectOpt && (
                                        <X className="w-4 h-4 text-red-600 flex-shrink-0" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* SPR answer display */}
                            {q.type === "spr" && (
                              <div className="text-sm">
                                <span className="font-medium text-sat-gray-700 dark:text-sat-gray-300">
                                  Your answer:{" "}
                                </span>
                                <span
                                  className={
                                    correct ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"
                                  }
                                >
                                  {userAns ?? "Not answered"}
                                </span>
                                {!correct && (
                                  <span className="ml-3 text-sat-gray-500">
                                    Correct: {q.correctAnswer.join(" or ")}
                                  </span>
                                )}
                              </div>
                            )}

                            {q.rationale && (
                              <div className="bg-sat-gray-50 dark:bg-sat-gray-800 rounded-xl p-4 text-sm text-sat-gray-700 dark:text-sat-gray-300">
                                <p className="font-semibold mb-2 text-sat-gray-900 dark:text-white">
                                  Explanation
                                </p>
                                <div
                                  className="leading-relaxed [&_p]:mb-2 [&_strong]:font-semibold [&_img]:max-w-full [&_img]:h-auto"
                                  dangerouslySetInnerHTML={{
                                    __html: q.rationale,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-4 pb-10">
          <button
            type="button"
            onClick={resetTest}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Take Another Test
          </button>
        </div>
      </motion.div>
    );
  }

  return null;
}
