"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PRACTICE_QUESTIONS } from "@/lib/questions";
import { LESSONS } from "@/lib/lessons";
import type { PracticeBankQuestion } from "@/lib/questions";

const SAMPLE_IDS = ["pq1", "pq17", "pq19"]; // algebra, words, grammar
const SAMPLE_QUESTIONS = SAMPLE_IDS
  .map((id) => PRACTICE_QUESTIONS.find((q) => q.id === id))
  .filter(Boolean) as PracticeBankQuestion[];

const LESSON_1 = LESSONS["1"];
const PREVIEW_BLOCKS = LESSON_1?.content.slice(0, 4) ?? [];
const PREVIEW_QUESTION = LESSON_1?.question;

function Block({ block }: { block: { type: string; content: string } }) {
  if (block.type === "heading") {
    return <h4 className="font-display font-bold text-lg mt-4 mb-1 dark:text-white">{block.content}</h4>;
  }
  if (block.type === "example") {
    return <p className="text-black dark:text-blue-300 font-medium text-sm mt-2">{block.content}</p>;
  }
  if (block.type === "formula") {
    return <p className="bg-sat-gray-100 dark:bg-sat-gray-700 rounded-lg px-3 py-2 text-sm font-mono mt-2 dark:text-sky-100">{block.content}</p>;
  }
  if (block.type === "tip") {
    return <p className="text-amber-700 dark:text-amber-200 text-sm mt-2 border-l-4 border-amber-400 pl-3">{block.content}</p>;
  }
  return <p className="text-sat-gray-700 dark:text-sky-200 text-sm leading-relaxed mt-1">{block.content}</p>;
}

export function TryItSection() {
  const [tab, setTab] = useState<"questions" | "lesson">("questions");
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [lessonAnswer, setLessonAnswer] = useState<string | null>(null);
  const [lessonSubmitted, setLessonSubmitted] = useState(false);

  const q = SAMPLE_QUESTIONS[qIndex];
  const correct = q && selected === q.correctKey;
  const showResult = submitted && q;

  const handleNext = () => {
    setSelected(null);
    setSubmitted(false);
    setQIndex((i) => (i + 1) % SAMPLE_QUESTIONS.length);
  };

  return (
    <section className="py-20 md:py-28 bg-white dark:bg-sat-gray-800 border-y border-sat-gray-100 dark:border-sat-gray-700">
      <div className="container mx-auto px-4">
        <motion.h2
          className="text-3xl md:text-5xl font-display font-bold text-center mb-2 text-sat-gray-800 dark:text-white"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Try it, no signup required
        </motion.h2>
        <motion.p
          className="text-sat-gray-600 dark:text-sky-200 text-center max-w-xl mx-auto mb-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          See what you&apos;ll get. Sample questions and a bite of a lesson.
        </motion.p>

        <div className="flex justify-center gap-2 mb-10">
          {(["questions", "lesson"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setSelected(null);
                setSubmitted(false);
                setLessonAnswer(null);
                setLessonSubmitted(false);
              }}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-colors ${
                tab === t
                  ? "bg-black dark:bg-blue-600 text-white"
                  : "bg-sat-gray-100 dark:bg-sat-gray-700 text-sat-gray-600 dark:text-blue-200 hover:bg-sat-gray-200 dark:hover:bg-sat-gray-600"
              }`}
            >
              {t === "questions" ? "Sample questions" : "Sample lesson"}
            </button>
          ))}
        </div>

        <motion.div
          className="max-w-2xl mx-auto card p-6 md:p-8 min-h-[280px]"
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "questions" && q && (
            <div>
              <p className="text-sm text-sat-gray-500 dark:text-sky-400 mb-2">Question {qIndex + 1} of {SAMPLE_QUESTIONS.length}</p>
              <p className="font-medium text-sat-gray-800 dark:text-white mb-4">{q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={submitted}
                    onClick={() => !submitted && setSelected(opt.key)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      !submitted
                        ? "border-sat-gray-200 dark:border-sat-gray-600 hover:border-black dark:hover:border-blue-500"
                        : opt.key === q.correctKey
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200"
                          : selected === opt.key
                            ? "border-sat-crimson bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                            : "border-sat-gray-200 dark:border-sat-gray-600 opacity-70"
                    } ${selected === opt.key && !submitted ? "border-black dark:border-blue-500 bg-black/5 dark:bg-blue-500/10" : ""}`}
                  >
                    <span className="font-medium">{opt.key}.</span> {opt.text}
                  </button>
                ))}
              </div>
              {!submitted ? (
                <button
                  type="button"
                  disabled={!selected}
                  onClick={() => setSubmitted(true)}
                  className="mt-6 btn-primary py-2.5 px-5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Check answer
                </button>
              ) : (
                <div className="mt-6 space-y-4">
                  <p className={`font-semibold ${correct ? "text-emerald-600 dark:text-emerald-400" : "text-sat-crimson dark:text-red-400"}`}>
                    {correct ? "Correct!" : "Not quite."}
                  </p>
                  <p className="text-sm text-sat-gray-600 dark:text-sky-200">{q.explanation}</p>
                  <button type="button" onClick={handleNext} className="btn-secondary py-2 px-4 text-sm">
                    Next question
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "lesson" && LESSON_1 && (
            <div>
              <h3 className="font-display font-bold text-xl mb-4 dark:text-white">{LESSON_1.title} preview</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {PREVIEW_BLOCKS.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </div>
              {PREVIEW_QUESTION && (
                <div className="mt-6 pt-6 border-t border-sat-gray-200 dark:border-sat-gray-600">
                  <p className="font-medium text-sat-gray-800 dark:text-white mb-3">Quick check:</p>
                  <p className="text-sm text-sat-gray-700 dark:text-sky-200 mb-3">{PREVIEW_QUESTION.question}</p>
                  <div className="flex flex-wrap gap-2">
                    {PREVIEW_QUESTION.options.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={lessonSubmitted}
                        onClick={() => !lessonSubmitted && setLessonAnswer(opt.key)}
                        className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          !lessonSubmitted
                            ? "border-sat-gray-200 dark:border-sat-gray-600 hover:border-black dark:hover:border-blue-500"
                            : opt.key === PREVIEW_QUESTION.correctKey
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                              : lessonAnswer === opt.key
                                ? "border-sat-crimson bg-red-50 dark:bg-red-900/20"
                                : "border-sat-gray-200 dark:border-sat-gray-600 opacity-60"
                        }`}
                      >
                        {opt.key}. {opt.text}
                      </button>
                    ))}
                  </div>
                  {lessonSubmitted && (
                    <p className="mt-3 text-sm text-sat-gray-600 dark:text-sky-200">{PREVIEW_QUESTION.explanation}</p>
                  )}
                  {!lessonSubmitted && lessonAnswer !== null && (
                    <button
                      type="button"
                      onClick={() => setLessonSubmitted(true)}
                      className="mt-3 btn-primary py-2 px-4 text-sm"
                    >
                      Check answer
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>

        <p className="text-center mt-6 text-sm text-sat-gray-500 dark:text-sky-400">
          Sign up free to unlock the full path, practice bank, and streaks.
        </p>
      </div>
    </section>
  );
}
