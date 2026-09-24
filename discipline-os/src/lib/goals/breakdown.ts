import { daysBetween, type LocalDate } from "../day";
import { formatValue } from "./format";
import type { Aggregation, Cadence, GoalType, MonthlyGoal, ProgressSource, YearlyGoal } from "./model";
import { isNumeric } from "./model";
import {
  addMonths,
  daysInMonth,
  monthEndOf,
  monthLabel,
  monthStartOf,
  weekEndOf,
  weeksOfMonth,
} from "./periods";

/**
 * Suggested breakdowns. Year → months and month → weeks, as editable drafts: nothing is saved
 * until the user approves it.
 *
 * Numbers are shaped, not just divided: cumulative results ramp up (a business grows into its
 * target), levels climb in steps that front-load the easy gains, and rates become the right
 * total for each month or week.
 */

export interface DraftGoal {
  key: string;
  /** monthStart for a month draft, weekStart (Monday) for a week draft. */
  periodStart: LocalDate;
  title: string;
  goalType: GoalType;
  unit: string | null;
  metric: string | null;
  cadence: Cadence;
  aggregation: Aggregation;
  progressSource: ProgressSource;
  startValue: number | null;
  targetValue: number | null;
  /** Weekly drafts: a major outcome, or a supporting task under one. */
  isMajor: boolean;
  /** Suggested, but left unticked until the user opts in. */
  optional: boolean;
  why: string | null;
  /** The counter it's measured by: its id when known, or its key within the goal's business. */
  metricId: string | null;
  metricKey: string | null;
}

/* ------------------------------------------------------------------ rounding */

/** A step that suits the size of the number: 2.5 kg plates, $500 for revenue, whole units otherwise. */
export function niceStep(value: number, unit: string | null): number {
  const u = (unit ?? "").trim().toLowerCase();
  if (u === "kg") return 2.5;
  if (u === "lb" || u === "lbs") return 5;
  const a = Math.abs(value);
  if (u === "$") {
    if (a >= 100_000) return 5000;
    if (a >= 20_000) return 1000;
    if (a >= 2000) return 500;
    if (a >= 200) return 50;
    return 1;
  }
  if (a >= 5000) return 100;
  if (a >= 500) return 10;
  if (a >= 50) return 5;
  if (a >= 3) return 1;
  return 0.5;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Splits `total` across weights, rounding each share to a nice step and letting the last
 * share absorb the rounding so the parts always add back to the total exactly.
 */
export function distribute(total: number, weights: number[], unit: string | null): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((s, w) => s + w, 0);
  const step = niceStep(total / weights.length, unit);
  const parts = weights.map((w) => roundTo((total * w) / sum, step));
  const drift = total - parts.reduce((s, p) => s + p, 0);
  parts[parts.length - 1] = Math.round((parts[parts.length - 1] + drift) * 100) / 100;
  return parts;
}

/** Linear ramp from 1 to `last` across n steps. */
function ramp(n: number, last: number): number[] {
  if (n === 1) return [1];
  return Array.from({ length: n }, (_, i) => 1 + ((last - 1) * i) / (n - 1));
}

/* ------------------------------------------------------------------ where progress comes from */

const MEASURED_UNITS = new Set(["$", "kg", "lb", "lbs", "%", "cm"]);

/**
 * How a lower-level goal gets its progress. Hours come from the timer and habits from their
 * ticks. Money and body measures are logged by hand at the week and roll up. Anything counted
 * in activities (leads, calls, sessions) is counted from completed daily actions.
 */
export function sourceFor(level: "monthly" | "weekly", parent: { progressSource: ProgressSource; unit: string | null }): ProgressSource {
  // Hours, habit ticks and counters run all the way down: each level reads the same source.
  if (parent.progressSource === "work_hours" || parent.progressSource === "habit" || parent.progressSource === "metric") return parent.progressSource;
  if (level === "monthly") return "children";
  return MEASURED_UNITS.has((parent.unit ?? "").trim().toLowerCase()) ? "manual" : "actions";
}

/* ------------------------------------------------------------------ year → months */

/** Days of a month still ahead (all of them for a future month). */
function daysLeftInMonth(monthStart: LocalDate, today: LocalDate): number {
  const end = monthEndOf(monthStart);
  if (today > end) return 0;
  return daysBetween(today > monthStart ? today : monthStart, end) + 1;
}

/** The months a yearly goal still has: from this month (or January, for a future year) to its deadline. */
export function remainingMonths(goal: Pick<YearlyGoal, "year" | "deadline">, today: LocalDate): LocalDate[] {
  const first = `${goal.year}-01-01`;
  const last = monthStartOf(goal.deadline ?? `${goal.year}-12-31`);
  const from = monthStartOf(today) > first ? monthStartOf(today) : first;
  const out: LocalDate[] = [];
  for (let m = from; m <= last; m = addMonths(m, 1)) out.push(m);
  return out;
}

