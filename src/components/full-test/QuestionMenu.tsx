"use client";

import { Bookmark, X } from "lucide-react";

export interface QuestionStatus {
  answered: boolean;
  marked: boolean;
}

/**
 * The numbered grid Bluebook calls the "Question Menu": answered questions
 * fill in, marked ones carry a bookmark, and any cell jumps straight to that
 * question. Used both as a mid-module popover and, unmodified, as the body of
 * the end-of-module review screen.
 */
export function QuestionMenuGrid({
  statuses,
  currentIdx,
  onJump,
}: {
  statuses: QuestionStatus[];
  /** -1 when there is no "current" question, e.g. on the review screen. */
  currentIdx: number;
  onJump: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
      {statuses.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onJump(i)}
          aria-current={i === currentIdx ? "true" : undefined}
          aria-label={`Question ${i + 1}${s.answered ? ", answered" : ", not answered"}${
            s.marked ? ", marked for review" : ""
          }`}
          className={`relative w-10 h-10 rounded-lg border-2 flex items-center justify-center text-sm font-semibold transition-colors ${
            i === currentIdx
              ? "border-sat-primary ring-2 ring-sat-primary/30 text-sat-primary"
              : s.answered
              ? "border-sat-primary/50 bg-sat-primary/10 text-sat-primary"
              : "border-sat-gray-300 dark:border-sat-gray-600 text-sat-gray-500 dark:text-sat-gray-400"
          }`}
        >
          {i + 1}
          {s.marked && (
            <Bookmark className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          )}
        </button>
      ))}
    </div>
  );
}

export function QuestionMenuLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-sat-gray-600 dark:text-sat-gray-400 mb-4">
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded border-2 border-sat-primary/50 bg-sat-primary/10" />
        Answered
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded border-2 border-sat-gray-300 dark:border-sat-gray-600" />
        Unanswered
      </span>
      <span className="flex items-center gap-1.5">
        <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
        Marked for review
      </span>
    </div>
  );
}

/** The mid-module popover opened from the "Question X / Y" pill. */
export function QuestionMenuModal({
  open,
  onClose,
  statuses,
  currentIdx,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  statuses: QuestionStatus[];
  currentIdx: number;
  onJump: (index: number) => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-5 mt-16 sm:mt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold dark:text-white">Question Menu</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-sat-gray-100 dark:hover:bg-sat-gray-700 text-sat-gray-500 dark:text-sat-gray-400"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <QuestionMenuLegend />
        <QuestionMenuGrid
          statuses={statuses}
          currentIdx={currentIdx}
          onJump={(i) => {
            onJump(i);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
