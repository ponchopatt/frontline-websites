import { addDays, daysBetween, type LocalDate } from "../day";
import { totalOver, type DayValues } from "../metrics";
import { formatValue, percent } from "./format";
import type { AnyGoal, Milestone, MonthlyGoal, WeeklyGoal, YearlyGoal } from "./model";
import { isNumeric } from "./model";
import { elapsedFraction, monthEndOf, weekEndOf, yearEnd, yearStart, type Period } from "./periods";

/**
 * Progress and health for every goal, from the goals themselves plus what actually happened:
 * work sessions, habit ticks, completed daily actions, milestones and Keep My Word. Pure and
 * synchronous.
 *
 * Health is a plain pace check: how much of the target is done against how much of the time
 * has passed. It makes no prediction about anything outside the user's control. Keep My Word
 * is the exception: a share of days is a level, so it's judged as it stands.
 */

export interface ExecutionData {
  /** Minutes of work logged per local day. */
  workMinutes: Map<LocalDate, number>;
  /** The days each habit was ticked. */
  habitDays: Map<string, Set<LocalDate>>;
  /** Sum of completed daily-action quantities per weekly goal (a null quantity counts as 1). */
  actionsByWeekly: Map<string, number>;
  milestones: Milestone[];
  /** Counter values by day, for goals measured by a counter. */
  metrics?: Map<string, { aggregation: "sum" | "latest"; values: DayValues }>;
  /** Days with a settled Keep My Word score (over, or closed today), and whether each kept it. */
  wordKept?: Map<LocalDate, boolean>;
}

export interface GoalTree {
  yearly: YearlyGoal[];
  monthly: MonthlyGoal[];
  weekly: WeeklyGoal[];
}

export type HealthStatus = "on_track" | "at_risk" | "behind" | "not_started" | "complete" | "cancelled";

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  on_track: "On track",
  at_risk: "At risk",
  behind: "Behind",
  not_started: "Not started",
  complete: "Complete",
  cancelled: "Cancelled",
};

export interface GoalProgress {
  /** The value to show against the target, or null for yes/no and milestone goals. */
  current: number | null;
  /** 0–1 towards the target, or null when there's nothing to measure against. */
  ratio: number | null;
  /** Share of the period gone, 0–1. */
  expected: number;
  health: HealthStatus;
  /** One neutral sentence explaining the health. */
  explanation: string;
}

/**
 * The span a goal is judged over. A goal set part-way through its period is paced from the day
 * it was set, so starting in September doesn't read as nine months behind.
 */
export function periodOf(goal: AnyGoal): Period {
  const natural = naturalPeriodOf(goal);
  const set = goal.createdOn;
  if (set && set > natural.start && set <= natural.end) return { start: set, end: natural.end };
  return natural;
}

/** The goal's whole year, month or week, whenever it was set. */
export function naturalPeriodOf(goal: AnyGoal): Period {
  return goal.level === "yearly"
    ? { start: yearStart(goal.year), end: goal.deadline ?? yearEnd(goal.year) }
    : goal.level === "monthly"
      ? { start: goal.monthStart, end: goal.deadline ?? monthEndOf(goal.monthStart) }
      : { start: goal.weekStart, end: weekEndOf(goal.weekStart) };
}

function isRate(goal: AnyGoal): boolean {
  if (goal.cadence === "per_week") return goal.level !== "weekly";
  if (goal.cadence === "per_month") return goal.level === "yearly";
  return false;
}

function sameUnit(a: string | null, b: string | null): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function live(goal: AnyGoal): boolean {
  return goal.state !== "cancelled" && goal.state !== "draft";
}

/** Totals from execution data over the part of a period that has happened. */
function sumOver(period: Period, today: LocalDate, perDay: (d: LocalDate) => number): number {
  const end = today < period.end ? today : period.end;
  let total = 0;
  for (let d = period.start; d <= end; d = addDays(d, 1)) total += perDay(d);
  return total;
}

