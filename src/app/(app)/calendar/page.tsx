"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon } from "lucide-react";

type LastFullTest = {
  readingScaled: number;
  mathScaled: number;
  totalScaled: number;
  computedAt: string;
  /** Set when the score came from the database, so it can be linked to. */
  attemptId?: string;
};

function formatDate(dateString: string) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function daysBetween(from: Date, to: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = to.getTime() - from.getTime();
  return Math.round(diff / msPerDay);
}

export default function CalendarPage() {
  const [lastTest, setLastTest] = useState<LastFullTest | null>(null);
  const [nextTestDate, setNextTestDate] = useState<string>("");

  // The stored score is the source of truth. localStorage is read first only so
  // something appears immediately, and so a student who tested before results
  // were saved anywhere still sees their last score.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("cain:lastFullTest");
      if (stored) setLastTest(JSON.parse(stored) as LastFullTest);
      const nextDate = window.localStorage.getItem("cain:nextTestDate");
      if (nextDate) setNextTestDate(nextDate);
    } catch {
      // Private browsing and malformed values both land here.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const latest = (d.attempts ?? []).find(
          (a: { status: string; totalScaled: number | null }) =>
            a.status === "completed" && a.totalScaled !== null
        );
        if (!latest) return;
        setLastTest({
          readingScaled: latest.rwScaled ?? 0,
          mathScaled: latest.mathScaled ?? 0,
          totalScaled: latest.totalScaled,
          computedAt: latest.completedAt ?? latest.startedAt,
          attemptId: latest.id,
        });
      })
      .catch(() => {
        // Keep whatever localStorage gave us.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleNextTestChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setNextTestDate(value);
    try {
      if (value) {
        window.localStorage.setItem("cain:nextTestDate", value);
      } else {
        window.localStorage.removeItem("cain:nextTestDate");
      }
    } catch {
      // ignore
    }
  }

  const today = new Date();
  const daysUntilNext =
    nextTestDate && !Number.isNaN(new Date(nextTestDate).getTime())
      ? daysBetween(today, new Date(nextTestDate))
      : null;

  const daysSinceLast =
    lastTest && !Number.isNaN(new Date(lastTest.computedAt).getTime())
      ? daysBetween(new Date(lastTest.computedAt), today)
      : null;

  return (
    <motion.div
      className="max-w-2xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <h1 className="text-2xl md:text-3xl font-display font-bold mb-2 text-sat-gray-900 dark:text-white">
        Calendar
      </h1>
      <p className="text-sat-gray-600 dark:text-sat-gray-400 mb-8">
        Plan your study schedule around real SAT scores and test dates.
      </p>

      <div className="card p-8 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <CalendarIcon className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg dark:text-white">Your SAT timeline</h2>
            <p className="text-sm text-sat-gray-600 dark:text-sat-gray-400">
              Track your last full-test score and your next official test date.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-display font-semibold text-sm mb-2 dark:text-white">Next test date</h3>
            <input
              type="date"
              value={nextTestDate}
              onChange={handleNextTestChange}
              className="px-4 py-2.5 rounded-xl border border-sat-gray-200 dark:border-sat-gray-600 dark:bg-sat-gray-800 dark:text-white focus:ring-2 focus:ring-sat-primary dark:focus:ring-sky-500 outline-none text-sm w-full max-w-xs"
            />
            {daysUntilNext !== null && (
              <p className="mt-2 text-sm text-sat-gray-600 dark:text-sky-200">
                {daysUntilNext > 0
                  ? `${daysUntilNext} day${daysUntilNext === 1 ? "" : "s"} until test day.`
                  : daysUntilNext === 0
                  ? "Test day is today."
                  : `Test day was ${Math.abs(daysUntilNext)} day${Math.abs(daysUntilNext) === 1 ? "" : "s"} ago.`}
              </p>
            )}
          </div>

          <div className="border-t border-sat-gray-100 dark:border-sat-gray-700 pt-4">
            <h3 className="font-display font-semibold text-sm mb-2 dark:text-white">Last full-test score</h3>
            {lastTest ? (
              <div className="space-y-1 text-sm text-sat-gray-700 dark:text-sky-100">
                <p>
                  <span className="font-semibold">Total:</span> {lastTest.totalScaled}{" "}
                  <span className="text-sat-gray-500 dark:text-sky-300">
                    (RW {lastTest.readingScaled} + Math {lastTest.mathScaled})
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Calculated:</span> {formatDate(lastTest.computedAt)}
                  {daysSinceLast !== null && daysSinceLast >= 0 && (
                    <span className="text-sat-gray-500 dark:text-sky-300">
                      {" "}
                      · {daysSinceLast} day{daysSinceLast === 1 ? "" : "s"} ago
                    </span>
                  )}
                </p>
                {lastTest.attemptId ? (
                  <p className="text-xs">
                    <Link
                      href={`/history/${lastTest.attemptId}`}
                      className="text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      See every question from this test
                    </Link>
                    <span className="text-sat-gray-500 dark:text-sky-300"> · </span>
                    <Link
                      href="/history"
                      className="text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      All results
                    </Link>
                  </p>
                ) : (
                  <p className="text-sat-gray-600 dark:text-sky-300 text-xs">
                    Take a new test on the Full Test page to update this.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-sat-gray-600 dark:text-sky-200">
                No full-test score yet.{" "}
                <Link href="/full-test" className="text-sky-600 dark:text-sky-400 hover:underline">
                  Take a full practice test
                </Link>{" "}
                and your score will appear here.
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

