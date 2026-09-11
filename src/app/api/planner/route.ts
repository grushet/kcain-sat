import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import { corsJson, plannerPreflight } from "@/lib/planner-cors";

export const dynamic = "force-dynamic";

export const OPTIONS = plannerPreflight;

export interface PlannerSubtaskDTO {
  id: string;
  text: string;
  completed: boolean;
  dueDate: string | null;
  importance: string | null;
}

export interface PlannerTaskDTO {
  id: string;
  text: string;
  completed: boolean;
  dueDate: string | null;
  importance: string | null;
  repeat: { n: number; unit: string } | null;
  reminder: string | null;
  reminderFired: boolean;
  description: string | null;
  pinIndex: number | null;
  subtasks: PlannerSubtaskDTO[];
}

/**
 * Everything the planner needs to draw itself: the task list, the view
 * preferences, and the pomodoro. One request, because the client cannot render
 * anything useful until it has all three.
 */
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return corsJson(req, { error: "Not signed in" }, { status: 401 });

  const [tasks, settings] = await Promise.all([
    prisma.plannerTask.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
      include: { subtasks: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.plannerSettings.findUnique({ where: { userId } }),
  ]);

  return corsJson(req, {
    tasks: tasks.map(
      (t): PlannerTaskDTO => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
        dueDate: t.dueDate,
        importance: t.importance,
        repeat:
          t.repeatN && t.repeatUnit ? { n: t.repeatN, unit: t.repeatUnit } : null,
        reminder: t.reminder,
        reminderFired: t.reminderFired,
        description: t.description,
        pinIndex: t.pinIndex,
        subtasks: t.subtasks.map((s) => ({
          id: s.id,
          text: s.text,
          completed: s.completed,
          dueDate: s.dueDate,
          importance: s.importance,
        })),
      })
    ),
    prefs: {
      groupBy: settings?.groupBy ?? "",
      sortBy: settings?.sortBy ?? "",
    },
    pomodoro: {
      settings: {
        work: settings?.pomoWork ?? 25,
        short: settings?.pomoShort ?? 5,
        long: settings?.pomoLong ?? 15,
        sessions: settings?.pomoSessions ?? 4,
      },
      state: {
        mode: settings?.pomoMode ?? "work",
        remaining: settings?.pomoRemaining ?? 25 * 60,
        currentSession: settings?.pomoCurrentSession ?? 0,
        runningSince: settings?.pomoRunningSince?.toISOString() ?? null,
      },
    },
  });
}
