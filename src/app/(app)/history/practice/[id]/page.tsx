"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Target } from "lucide-react";
import type { ClientQuestion } from "@/lib/question-store";
import { QuestionReview, type ReviewGroup } from "@/components/review/QuestionReview";

interface PracticeSessionDetail {
  id: string;
  topicSlug: string;
  topicLabel: string;
  difficulty: string;
  totalQuestions: number;
  answered: number;
  correct: number;
  startedAt: string;
  completedAt: string | null;
}

interface PracticeAnswer {
  question: ClientQuestion;
  selectedAnswer: string | null;
  isCorrect: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** A past practice run, with every question the student answered. */
export default function PracticeReviewPage() {
  const params = useParams();
  const id = params.id as string;

  const [session, setSession] = useState<PracticeSessionDetail | null>(null);
  const [answers, setAnswers] = useState<PracticeAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/practice/session/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 404 ? "That practice run was not found." : "Could not load that run."
          );
        }
        return r.json();
      })
      .then((d) => {
        setSession(d.session as PracticeSessionDetail);
        setAnswers((d.answers ?? []) as PracticeAnswer[]);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const back = (
    <Link
      href="/history"
      className="inline-flex items-center gap-2 text-sat-primary hover:underline mb-6"
    >
      <ArrowLeft className="w-4 h-4" /> Back to results
    </Link>
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        {back}
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-4">
          <Loader2 className="w-8 h-8 text-sat-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-3xl mx-auto">
        {back}
        <div className="card p-8 text-center text-sat-gray-600 dark:text-sat-gray-400">
          {error ?? "That practice run was not found."}
        </div>
      </div>
    );
  }

  const groups: ReviewGroup[] = [
    {
      label: session.topicLabel,
      items: answers.map((a) => ({ question: a.question, answer: a.selectedAnswer })),
    },
  ];

  const pct = session.answered > 0 ? Math.round((session.correct / session.answered) * 100) : 0;

  return (
    <motion.div
      className="max-w-3xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {back}

      <div className="flex items-center gap-3 mb-1">
        <Target className="w-6 h-6 text-sat-primary" />
        <h1 className="text-2xl font-display font-bold dark:text-white">{session.topicLabel}</h1>
      </div>
      <p className="text-sat-gray-500 dark:text-sat-gray-400 mb-6">
        {formatDate(session.startedAt)}
        {session.difficulty !== "all" && ` · ${session.difficulty.replace("_", " ")}`}
      </p>

      <div className="card p-5 mb-8 flex items-center gap-6">
        <div>
          <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">Score</p>
          <p className="text-3xl font-display font-bold text-sat-primary">
            {session.correct}
            <span className="text-lg text-sat-gray-400">/{session.answered}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">Accuracy</p>
          <p className="text-3xl font-display font-bold text-sat-gray-900 dark:text-white">
            {pct}%
          </p>
        </div>
        {session.totalQuestions > session.answered && (
          <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 ml-auto max-w-[12rem]">
            You left this run after {session.answered} of {session.totalQuestions} questions.
          </p>
        )}
      </div>

      <h2 className="font-display font-bold text-lg dark:text-white mb-3">Question Review</h2>
      <div className="pb-10">
        <QuestionReview groups={groups} idPrefix="practice" />
      </div>
    </motion.div>
  );
}