function label(goal: { metric: string | null; title: string }): string {
  return (goal.metric?.trim() || goal.title).replace(/\s+/g, " ");
}

/** "$10,000 revenue", "Bench press: 165 kg", "172 focused hours" */
function valueTitle(value: number, goal: { unit: string | null; metric: string | null; title: string; goalType: GoalType }): string {
  const v = formatValue(value, goal.unit);
  if (goal.goalType === "performance") return `${label(goal)}: ${v}`;
  if (!goal.metric) return `${v} towards ${goal.title}`;
  const metric = goal.metric.toLowerCase();
  const unit = (goal.unit ?? "").trim().toLowerCase();
  // "175 focused hours", not "175 hours focused hours"
  if (/^[a-z]/.test(unit) && metric.includes(unit)) return `${formatValue(value, null)} ${metric}`;
  return `${v} ${metric}`;
}

export function yearToMonths(goal: YearlyGoal, today: LocalDate, milestones: Array<{ title: string; dueDate: LocalDate | null }> = []): DraftGoal[] {
  const months = remainingMonths(goal, today);
  if (months.length === 0) return [];
  const base = {
    unit: goal.unit,
    metric: goal.metric,
    why: goal.why,
    isMajor: true,
    optional: false,
    metricId: goal.progressSource === "metric" ? goal.metricId : null,
    metricKey: null,
  };

  // Yes/no: finish in the deadline month, with a preparation month before it where there's room.
  if (goal.goalType === "binary") {
    const lastMonth = months[months.length - 1];
    const out: DraftGoal[] = [];
    if (months.length >= 2) {
      out.push({ ...base, key: `m-${months[months.length - 2]}`, periodStart: months[months.length - 2], title: `Prepare: ${goal.title}`, goalType: "binary", cadence: "total", aggregation: "sum", progressSource: "manual", startValue: null, targetValue: null });
    }
    out.push({ ...base, key: `m-${lastMonth}`, periodStart: lastMonth, title: goal.title, goalType: "binary", cadence: "total", aggregation: "sum", progressSource: "manual", startValue: null, targetValue: null });
    return out;
  }

  // Milestones: one monthly goal per milestone, in the month it's due (or spread out if undated).
  if (goal.goalType === "milestone") {
    if (milestones.length === 0) {
      const lastMonth = months[months.length - 1];
      return [{ ...base, key: `m-${lastMonth}`, periodStart: lastMonth, title: goal.title, goalType: "binary", cadence: "total", aggregation: "sum", progressSource: "manual", startValue: null, targetValue: null }];
    }
    return milestones.map((ms, i) => {
      const month = ms.dueDate
        ? monthStartOf(ms.dueDate) < months[0] ? months[0] : monthStartOf(ms.dueDate)
        : months[Math.min(months.length - 1, Math.floor(((i + 1) * months.length) / milestones.length) - 1)];
      return { ...base, key: `m-${month}-${i}`, periodStart: month, title: ms.title, goalType: "binary" as const, cadence: "total" as const, aggregation: "sum" as const, progressSource: "manual" as const, startValue: null, targetValue: null };
    });
  }

  if (!isNumeric(goal.goalType) || goal.targetValue === null) {
    return months.map((m) => ({ ...base, key: `m-${m}`, periodStart: m, title: `${goal.title} — ${monthLabel(m).split(" ")[0]}`, goalType: "process" as const, cadence: "total" as const, aggregation: "sum" as const, progressSource: "manual" as const, startValue: null, targetValue: null }));
  }

  const source = sourceFor("monthly", goal);

  // Rates (40 hours a week, Bible study 6 days a week): each month gets its own total.
  if (goal.cadence !== "total") {
    return months.map((m) => {
      const days = daysLeftInMonth(m, today);
      const total = goal.cadence === "per_week" ? (goal.targetValue! * days) / 7 : (goal.targetValue! * days) / daysInMonth(m);
      const value = roundTo(total, niceStep(total, goal.unit));
      return { ...base, key: `m-${m}`, periodStart: m, title: valueTitle(value, goal), goalType: goal.goalType, cadence: "total" as const, aggregation: "sum" as const, progressSource: source, startValue: null, targetValue: value };
    });
  }

  // Levels (bench press, bodyweight): climb in steps, faster at first, ending on the target.
  if (goal.aggregation === "latest" || goal.goalType === "performance") {
    const start = goal.currentValue ?? goal.startValue ?? 0;
    const n = months.length;
    const step = niceStep(goal.targetValue - start, goal.unit);
    return months.map((m, i) => {
      const f = 1 - Math.pow(1 - (i + 1) / n, 1.4);
      const value = i === n - 1 ? goal.targetValue! : roundTo(start + (goal.targetValue! - start) * f, step);
      return { ...base, key: `m-${m}`, periodStart: m, title: valueTitle(value, goal), goalType: "performance" as const, cadence: "total" as const, aggregation: "latest" as const, progressSource: source, startValue: null, targetValue: value };
    });
  }

  // Cumulative results (revenue, books read): what's left, ramping up month on month.
  const already = (goal.currentValue ?? goal.startValue ?? 0) - (goal.startValue ?? 0);
  const remaining = Math.max(0, goal.targetValue - (goal.startValue ?? 0) - already);
  const weights =
    goal.goalType === "outcome"
      ? ramp(months.length, 3).map((w, i) => w * (daysLeftInMonth(months[i], today) / 30.4))
      : months.map((m) => daysLeftInMonth(m, today));
  const values = distribute(remaining, weights, goal.unit);
  return months.map((m, i) => ({
    ...base,
    key: `m-${m}`,
    periodStart: m,
    title: valueTitle(values[i], goal),
    goalType: goal.goalType,
    cadence: "total" as const,
    aggregation: "sum" as const,
    progressSource: source,
    startValue: null,
    targetValue: values[i],
  }));
}