/** Keep My Word over the part of a period that has happened: days scored, days kept, the first one scored. */
function wordDays(period: Period, today: LocalDate, days: Map<LocalDate, boolean> | undefined) {
  const end = today < period.end ? today : period.end;
  let scored = 0;
  let kept = 0;
  let first: LocalDate | null = null;
  for (const [d, k] of days ?? []) {
    if (d < period.start || d > end) continue;
    scored += 1;
    if (k) kept += 1;
    if (first === null || d < first) first = d;
  }
  return { scored, kept, first };
}

/** Whole weeks / months elapsed, at least 1, for turning a total into a rate. */
function elapsedUnits(goal: AnyGoal, today: LocalDate): number {
  const p = periodOf(goal);
  const end = today < p.end ? today : p.end;
  if (end < p.start) return 1;
  const days = daysBetween(p.start, end) + 1;
  return Math.max(1, goal.cadence === "per_month" ? days / (365.25 / 12) : days / 7);
}

export function evaluateGoals(tree: GoalTree, exec: ExecutionData, today: LocalDate): Map<string, GoalProgress> {
  const monthlyByParent = new Map<string, MonthlyGoal[]>();
  for (const m of tree.monthly) {
    if (!m.parentYearlyId || !live(m)) continue;
    monthlyByParent.set(m.parentYearlyId, [...(monthlyByParent.get(m.parentYearlyId) ?? []), m]);
  }
  const weeklyByParent = new Map<string, WeeklyGoal[]>();
  for (const w of tree.weekly) {
    if (!w.parentMonthlyId || !live(w)) continue;
    weeklyByParent.set(w.parentMonthlyId, [...(weeklyByParent.get(w.parentMonthlyId) ?? []), w]);
  }
  const childrenOf = (g: AnyGoal): AnyGoal[] =>
    g.level === "yearly" ? monthlyByParent.get(g.id) ?? [] : g.level === "monthly" ? weeklyByParent.get(g.id) ?? [] : [];

  const accumulated = new Map<string, number | null>();

  /** What has accumulated in the goal's own terms (before adding the start value). */
  function accumulate(goal: AnyGoal): number | null {
    if (accumulated.has(goal.id)) return accumulated.get(goal.id)!;
    let value: number | null = null;
    const p = periodOf(goal);
    switch (goal.progressSource) {
      case "work_hours":
        value = sumOver(p, today, (d) => exec.workMinutes.get(d) ?? 0) / 60;
        break;
      case "habit": {
        const days = goal.habitId ? exec.habitDays.get(goal.habitId) : undefined;
        value = sumOver(p, today, (d) => (days?.has(d) ? 1 : 0));
        break;
      }
      case "metric": {
        // A counter was running before the goal was set: the whole period counts.
        const m = goal.metricId ? exec.metrics?.get(goal.metricId) : undefined;
        const whole = naturalPeriodOf(goal);
        const end = today < whole.end ? today : whole.end;
        value = m ? totalOver(m.values, whole.start, end, m.aggregation) : 0;
        break;
      }
      case "keep_word": {
        // The share of days since the goal was set that kept my word, as a whole percent.
        const { scored, kept } = wordDays(p, today, exec.wordKept);
        value = scored > 0 ? Math.round((kept / scored) * 100) : null;
        break;
      }
      case "actions": {
        if (goal.level === "weekly") value = exec.actionsByWeekly.get(goal.id) ?? 0;
        else value = childrenOf(goal).reduce((s, c) => s + (accumulate(c) ?? 0), 0);
        break;
      }
      case "children": {
        const kids = childrenOf(goal).filter((c) => sameUnit(c.unit, goal.unit));
        const values = kids
          .map((c) => ({ c, v: currentOf(c) }))
          .filter((x): x is { c: AnyGoal; v: number } => x.v !== null);
        if (values.length === 0) {
          value = null;
        } else if (goal.aggregation === "latest") {
          const started = values.filter((x) => periodOf(x.c).start <= today);
          const pick = (started.length ? started : values).sort((a, b) => periodOf(a.c).start.localeCompare(periodOf(b.c).start));
          value = pick[pick.length - 1].v;
        } else {
          value = values.reduce((s, x) => s + x.v, 0);
        }
        break;
      }
      default:
        value = null;
    }
    accumulated.set(goal.id, value);
    return value;
  }

  /** The current value to show against the target. */
  function currentOf(goal: AnyGoal): number | null {
    if (!isNumeric(goal.goalType)) return null;
    if (goal.progressSource === "manual" || goal.progressSource === "milestones") return goal.currentValue;
    // A share of days stands as it is: no start value, no average, nothing logged by hand.
    if (goal.progressSource === "keep_word") return accumulate(goal);
    const acc = accumulate(goal);
    if (acc === null) return goal.currentValue; // nothing below it yet: fall back to what was logged
    if (isRate(goal)) return acc / elapsedUnits(goal, today);
    if (goal.progressSource === "children" && goal.aggregation === "latest") return acc;
    return (goal.startValue ?? 0) + acc;
  }

  const out = new Map<string, GoalProgress>();
  for (const goal of [...tree.yearly, ...tree.monthly, ...tree.weekly]) {
    out.set(goal.id, assess(goal, currentOf(goal), exec, today));
  }
  return out;
}

