import { addDays, type LocalDate } from "./day";

/**
 * Keep My Word: of everything I said I'd do today, how much did I do?
 *
 *   commitments = habits due today + tasks planned for today + the night review + the work target
 *   kept        = the ones that are done
 *
 * A dropped task still counts as made and not kept: dropping it is a decision, not a do-over.
 * Tasks parked for "later" aren't on any day yet, so they aren't commitments.
 */

export interface WordTally {
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  reviewDone: boolean;
  workMinutes: number;
  workTargetMinutes: number;
}

export interface WordResult {
  made: number;
  kept: number;
  /** 0–100, whole number. Null when nothing was committed to. */
  percent: number | null;
}

export function keepWord(t: WordTally): WordResult {
  const hasWork = t.workTargetMinutes > 0;
  const made = t.habitsTotal + t.tasksTotal + 1 + (hasWork ? 1 : 0);
  const kept =
    Math.min(t.habitsDone, t.habitsTotal) +
    Math.min(t.tasksDone, t.tasksTotal) +
    (t.reviewDone ? 1 : 0) +
    (hasWork && t.workMinutes >= t.workTargetMinutes ? 1 : 0);
  return { made, kept, percent: made === 0 ? null : Math.round((kept / made) * 100) };
}

/** The average of the days so far in a week that have a number. Null when none do. */
export function weekAverage(days: Array<{ date: LocalDate; score: number | null }>, weekStart: LocalDate, today: LocalDate): number | null {
  const end = addDays(weekStart, 6);
  const scored = days.filter((d) => d.date >= weekStart && d.date <= end && d.date <= today && d.score !== null);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((s, d) => s + (d.score ?? 0), 0) / scored.length);
}
