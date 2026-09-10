/**
 * Deciding whether a task reminder is due, for the cron that fires them when the
 * planner tab is shut.
 *
 * A reminder is a local wall-clock string ("2026-09-01T09:00") with no offset,
 * exactly as the planner stores it -- nine in the morning wherever the student
 * is. The server has no wall clock of its own that means anything to the
 * student, so it reads the current instant *through* the student's IANA time
 * zone and compares the two wall-clock strings. That sidesteps every offset and
 * DST calculation: both sides are the same zone's wall clock, so a plain string
 * compare orders them correctly.
 *
 * Kept free of any database or network import so `npm run check` can exercise it.
 */

/** Used when a subscription reported no zone, or an unusable one. */
export const DEFAULT_TIME_ZONE = "America/Toronto";

/**
 * A reminder this far past its time is not worth firing -- the student has long
 * since seen the task, and a burst of hours-old alerts after the cron catches up
 * from an outage is worse than silence. It is still marked fired so it does not
 * get re-examined every run.
 */
export const REMINDER_STALE_HOURS = 48;

const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    // Throws RangeError for an unknown zone.
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * `date` as it would read on a wall clock in `timeZone`, formatted the same way
 * the planner writes a reminder ("YYYY-MM-DDTHH:mm").
 */
export function wallClockInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  let hour = pick("hour");
  // Some ICU builds render local midnight as "24" rather than "00".
  if (hour === "24") hour = "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${hour}:${pick("minute")}`;
}

/**
 * Both arguments are the same zone's wall clock, so reading them as if they were
 * UTC gives a wrong instant but a correct *difference* -- the offset cancels.
 * Only ever used for the staleness gap.
 */
function wallClockGapMs(laterWall: string, earlierWall: string): number {
  return Date.parse(`${laterWall}:00Z`) - Date.parse(`${earlierWall}:00Z`);
}

export type ReminderStatus = "pending" | "due" | "stale";

/**
 * - `pending`: its wall-clock time has not arrived in the student's zone yet.
 * - `due`: it is time (or was, within the staleness window) -- send it.
 * - `stale`: too far overdue to be useful -- mark it fired, send nothing.
 */
export function reminderStatus(
  reminder: string,
  timeZone: string,
  now: Date = new Date()
): ReminderStatus {
  if (!WALL_CLOCK.test(reminder)) return "stale"; // unusable; retire it
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const nowWall = wallClockInZone(now, zone);
  if (reminder > nowWall) return "pending";
  if (wallClockGapMs(nowWall, reminder) > REMINDER_STALE_HOURS * 3_600_000) {
    return "stale";
  }
  return "due";
}
