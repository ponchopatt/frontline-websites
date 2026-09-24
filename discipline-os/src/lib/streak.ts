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
}

export interface DayScore {
  date: LocalDate;
  /** Keep My Word, 0–100. */
  score: number;
  /** True when the score is the one stored by Complete Day. */
  locked: boolean;
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
  if (s.completed_at && s.final_score !== null) {
    return { date: s.local_date, score: s.final_score, locked: true };
  }
  return {
    date: s.local_date,
    score: keepWord(summaryToTally(s, workTargetHours)).percent ?? 0,
    locked: false,
  };
}

export interface Streaks {
  current: number;
  best: number;
}

/**
 * A streak is consecutive days scoring at or above the threshold.
 *
 * `days` must be every day up to and including `today`, oldest first. Today only adds to the
 * streak once it reaches the threshold; until then it is still in progress, so the streak
 * shown is the one that ran to yesterday. A missed day ends a streak and changes nothing else.
 */
export function computeStreaks(days: DayScore[], threshold: number, today: LocalDate): Streaks {
  let best = 0;
  let run = 0;
  for (const day of days) {
    if (day.date > today) break;
    run = day.score >= threshold ? run + 1 : 0;
    if (run > best) best = run;
  }

  let current = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const day = days[i];
    if (day.date > today) continue;
    if (day.score >= threshold) {
      current += 1;
      continue;
    }
    if (day.date === today) continue; // today is not over yet
    break;
  }

  return { current, best };
}
