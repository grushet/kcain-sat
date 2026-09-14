import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import { isTimeMultiplier } from "@/lib/test-attempt";
import { corsJson, plannerPreflight } from "@/lib/planner-cors";

export const dynamic = "force-dynamic";

export const OPTIONS = plannerPreflight;

/**
 * The signed-in student's own account settings: extended time and account
 * deletion. Cross-origin because the planner's "Delete my account" button
 * lives on tasks.cainsat.org and calls this directly.
 */
export async function GET(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timeMultiplier: true },
  });
  if (!user) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  return corsJson(req, { timeMultiplier: user.timeMultiplier });
}

export async function PATCH(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !isTimeMultiplier(body.timeMultiplier)) {
    return corsJson(req, { error: "timeMultiplier must be 1, 1.5, or 2" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { timeMultiplier: body.timeMultiplier },
    select: { timeMultiplier: true },
  });

  return corsJson(req, { timeMultiplier: user.timeMultiplier });
}

/**
 * Deletes the signed-in student's account and everything tied to it. Every
 * child model cascades from User in the schema, so this one delete is enough;
 * see the handover note listing what was verified to cascade.
 */
export async function DELETE(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  await prisma.user.delete({ where: { id: userId } });

  return corsJson(req, { ok: true });
}
