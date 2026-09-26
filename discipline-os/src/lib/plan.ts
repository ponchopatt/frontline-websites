import type { Area, WorkArea } from "./areas";
import { addDays, shortDate, type LocalDate } from "./day";
import type { DailyGoal } from "./goals/model";
import type { Suggestion } from "./goals/suggest";
import { actionTitle } from "./goals/suggest";
import { metricTaskTitle, type Metric } from "./metrics";

/**
 * Plan my day. Pulls from everything that already says what matters — this week's goals,
 * today's counter targets, unfinished and due tasks, the AI bot's next step — and returns a
 * short plan: the Big 3, up to four supporting tasks, and where the work hours go.
 * It never proposes more than seven tasks: a plan you can't finish isn't a plan.
 */

export interface PlanInput {
  today: LocalDate;
  /**
   * Local minutes since midnight of the day, for block times. Before the day starts the clock
   * is still on the night before, so it goes past 24:00 (see minutesIntoDay).
   */
  nowMinutes: number;
  todayTasks: DailyGoal[];
  /** Pending tasks from the last week that haven't been moved on. */
  unfinished: DailyGoal[];
  /** Tasks parked for later (no day yet). */
  later: DailyGoal[];
  /** Ranked suggestions from this week's goals (see rankSuggestions). */
  weekly: Suggestion[];
  /** Area of each weekly goal, from its life area. */
  weeklyArea: Map<string, Area | null>;
  /** Today's counters with their targets. */
  counters: Array<{ metric: Metric; target: number | null; value: number }>;
  milestone: { title: string; nextStep: string | null } | null;
  workTargetMinutes: number;
  /** Minutes already worked today, by business. */
  worked: Partial<Record<WorkArea, number>>;
  /** Minutes already planned in work blocks today, by business. */
  planned: Partial<Record<WorkArea, number>>;
  /** Hours a day to give a business (e.g. trading: 2). On a focus day: deep and keep-alive hours. */
  hourTargets: Partial<Record<WorkArea, number>>;
  /** Today's focus business, if the week has one. */
  focus?: "imperium" | "websites" | "trading" | null;
}

export interface PlanItem {
  key: string;
  title: string;
  area: Area | null;
  quantity: number | null;
  unit: string | null;
  metricId: string | null;
  weeklyGoalId: string | null;
  carriedFromId: string | null;
  /** An existing task this item promotes or moves to today. */
  taskId: string | null;
  estimatedMinutes: number;
  score: number;
  reasons: string[];
}

export interface PlanBlock {
  area: WorkArea;
  start: string;
  end: string;
  minutes: number;
}

export interface DayPlan {
  big3: PlanItem[];
  supporting: PlanItem[];
  blocks: PlanBlock[];
}

const MAX_SUPPORTING = 4;
const SAME_AREA_PENALTY = 12;

function dueBonus(due: LocalDate | null, today: LocalDate): [number, string | null] {
  if (!due) return [0, null];
  if (due < today) return [22, `Overdue since ${shortDate(due)}`];
  if (due === today) return [20, "Due today"];
  if (due <= addDays(today, 2)) return [10, `Due ${shortDate(due)}`];
  return [0, null];
}

function fromTask(t: DailyGoal, today: LocalDate, base: number, reason: string, carried: boolean): PlanItem {
  const [bonus, dueReason] = dueBonus(t.dueDate, today);
  return {
    key: `${carried ? "c" : "t"}-${t.id}`,
    title: t.title,
    area: (t.area as Area | null) ?? null,
    quantity: t.quantity,
    unit: t.unit,
    metricId: t.metricId,
    weeklyGoalId: t.parentWeeklyId,
    carriedFromId: carried ? t.id : null,
    taskId: carried ? null : t.id,
    estimatedMinutes: t.estimatedMinutes ?? 45,
    score: base + bonus + (3 - t.priority) * 8,
    reasons: [dueReason, reason].filter((r): r is string => Boolean(r)),
  };
}

