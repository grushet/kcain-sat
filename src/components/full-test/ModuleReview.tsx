"use client";

import { motion } from "framer-motion";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { QuestionMenuGrid, QuestionMenuLegend, type QuestionStatus } from "./QuestionMenu";

/**
 * Bluebook's review screen: reached by pressing "Next" on a module's last
 * question, it never submits by itself. It shows every question's status and
 * hands submission to one explicit button, so a student who skipped a
 * question gets a last chance to notice before the clock (still running
 * behind this screen) takes the module away from them.
 */
export function ModuleReview({
  moduleLabel,
  answers,
  marked,
  onJump,
  onBackToQuestions,
  onSubmit,
  submitting,
}: {
  moduleLabel: string;
  answers: (string | null)[];
  marked: boolean[];
  onJump: (index: number) => void;
  onBackToQuestions: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const statuses: QuestionStatus[] = answers.map((a, i) => ({
    answered: a !== null,
    marked: marked[i] ?? false,
  }));
  const answeredCount = statuses.filter((s) => s.answered).length;
  const markedCount = statuses.filter((s) => s.marked).length;
  const unanswered = statuses.length - answeredCount;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5">
        <h2 className="font-display font-bold text-xl dark:text-white mb-1">
          Check Your Work
        </h2>
        <p className="text-sm text-sat-gray-600 dark:text-sat-gray-400">
          {moduleLabel} · {answeredCount}/{statuses.length} answered
          {markedCount > 0 ? ` · ${markedCount} marked for review` : ""}
        </p>
      </div>

      <div className="card p-5 mb-6">
        <QuestionMenuLegend />
        <QuestionMenuGrid statuses={statuses} currentIdx={-1} onJump={onJump} />
      </div>

      {unanswered > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-6">
          {unanswered} question{unanswered === 1 ? "" : "s"} unanswered. An unanswered question
          is scored the same as a wrong one, so it&apos;s worth a guess.
        </p>
      )}

      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBackToQuestions}
          className="btn-secondary flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Questions
        </button>
        <motion.button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
          whileHover={{ scale: submitting ? 1 : 1.02 }}
          whileTap={{ scale: submitting ? 1 : 0.98 }}
        >
          <CheckCircle2 className="w-4 h-4" /> Submit Module
        </motion.button>
      </div>
    </div>
  );
}
