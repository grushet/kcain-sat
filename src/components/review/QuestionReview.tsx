"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Minus } from "lucide-react";
import type { ClientQuestion } from "@/lib/question-store";
import { isCorrect } from "@/lib/test-attempt";

export interface ReviewItem {
  question: ClientQuestion;
  answer: string | null;
}

export interface ReviewGroup {
  label: string;
  items: ReviewItem[];
}

export function DiffBadge({ d }: { d: string }) {
  const label = d === "E" ? "Easy" : d === "M" ? "Medium" : d === "H" ? "Hard" : d;
  const cls =
    d === "E"
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
      : d === "M"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
      : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
  );
}

type Outcome = "correct" | "wrong" | "skipped";

function outcomeOf(item: ReviewItem): Outcome {
  if (!item.answer) return "skipped";
  return isCorrect(item.question, item.answer) ? "correct" : "wrong";
}

function OutcomeDot({ outcome }: { outcome: Outcome }) {
  if (outcome === "correct") {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-100 dark:bg-green-900/40">
        <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
      </div>
    );
  }
  if (outcome === "wrong") {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-red-100 dark:bg-red-900/40">
        <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-sat-gray-200 dark:bg-sat-gray-700">
      <Minus className="w-3.5 h-3.5 text-sat-gray-500 dark:text-sat-gray-400" />
    </div>
  );
}

/**
 * The per-question breakdown, rendered identically on the results screen and on
 * a past attempt in history. One component rather than two so the two views
 * cannot drift apart as either one is changed.
 *
 * A skipped question is shown as its own outcome rather than being lumped in
 * with wrong answers: running out of time is a different problem from picking
 * the wrong choice, and a student needs to be able to tell them apart.
 */
export function QuestionReview({
  groups,
  idPrefix = "review",
}: {
  groups: ReviewGroup[];
  idPrefix?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [missedOnly, setMissedOnly] = useState(false);

  const missedCount = useMemo(
    () =>
      groups.reduce(
        (n, g) => n + g.items.filter((it) => outcomeOf(it) !== "correct").length,
        0
      ),
    [groups]
  );
  const totalCount = useMemo(
    () => groups.reduce((n, g) => n + g.items.length, 0),
    [groups]
  );

  if (totalCount === 0) {
    return (
      <p className="text-sat-gray-500 dark:text-sat-gray-400 py-6">
        No answered questions to review.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          type="button"
          onClick={() => setMissedOnly(false)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !missedOnly
              ? "bg-sat-primary text-white"
              : "bg-sat-gray-200 dark:bg-sat-gray-700 text-sat-gray-700 dark:text-sat-gray-300"
          }`}
        >
          All {totalCount}
        </button>
        <button
          type="button"
          onClick={() => setMissedOnly(true)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            missedOnly
              ? "bg-sat-primary text-white"
              : "bg-sat-gray-200 dark:bg-sat-gray-700 text-sat-gray-700 dark:text-sat-gray-300"
          }`}
        >
          Missed {missedCount}
        </button>
        <span className="text-sm text-sat-gray-500 dark:text-sat-gray-400 ml-1">
          Click any question for the full explanation.
        </span>
      </div>

      {missedOnly && missedCount === 0 && (
        <p className="card p-6 text-center text-sat-gray-600 dark:text-sat-gray-300">
          Nothing missed. Every question here was answered correctly.
        </p>
      )}

      {groups.map((group) => {
        const visible = missedOnly
          ? group.items
              .map((item, i) => ({ item, i }))
              .filter(({ item }) => outcomeOf(item) !== "correct")
          : group.items.map((item, i) => ({ item, i }));

        if (visible.length === 0) return null;

        const correctInGroup = group.items.filter(
          (it) => outcomeOf(it) === "correct"
        ).length;

        return (
          <div key={group.label} className="mb-8">
            <h3 className="text-xs font-semibold text-sat-gray-500 dark:text-sat-gray-400 uppercase tracking-widest mb-3">
              {group.label}: {correctInGroup}/{group.items.length} correct
            </h3>
            <div className="space-y-2">
              {visible.map(({ item, i }) => {
                const { question: q, answer } = item;
                const outcome = outcomeOf(item);
                const key = `${idPrefix}-${group.label}-${i}`;
                const isOpen = expandedId === key;
                const correctKey = q.correctAnswer[0]?.toUpperCase();

                return (
                  <div key={key} className="card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : key)}
                      className="w-full p-4 flex items-center gap-3 text-left hover:bg-sat-gray-50 dark:hover:bg-sat-gray-700/40 transition-colors"
                    >
                      <OutcomeDot outcome={outcome} />
                      <span className="text-sm font-medium text-sat-gray-600 dark:text-sat-gray-400">
                        Q{i + 1}
                      </span>
                      <DiffBadge d={q.difficulty} />
                      {q.skill_desc && (
                        <span className="text-xs text-sat-gray-500 dark:text-sat-gray-500 truncate hidden sm:block">
                          {q.skill_desc}
                        </span>
                      )}
                      <span className="ml-auto text-sat-gray-500 text-xs">
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
                                  const isCorrectOpt = opt.key.toUpperCase() === correctKey;
                                  const isUserOpt =
                                    answer?.toUpperCase() === opt.key.toUpperCase();
                                  return (
                                    <div
                                      key={opt.key}
                                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                                        isCorrectOpt
                                          ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                                          : isUserOpt
                                          ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                                          : "text-sat-gray-600 dark:text-sat-gray-400"
                                      }`}
                                    >
                                      <span className="font-bold flex-shrink-0">{opt.key}.</span>
                                      <div
                                        className="flex-1 [&_p]:m-0 [&_img]:max-w-full [&_img]:h-auto"
                                        dangerouslySetInnerHTML={{ __html: opt.text }}
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

                            {q.type === "spr" && (
                              <div className="text-sm">
                                <span className="font-medium text-sat-gray-700 dark:text-sat-gray-300">
                                  Your answer:{" "}
                                </span>
                                <span
                                  className={
                                    outcome === "correct"
                                      ? "text-green-600 dark:text-green-400 font-medium"
                                      : "text-red-600 dark:text-red-400 font-medium"
                                  }
                                >
                                  {answer ?? "Not answered"}
                                </span>
                                {outcome !== "correct" && (
                                  <span className="ml-3 text-sat-gray-500">
                                    Correct: {q.correctAnswer.join(" or ")}
                                  </span>
                                )}
                              </div>
                            )}

                            {outcome === "skipped" && q.type !== "spr" && (
                              <p className="text-sm text-sat-gray-500 dark:text-sat-gray-400">
                                You did not answer this one.
                              </p>
                            )}

                            {q.rationale && (
                              <div className="bg-sat-gray-50 dark:bg-sat-gray-800 rounded-xl p-4 text-sm text-sat-gray-700 dark:text-sat-gray-300">
                                <p className="font-semibold mb-2 text-sat-gray-900 dark:text-white">
                                  Explanation
                                </p>
                                <div
                                  className="leading-relaxed [&_p]:mb-2 [&_strong]:font-semibold [&_img]:max-w-full [&_img]:h-auto"
                                  dangerouslySetInnerHTML={{ __html: q.rationale }}
                                />
                              </div>
                            )}

                            {!q.externalId.startsWith("bank:") && (
                              <p className="text-xs text-sat-gray-500 dark:text-sat-gray-500">
                                Question © College Board
                              </p>
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
        );
      })}
    </div>
  );
}