export function planDay(input: PlanInput): DayPlan {
  const { today } = input;
  const ranked = input.todayTasks.filter((t) => t.rank !== null);
  const freeSlots = Math.max(0, 3 - ranked.length);
  const takenTitles = new Set(input.todayTasks.map((t) => t.title.trim().toLowerCase()));
  const takenMetrics = new Set(input.todayTasks.filter((t) => t.status !== "dropped" && t.metricId).map((t) => t.metricId));
  const takenWeekly = new Set(input.todayTasks.filter((t) => t.status !== "dropped" && t.parentWeeklyId).map((t) => t.parentWeeklyId));
  const counterFor = new Map(input.counters.map((c) => [c.metric.id, c]));

  const candidates: PlanItem[] = [];
  const add = (item: PlanItem) => {
    const title = item.title.trim().toLowerCase();
    if (candidates.some((c) => c.title.trim().toLowerCase() === title)) return;
    if (item.metricId && candidates.some((c) => c.metricId === item.metricId)) return;
    candidates.push(item);
  };

  // Already on today's list but not in the Big 3: can be promoted, never duplicated.
  for (const t of input.todayTasks) {
    if (t.rank === null && t.status === "pending") add(fromTask(t, today, 26, "On today's list", false));
  }
  for (const t of input.unfinished) {
    if (takenTitles.has(t.title.trim().toLowerCase())) continue;
    add(fromTask(t, today, 34, t.localDate ? `Left from ${shortDate(t.localDate)}` : "Unfinished", true));
  }
  for (const t of input.later) {
    if (!t.dueDate || t.dueDate > addDays(today, 2)) continue;
    add(fromTask(t, today, 18, "", false));
  }

  // This week's goals, with counter-based ones sized to today's counter target.
  for (const s of input.weekly) {
    if (s.weeklyGoalId && takenWeekly.has(s.weeklyGoalId)) continue;
    if (s.carriedFromId) continue; // unfinished tasks are handled above
    if (s.metricId && takenMetrics.has(s.metricId)) continue;
    const counter = s.metricId ? counterFor.get(s.metricId) : undefined;
    let quantity = s.quantity;
    let title = actionTitle(s.title, s.quantity, s.unit);
    if (counter && counter.target !== null) {
      if (counter.value >= counter.target) continue; // already hit today
      quantity = counter.target;
      title = metricTaskTitle(counter.metric, counter.target) ?? actionTitle(s.title, counter.target, s.unit);
    }
    add({
      key: s.key,
      title,
      area: s.weeklyGoalId ? input.weeklyArea.get(s.weeklyGoalId) ?? counter?.metric.area ?? null : null,
      quantity,
      unit: s.unit,
      metricId: s.metricId,
      weeklyGoalId: s.weeklyGoalId,
      carriedFromId: null,
      taskId: null,
      estimatedMinutes: s.estimatedMinutes,
      score: s.score,
      reasons: s.reasons,
    });
  }

  // Counter targets no goal already covers: today's share of the week.
  for (const c of input.counters) {
    if (c.target === null || c.target <= 0 || c.value >= c.target || takenMetrics.has(c.metric.id)) continue;
    const title = metricTaskTitle(c.metric, c.target);
    if (!title) continue;
    const big = c.metric.key === "leads_called" || c.metric.key === "cold_calls";
    add({
      key: `m-${c.metric.id}`,
      title,
      area: c.metric.area,
      quantity: c.target,
      unit: c.metric.unit,
      metricId: c.metric.id,
      weeklyGoalId: null,
      carriedFromId: null,
      taskId: null,
      estimatedMinutes: Math.min(180, Math.max(20, c.target * (big ? 5 : 20))),
      score: 28 + (big ? 8 : 0) + (c.metric.pinned ? 2 : 0),
      reasons: [c.metric.weeklyTarget ? `Today's share of ${c.metric.weeklyTarget} this week` : "Today's target"],
    });
  }

  if (input.milestone?.nextStep && (!input.focus || input.focus === "trading")) {
    add({
      key: "bot-step",
      title: `${input.milestone.nextStep}: ${input.milestone.title}`,
      area: "trading",
      quantity: null,
      unit: null,
      metricId: null,
      weeklyGoalId: null,
      carriedFromId: null,
      taskId: null,
      estimatedMinutes: 90,
      score: 30 + ((input.hourTargets.trading ?? 0) > 0 ? 4 : 0),
      reasons: ["Next step on the AI bot milestone"],
    });
  }

  // A focus day: the focus business's work comes first, the others' waits (their keep-alive is
  // time on the clock, not a task).
  const focus = input.focus ?? null;
  const isBusiness = (a: Area | null) => a === "imperium" || a === "websites" || a === "trading";
  if (focus) {
    for (const c of candidates) {
      if (c.area === focus) {
        c.score += 12;
        c.reasons = [...c.reasons, "This week's focus"];
      } else if (isBusiness(c.area)) c.score -= 12;
    }
  }

  // Big 3: best first, spread across areas so one business doesn't take all three (except the
  // focus, which is meant to).
  const pool = [...candidates].sort((a, b) => b.score - a.score);
  const big3: PlanItem[] = [];
  const areasIn = ranked.map((t) => t.area as Area | null);
  while (big3.length < freeSlots && pool.length > 0) {
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((item, i) => {
      const same = item.area && item.area !== focus ? areasIn.filter((a) => a === item.area).length : 0;
      const effective = item.score - same * SAME_AREA_PENALTY;
      if (effective > bestScore) {
        bestScore = effective;
        best = i;
      }
    });
    const [pick] = pool.splice(best, 1);
    big3.push(pick);
    areasIn.push(pick.area);
  }
  // Supporting: new work only (tasks already on today's list stay where they are).
  const supporting = pool.filter((p) => !(p.taskId && input.todayTasks.some((t) => t.id === p.taskId))).slice(0, MAX_SUPPORTING);

  return { big3, supporting, blocks: allocate(input, [...ranked.map((t) => t.area as Area | null), ...big3.map((b) => b.area)], supporting) };
}

