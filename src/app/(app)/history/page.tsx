"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  History as HistoryIcon,
  Trophy,
  ChevronRight,
  Loader2,
  Target,
  TrendingUp,
  Play,
} from "lucide-react";
import { ScoreTrend, type TrendPoint } from "@/components/history/ScoreTrend";

interface HistoryAttempt {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  completedAt: string | null;
  rwRaw: number | null;
  rwMax: number | null;
  mathRaw: number | null;
  mathMax: number | null;
  rwScaled: number | null;
  mathScaled: number | null;
  totalScaled: number | null;
  modulesCompleted: number;
}

interface HistoryPracticeSession {
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

interface SkillBreakdown {
  skill: string;
  section: "math" | "rw";
  total: number;
  correct: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<HistoryAttempt[]>([]);
  const [practice, setPractice] = useState<HistoryPracticeSession[]>([]);
  const [skills, setSkills] = useState<SkillBreakdown[]>([]);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setAttempts(d.attempts ?? []);
        setPractice(d.practiceSessions ?? []);
        setSkills(d.skills ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completed = attempts.filter((a) => a.status === "completed" && a.totalScaled !== null);
  const inProgress = attempts.filter((a) => a.status === "in_progress");

  // Oldest first, so the trend reads left to right in time order.
  const trend: TrendPoint[] = [...completed]
    .reverse()
    .map((a) => ({
      label: formatShortDate(a.completedAt ?? a.startedAt),
      value: a.totalScaled ?? 0,
    }));

  const best = completed.reduce(
    (max, a) => Math.max(max, a.totalScaled ?? 0),
    0
  );
  const latest = completed[0]?.totalScaled ?? null;
  const previous = completed[1]?.totalScaled ?? null;
  const delta = latest !== null && previous !== null ? latest - previous : null;

  const weakest = skills.slice(0, 6);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <Loader2 className="w-8 h-8 text-sat-primary animate-spin" />
        <p className="text-sat-gray-500 dark:text-sat-gray-400 text-sm">Loading your results…</p>
      </div>
    );
  }

  const nothingYet =
    attempts.length === 0 && practice.length === 0;

