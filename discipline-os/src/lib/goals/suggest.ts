import { shortDate, type LocalDate } from "../day";
import { formatValue } from "./format";
import type { DailyGoal, MonthlyGoal, WeeklyGoal, YearlyGoal } from "./model";
import { isNumeric } from "./model";
import { daysLeft, weekEndOf } from "./periods";
import type { GoalProgress } from "./progress";

/**
 * "What should I do today?" Turns this week's goals into today's actions and ranks them by
 * importance, impact, deadline, what they unblock, what was missed, and the time available.
 * The top three are today's Big 3; the rest are supporting tasks.
 */

export interface WeeklyContext {
  goal: WeeklyGoal;
  progress: GoalProgress;
  monthly: MonthlyGoal | null;
  monthlyProgress: GoalProgress | null;
  yearly: YearlyGoal | null;
  /** Titles of this week's goals that can't start until this one is done. */
  unblocks: string[];
}

export interface SuggestionInput {
  today: LocalDate;
  weekly: WeeklyContext[];
  /** Actions already on today's list (any status). */
  todayActions: DailyGoal[];
  /** Earlier days' actions this week that were left pending. */
  unfinished: DailyGoal[];
  /** Minutes free for goal work today: the work target less what's already planned. */
  availableMinutes: number;
}

export interface Suggestion {
  key: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  estimatedMinutes: number;
  weeklyGoalId: string | null;
  carriedFromId: string | null;
  /** The counter this action moves ("Call 10 leads" → leads called). */
  metricId: string | null;
  /** Deep-work suggestions create a work block when accepted. */
  createsWorkBlock: boolean;
  score: number;
  /** Why it ranks where it does, most important first. */
  reasons: string[];
}

const MINUTES_PER_UNIT: Record<string, number> = {
  prospects: 4, leads: 4, contacts: 10, calls: 30, jobs: 120, sessions: 60, chapters: 25,
  blocks: 90, days: 20, evenings: 90, hours: 60, pages: 3,
};

function estimate(quantity: number | null, unit: string | null): number {
  const per = MINUTES_PER_UNIT[(unit ?? "").trim().toLowerCase()] ?? 30;
  const q = quantity ?? 1;
  return Math.min(240, Math.max(15, Math.round(q * per)));
}

/** "Follow up with previous leads · 5 leads" */
export function actionTitle(title: string, quantity: number | null, unit: string | null): string {
  if (quantity === null || !unit || unit === "days") return title;
  return `${title} · ${formatValue(quantity, unit)}`;
}

function generate(ctx: WeeklyContext, today: LocalDate): Omit<Suggestion, "score" | "reasons"> | null {
  const { goal, progress } = ctx;
  if (goal.state !== "active" || progress.health === "complete") return null;
  const left = daysLeft({ start: goal.weekStart, end: weekEndOf(goal.weekStart) }, today);
  if (left <= 0) return null;

  if (goal.goalType === "binary" || goal.goalType === "milestone") {
    return { key: `w-${goal.id}`, title: goal.title, quantity: null, unit: null, estimatedMinutes: 60, weeklyGoalId: goal.id, carriedFromId: null, metricId: null, createsWorkBlock: false };
  }
  if (!isNumeric(goal.goalType) || goal.targetValue === null) return null;

  const current = progress.current ?? 0;
  const remaining = goal.targetValue - current;
  if (remaining <= 0) return null;

  if (goal.progressSource === "work_hours") {
    const hours = remaining / left;
    const blocks = Math.max(1, Math.min(4, Math.round((hours * 60) / 90)));
    return {
      key: `w-${goal.id}`,
      title: `${blocks} × 90-minute deep work block${blocks === 1 ? "" : "s"}`,
      quantity: blocks * 1.5,
      unit: "hours",
      estimatedMinutes: blocks * 90,
      weeklyGoalId: goal.id,
      carriedFromId: null,
      metricId: null,
      createsWorkBlock: true,
    };
  }
  if (goal.progressSource === "actions" || (goal.progressSource === "metric" && goal.unit !== "$")) {
    const unit = goal.unit?.trim() || null;
    const quantity = unit === "days" ? 1 : Math.max(1, Math.ceil(remaining / left));
    return {
      key: `w-${goal.id}`,
      title: goal.title,
      quantity,
      unit,
      estimatedMinutes: estimate(quantity, unit),
      weeklyGoalId: goal.id,
      carriedFromId: null,
      metricId: goal.progressSource === "metric" ? goal.metricId : null,
      createsWorkBlock: false,
    };
  }
  // Manual measures (revenue, bodyweight) move through the supporting work, not a daily task.
  return null;
}

