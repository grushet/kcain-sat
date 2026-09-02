import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import { ATTEMPT_INCLUDE, hydrateAttempt, scoreAttempt } from "@/lib/attempt-service";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Closes out a sitting and writes its scores. Everything is recomputed from the
 * stored modules rather than read off the request, so the number a student sees
 * is the number the answers actually earned.
 *
 * Safe to call twice: a second call on an already completed attempt returns the
 * same record instead of rescoring or erroring, which matters because this fires
 * from a results screen the student can land on more than once.
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
    return NextResponse.json({ attempt: payload, alreadyCompleted: true });
  }

  const scores = scoreAttempt(payload);

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

  return NextResponse.json({
    attempt: await hydrateAttempt(updated),
    alreadyCompleted: false,
  });
}