/**
 * The goal with its measured progress as its current value. Only goals logged by hand store
 * one, so a breakdown of anything counted or timed needs this to plan from what's left.
 */
export function withProgress<G extends AnyGoal>(goal: G, progress: GoalProgress | undefined): G {
  return { ...goal, currentValue: progress?.current ?? goal.currentValue };
}

function ratioFor(goal: AnyGoal, current: number | null, exec: ExecutionData): number | null {
  if (goal.state === "completed") return 1;
  if (goal.goalType === "binary") return 0;
  if (goal.goalType === "milestone" || goal.progressSource === "milestones") {
    const own = exec.milestones.filter((m) => (goal.level === "yearly" ? m.yearlyGoalId : m.monthlyGoalId) === goal.id);
    if (own.length === 0) return 0;
    return own.filter((m) => m.done).length / own.length;
  }
  if (goal.targetValue === null || current === null) return current === null && goal.targetValue !== null ? 0 : null;
  // Rates and shares of days are measured from zero.
  if (isRate(goal) || goal.progressSource === "keep_word") return clamp(goal.targetValue === 0 ? 1 : current / goal.targetValue);
  const start = goal.startValue ?? 0;
  if (goal.targetValue === start) return current >= goal.targetValue ? 1 : 0;
  return clamp((current - start) / (goal.targetValue - start));
}