export function suggestToday(input: SuggestionInput): { big3: Suggestion[]; supporting: Suggestion[] } {
  const ordered = rankSuggestions(input);
  return { big3: ordered.slice(0, 3), supporting: ordered.slice(3) };
}

/** Every suggestion from this week's goals and unfinished actions, best first. */
export function rankSuggestions(input: SuggestionInput): Suggestion[] {
  const takenWeekly = new Set(input.todayActions.filter((a) => a.status !== "dropped").map((a) => a.parentWeeklyId));
  const takenCarry = new Set(input.todayActions.map((a) => a.title.trim().toLowerCase()));
  const byWeekly = new Map(input.weekly.map((w) => [w.goal.id, w]));
  const scored: Suggestion[] = [];

  for (const ctx of input.weekly) {
    if (takenWeekly.has(ctx.goal.id)) continue;
    const s = generate(ctx, input.today);
    if (!s) continue;
    scored.push(rank(s, ctx, input));
  }

  // Unfinished actions from earlier this week come back, flagged.
  for (const a of input.unfinished) {
    if (takenCarry.has(a.title.trim().toLowerCase())) continue;
    if (a.parentWeeklyId && takenWeekly.has(a.parentWeeklyId)) continue;
    const ctx = a.parentWeeklyId ? byWeekly.get(a.parentWeeklyId) ?? null : null;
    // A carried action replaces a fresh suggestion for the same goal.
    const fresh = scored.findIndex((s) => s.weeklyGoalId && s.weeklyGoalId === a.parentWeeklyId);
    if (fresh !== -1) scored.splice(fresh, 1);
    const base: Omit<Suggestion, "score" | "reasons"> = {
      key: `c-${a.id}`,
      title: a.title,
      quantity: a.quantity,
      unit: a.unit,
      estimatedMinutes: a.estimatedMinutes ?? estimate(a.quantity, a.unit),
      weeklyGoalId: a.parentWeeklyId,
      carriedFromId: a.id,
      metricId: a.metricId,
      createsWorkBlock: false,
    };
    const r = ctx ? rank(base, ctx, input) : { ...base, score: 20, reasons: [] as string[] };
    r.score += 14;
    r.reasons.unshift(a.localDate ? `Left from ${shortDate(a.localDate)}` : "Unfinished");
    scored.push(r);
  }

  scored.sort((a, b) => b.score - a.score || a.estimatedMinutes - b.estimatedMinutes);

  // Respect the time available: anything that no longer fits drops below what does.
  let free = input.availableMinutes;
  const fits: Suggestion[] = [];
  const tooLong: Suggestion[] = [];
  for (const s of scored) {
    if (s.estimatedMinutes <= free) {
      fits.push(s);
      free -= s.estimatedMinutes;
    } else {
      tooLong.push({ ...s, reasons: [...s.reasons, "More than the time left today"] });
    }
  }
  return [...fits, ...tooLong];
}

function rank(s: Omit<Suggestion, "score" | "reasons">, ctx: WeeklyContext, input: SuggestionInput): Suggestion {
  const reasons: Array<[number, string]> = [];
  let score = 0;
  const { goal, progress } = ctx;

  // 1. Importance
  const importance = (goal.isMajor ? 30 : 12) + (3 - goal.priority) * 6;
  score += importance;
  if (goal.isMajor) reasons.push([importance, "Major outcome this week"]);

  // 2. Impact on the larger goals
  if (ctx.yearly) {
    const impact = (3 - ctx.yearly.priority) * 4 + 4;
    score += impact;
    reasons.push([impact, `Moves ${ctx.yearly.title}`]);
  }
  if (ctx.monthlyProgress?.health === "behind") {
    score += 12;
    reasons.push([12, "Month is behind pace"]);
  } else if (ctx.monthlyProgress?.health === "at_risk") {
    score += 6;
    reasons.push([6, "Month is at risk"]);
  }

  // 3. Deadline
  if (progress.health === "behind") {
    score += 10;
    reasons.push([10, "Behind pace this week"]);
  } else if (progress.health === "at_risk") {
    score += 5;
    reasons.push([5, "At risk this week"]);
  }
  const left = daysLeft({ start: goal.weekStart, end: weekEndOf(goal.weekStart) }, input.today);
  if (left <= 2) {
    score += 6;
    reasons.push([6, left === 1 ? "Last day of the week" : "Two days left this week"]);
  }

  // 4. Unblocks other goals
  if (ctx.unblocks.length > 0) {
    score += 15;
    reasons.push([15, `Needed before ${ctx.unblocks[0]}`]);
  }

  return { ...s, score, reasons: reasons.sort((a, b) => b[0] - a[0]).map(([, r]) => r) };
}
