"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Users, TrendingUp, Calendar, User, ShieldOff } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";

interface AdminStats {
  total: number;
  last7: number;
  last30: number;
  daily: { date: string; count: number }[];
  recentUsers: { id: string; name: string | null; email: string; image: string | null; createdAt: string }[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (d) setStats(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (forbidden) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <ShieldOff className="w-10 h-10 mx-auto mb-3 text-sat-gray-400" />
        <h1 className="font-display font-bold text-xl text-sat-gray-900 dark:text-white mb-1">
          Not authorized
        </h1>
        <p className="text-sat-gray-600 dark:text-sat-gray-400 text-sm mb-4">
          This page is restricted to the site admin.
        </p>
        <button onClick={() => router.push("/dashboard")} className="btn-secondary">
          Back to dashboard
        </button>
      </div>
    );
  }

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
              <div key={d.date} className="flex-1 group relative">
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
    </motion.div>
  );
}