function clamp(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function assess(goal: AnyGoal, current: number | null, exec: ExecutionData, today: LocalDate): GoalProgress {
  const period = periodOf(goal);
  const expected = elapsedFraction(period, today);
  const ratio = ratioFor(goal, current, exec);
  const base = { current, ratio, expected };

  if (goal.state === "cancelled") return { ...base, health: "cancelled", explanation: "Cancelled." };
  if (goal.progressSource === "keep_word" && goal.state !== "completed") return assessWord(goal, base, period, exec, today);
  if (goal.state === "completed" || (ratio !== null && ratio >= 1)) {
    return { ...base, health: "complete", explanation: "Target reached." };
  }
  if (today < period.start) {
    return { ...base, health: "not_started", explanation: `Starts ${dayLabel(period.start)}.` };
  }

  // Yes/no goals: nothing to pace against until the end nears.
  if (goal.goalType === "binary") {
    if (today > period.end) return { ...base, health: "behind", explanation: "The deadline has passed and it isn't marked done." };
    if (expected >= 0.9) return { ...base, health: "at_risk", explanation: "The deadline is close and it isn't marked done." };
    return { ...base, health: "on_track", explanation: "Not due yet." };
  }

  if (goal.goalType === "milestone" || goal.progressSource === "milestones") {
    const own = exec.milestones.filter((m) => (goal.level === "yearly" ? m.yearlyGoalId : m.monthlyGoalId) === goal.id);
    const overdue = own.filter((m) => !m.done && m.dueDate && m.dueDate < today);
    if (own.length === 0) return { ...base, health: "not_started", explanation: "Add milestones to track this goal." };
    if (overdue.length > 0) {
      return { ...base, health: "behind", explanation: `${overdue.length} milestone${overdue.length === 1 ? " is" : "s are"} past due.` };
    }
    return { ...base, health: "on_track", explanation: `${own.filter((m) => m.done).length} of ${own.length} milestones done, none overdue.` };
  }

  if (ratio === null) return { ...base, health: "not_started", explanation: "Set a target to track progress." };

  if (isRate(goal)) {
    const avg = `${formatValue(current, goal.unit)}`;
    const target = formatValue(goal.targetValue, goal.unit);
    const per = goal.cadence === "per_week" ? "a week" : "a month";
    if (ratio >= 0.9) return { ...base, health: "on_track", explanation: `Averaging ${avg} ${per} against ${target}.` };
    if (ratio >= 0.7) return { ...base, health: "at_risk", explanation: `Averaging ${avg} ${per}, a little under ${target}.` };
    return { ...base, health: "behind", explanation: `Averaging ${avg} ${per}, below the ${target} target.` };
  }

  // Nothing is owed on the first day, or before a quarter of the time has gone.
  if (ratio === 0 && (expected < 0.25 || today <= period.start)) {
    return { ...base, health: "not_started", explanation: "Nothing logged yet." };
  }
  if (today > period.end) {
    return { ...base, health: "behind", explanation: `Ended at ${percent(ratio)} of the target.` };
  }
  const pace = expected === 0 ? 1 : ratio / expected;
  const numbers = `${percent(ratio)} done with ${percent(expected)} of the time gone`;
  if (pace >= 0.9) return { ...base, health: "on_track", explanation: `On pace: ${numbers}.` };
  if (pace >= 0.7) return { ...base, health: "at_risk", explanation: `A little behind the pace needed: ${numbers}.` };
  return { ...base, health: "behind", explanation: `Below the pace needed to reach the target: ${numbers}.` };
}

/**
 * Keep My Word: the share of days kept since the goal was set, against its line. It's a level
 * that can still fall, so it's judged as it stands and is never complete before the period ends.
 */
function assessWord(
  goal: AnyGoal,
  base: Pick<GoalProgress, "current" | "ratio" | "expected">,
  period: Period,
  exec: ExecutionData,
  today: LocalDate,
): GoalProgress {
  if (today < period.start) return { ...base, health: "not_started", explanation: `Starts ${dayLabel(period.start)}.` };
  if (goal.targetValue === null) return { ...base, health: "not_started", explanation: "Set a target to track progress." };
  if (base.current === null) return { ...base, health: "not_started", explanation: "No days scored yet." };
  const kept = Math.round(base.current);
  const line = `${formatValue(goal.targetValue, null)}%`;
  if (today > period.end) {
    return kept >= goal.targetValue
      ? { ...base, health: "complete", explanation: `Target reached: you kept your word on ${kept}% of days.` }
      : { ...base, health: "behind", explanation: `Ended at ${kept}% of days kept, against ${line}.` };
  }
  const since = dayLabel(wordDays(period, today, exec.wordKept).first ?? period.start);
  const explanation = `Kept your word on ${kept}% of days since ${since}, against ${line}.`;
  if (kept >= goal.targetValue) return { ...base, health: "on_track", explanation };
  if (kept >= goal.targetValue - 5) return { ...base, health: "at_risk", explanation };
  return { ...base, health: "behind", explanation };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthName(date: LocalDate): string {
  return MONTHS[Number(date.slice(5, 7)) - 1];
}

/** "24 Sep" */
function dayLabel(date: LocalDate): string {
  return `${Number(date.slice(8, 10))} ${monthName(date)}`;
}
