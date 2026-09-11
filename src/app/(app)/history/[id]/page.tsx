"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { MODULE_META, type AttemptPayload } from "@/lib/test-attempt";
import { QuestionReview, type ReviewGroup } from "@/components/review/QuestionReview";
import { estimateSectionRange } from "@/lib/scoring";

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

/** A past sitting, rendered through the same review component as the results screen. */
export default function AttemptReviewPage() {
  const params = useParams();
  const id = params.id as string;

  const [attempt, setAttempt] = useState<AttemptPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/full-test/attempt/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "That test was not found." : "Could not load that test.");
        return r.json();
      })
      .then((d) => setAttempt(d.attempt as AttemptPayload))
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

  if (error || !attempt) {
    return (
      <div className="max-w-3xl mx-auto">
        {back}
        <div className="card p-8 text-center text-sat-gray-600 dark:text-sat-gray-400">
          {error ?? "That test was not found."}
        </div>
      </div>
    );
  }

  const groups: ReviewGroup[] = attempt.modules
    .filter((m) => m.questions.length > 0)
    .map((m) => ({
      label: MODULE_META[m.key].label,
      items: m.questions.map((q, i) => ({ question: q, answer: m.answers[i] ?? null })),
    }));

  const unfinished = attempt.status !== "completed";
  const hasRawCounts =
    attempt.rwRaw != null && attempt.rwMax != null && attempt.mathRaw != null && attempt.mathMax != null;
  const rwRange = hasRawCounts
    ? estimateSectionRange(attempt.rwRaw!, attempt.rwMax!, "reading_writing")
    : null;
  const mathRange = hasRawCounts ? estimateSectionRange(attempt.mathRaw!, attempt.mathMax!, "math") : null;
  const totalRange =
    rwRange && mathRange
      ? { lower: rwRange.lower + mathRange.lower, upper: rwRange.upper + mathRange.upper }
      : null;

  return (
    <motion.div
      className="max-w-3xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {back}

      <div className="flex items-center gap-3 mb-1">
        <Trophy className="w-6 h-6 text-amber-500" />
        <h1 className="text-2xl font-display font-bold dark:text-white">
          {unfinished ? "Unfinished test" : "Practice test"}
        </h1>
      </div>
      <p className="text-sat-gray-500 dark:text-sat-gray-400 mb-6">
        {formatDate(attempt.completedAt ?? attempt.startedAt)}
      </p>

      {unfinished ? (
        <div className="card p-5 mb-8">
          <p className="text-sat-gray-700 dark:text-sat-gray-300 text-sm">
            This sitting was never finished, so it has no scaled score. The modules you did
            complete are below.
          </p>
          <Link href="/full-test" className="btn-primary text-sm py-2 px-4 inline-block mt-3">
            Go to the full test
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
            <div className="card p-5 text-center">
              <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">
                Reading &amp; Writing
              </p>
              <p className="text-3xl font-display font-bold text-sky-600 dark:text-sky-400">
                {rwRange ? `${rwRange.lower}–${rwRange.upper}` : attempt.rwScaled}
              </p>
              <p className="text-xs text-sat-gray-500 mt-1">
                {attempt.rwRaw}/{attempt.rwMax} correct
              </p>
            </div>
            <div className="card p-5 text-center ring-2 ring-sat-primary">
              <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">Total Score</p>
              <p className="text-3xl font-display font-bold text-sat-primary">
                {totalRange ? `${totalRange.lower}–${totalRange.upper}` : attempt.totalScaled}
              </p>
              <p className="text-xs text-sat-gray-500 mt-1">out of 1600</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">Math</p>
              <p className="text-3xl font-display font-bold text-amber-600 dark:text-amber-400">
                {mathRange ? `${mathRange.lower}–${mathRange.upper}` : attempt.mathScaled}
              </p>
              <p className="text-xs text-sat-gray-500 mt-1">
                {attempt.mathRaw}/{attempt.mathMax} correct
              </p>
            </div>
          </div>
          {totalRange && (
            <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-8">
              Estimate based on College Board&apos;s published conversion tables. The real test is
              adaptive, so your official score may differ.
            </p>
          )}
        </>
      )}

      <h2 className="font-display font-bold text-lg dark:text-white mb-3">Question Review</h2>
      <div className="pb-10">
        <QuestionReview groups={groups} idPrefix="attempt" />
      </div>
    </motion.div>
  );
}