/* ------------------------------------------------------------------ month → weeks */

interface ActivityTemplate {
  title: string;
  unit: string | null;
  target: number | null;
  goalType: GoalType;
  /** The business counter that measures it, so the quick counters on Today move it. */
  metricKey?: string;
}

/**
 * Supporting activities by area of life: the actual work that moves an outcome. Numbers are a
 * starting point to edit, not a prescription.
 */
export const ACTIVITIES: Record<string, ActivityTemplate[]> = {
  imperium: [
    { title: "Call leads", unit: "leads", target: 50, goalType: "process", metricKey: "leads_called" },
    { title: "Follow up with leads", unit: "follow-ups", target: 20, goalType: "process", metricKey: "follow_ups" },
    { title: "Post reels", unit: "reels", target: 5, goalType: "process", metricKey: "reels_posted" },
    { title: "Send quotes", unit: "quotes", target: 5, goalType: "process", metricKey: "quotes_sent" },
    { title: "Film before/after content", unit: "posts", target: 3, goalType: "process", metricKey: "before_after" },
  ],
  websites: [
    { title: "Build demos", unit: "demos", target: 10, goalType: "process", metricKey: "demos_built" },
    { title: "Make cold calls", unit: "calls", target: 100, goalType: "process", metricKey: "cold_calls" },
    { title: "Follow up with prospects", unit: "follow-ups", target: 20, goalType: "process", metricKey: "follow_ups" },
    { title: "Deliver websites", unit: "websites", target: 1, goalType: "process", metricKey: "delivered" },
  ],
  "ai trading": [
    { title: "Finish the next milestone step", unit: null, target: null, goalType: "binary" },
    { title: "Write up what the tests showed", unit: null, target: null, goalType: "binary" },
  ],
  business: [
    { title: "Contact prospects", unit: "prospects", target: 25, goalType: "process" },
    { title: "Run sales calls", unit: "calls", target: 3, goalType: "process" },
    { title: "Follow up with previous leads", unit: "leads", target: 10, goalType: "process" },
    { title: "Deliver client jobs", unit: "jobs", target: 3, goalType: "process" },
    { title: "Improve the offer or landing page", unit: null, target: null, goalType: "binary" },
  ],
  money: [
    { title: "Review spending against the budget", unit: null, target: null, goalType: "binary" },
    { title: "Move savings on payday", unit: null, target: null, goalType: "binary" },
  ],
  career: [
    { title: "Focused hours on the priority project", unit: "hours", target: 10, goalType: "process" },
    { title: "Reach out to people in the field", unit: "contacts", target: 3, goalType: "process" },
  ],
  fitness: [
    { title: "Training sessions", unit: "sessions", target: 4, goalType: "process" },
    { title: "Cardio sessions", unit: "sessions", target: 2, goalType: "process" },
    { title: "Hit the nutrition target", unit: "days", target: 6, goalType: "habit" },
  ],
  health: [
    { title: "Hit the sleep target", unit: "days", target: 6, goalType: "habit" },
    { title: "Walk 10,000 steps", unit: "days", target: 5, goalType: "habit" },
    { title: "Prep meals for the week", unit: null, target: null, goalType: "binary" },
  ],
  faith: [
    { title: "Complete the assigned readings", unit: "days", target: 6, goalType: "habit" },
    { title: "Attend Liturgy", unit: null, target: null, goalType: "binary" },
    { title: "Study one Church Father", unit: "sessions", target: 1, goalType: "process" },
    { title: "Journal and pray", unit: "days", target: 6, goalType: "habit" },
  ],
  learning: [
    { title: "Study sessions", unit: "sessions", target: 4, goalType: "process" },
    { title: "Chapters read", unit: "chapters", target: 3, goalType: "process" },
  ],
  relationships: [
    { title: "Time together without phones", unit: "evenings", target: 3, goalType: "process" },
    { title: "Plan a date", unit: null, target: null, goalType: "binary" },
  ],
  family: [
    { title: "Time together without phones", unit: "evenings", target: 3, goalType: "process" },
    { title: "Call family", unit: "calls", target: 2, goalType: "process" },
  ],
  "personal discipline": [
    { title: "90-minute deep work blocks", unit: "blocks", target: 8, goalType: "process" },
    { title: "Phone away after 9pm", unit: "days", target: 6, goalType: "habit" },
  ],
};

