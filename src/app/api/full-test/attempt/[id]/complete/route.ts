import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import { ATTEMPT_INCLUDE, hydrateAttempt, scoreAttempt } from "@/lib/attempt-service";
import { grantMany } from "@/lib/xp-service";
import { XP, XP_SOURCE, xpLabel } from "@/lib/xp";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Closes out a sitting and writes its scores. Everything is recomputed from the
 * stored modules rather than read off the request, so the number a student sees
 * is the number the answers actually earned.
 *
 * Safe to call twice: a second call on an already completed attempt returns the
 * same record instead of rescoring or paying out again, which matters because
 * this fires from a results screen the student can land on more than once.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attempt = await prisma.testAttempt.findFirst({
    where: { id: params.id, userId },
    include: ATTEMPT_INCLUDE,
  });
  if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = await hydrateAttempt(attempt);

  if (attempt.status === "completed") {
    return NextResponse.json({ attempt: payload, alreadyCompleted: true, xp: null });
  }

  const scores = scoreAttempt(payload);

  // The best of everything finished before this one. Read before the update, so
  // the attempt being scored cannot be its own previous best.
  const previousBest = await prisma.testAttempt.aggregate({
    where: { userId, status: "completed", id: { not: attempt.id } },
    _max: { totalScaled: true },
  });
  const bestBefore = previousBest._max.totalScaled;
  const isPersonalBest = bestBefore === null || scores.totalScaled > bestBefore;

  const updated = await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "completed",
      phase: "results",
      completedAt: new Date(),
      ...scores,
    },
    include: ATTEMPT_INCLUDE,
  });

  // Sitting all four modules is the achievement; beating your own best is the
  // bonus. A bonus keyed to the absolute score instead would pay the least to
  // the students with the most to gain, so improvement is what gets rewarded.
  const xp = await grantMany(userId, [
    {
      amount: XP.testComplete,
      source: XP_SOURCE.testComplete,
      reference: attempt.id,
      scope: "once",
    },
    ...(isPersonalBest
      ? [
          {
            amount: XP.testPersonalBest,
            source: XP_SOURCE.testPersonalBest,
            reference: attempt.id,
            scope: "once" as const,
          },
        ]
      : []),
  ]);

  // The modules were each paid as they were handed in; they are listed here so
  // the results screen can show the whole sitting's earnings in one place.
  const moduleXP = await prisma.xPRecord.aggregate({
    where: { userId, source: XP_SOURCE.testModule, reference: { startsWith: `${attempt.id}:` } },
    _sum: { amount: true },
  });
  const modulesEarned = moduleXP._sum.amount ?? 0;

  return NextResponse.json({
    attempt: await hydrateAttempt(updated),
    alreadyCompleted: false,
    xp: {
      total: xp.total + modulesEarned,
      streak: xp.streak,
      isPersonalBest,
      previousBest: bestBefore,
      awards: [
        ...(modulesEarned > 0
          ? [{ source: XP_SOURCE.testModule, label: xpLabel(XP_SOURCE.testModule), amount: modulesEarned }]
          : []),
        ...xp.awards.map((a) => ({ source: a.source, label: xpLabel(a.source), amount: a.amount })),
      ],
    },
  });
}
