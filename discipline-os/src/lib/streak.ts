import type { LocalDate } from "./day";
import { BIBLE_ITEMS, REVIEW_ITEMS, computeScore, type ScoreInput } from "./score";

/** One row of public.day_summaries(). */
export interface DaySummary {
  local_date: LocalDate;
  morning_total: number;
  morning_done: number;
  body_total: number;
  body_done: number;
  discipline_total: number;
  discipline_done: number;
  god_total: number;
  god_done: number;
  bible_done: number;
  review_filled: number;
  work_minutes: number;
  final_score: number | null;
  completed_at: string | null;
}

export interface DayScore {
  date: LocalDate;
  score: number;
  /** True when the score is the one stored by Complete Day. */
  locked: boolean;
}

export function summaryToScoreInput(s: DaySummary, workTargetHours: number): ScoreInput {
  return {
    god: { done: s.god_done + s.bible_done, total: s.god_total + BIBLE_ITEMS },
    body: { done: s.body_done, total: s.body_total },
    discipline: {
      done: s.morning_done + s.discipline_done,
      total: s.morning_total + s.discipline_total,
    },
    reflection: { done: s.review_filled, total: REVIEW_ITEMS },
    work: { minutes: Number(s.work_minutes), targetMinutes: workTargetHours * 60 },
  };
}

/**
 * A completed day keeps the score it was completed with, so editing your habit list later
 * never rewrites history. Any other day is scored from what is stored for it.
 */
export function scoreForSummary(s: DaySummary, workTargetHours: number): DayScore {
  if (s.completed_at && s.final_score !== null) {
    return { date: s.local_date, score: s.final_score, locked: true };
  }
  return {
    date: s.local_date,
    score: computeScore(summaryToScoreInput(s, workTargetHours)).score,
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