/**
 * The wall clock as minutes into the day it belongs to. With a 04:00 start, 01:30 is still
 * last night: 25:30, not 01:30.
 */
export function minutesIntoDay(wallMinutes: number, dayStartHour: number): number {
  return wallMinutes < dayStartHour * 60 ? wallMinutes + 24 * 60 : wallMinutes;
}

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Splits the work hours still open today: each business's own daily hours first (the AI bot's
 * two hours), the rest between Imperium and Websites by how much of today's plan is theirs.
 * Blocks are at most two hours, start from now (not before 8am) and stop by 11pm.
 */
function allocate(input: PlanInput, bigAreas: Array<Area | null>, supporting: PlanItem[]): PlanBlock[] {
  const sum = (r: Partial<Record<WorkArea, number>>) => Object.values(r).reduce((s, v) => s + (v ?? 0), 0);
  let open = Math.max(0, input.workTargetMinutes - sum(input.worked) - sum(input.planned));
  if (open < 30) return [];
  if (input.focus) return allocateFocus(input, input.focus, open);

  const want: Array<[WorkArea, number]> = [];
  for (const area of ["trading", "imperium", "websites"] as const) {
    const target = (input.hourTargets[area] ?? 0) * 60;
    if (target <= 0) continue;
    const need = Math.min(open, Math.max(0, target - (input.worked[area] ?? 0) - (input.planned[area] ?? 0)));
    const rounded = Math.floor(need / 30) * 30;
    if (rounded > 0) {
      want.push([area, rounded]);
      open -= rounded;
    }
  }

  const weight = (area: "imperium" | "websites") =>
    1 + bigAreas.filter((a) => a === area).length * 2 + supporting.filter((s) => s.area === area).length;
  const wi = weight("imperium");
  const ww = weight("websites");
  const imperium = Math.round((open * wi) / (wi + ww) / 30) * 30;
  const websites = Math.floor((open - imperium) / 30) * 30;
  if (imperium > 0) want.push(["imperium", imperium]);
  if (websites > 0) want.push(["websites", websites]);

  // Order: the businesses in today's Big 3 first, in that order.
  const order = (area: WorkArea) => {
    const i = bigAreas.indexOf(area);
    return i === -1 ? 99 : i;
  };
  want.sort((a, b) => order(a[0]) - order(b[0]));

  return lay(input, want);
}

/**
 * A focus day: each other business's keep-alive (to the nearest 10 minutes still owed), and the
 * rest of the open time to the focus, in blocks of up to two hours. The keep-alives sit after
 * the first deep block, as a break between the long ones.
 */
function allocateFocus(input: PlanInput, focus: "imperium" | "websites" | "trading", open: number): PlanBlock[] {
  const keep: Array<[WorkArea, number]> = [];
  for (const area of ["imperium", "websites", "trading"] as const) {
    if (area === focus) continue;
    const need = (input.hourTargets[area] ?? 0) * 60 - (input.worked[area] ?? 0) - (input.planned[area] ?? 0);
    const minutes = Math.min(open, Math.ceil(need / 10) * 10);
    if (minutes >= 10) {
      keep.push([area, minutes]);
      open -= minutes;
    }
  }
  const deep = Math.floor(open / 30) * 30;
  if (deep <= 0) return lay(input, keep);
  const first = Math.min(120, deep);
  const want: Array<[WorkArea, number]> = [[focus, first], ...keep];
  if (deep > first) want.push([focus, deep - first]);
  return lay(input, want);
}

/** Lays the wanted minutes out on the clock from now (not before 8am), stopping by 11pm. */
function lay(input: PlanInput, want: Array<[WorkArea, number]>): PlanBlock[] {
  const blocks: PlanBlock[] = [];
  let at = Math.max(8 * 60, Math.ceil(input.nowMinutes / 30) * 30);
  for (const [area, minutes] of want) {
    let left = minutes;
    while (left > 0) {
      const len = Math.min(120, left);
      if (at + len > 23 * 60) return blocks;
      blocks.push({ area, start: hhmm(at), end: hhmm(at + len), minutes: len });
      at += len;
      left -= len;
    }
  }
  return blocks;
}
