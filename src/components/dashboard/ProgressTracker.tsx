"use client";

import { Flame, Target, Trophy, Star, Check } from "lucide-react";
import { motion } from "framer-motion";
import type { LevelInfo } from "@/lib/xp";

interface ProgressTrackerProps {
  xp: number;
  level: LevelInfo;
  streak: number;
  longestStreak: number;
  streakAtRisk: boolean;
  dailyGoal: { target: number; earned: number; completed: boolean };
}

/**
 * The four numbers a student sees first.
 *
 * Two of them used to be decoration. The daily goal was fed a hardcoded zero, so
 * it read "0/20 XP" with an empty bar every day forever, and the level came from
 * a flat 50-XP-per-level curve that put finishing every lesson at level 40 and
 * kept climbing past 100. Both now come from real numbers.
 */
export function ProgressTracker({
  xp,
  level,
  streak,
  longestStreak,
  streakAtRisk,
  dailyGoal,
}: ProgressTrackerProps) {
  const dailyPercent = Math.min(
    100,
    dailyGoal.target > 0 ? Math.round((dailyGoal.earned / dailyGoal.target) * 100) : 0
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Level, with the bar to the next one. The reason to keep going. */}
      <Card
        icon={Star}
        iconClasses="bg-sat-primary"
        label={`Level ${level.level}`}
        value={`${level.into}/${level.span}`}
        caption={`${level.toNext} XP to level ${level.level + 1}`}
        barPercent={level.percent}
        barClasses="bg-sat-primary"
        delay={0}
      />

      {/* Streak, with the state that actually drives the habit. */}
      <Card
        icon={Flame}
        iconClasses={streak > 0 ? "bg-amber-500 dark:bg-amber-600" : "bg-sat-gray-400 dark:bg-sat-gray-600"}
        label="Streak"
        value={`${streak} ${streak === 1 ? "day" : "days"}`}
        caption={
          streakAtRisk
            ? "Study today to keep it"
            : streak > 0 && streak === longestStreak
            ? "Your best run yet"
            : longestStreak > 0
            ? `Best: ${longestStreak} days`
            : "Start one today"
        }
        captionClasses={
          streakAtRisk ? "text-amber-600 dark:text-amber-400 font-medium" : undefined
        }
        delay={0.05}
      />

      {/* Daily goal, finally connected to something. */}
      <Card
        icon={dailyGoal.completed ? Check : Target}
        iconClasses={
          dailyGoal.completed ? "bg-green-500 dark:bg-green-600" : "bg-sky-500 dark:bg-sky-600"
        }
        label="Daily goal"
        value={`${dailyGoal.earned}/${dailyGoal.target} XP`}
        caption={dailyGoal.completed ? "Done for today" : `${dailyGoal.target - dailyGoal.earned} XP to go`}
        captionClasses={
          dailyGoal.completed ? "text-green-600 dark:text-green-400 font-medium" : undefined
        }
        barPercent={dailyPercent}
        barClasses={
          dailyGoal.completed ? "bg-green-500 dark:bg-green-600" : "bg-sky-500 dark:bg-sky-600"
        }
        delay={0.1}
      />

      <Card
        icon={Trophy}
        iconClasses="bg-sky-500 dark:bg-sky-600"
        label="Total XP"
        value={xp.toLocaleString()}
        caption="Across every activity"
        delay={0.15}
      />
    </div>
  );
}

function Card({
  icon: Icon,
  iconClasses,
  label,
  value,
  caption,
  captionClasses,
  barPercent,
  barClasses,
  delay,
}: {
  icon: typeof Flame;
  iconClasses: string;
  label: string;
  value: string;
  caption: string;
  captionClasses?: string;
  barPercent?: number;
  barClasses?: string;
  delay: number;
}) {
  return (
    <motion.div
      className="card p-4 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className={`w-10 h-10 rounded-xl ${iconClasses} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-xs text-sat-gray-600 dark:text-sat-gray-400 mb-0.5">{label}</p>
      <p className="font-display font-bold text-xl text-sat-gray-900 dark:text-white">{value}</p>
      <p
        className={`text-xs mt-0.5 ${
          captionClasses ?? "text-sat-gray-500 dark:text-sat-gray-400"
        }`}
      >
        {caption}
      </p>
      {barPercent !== undefined && (
        <div className="mt-3 h-2 bg-sat-gray-200 dark:bg-sat-gray-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${barClasses}`}
            initial={{ width: 0 }}
            animate={{ width: `${barPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      )}
    </motion.div>
  );
}
