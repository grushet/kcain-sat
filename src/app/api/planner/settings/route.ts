import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/api-auth";
import { corsJson, plannerPreflight } from "@/lib/planner-cors";

export const dynamic = "force-dynamic";

export const OPTIONS = plannerPreflight;

const VIEW_KEYS = new Set(["", "date", "importance"]);
const POMO_MODES = new Set(["work", "short", "long"]);

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function view(value: unknown): string | undefined {
  return typeof value === "string" && VIEW_KEYS.has(value) ? value : undefined;
}

/**
 * View preferences and the pomodoro, in one row per user.
 *
 * Everything is optional: the client sends only what changed. The old build
 * wrote the whole timer to the database on every tick, which is one write per
 * second per running timer -- enough to burn a day's quota in a dozen sessions.
 * Now the client only calls this when a period actually changes.
 */
export async function PUT(req: Request) {
  const userId = await currentUserId();
  if (!userId) return corsJson(req, { error: "Not signed in" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return corsJson(req, { error: "Malformed JSON" }, { status: 400 });
  }

  const prefs = (body.prefs ?? {}) as Record<string, unknown>;
  const settings = (body.pomodoroSettings ?? {}) as Record<string, unknown>;
  const state = (body.pomodoroState ?? {}) as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if ("groupBy" in prefs) data.groupBy = view(prefs.groupBy);
  if ("sortBy" in prefs) data.sortBy = view(prefs.sortBy);

  if ("work" in settings) data.pomoWork = clampInt(settings.work, 1, 90, 25);
  if ("short" in settings) data.pomoShort = clampInt(settings.short, 1, 30, 5);
  if ("long" in settings) data.pomoLong = clampInt(settings.long, 1, 60, 15);
  if ("sessions" in settings) data.pomoSessions = clampInt(settings.sessions, 1, 12, 4);

  if ("mode" in state && typeof state.mode === "string" && POMO_MODES.has(state.mode)) {
    data.pomoMode = state.mode;
  }
  if ("remaining" in state) data.pomoRemaining = clampInt(state.remaining, 0, 90 * 60, 25 * 60);
  if ("currentSession" in state) {
    data.pomoCurrentSession = clampInt(state.currentSession, 0, 1000, 0);
  }
  if ("runningSince" in state) {
    const raw = state.runningSince;
    if (raw === null) {
      data.pomoRunningSince = null;
    } else if (typeof raw === "string") {
      const parsed = new Date(raw);
      data.pomoRunningSince = Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  // A key present but invalid resolves to undefined above; drop it rather than
  // writing undefined over a good stored value.
  for (const key of Object.keys(data)) {
    if (data[key] === undefined) delete data[key];
  }

  if (Object.keys(data).length === 0) {
    return corsJson(req, { ok: true, changed: 0 });
  }

  try {
    await prisma.plannerSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  } catch (err) {
    // As in the tasks route: an unguarded throw becomes a CORS-less 500 that
    // the browser will not let the planner read.
    console.error("[planner] settings write failed", err);
    return corsJson(req, { error: "Could not save settings" }, { status: 500 });
  }

  return corsJson(req, { ok: true, changed: Object.keys(data).length });
}
