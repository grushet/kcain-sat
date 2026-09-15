"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Users, TrendingUp, Calendar, User, Activity, Radio, ListChecks, PenLine } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";

interface AdminStats {
  total: number;
  last7: number;
  last30: number;
  daily: { date: string; count: number }[];
  recentUsers: { id: string; name: string | null; email: string; image: string | null; createdAt: string }[];
}

interface CountWindow {
  last7: number;
  last30: number;
}

interface UsageStats {
  dau: number;
  wau: number;
  actions: {
    planner: { tasksCreated: CountWindow };
    sat: { practiceSessions: CountWindow; questionsAnswered: CountWindow };
  };
  retention: { date: string; cohortSize: number; day1: number | null; day3: number | null; day7: number | null }[];
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

function pctLabel(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

type Tab = "overview" | "usage";

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);

  const [usageLoading, setUsageLoading] = useState(true);
  const [usage, setUsage] = useState<UsageStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setStats(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch("/api/admin/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setUsage(d);
      })
      .catch(() => {})
      .finally(() => setUsageLoading(false));
  }, []);

  const maxDaily = stats ? Math.max(1, ...stats.daily.map((d) => d.count)) : 1;

  return (
    <motion.div
      className="max-w-5xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <h1 className="text-2xl md:text-3xl font-display font-bold mb-1 text-sat-gray-900 dark:text-white">
        Admin
      </h1>
      <p className="text-sat-gray-600 dark:text-sat-gray-400 text-base mb-6">
        Signups and account activity.
      </p>

      <div className="flex gap-1 mb-6 border-b border-sat-gray-100 dark:border-sat-horizon">
        {([
          ["overview", "Overview"],
          ["usage", "Usage"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-black dark:border-sat-azure text-sat-gray-900 dark:text-white"
                : "border-transparent text-sat-gray-500 dark:text-sat-gray-400 hover:text-sat-gray-900 dark:hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* Stat cards */}
          {loading ? (
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card p-4">
                  <Skeleton className="h-4 w-20 mb-3" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2 text-sat-gray-500 dark:text-sat-gray-400">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-medium">Total signups</span>
                </div>
                <p className="font-display font-bold text-2xl text-sat-gray-900 dark:text-white">
                  {stats?.total ?? 0}
                </p>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2 text-sat-gray-500 dark:text-sat-gray-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium">Last 7 days</span>
                </div>
                <p className="font-display font-bold text-2xl text-sat-gray-900 dark:text-white">
                  {stats?.last7 ?? 0}
                </p>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2 text-sat-gray-500 dark:text-sat-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-medium">Last 30 days</span>
                </div>
                <p className="font-display font-bold text-2xl text-sat-gray-900 dark:text-white">
                  {stats?.last30 ?? 0}
                </p>
              </div>
            </div>
          )}

          {/* Daily chart */}
          <div className="card p-5 mb-8">
            <h2 className="font-display font-semibold text-base mb-4 text-sat-gray-900 dark:text-white">
              Signups, last 30 days
            </h2>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="flex items-end gap-1 h-24">
                {stats?.daily.map((d) => (
                  <div key={d.date} className="flex-1 h-full flex flex-col justify-end group relative">
                    <div
                      className="w-full bg-sky-500 dark:bg-sky-600 rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${(d.count / maxDaily) * 100}%` }}
                    />
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap text-[11px] bg-black text-white rounded px-1.5 py-0.5">
                      {d.date}: {d.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent signups */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-base mb-4 text-sat-gray-900 dark:text-white">
              Recent signups
            </h2>
            {loading ? (
              <ul className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                    <Skeleton className="h-4 w-48" />
                  </li>
                ))}
              </ul>
            ) : stats && stats.recentUsers.length > 0 ? (
              <ul className="space-y-1">
                {stats.recentUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 py-2 border-b border-sat-gray-100 dark:border-sat-gray-700 last:border-0"
                  >
                    {u.image ? (
                      <Image src={u.image} alt="" width={28} height={28} className="w-7 h-7 rounded-lg object-cover shrink-0" unoptimized />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-sat-gray-100 dark:bg-sat-gray-700 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-sat-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-sat-gray-900 dark:text-white truncate">
                        {u.name || u.email}
                      </p>
                      {u.name && <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 truncate">{u.email}</p>}
                    </div>
                    <span className="text-xs text-sat-gray-500 dark:text-sat-gray-400 shrink-0">
                      {formatDate(u.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sat-gray-500 dark:text-sat-gray-400 py-4 text-sm">No signups yet.</p>
            )}
          </div>
        </>
      )}

      {tab === "usage" && (
        <>
          {/* DAU / WAU */}
          {usageLoading ? (
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="card p-4">
                  <Skeleton className="h-4 w-24 mb-3" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2 text-sat-gray-500 dark:text-sat-gray-400">
                  <Activity className="w-4 h-4" />
                  <span className="text-xs font-medium">Daily active users</span>
                </div>
                <p className="font-display font-bold text-2xl text-sat-gray-900 dark:text-white">
                  {usage?.dau ?? 0}
                </p>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2 text-sat-gray-500 dark:text-sat-gray-400">
                  <Radio className="w-4 h-4" />
                  <span className="text-xs font-medium">Weekly active users</span>
                </div>
                <p className="font-display font-bold text-2xl text-sat-gray-900 dark:text-white">
                  {usage?.wau ?? 0}
                </p>
              </div>
            </div>
          )}

          {/* Core action counts, planner vs SAT */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {usageLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card p-4">
                  <Skeleton className="h-4 w-28 mb-3" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ))
            ) : (
              <>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2 text-sat-gray-500 dark:text-sat-gray-400">
                    <ListChecks className="w-4 h-4" />
                    <span className="text-xs font-medium">Planner · tasks created</span>
                  </div>
                  <p className="font-display font-bold text-2xl text-sat-gray-900 dark:text-white">
                    {usage?.actions.planner.tasksCreated.last7 ?? 0}
                  </p>
                  <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mt-1">
                    last 7 days · {usage?.actions.planner.tasksCreated.last30 ?? 0} in 30
                  </p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2 text-sat-gray-500 dark:text-sat-gray-400">
                    <PenLine className="w-4 h-4" />
                    <span className="text-xs font-medium">SAT · practice sessions</span>
                  </div>
                  <p className="font-display font-bold text-2xl text-sat-gray-900 dark:text-white">
                    {usage?.actions.sat.practiceSessions.last7 ?? 0}
                  </p>
                  <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mt-1">
                    last 7 days · {usage?.actions.sat.practiceSessions.last30 ?? 0} in 30
                  </p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2 text-sat-gray-500 dark:text-sat-gray-400">
                    <PenLine className="w-4 h-4" />
                    <span className="text-xs font-medium">SAT · questions answered</span>
                  </div>
                  <p className="font-display font-bold text-2xl text-sat-gray-900 dark:text-white">
                    {usage?.actions.sat.questionsAnswered.last7 ?? 0}
                  </p>
                  <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mt-1">
                    last 7 days · {usage?.actions.sat.questionsAnswered.last30 ?? 0} in 30
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Retention */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-base mb-1 text-sat-gray-900 dark:text-white">
              Retention by signup cohort
            </h2>
            <p className="text-xs text-sat-gray-500 dark:text-sat-gray-400 mb-4">
              Of everyone who signed up that day, the percent seen again on or after day 1 / 3 / 7. Cohorts too
              recent to know yet show as “—”.
            </p>
            {usageLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : usage && usage.retention.some((r) => r.cohortSize > 0) ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-sat-gray-500 dark:text-sat-gray-400 border-b border-sat-gray-100 dark:border-sat-gray-700">
                      <th className="py-2 pr-4 font-medium">Cohort</th>
                      <th className="py-2 pr-4 font-medium">Signups</th>
                      <th className="py-2 pr-4 font-medium">Day 1</th>
                      <th className="py-2 pr-4 font-medium">Day 3</th>
                      <th className="py-2 pr-4 font-medium">Day 7</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.retention
                      .filter((r) => r.cohortSize > 0)
                      .slice()
                      .reverse()
                      .map((r) => (
                        <tr
                          key={r.date}
                          className="border-b border-sat-gray-100 dark:border-sat-gray-700 last:border-0"
                        >
                          <td className="py-2 pr-4 text-sat-gray-900 dark:text-white whitespace-nowrap">
                            {formatShortDate(r.date)}
                          </td>
                          <td className="py-2 pr-4 text-sat-gray-600 dark:text-sat-gray-400">{r.cohortSize}</td>
                          <td className="py-2 pr-4 text-sat-gray-900 dark:text-white">{pctLabel(r.day1)}</td>
                          <td className="py-2 pr-4 text-sat-gray-900 dark:text-white">{pctLabel(r.day3)}</td>
                          <td className="py-2 pr-4 text-sat-gray-900 dark:text-white">{pctLabel(r.day7)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sat-gray-500 dark:text-sat-gray-400 py-4 text-sm">No cohorts yet.</p>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
