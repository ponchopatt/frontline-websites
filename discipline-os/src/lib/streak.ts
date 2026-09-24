import type { LocalDate } from "./day";
import { keepWord, type WordTally } from "./keep-word";

/** One row of public.day_summaries(): the counts behind a day's Keep My Word. */
export interface DaySummary {
  local_date: LocalDate;
  habits_total: number;
  habits_done: number;
  tasks_total: number;
  tasks_done: number;
  review_done: number;
  work_minutes: number;
  final_score: number | null;
  completed_at: string | null;
  /** Minimum Day was switched on. */
  minimum_on: boolean;
  /** The minimum day's items that day, and how many were done. */
  minimum_total: number;
  minimum_done: number;
}

export interface DayScore {
  date: LocalDate;
  /** Keep My Word, 0–100. */
  score: number;
  /** True when the score is the one stored by Close Day. */
  locked: boolean;
  /** Minimum Day was on: "on" while its items are open, "secured" once they're all done. */
  minimum: "on" | "secured" | null;
}

/** Whether a day keeps the Keep My Word streak going: on the line, or a secured minimum day. */
export function keepsChain(day: DayScore, threshold: number): boolean {
  return day.score >= threshold || day.minimum === "secured";
}

export function minimumState(s: Pick<DaySummary, "minimum_on" | "minimum_total" | "minimum_done">): DayScore["minimum"] {
  if (!s.minimum_on) return null;
  return s.minimum_total > 0 && s.minimum_done >= s.minimum_total ? "secured" : "on";
}

export function summaryToTally(s: DaySummary, workTargetHours: number): WordTally {
  return {
    habitsDone: s.habits_done,
    habitsTotal: s.habits_total,
    tasksDone: s.tasks_done,
    tasksTotal: s.tasks_total,
    reviewDone: s.review_done > 0,
    workMinutes: Number(s.work_minutes),
    workTargetMinutes: workTargetHours * 60,
  };
}

/**
 * A completed day keeps the number it was completed with, so editing your habit list later
 * never rewrites history. Any other day is worked out from what is stored for it.
 */
export function scoreForSummary(s: DaySummary, workTargetHours: number): DayScore {
  const minimum = minimumState(s);
  if (s.completed_at && s.final_score !== null) {
    return { date: s.local_date, score: s.final_score, locked: true, minimum };
  }
  return {
    date: s.local_date,
    score: keepWord(summaryToTally(s, workTargetHours)).percent ?? 0,
    locked: false,
    minimum,
  };
}

export interface Streaks {
  current: number;
  best: number;
}

/**
 * A streak is consecutive days scoring at or above the threshold. A secured minimum day keeps
 * it going too: one bad day doesn't have to become a bad week.
 *
 * `days` must be every day up to and including `today`, oldest first. Today only adds to the
 * streak once it reaches the threshold; until then it is still in progress, so the streak
 * shown is the one that ran to yesterday. Once today is closed below the line it's a missed
 * day. A missed day ends a streak and changes nothing else.
 */
export function computeStreaks(days: DayScore[], threshold: number, today: LocalDate): Streaks {
  let best = 0;
  let run = 0;
  for (const day of days) {
    if (day.date > today) break;
    run = keepsChain(day, threshold) ? run + 1 : 0;
    if (run > best) best = run;
  }

  let current = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const day = days[i];
    if (day.date > today) continue;
    if (keepsChain(day, threshold)) {
      current += 1;
      continue;
    }
    if (day.date === today && !day.locked) continue; // an open today is not over yet
    break;
  }

  return { current, best };
}