  return (
    <motion.div
      className="max-w-5xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl bg-sat-primary/10 text-sat-primary">
          <HistoryIcon className="w-6 h-6" />
        </div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-sat-gray-900 dark:text-white">
          Your Results
        </h1>
      </div>
      <p className="text-sat-gray-600 dark:text-sat-gray-400 mb-8">
        Every test and practice run you have taken, with the exact questions you missed.
      </p>

      {nothingYet && (
        <div className="card p-8 text-center">
          <Trophy className="w-10 h-10 text-sat-gray-300 dark:text-sat-gray-600 mx-auto mb-3" />
          <p className="text-sat-gray-600 dark:text-sat-gray-300 mb-4">
            Nothing here yet. Take a full test or a practice set and your scores will show up.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/full-test" className="btn-primary text-sm py-2 px-4">
              Take a full test
            </Link>
            <Link href="/practice" className="btn-secondary text-sm py-2 px-4">
              Practice a topic
            </Link>
          </div>
        </div>
      )}

      {inProgress.length > 0 && (
        <div className="card p-5 mb-6 border-2 border-sat-primary/40 bg-sat-primary/5">
          <div className="flex items-center gap-3">
            <Play className="w-5 h-5 text-sat-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sat-gray-900 dark:text-white text-sm">
                You have a test in progress from {formatDate(inProgress[0].startedAt)}
              </p>
              <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400">
                {inProgress[0].modulesCompleted} of 4 modules finished
              </p>
            </div>
            <Link href="/full-test" className="btn-primary text-sm py-2 px-4 whitespace-nowrap">
              Resume
            </Link>
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="card p-5">
              <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">Most recent</p>
              <p className="text-3xl font-display font-bold text-sat-gray-900 dark:text-white">
                {latest}
              </p>
              {delta !== null && (
                <p
                  className={`text-xs mt-1 font-medium ${
                    delta > 0
                      ? "text-green-600 dark:text-green-400"
                      : delta < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-sat-gray-500"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta} from your last test
                </p>
              )}
            </div>
            <div className="card p-5">
              <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">Best score</p>
              <p className="text-3xl font-display font-bold text-sat-primary">{best}</p>
              <p className="text-xs text-sat-gray-400 mt-1">out of 1600</p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-1">Tests taken</p>
              <p className="text-3xl font-display font-bold text-sat-gray-900 dark:text-white">
                {completed.length}
              </p>
              <p className="text-xs text-sat-gray-400 mt-1">
                {practice.length} practice {practice.length === 1 ? "run" : "runs"}
              </p>
            </div>
          </div>

          {trend.length >= 2 && (
            <div className="card p-5 mb-8">
              <h2 className="font-display font-bold text-base mb-1 flex items-center gap-2 dark:text-white">
                <TrendingUp className="w-4 h-4 text-sat-primary" />
                Total score over time
              </h2>
              <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-3">
                Hover a point to read its date and score.
              </p>
              <ScoreTrend points={trend} />
            </div>
          )}
        </>
      )}

      {completed.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display font-bold text-lg mb-3 dark:text-white">Full tests</h2>
          <div className="space-y-2">
            {completed.map((a) => (
              <Link key={a.id} href={`/history/${a.id}`} className="block">
                <div className="card p-4 hover:bg-sat-gray-50 dark:hover:bg-sat-gray-700/40 transition-colors flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sat-primary/10 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-5 h-5 text-sat-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold text-lg text-sat-gray-900 dark:text-white leading-tight">
                      {a.totalScaled}
                      <span className="text-sm font-normal text-sat-gray-400"> / 1600</span>
                    </p>
                    <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400">
                      {formatDate(a.completedAt ?? a.startedAt)}
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end text-xs text-sat-gray-500 dark:text-sat-gray-400">
                    <span>
                      R&amp;W <strong className="text-sky-600 dark:text-sky-400">{a.rwScaled}</strong>
                      {a.rwMax ? ` · ${a.rwRaw}/${a.rwMax}` : ""}
                    </span>
                    <span>
                      Math <strong className="text-amber-600 dark:text-amber-400">{a.mathScaled}</strong>
                      {a.mathMax ? ` · ${a.mathRaw}/${a.mathMax}` : ""}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-sat-gray-400 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {weakest.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display font-bold text-lg mb-1 dark:text-white">
            Where you lose the most points
          </h2>
          <p className="text-sm text-sat-gray-500 dark:text-sat-gray-400 mb-3">
            Across every test and practice question you have answered.
          </p>
          <div className="card p-5 space-y-3">
            {weakest.map((s) => {
              const pct = Math.round((s.correct / s.total) * 100);
              return (
                <div key={s.skill}>
                  <div className="flex items-center justify-between text-sm mb-1 gap-3">
                    <span className="text-sat-gray-800 dark:text-sat-gray-200 truncate">
                      {s.skill}
                    </span>
                    <span className="text-sat-gray-500 dark:text-sat-gray-400 whitespace-nowrap text-xs tabular-nums">
                      {s.correct}/{s.total} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-sat-gray-200 dark:bg-sat-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        s.section === "math" ? "bg-amber-500" : "bg-sky-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {practice.length > 0 && (
        <section className="pb-10">
          <h2 className="font-display font-bold text-lg mb-3 dark:text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-sat-primary" />
            Practice runs
          </h2>
          <div className="space-y-2">
            {practice.map((p) => (
              <Link key={p.id} href={`/history/practice/${p.id}`} className="block">
                <div className="card p-4 hover:bg-sat-gray-50 dark:hover:bg-sat-gray-700/40 transition-colors flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sat-gray-900 dark:text-white text-sm truncate">
                      {p.topicLabel}
                    </p>
                    <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400">
                      {formatDate(p.startedAt)}
                      {p.difficulty !== "all" && ` · ${p.difficulty.replace("_", " ")}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-sat-gray-700 dark:text-sat-gray-200 tabular-nums whitespace-nowrap">
                    {p.correct}/{p.answered}
                  </span>
                  <ChevronRight className="w-5 h-5 text-sat-gray-400 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}
