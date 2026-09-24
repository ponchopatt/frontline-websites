import type { Area } from "./areas";
import { detectArea } from "./areas";
import { addDays, isoWeekday, startOfWeek, type LocalDate } from "./day";

/**
 * Counters: the numbers the businesses run on (leads called, cold calls, revenue). One entry
 * per counter per day; weeks, months and years are sums of days, so nothing is entered twice.
 */

export interface Metric {
  id: string;
  area: Area;
  key: string;
  label: string;
  grp: string | null;
  unit: string | null;
  /** sum: the day adds to the week. latest: a level, like demos ready to call. */
  aggregation: "sum" | "latest";
  dailyTarget: number | null;
  weeklyTarget: number | null;
  pinned: boolean;
  sortOrder: number;
  /** When the counter was created (an ISO timestamp). */
  createdAt: string;
}

/** Values by day for one counter. */
export type DayValues = Map<LocalDate, number>;

/**
 * A counter over a span: the sum of its days, or for a level the last value entered on or
 * before the span's end (a level carries over until it's changed).
 */
export function totalOver(values: DayValues | undefined, from: LocalDate, to: LocalDate, aggregation: Metric["aggregation"]): number {
  if (!values) return 0;
  if (aggregation === "latest") {
    let best: LocalDate | null = null;
    for (const d of values.keys()) if (d <= to && (best === null || d > best)) best = d;
    return best === null ? 0 : values.get(best) ?? 0;
  }
  let total = 0;
  for (const [d, v] of values) if (d >= from && d <= to) total += v;
  return total;
}

/** Work days from `from` to `to`, both included. */
export function workDaysBetween(from: LocalDate, to: LocalDate, workDays: number[]): number {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (workDays.includes(isoWeekday(d))) n += 1;
  return n;
}

/**
 * A counter's own weekly target for a week it only joined part-way through (a new account on
 * a Thursday): the share for the work days it was there. A full week keeps the whole target.
 */
export function weekShare(weeklyTarget: number | null, weekStart: LocalDate, activeFrom: LocalDate, workDays: number[], unit: string | null): number | null {
  if (weeklyTarget === null || activeFrom <= weekStart) return weeklyTarget;
  const end = addDays(weekStart, 6);
  const all = workDaysBetween(weekStart, end, workDays);
  if (all === 0) return weeklyTarget;
  const share = (weeklyTarget * workDaysBetween(activeFrom, end, workDays)) / all;
  return unit === "$" ? Math.round(share / 10) * 10 : Math.ceil(share);
}

/** Work days from `today` to the end of its week, today included when it's a work day. */
export function workDaysLeft(today: LocalDate, workDays: number[]): number {
  return workDaysBetween(today, addDays(startOfWeek(today), 6), workDays);
}

export interface TargetInput {
  metric: Pick<Metric, "aggregation" | "dailyTarget" | "unit">;
  /** The week's target: from a weekly goal on this counter, else the counter's own. */
  weeklyTarget: number | null;
  /** What was logged this week before today. */
  doneBeforeToday: number;
  today: LocalDate;
  workDays: number[];
}

/**
 * Today's target for a counter. A fixed daily target wins. Otherwise what's left of the week
 * is spread over the work days left, so a slow Monday raises Tuesday's number. No target on a
 * day off, and none for levels.
 */
export function dailyTarget({ metric, weeklyTarget, doneBeforeToday, today, workDays }: TargetInput): number | null {
  if (metric.dailyTarget !== null) return metric.dailyTarget;
  if (metric.aggregation === "latest" || weeklyTarget === null || weeklyTarget <= 0) return null;
  if (!workDays.includes(isoWeekday(today))) return null;
  const left = workDaysLeft(today, workDays);
  const remaining = Math.max(0, weeklyTarget - doneBeforeToday);
  if (remaining === 0 || left === 0) return 0;
  const per = remaining / left;
  return metric.unit === "$" ? Math.ceil(per / 10) * 10 : Math.ceil(per);
}

/** Plain task titles for counters, so a target reads as something to do. */
const TASK_TITLES: Record<string, (n: number) => string> = {
  "imperium.leads_called": (n) => `Call ${n} Imperium ${n === 1 ? "lead" : "leads"}`,
  "imperium.follow_ups": (n) => `Do ${n} Imperium ${n === 1 ? "follow-up" : "follow-ups"}`,
  "imperium.quotes_sent": (n) => `Send ${n} Imperium ${n === 1 ? "quote" : "quotes"}`,
  "imperium.reel_ideas": (n) => `Write ${n} reel ${n === 1 ? "idea" : "ideas"}`,
  "imperium.reels_filmed": (n) => `Film ${n} ${n === 1 ? "reel" : "reels"}`,
  "imperium.reels_posted": (n) => `Post ${n} ${n === 1 ? "reel" : "reels"}`,
  "imperium.before_after": (n) => `Post ${n} before/after`,
  "imperium.stories": (n) => `Post ${n} ${n === 1 ? "story" : "stories"}`,
  "websites.demos_built": (n) => `Build ${n} website ${n === 1 ? "demo" : "demos"}`,
  "websites.cold_calls": (n) => `Make ${n} website cold ${n === 1 ? "call" : "calls"}`,
  "websites.follow_ups": (n) => `Do ${n} website ${n === 1 ? "follow-up" : "follow-ups"}`,
};

/** "Call 10 Imperium leads". Null for counters that are outcomes, not actions (revenue, jobs). */
export function metricTaskTitle(metric: Pick<Metric, "area" | "key">, n: number): string | null {
  return TASK_TITLES[`${metric.area}.${metric.key}`]?.(n) ?? null;
}

export interface QuickTask {
  title: string;
  area: Area | null;
  quantity: number | null;
  /** "imperium.leads_called" when the task is a number on a counter. */
  metric: { area: Area; key: string } | null;
}

const METRIC_WORDS: Array<{ area: Area; key: string; test: RegExp }> = [
  { area: "imperium", key: "leads_called", test: /\bleads?\b/ },
  { area: "imperium", key: "reel_ideas", test: /reel ideas?|ideas? for reels/ },
  { area: "imperium", key: "reels_posted", test: /post\w*\s+(\d+\s+)?reels?|reels?\s+post/ },
  { area: "imperium", key: "reels_filmed", test: /film\w*\s+(\d+\s+)?reels?/ },
  { area: "imperium", key: "quotes_sent", test: /\bquotes?\b/ },
  { area: "imperium", key: "stories", test: /\bstor(y|ies)\b/ },
  { area: "imperium", key: "follow_ups", test: /follow[- ]?ups?/ },
  { area: "websites", key: "cold_calls", test: /\bcalls?\b/ },
  { area: "websites", key: "demos_built", test: /\bdemos?\b/ },
  { area: "websites", key: "follow_ups", test: /follow[- ]?ups?/ },
];

/**
 * Reads a typed task: "Call 10 Imperium leads" → Imperium, 10, the leads counter. The title
 * stays exactly as typed; the rest is a best guess the user can change.
 */
export function parseQuickTask(text: string): QuickTask {
  const title = text.trim().replace(/\s+/g, " ");
  const lower = title.toLowerCase();
  const area = detectArea(title);
  const n = lower.match(/\b(\d{1,5})\b/);
  const quantity = n ? Number(n[1]) : null;
  let metric: QuickTask["metric"] = null;
  if (quantity !== null && (area === "imperium" || area === "websites")) {
    const hit = METRIC_WORDS.find((m) => m.area === area && m.test.test(lower));
    if (hit) metric = { area: hit.area, key: hit.key };
  }
  return { title, area, quantity: metric ? quantity : null, metric };
}