export function activitiesFor(areaName: string | null | undefined): ActivityTemplate[] {
  return ACTIVITIES[(areaName ?? "").trim().toLowerCase()] ?? [];
}

/** Days of a week that fall inside a month and are still ahead. */
/** Days of a week still ahead. A week belongs wholly to one month (by its Thursday), so all 7 count. */
function daysOfWeekAhead(weekStart: LocalDate, today: LocalDate): number {
  const from = today > weekStart ? today : weekStart;
  const to = weekEndOf(weekStart);
  return to < from ? 0 : daysBetween(from, to) + 1;
}

/** The weeks of a month still ahead (from this week on). */
export function remainingWeeks(monthStart: LocalDate, today: LocalDate): LocalDate[] {
  const weeks = weeksOfMonth(monthStart);
  const current = weeks.filter((w) => weekEndOf(w) >= today);
  return current.length ? current : [];
}

export function monthToWeeks(goal: MonthlyGoal, areaName: string | null, today: LocalDate): DraftGoal[] {
  const weeks = remainingWeeks(goal.monthStart, today);
  if (weeks.length === 0) return [];
  const out: DraftGoal[] = [];
  const base = { metric: goal.metric, why: goal.why, optional: false, metricId: goal.progressSource === "metric" ? goal.metricId : null, metricKey: null };

  if (isNumeric(goal.goalType) && goal.targetValue !== null) {
    if (goal.aggregation === "latest" || goal.goalType === "performance") {
      // Levels: step towards the month's target week by week.
      const start = goal.currentValue ?? goal.startValue ?? goal.targetValue;
      weeks.forEach((w, i) => {
        const value = i === weeks.length - 1 ? goal.targetValue! : roundTo(start + ((goal.targetValue! - start) * (i + 1)) / weeks.length, niceStep(goal.targetValue! - start || 1, goal.unit));
        out.push({ ...base, key: `w-${w}-main`, periodStart: w, title: valueTitle(value, goal), goalType: "performance", unit: goal.unit, cadence: "total", aggregation: "latest", progressSource: sourceFor("weekly", goal), startValue: null, targetValue: value, isMajor: true });
      });
    } else {
      // Totals: what's left, by the days of each week inside the month, rising slightly.
      const done = Math.max(0, (goal.currentValue ?? 0) - (goal.startValue ?? 0));
      const remaining = Math.max(0, goal.targetValue - (goal.startValue ?? 0) - done);
      const weights = weeks.map((w, i) => daysOfWeekAhead(w, today) * (goal.goalType === "outcome" ? 1 + (0.25 * i) / Math.max(1, weeks.length - 1) : 1));
      const values = distribute(remaining, weights, goal.unit);
      const source = sourceFor("weekly", goal);
      weeks.forEach((w, i) => {
        out.push({ ...base, key: `w-${w}-main`, periodStart: w, title: valueTitle(values[i], goal), goalType: goal.goalType, unit: goal.unit, cadence: "total", aggregation: "sum", progressSource: source, startValue: null, targetValue: values[i], isMajor: true });
      });
    }
  } else {
    // Yes/no and milestone months: the work goes in the first week, with room to finish.
    out.push({ ...base, key: `w-${weeks[0]}-main`, periodStart: weeks[0], title: goal.title, goalType: "binary", unit: null, cadence: "total", aggregation: "sum", progressSource: "manual", startValue: null, targetValue: null, isMajor: true });
  }

  // Supporting activities under each week's outcome, from the goal's area of life.
  for (const w of weeks) {
    activitiesFor(areaName).forEach((a, i) => {
      out.push({
        ...base,
        key: `w-${w}-a${i}`,
        periodStart: w,
        title: a.title,
        goalType: a.goalType,
        unit: a.unit,
        metric: null,
        cadence: "total",
        aggregation: "sum",
        progressSource: a.target === null ? "manual" : a.metricKey ? "metric" : "actions",
        metricId: null,
        metricKey: a.metricKey ?? null,
        startValue: null,
        targetValue: a.target,
        isMajor: false,
        optional: i >= 3,
      });
    });
  }
  return out;
}

