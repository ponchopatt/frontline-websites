import type { WorkArea } from "./areas";
import { formatDuration } from "./day";
import { formatValue } from "./goals/format";
import type { RecordEvent } from "./history";

/**
 * Close Day: the day's numbers, what it achieved, and the one line under them. Stored with
 * the day when it's closed, so the summary never changes afterwards.
 */

export interface Tally {
  done: number;
  total: number;
}

export interface CloseInput {
  made: number;
  kept: number;
  percent: number;
  threshold: number;
  workMinutes: number;
  workTargetMinutes: number;
  byArea: Partial<Record<WorkArea, number>>;
  tasks: Tally;
  big3: Tally;
  habits: Tally;
  morning: Tally;
  /** Bible, Journal and Prayer ticked. */
  faithDone: number;
  faithTotal: number;
  gym: boolean;
  cardio: boolean;
  cardioMinutes: number;
  counters: Array<{ label: string; unit: string | null; value: number; target: number | null }>;
  reviewDone: boolean;
  minimum: "on" | "secured" | null;
  records: RecordEvent[];
}

export type Verdict = "kept" | "minimum" | "short";

export interface CloseSummary {
  version: 2;
  score: number;
  made: number;
  kept: number;
  /** Commitments made and not kept. */
  broken: number;
  workMinutes: number;
  workTargetMinutes: number;
  byArea: Partial<Record<WorkArea, number>>;
  tasks: Tally;
  habits: Tally;
  achievements: string[];
  records: RecordEvent[];
  minimum: "on" | "secured" | null;
  verdict: Verdict;
}

export function closeSummary(i: CloseInput): CloseSummary {
  const a: string[] = [];
  if (i.workTargetMinutes > 0 && i.workMinutes >= i.workTargetMinutes) a.push(`Work target hit: ${formatDuration(i.workMinutes)}`);
  if (i.big3.total > 0 && i.big3.done === i.big3.total) a.push(i.big3.total === 3 ? "Big 3 done" : `Big ${i.big3.total} done`);
  if (i.morning.total > 0 && i.morning.done === i.morning.total) a.push("Morning routine complete");
  if (i.faithTotal > 0 && i.faithDone === i.faithTotal) a.push("Bible, journal and prayer");
  if (i.gym) a.push("Gym");
  if (i.cardio) a.push(i.cardioMinutes > 0 ? `Cardio: ${i.cardioMinutes} min` : "Cardio");
  for (const c of i.counters) {
    if (c.target !== null && c.target > 0 && c.value >= c.target) a.push(`${c.label}: ${formatValue(c.value, c.unit === "$" ? "$" : null)} of ${formatValue(c.target, c.unit === "$" ? "$" : null)}`);
  }
  if (i.reviewDone) a.push("Night review done");
  if (i.minimum === "secured") a.push("Minimum day secured");

  const verdict: Verdict = i.percent >= i.threshold ? "kept" : i.minimum === "secured" ? "minimum" : "short";
  return {
    version: 2,
    score: i.percent,
    made: i.made,
    kept: i.kept,
    broken: Math.max(0, i.made - i.kept),
    workMinutes: Math.round(i.workMinutes),
    workTargetMinutes: i.workTargetMinutes,
    byArea: Object.fromEntries(Object.entries(i.byArea).map(([k, v]) => [k, Math.round(v ?? 0)])) as Partial<Record<WorkArea, number>>,
    tasks: i.tasks,
    habits: i.habits,
    achievements: a,
    records: i.records,
    minimum: i.minimum,
    verdict,
  };
}

/** The line under the numbers. Plain, never a judgement. */
export function verdictLine(v: Verdict, score: number): string {
  if (v === "kept") return "You kept your word today.";
  if (v === "minimum") return "Minimum day secured. You kept the chain alive.";
  return `Closed at ${score}%. Tomorrow starts clean.`;
}

/** A stored breakdown, if it's the full summary (older days only stored made/kept). */
export function asCloseSummary(raw: unknown): CloseSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<CloseSummary>;
  return r.version === 2 && typeof r.score === "number" ? (r as CloseSummary) : null;
}
