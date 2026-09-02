import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import {
  isPracticeDifficulty,
  isPracticeTopicSlug,
  practiceTopicLabel,
} from "@/lib/practice-topics";

export const dynamic = "force-dynamic";

/**
 * Opens a practice run. Practice has no finish button and a student can close
 * the tab on any question, so the session is created when they start and its
 * counters move with each answer rather than being written once at the end.
 */
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!isPracticeTopicSlug(body.topicSlug)) {
    return NextResponse.json({ error: "Unknown topic" }, { status: 400 });
  }

  const difficulty = isPracticeDifficulty(body.difficulty) ? body.difficulty : "all";
  const totalQuestions =
    Number.isInteger(body.totalQuestions) && body.totalQuestions > 0
      ? Math.min(body.totalQuestions as number, 200)
      : 0;

  const session = await prisma.practiceSession.create({
    data: {
      userId,
      topicSlug: body.topicSlug,
      topicLabel: practiceTopicLabel(body.topicSlug),
      difficulty,
      totalQuestions,
    },
    select: { id: true },
  });

  return NextResponse.json({ sessionId: session.id });
}
