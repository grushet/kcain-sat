"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ProgressTracker } from "@/components/dashboard/ProgressTracker";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Target, ArrowRight, Trophy, Zap, Lightbulb, Clock, ChevronRight, Star, FileQuestion, History } from "lucide-react";
import { LESSONS } from "@/lib/lessons";
import { MATH_LESSON_IDS, READING_LESSON_IDS } from "@/lib/lessons";
import { DAILY_GOAL_XP, levelFromXP, type LevelInfo } from "@/lib/xp";

const SAT_TIPS = [
  "Plug answer choices back in when the algebra gets messy; it is often faster than solving.",
  "For paired evidence questions, answer the main question first, then find the line that proves it.",
  "'NO CHANGE' is correct about 25% of the time. Don't overthink it.",
  "Memorize the 3-4-5 and 5-12-13 right triangles; they appear often.",
  "When stuck on vocab, cover the word and predict what would fit in the blank.",
  "Use your calculator for the Math section; it's allowed and can save time.",
  "Read the passage for main idea before answering questions.",
  "For comparisons, use 'any other' to exclude the thing being compared.",
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [progress, setProgress] = useState({
    totalXP: 0,
    level: levelFromXP(0) as LevelInfo,
    streak: { current: 0, longest: 0, extended: false },
    dailyGoal: { target: DAILY_GOAL_XP, earned: 0, completed: false },
    streakAtRisk: false,
    completedLessonIds: [] as string[],
    mathCompleted: 0,
    readingCompleted: 0,
    lastCompleted: [] as { lessonId: string | null; title: string; completedAt: string }[],
  });

  const [lastTest, setLastTest] = useState<{
    id: string;
    totalScaled: number;
    rwScaled: number | null;
    mathScaled: number | null;
    completedAt: string | null;
    startedAt: string;
  } | null>(null);
  const [testCount, setTestCount] = useState(0);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => r.json())
      .then(setProgress)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const done = (d.attempts ?? []).filter(
          (a: { status: string; totalScaled: number | null }) =>
            a.status === "completed" && a.totalScaled !== null
        );
        setTestCount(done.length);
        setLastTest(done[0] ?? null);
      })
      .catch(() => {});
  }, []);

  const name = session?.user?.name || session?.user?.email?.split("@")[0] || "there";
  const lessonsCompleted = progress.completedLessonIds.length;
  const mathPercent = Math.round((progress.mathCompleted / MATH_LESSON_IDS.length) * 100);
  const readingPercent = Math.round((progress.readingCompleted / READING_LESSON_IDS.length) * 100);
  const TOTAL_LESSONS = MATH_LESSON_IDS.length + READING_LESSON_IDS.length;
  const totalPercent = Math.round((lessonsCompleted / TOTAL_LESSONS) * 100);
  // One tip per day rather than one per XP total, which changed the "daily" tip
  // every time a student answered a question.
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  const nextTip = SAT_TIPS[dayOfYear % SAT_TIPS.length] ?? SAT_TIPS[0]!;

  const nextMathId = MATH_LESSON_IDS.find((id) => !progress.completedLessonIds.includes(id));
  const nextReadingId = READING_LESSON_IDS.find((id) => !progress.completedLessonIds.includes(id));
  const nextLessonId = nextMathId ?? nextReadingId;
  const nextLesson = nextLessonId ? LESSONS[nextLessonId] : null;

  return (
    <motion.div
      className="max-w-5xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold mb-1 text-sat-gray-900 dark:text-white">
          Welcome back, {name}
        </h1>
        <p className="text-sat-gray-600 dark:text-sat-gray-400 text-base">Track progress, build streaks, and complete your learning path.</p>
      </motion.div>

      {/* Progress tracker */}
      <motion.div className="mb-8 mt-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <ProgressTracker
          xp={progress.totalXP}
          level={progress.level}
          streak={progress.streak.current}
          longestStreak={progress.streak.longest}
          streakAtRisk={progress.streakAtRisk}
          dailyGoal={progress.dailyGoal}
        />
      </motion.div>

      {/* Stats row */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div className="card p-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-sky-500 dark:bg-sky-600 flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-display font-bold text-sat-gray-900 dark:text-white text-sm">Lessons</h3>
          </div>
          <div className="h-1.5 bg-sat-gray-200 dark:bg-sat-gray-700 rounded-full overflow-hidden">
            <motion.div className="h-full bg-sky-500 dark:bg-sky-600" initial={{ width: 0 }} animate={{ width: `${totalPercent}%` }} transition={{ duration: 0.8 }} />
          </div>
          <p className="text-xs text-sat-gray-600 dark:text-sat-gray-400 mt-1">{lessonsCompleted}/{TOTAL_LESSONS} done</p>
        </motion.div>
        <motion.div className="card p-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-sky-500 dark:bg-sky-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-display font-bold text-sat-gray-900 dark:text-white text-sm">Math</h3>
          </div>
          <div className="h-1.5 bg-sat-gray-200 dark:bg-sat-gray-700 rounded-full overflow-hidden">
            <motion.div className="h-full bg-sky-500 dark:bg-sky-600" initial={{ width: 0 }} animate={{ width: `${mathPercent}%` }} transition={{ duration: 0.8 }} />
          </div>
          <p className="text-xs text-sat-gray-600 dark:text-sat-gray-400 mt-1">{progress.mathCompleted}/{MATH_LESSON_IDS.length} · {mathPercent}%</p>
        </motion.div>
        <motion.div className="card p-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-sky-500 dark:bg-sky-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-display font-bold text-sat-gray-900 dark:text-white text-sm">Reading</h3>
          </div>
          <div className="h-1.5 bg-sat-gray-200 dark:bg-sat-gray-700 rounded-full overflow-hidden">
            <motion.div className="h-full bg-sky-500 dark:bg-sky-600" initial={{ width: 0 }} animate={{ width: `${readingPercent}%` }} transition={{ duration: 0.8 }} />
          </div>
          <p className="text-xs text-sat-gray-600 dark:text-sat-gray-400 mt-1">{progress.readingCompleted}/{READING_LESSON_IDS.length} · {readingPercent}%</p>
        </motion.div>
        <motion.div className="card p-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-500 dark:bg-amber-600 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-display font-bold text-sat-gray-900 dark:text-white text-sm">Overall</h3>
          </div>
          <div className="h-1.5 bg-sat-gray-200 dark:bg-sat-gray-700 rounded-full overflow-hidden">
            <motion.div className="h-full bg-amber-500 dark:bg-amber-600" initial={{ width: 0 }} animate={{ width: `${totalPercent}%` }} transition={{ duration: 0.8 }} />
          </div>
          <p className="text-xs text-sat-gray-600 dark:text-sat-gray-400 mt-1">{lessonsCompleted}/{TOTAL_LESSONS} · {totalPercent}%</p>
        </motion.div>
      </div>

      {/* Latest full-test score */}
      <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
        {lastTest ? (
          <Link href={`/history/${lastTest.id}`} className="block">
            <div className="card p-5 hover:bg-sat-gray-50 dark:hover:bg-sat-gray-700/40 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sat-primary/10 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-sat-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-sat-gray-500 dark:text-sat-gray-400">
                    Latest practice test
                  </p>
                  <p className="font-display font-bold text-2xl text-sat-gray-900 dark:text-white leading-tight">
                    {lastTest.totalScaled}
                    <span className="text-base font-normal text-sat-gray-400"> / 1600</span>
                  </p>
                  <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400">
                    R&amp;W {lastTest.rwScaled} · Math {lastTest.mathScaled}
                    {testCount > 1 && ` · ${testCount} tests taken`}
                  </p>
                </div>
                <span className="ml-auto text-sm text-sky-600 dark:text-sky-400 hidden sm:flex items-center gap-1">
                  Review answers <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>
        ) : (
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sat-gray-100 dark:bg-sat-gray-700 flex items-center justify-center shrink-0">
              <FileQuestion className="w-5 h-5 text-sat-gray-400" />
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-sat-gray-900 dark:text-white">
                No practice test yet
              </p>
              <p className="text-sm text-sat-gray-600 dark:text-sat-gray-400">
                Sit a full-length test to get a score estimate and a breakdown of every question.
              </p>
            </div>
            <Link href="/full-test" className="btn-primary text-sm py-2 px-4 ml-auto whitespace-nowrap">
              Start
            </Link>
          </div>
        )}
      </motion.div>

      {/* ── Activity + Tip ── */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <motion.div className="lg:col-span-2 card p-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33 }}>
          <h2 className="font-display font-semibold text-base mb-3 flex items-center gap-2 text-sat-gray-900 dark:text-white">
            <Clock className="w-4 h-4 text-sat-gray-500 dark:text-sat-gray-400" />
            Recent Activity
          </h2>
          {progress.lastCompleted.length > 0 ? (
            <ul className="space-y-3">
              {progress.lastCompleted.map((item, i) => (
                <li key={i} className="flex items-center gap-3 py-2 border-b border-sat-gray-100 dark:border-sat-gray-700 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="font-medium text-sat-gray-800 dark:text-white">{item.title}</span>
                  <span className="text-xs text-sat-gray-500 dark:text-sky-300 ml-auto">Completed</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sat-gray-500 dark:text-sky-300 py-6">No lessons completed yet. Go to the <Link href="/lessons" className="text-sky-600 dark:text-sky-400 font-medium hover:underline">Lessons</Link> tab to start!</p>
          )}
        </motion.div>
        <motion.div className="card p-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
          <h2 className="font-display font-semibold text-base mb-3 flex items-center gap-2 text-sat-gray-900 dark:text-white">
            <Lightbulb className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            SAT Tip
          </h2>
          <p className="text-sm text-sat-gray-700 dark:text-sat-gray-300 leading-relaxed">{nextTip}</p>
        </motion.div>
      </div>

      {/* Next lesson CTA */}
      {nextLesson && (
        <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.39 }}>
          <Link href={`/learn/${nextLessonId}`} className="block">
            <div className="card p-4 border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/30 hover:bg-sky-100/50 dark:hover:bg-sky-900/30 transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-sky-500 dark:bg-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <ArrowRight className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-sky-600 dark:text-sky-400">Next lesson</p>
                    <h3 className="font-display font-bold text-lg text-sat-gray-900 dark:text-white">{nextLesson.title}</h3>
                    <p className="text-sat-gray-600 dark:text-sat-gray-400 text-sm">+{nextLesson.xpReward} XP</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-sky-500 dark:text-sky-400 opacity-70 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* Action buttons */}
      <motion.div className="flex flex-col sm:flex-row gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }}>
        <Link href="/lessons">
          <motion.span className="btn-secondary inline-flex items-center gap-2 justify-center" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <BookOpen className="w-5 h-5" />
            Lessons
          </motion.span>
        </Link>
        <Link href="/practice">
          <motion.span className="btn-secondary inline-flex items-center gap-2 justify-center" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Target className="w-5 h-5" />
            Practice Questions
          </motion.span>
        </Link>
        <Link href="/history">
          <motion.span className="btn-secondary inline-flex items-center gap-2 justify-center" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <History className="w-5 h-5" />
            Your Results
          </motion.span>
        </Link>
      </motion.div>
    </motion.div>
  );
}
