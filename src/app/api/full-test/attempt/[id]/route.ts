import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import { ATTEMPT_INCLUDE, hydrateAttempt } from "@/lib/attempt-service";
import { isPhase } from "@/lib/test-attempt";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** One attempt in full, used both to resume a test and to review a finished one. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attempt = await prisma.testAttempt.findFirst({
    where: { id: params.id, userId },
    include: ATTEMPT_INCLUDE,
  });
  if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ attempt: await hydrateAttempt(attempt) });
}

/** Records which screen the student is on, so a resume lands in the right place. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: { phase?: string; status?: string } = {};
  if (isPhase(body.phase)) data.phase = body.phase;
  if (body.status === "abandoned") data.status = "abandoned";
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // A finished attempt is a record, not a draft: scoping the update to
  // in_progress stops a late autosave from reopening or rewriting it.
  const result = await prisma.testAttempt.updateMany({
    where: { id: params.id, userId, status: "in_progress" },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

/** Gives up on a test in progress, so the page stops offering to resume it. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.testAttempt.updateMany({
    where: { id: params.id, userId, status: "in_progress" },
    data: { status: "abandoned" },
  });

  return NextResponse.json({ ok: true });
}
