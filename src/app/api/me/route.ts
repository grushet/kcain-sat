import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import { isTimeMultiplier } from "@/lib/test-attempt";

export const dynamic = "force-dynamic";

/** The signed-in student's own account settings: extended time and account deletion. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timeMultiplier: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ timeMultiplier: user.timeMultiplier });
}

export async function PATCH(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !isTimeMultiplier(body.timeMultiplier)) {
    return NextResponse.json({ error: "timeMultiplier must be 1, 1.5, or 2" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { timeMultiplier: body.timeMultiplier },
    select: { timeMultiplier: true },
  });

  return NextResponse.json({ timeMultiplier: user.timeMultiplier });
}

/**
 * Deletes the signed-in student's account and everything tied to it. Every
 * child model cascades from User in the schema, so this one delete is enough;
 * see the handover note listing what was verified to cascade.
 */
export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
