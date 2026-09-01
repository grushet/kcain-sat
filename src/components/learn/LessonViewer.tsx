"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Check, X, Sparkles, LayoutDashboard, ExternalLink, BookOpen } from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  getLesson,
  getNextLessonId,
  getLessonQuestions,
  getLessonHackSlides,
  type PracticeQuestion,
  type HackSlide,
} from "@/lib/lessons";
import { mathStr } from "@/components/MathText";

type FlowStep = "content" | `q:${number}` | `r:${number}` | `h:${number}` | "done";

function buildFlow(questionCount: number, hackSlides: HackSlide[]): FlowStep[] {
  const steps: FlowStep[] = ["content"];
  for (let i = 0; i < questionCount; i++) {
    steps.push(`q:${i}` as FlowStep);
    steps.push(`r:${i}` as FlowStep);
    if (hackSlides[i]) steps.push(`h:${i}` as FlowStep);
  }
  steps.push("done");
  return steps;
}

export function LessonViewer({ lessonId }: { lessonId: string }) {
  const lesson = getLesson(lessonId);
  const questions = lesson ? getLessonQuestions(lesson) : [];
  const hackSlides = useMemo(() => (lesson ? getLessonHackSlides(lesson) : []), [lesson]);
  const flow = useMemo(() => buildFlow(questions.length, hackSlides), [questions.length, hackSlides]);

  const [flowIndex, setFlowIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const completedRef = useRef(false);
  const [xpSaved, setXpSaved] = useState<"pending" | "saved" | "signed-out" | "error">("pending");

  const step = flow[flowIndex] ?? "content";
  useEffect(() => {
    if (!lesson) return;
    if (step === "done" && !completedRef.current) {
      completedRef.current = true;
      // A signed-out student can reach a lesson, so a failure here has to be
      // shown rather than swallowed: otherwise their XP silently disappears.
      fetch("/api/progress/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      })
        .then((r) => {
          if (r.ok) setXpSaved("saved");
          else if (r.status === 401) setXpSaved("signed-out");
          else setXpSaved("error");
        })
        .catch(() => setXpSaved("error"));
    }
  }, [lesson, step, lessonId]);

  if (!lesson) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <p className="text-sat-gray-600 dark:text-sky-200">
          Lesson not found.{" "}
          <Link href="/dashboard" className="text-sat-primary dark:text-sky-400 font-medium hover:underline">
            Back to Dashboard
          </Link>
        </p>
      </motion.div>
    );
  }

  const { content } = lesson;
  const nextLessonId = getNextLessonId(lesson.id);
  const nextLesson = nextLessonId ? getLesson(nextLessonId) : null;

  const progressWidth = flow.length <= 1 ? "100%" : `${(flowIndex / (flow.length - 1)) * 100}%`;

  const handleCheck = (_q: PracticeQuestion) => {
    setFlowIndex((i) => i + 1);
  };

  const handleNextFromResult = () => {
    setSelectedAnswer(null);
    setFlowIndex((i) => i + 1);
  };

  const handleNextFromHack = () => {
    setFlowIndex((i) => i + 1);
  };

  // Current question index when step is q:i or r:i
  const questionIndex = step.startsWith("q:") || step.startsWith("r:") ? parseInt(step.split(":")[1] ?? "0", 10) : 0;
  const currentQuestion = questions[questionIndex] ?? questions[0]!;
  const isCorrect = currentQuestion && selectedAnswer === currentQuestion.correctKey;
  const isResultStep = step.startsWith("r:");
  const isHackStep = step.startsWith("h:");
  const hackIndex = isHackStep ? parseInt(step.split(":")[1] ?? "0", 10) : 0;
  const currentHack = hackSlides[hackIndex];

  return (
    <motion.div
      className="max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="h-2 bg-sat-gray-200 dark:bg-sat-gray-700 rounded-full mb-10 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-sat-primary to-sat-crimson dark:from-sky-500 dark:to-sky-600 rounded-full"
          initial={false}
          animate={{ width: progressWidth }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === "content" && (
          <motion.div
            key="content"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="space-y-6 min-h-[280px]"
          >
            {content.map((block, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={clsx(
                  block.type === "heading" &&
                    "text-2xl font-display font-bold bg-gradient-to-r from-sat-primary to-sat-crimson dark:from-sky-400 dark:to-sky-600 bg-clip-text text-transparent",
                  block.type === "text" && "text-sat-gray-700 dark:text-sky-200 leading-relaxed",
                  block.type === "example" &&
                    "p-5 bg-gradient-to-br from-sat-primary/5 to-sat-crimson/5 dark:from-sky-500/10 dark:to-sky-600/10 rounded-2xl border border-sat-primary/20 dark:border-sky-500/30 italic dark:text-sky-100",
                  block.type === "formula" &&
                    "p-5 bg-sat-gray-100 dark:bg-sat-gray-700 rounded-2xl font-mono text-lg border border-sat-gray-200 dark:border-sat-gray-600 dark:text-sky-100",
                  block.type === "tip" &&
                    "p-5 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border-l-4 border-amber-500 dark:border-sky-500 font-medium text-sat-gray-800 dark:text-sky-100"
                )}
              >
                {mathStr(block.content)}
              </motion.div>
            ))}
            <motion.button
              onClick={() => setFlowIndex(1)}
              className="btn-primary inline-flex items-center gap-2 mt-8"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Continue to Practice
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        )}

        {step.startsWith("q:") && currentQuestion && (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="space-y-6 min-h-[280px]"
          >
            <h2 className="text-xl font-display font-bold dark:text-white">
              Practice {questions.length > 1 ? `(${questionIndex + 1} of ${questions.length})` : ""}
            </h2>
            <p className="text-sat-gray-700 dark:text-sky-200 text-lg">{mathStr(currentQuestion.question)}</p>
            <div className="space-y-3">
              {currentQuestion.options.map((opt, i) => (
                <motion.button
                  key={opt.key}
                  onClick={() => setSelectedAnswer(opt.key)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={clsx(
                    "w-full p-4 rounded-xl border-2 text-left flex items-center gap-4 transition-all dark:text-white",
                    selectedAnswer === opt.key
                      ? "border-sat-primary dark:border-sky-500 bg-sat-primary/5 dark:bg-sky-500/10 shadow-md"
                      : "border-sat-gray-200 dark:border-sat-gray-600 hover:border-sat-gray-300 dark:hover:border-sky-500/50 hover:bg-sat-gray-50 dark:hover:bg-sat-gray-700/50"
                  )}
                  whileHover={{ x: 4 }}
                >
                  <span className="w-10 h-10 rounded-xl bg-sat-gray-100 dark:bg-sat-gray-700 flex items-center justify-center font-bold shrink-0">
                    {opt.key}
                  </span>
                  {mathStr(opt.text)}
                </motion.button>
              ))}
            </div>
            <motion.button
              onClick={() => handleCheck(currentQuestion)}
              disabled={!selectedAnswer}
              className="btn-primary w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: selectedAnswer ? 1.01 : 1 }}
              whileTap={{ scale: 0.99 }}
            >
              Check
            </motion.button>
          </motion.div>
        )}

        {isResultStep && currentQuestion && (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="space-y-6 min-h-[280px]"
          >
            <motion.div
              className={clsx(
                "p-8 rounded-2xl flex items-center gap-6",
                isCorrect
                  ? "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 border-2 border-emerald-200 dark:border-emerald-700"
                  : "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 border-2 border-red-200 dark:border-red-700"
              )}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
            >
              {isCorrect ? (
                <>
                  <motion.div
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
                  >
                    <Check className="w-8 h-8 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-bold text-2xl text-emerald-800 dark:text-emerald-200">Correct!</h3>
                    <p className="text-emerald-700 dark:text-emerald-300">
                      {questions.length > 1 ? `Question ${questionIndex + 1} of ${questions.length}` : `+${lesson.xpReward} XP earned`}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <motion.div
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
                  >
                    <X className="w-8 h-8 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-bold text-2xl text-red-800 dark:text-red-200">Not quite</h3>
                    <p className="text-red-700 dark:text-red-300">Review the explanation below</p>
                  </div>
                </>
              )}
            </motion.div>
            <motion.div
              className="p-6 bg-sat-gray-50 dark:bg-sat-gray-700/50 rounded-2xl border border-sat-gray-200 dark:border-sat-gray-600"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <p className="font-bold mb-2 text-sat-gray-800 dark:text-white">Explanation</p>
              <p className="text-sat-gray-700 dark:text-sky-200">{mathStr(currentQuestion.explanation)}</p>
            </motion.div>
            <motion.button
              onClick={handleNextFromResult}
              className="btn-primary w-full py-4 inline-flex items-center justify-center gap-2"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        )}

        {isHackStep && currentHack && (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="space-y-6 min-h-[280px]"
          >
            <div
              className={clsx(
                "p-8 rounded-2xl border-2",
                currentHack.type === "desmos"
                  ? "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700"
                  : "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700"
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                {currentHack.type === "desmos" ? (
                  <ExternalLink className="w-8 h-8 text-sky-600 dark:text-sky-400 shrink-0" />
                ) : (
                  <BookOpen className="w-8 h-8 text-violet-600 dark:text-violet-400 shrink-0" />
                )}
                <h2 className="text-xl font-display font-bold dark:text-white">{currentHack.title}</h2>
              </div>
              <p className="text-sat-gray-700 dark:text-sky-200 leading-relaxed mb-6">{mathStr(currentHack.content)}</p>
              {currentHack.url && (
                <a
                  href={currentHack.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400 font-medium hover:underline"
                >
                  Open Desmos calculator
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            <motion.button
              onClick={handleNextFromHack}
              className="btn-primary w-full py-4 inline-flex items-center justify-center gap-2"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              Continue
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="space-y-6 min-h-[280px]"
          >
            <motion.div
              className="p-8 rounded-2xl flex items-center gap-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 border-2 border-emerald-200 dark:border-emerald-700"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
            >
              <motion.div
                className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
              >
                <Check className="w-8 h-8 text-white" />
              </motion.div>
              <div>
                <h3 className="font-display font-bold text-2xl text-emerald-800 dark:text-emerald-200">Lesson complete!</h3>
                <p className="text-emerald-700 dark:text-emerald-300">
                  {xpSaved === "signed-out"
                    ? `+${lesson.xpReward} XP available`
                    : `+${lesson.xpReward} XP earned`}
                </p>
                {xpSaved === "signed-out" && (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    <Link href="/auth/login" className="font-semibold underline">
                      Sign in
                    </Link>{" "}
                    to save your progress.
                  </p>
                )}
                {xpSaved === "error" && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    We could not save this one. Your progress may not be recorded.
                  </p>
                )}
              </div>
            </motion.div>
            <div className="flex flex-col sm:flex-row gap-3">
              {nextLesson ? (
                <Link href={`/learn/${nextLessonId}`} className="flex-1">
                  <motion.span
                    className="btn-primary w-full py-4 inline-flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Sparkles className="w-5 h-5" />
                    Next: {nextLesson.title}
                  </motion.span>
                </Link>
              ) : null}
              <Link href="/dashboard" className={nextLesson ? "flex-1" : "w-full"}>
                <motion.span
                  className={clsx(
                    "w-full py-4 inline-flex items-center justify-center gap-2 rounded-xl font-display font-bold transition-colors",
                    nextLesson ? "btn-secondary" : "btn-primary"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Back to Dashboard
                </motion.span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
