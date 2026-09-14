import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCurrentUserAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const CHART_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Signup counts and a recent-user list, for the /admin page. Gated by isCurrentUserAdmin. */
export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  const chartSince = new Date(now - CHART_DAYS * DAY_MS);
  const sevenDaysAgo = new Date(now - 7 * DAY_MS);

  const [total, last7, last30, recentUsers, chartWindowUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: chartSince } } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: chartSince } },
      select: { createdAt: true },
    }),
  ]);

  // Bucket into day strings (UTC) for a simple bar chart.
  const buckets = new Map<string, number>();
  for (let i = 0; i < CHART_DAYS; i++) {
    const key = new Date(chartSince.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    buckets.set(key, 0);
  }
  for (const u of chartWindowUsers) {
    const key = u.createdAt.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return NextResponse.json({
    total,
    last7,
    last30,
    daily: Array.from(buckets.entries()).map(([date, count]) => ({ date, count })),
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
