import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import { ATTEMPT_INCLUDE, hydrateAttempt } from "@/lib/attempt-service";

export const dynamic = "force-dynamic";

/**
 * The attempt a student is part-way through, if any. This is what makes a
 * refresh, a closed laptop or a dead battery survivable: the page asks for this
 * on load and offers to pick the test back up instead of starting over.
 */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attempt = await prisma.testAttempt.findFirst({
    where: { userId, status: "in_progress" },
    orderBy: { startedAt: "desc" },
    include: ATTEMPT_INCLUDE,
  });

  if (!attempt) return NextResponse.json({ attempt: null });
  return NextResponse.json({ attempt: await hydrateAttempt(attempt) });
}

/**
 * Starts a sitting. Created up front rather than at the results screen, because
 * an attempt that only exists once the student finishes is exactly the thing
 * that used to be lost. Any earlier unfinished attempt is retired first, so a
 * student always has at most one test to resume.
 */
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.testAttempt.updateMany({
    where: { userId, status: "in_progress" },
    data: { status: "abandoned" },
  });

  const attempt = await prisma.testAttempt.create({
    data: { userId, status: "in_progress", phase: "loading" },
    include: ATTEMPT_INCLUDE,
  });

  return NextResponse.json({ attempt: await hydrateAttempt(attempt) });
}
