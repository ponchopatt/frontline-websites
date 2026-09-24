import "server-only";
import { cache } from "react";
import { fetchAll, firstDayOf, loadSummaries, type Viewer } from "../data";
import { addDays, type LocalDate } from "../day";
import type { Area } from "../areas";
import type { DayValues } from "../metrics";
import { keepsChain, scoreForSummary } from "../streak";
import type { GoalChain } from "../types";
import type { Database } from "../supabase/database.types";
import {
  coreFromRow,
  type AnyGoal,
  type DailyGoal,
  type DayZone,
  type GoalRow,
  type LifeArea,
  type Milestone,
  type MonthlyGoal,
  type WeeklyGoal,
  type YearlyGoal,
} from "./model";
import { monthOfWeek, yearEnd, yearStart } from "./periods";
import { evaluateGoals, periodOf, type ExecutionData, type GoalProgress, type GoalTree } from "./progress";

type Tables = Database["public"]["Tables"];
type YearlyRow = Tables["yearly_goals"]["Row"];
type MonthlyRow = Tables["monthly_goals"]["Row"];
type WeeklyRow = Tables["weekly_goals"]["Row"];
type DailyRow = Tables["daily_goals"]["Row"];

/** Rows → goals. `zone` is the user's timezone and day start, for the day each goal was set. */
export function mapYearly(r: YearlyRow, zone: DayZone): YearlyGoal {
  return { ...coreFromRow(r as unknown as GoalRow, zone), level: "yearly", year: r.year };
}
export function mapMonthly(r: MonthlyRow, zone: DayZone): MonthlyGoal {
  return { ...coreFromRow(r as unknown as GoalRow, zone), level: "monthly", monthStart: r.month_start, parentYearlyId: r.parent_yearly_goal_id };
}
export function mapWeekly(r: WeeklyRow, zone: DayZone): WeeklyGoal {
  return {
    ...coreFromRow(r as unknown as GoalRow, zone),
    level: "weekly",
    weekStart: r.week_start,
    parentMonthlyId: r.parent_monthly_goal_id,
    isMajor: r.is_major,
    carriedFromId: r.carried_from_id,
  };
}
export function mapDaily(r: DailyRow): DailyGoal {
  return {
    id: r.id,
    localDate: r.local_date,
    parentWeeklyId: r.parent_weekly_goal_id,
    title: r.title,
    quantity: r.quantity === null ? null : Number(r.quantity),
    unit: r.unit,
    estimatedMinutes: r.estimated_minutes,
    rank: (r.rank as 1 | 2 | 3 | null) ?? null,
    status: r.status,
    source: r.source as DailyGoal["source"],
    workBlockId: r.work_block_id,
    carriedFromId: r.carried_from_id,
    completedAt: r.completed_at,
    area: r.area,
    metricId: r.metric_id,
    priority: Math.min(3, Math.max(1, r.priority)) as 1 | 2 | 3,
    dueDate: r.due_date,
    notes: r.notes,
    category: r.category,
  };
}

/** Areas of life, created on first use for accounts made before goals existed. */
export async function loadLifeAreas(viewer: Viewer): Promise<LifeArea[]> {
  let { data } = await viewer.supabase.from("life_areas").select("*").order("sort_order");
  if (!data || data.length === 0) {
    await viewer.supabase.rpc("ensure_life_areas");
    ({ data } = await viewer.supabase.from("life_areas").select("*").order("sort_order"));
  }
  return (data ?? []).map((a) => ({ id: a.id, name: a.name, key: (a.key as Area | null) ?? null, sortOrder: a.sort_order, isActive: a.is_active }));
}

export interface Vision {
  becoming: string;
  why: string;
}

export async function loadVision(viewer: Viewer): Promise<Vision> {
  const { data } = await viewer.supabase.from("goals").select("kind,content").in("kind", ["becoming", "why"]);
  const get = (k: string) => data?.find((r) => r.kind === k)?.content ?? "";
  return { becoming: get("becoming"), why: get("why") };
}

export interface GoalYear {
  year: number;
  tree: GoalTree;
  milestones: Milestone[];
  progress: Map<string, GoalProgress>;
  exec: ExecutionData;
  /** All daily actions in the range, for breadcrumbs and carry-over. */
  daily: DailyGoal[];
}

/**
 * Every goal for a year with its progress, computed from the goals and from what actually
 * happened (work sessions, habit ticks, completed actions, milestones, Keep My Word).
 *
 * Paged queries sort on a unique key last, so no row is skipped or repeated between pages.
 */
export const loadGoalYear = cache(async (viewer: Viewer, year: number): Promise<GoalYear> => {
  const { supabase } = viewer;
  const from = addDays(yearStart(year), -6);
  const to = yearEnd(year);
  // The year's last week can run into January (the week of Mon 28 Dec 2026 ends on 3 Jan).
  const execTo = addDays(to, 7);

  const [yearlyRes, monthlyRes, weekly, milestonesRes, daily, sessions] = await Promise.all([
    supabase.from("yearly_goals").select("*").eq("year", year).order("priority").order("sort_order").order("created_at"),
    supabase.from("monthly_goals").select("*").gte("month_start", yearStart(year)).lte("month_start", to).order("month_start").order("sort_order").order("created_at"),
    fetchAll<WeeklyRow>((a, b) =>
      supabase.from("weekly_goals").select("*").gte("week_start", from).lte("week_start", to).order("week_start").order("is_major", { ascending: false }).order("sort_order").order("created_at").order("id").range(a, b),
    ),
    supabase.from("goal_milestones").select("*").order("sort_order").order("due_date"),
    fetchAll<DailyRow>((a, b) =>
      supabase.from("daily_goals").select("*").gte("local_date", from).lte("local_date", execTo).order("local_date").order("rank").order("id").range(a, b),
    ),
    fetchAll<{ local_date: string; started_at: string; ended_at: string | null }>((a, b) =>
      supabase.from("work_sessions").select("local_date,started_at,ended_at").gte("local_date", from).lte("local_date", execTo).order("id").range(a, b),
    ),
  ]);
  for (const res of [yearlyRes, monthlyRes, milestonesRes]) {
    if (res.error) throw new Error(`Your goals couldn't be loaded: ${res.error.message}`);
  }

  const tree: GoalTree = {
    yearly: (yearlyRes.data ?? []).map((r) => mapYearly(r, viewer.profile)),
    monthly: (monthlyRes.data ?? []).map((r) => mapMonthly(r, viewer.profile)),
    weekly: weekly.map((r) => mapWeekly(r, viewer.profile)),
  };
  const milestones: Milestone[] = (milestonesRes.data ?? []).map((m) => ({
    id: m.id,
    yearlyGoalId: m.yearly_goal_id,
    monthlyGoalId: m.monthly_goal_id,
    title: m.title,
    dueDate: m.due_date,
    done: m.done,
  }));

  const now = Date.now();
  const workMinutes = new Map<LocalDate, number>();
  for (const s of sessions) {
    const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
    const mins = Math.max(0, (end - new Date(s.started_at).getTime()) / 60000);
    workMinutes.set(s.local_date, (workMinutes.get(s.local_date) ?? 0) + mins);
  }

  const habitIds = [...new Set([...tree.yearly, ...tree.monthly, ...tree.weekly].map((g) => g.habitId).filter((id): id is string => Boolean(id)))];
  const habitDays = new Map<string, Set<LocalDate>>();
  if (habitIds.length > 0) {
    const completions = await fetchAll<{ habit_id: string; local_date: string }>((a, b) =>
      supabase.from("habit_completions").select("habit_id,local_date").in("habit_id", habitIds).gte("local_date", from).lte("local_date", execTo).order("id").range(a, b),
    );
    for (const c of completions) {
      if (!habitDays.has(c.habit_id)) habitDays.set(c.habit_id, new Set());
      habitDays.get(c.habit_id)!.add(c.local_date);
    }
  }

  const dailyGoals = daily.map(mapDaily);
  const actionsByWeekly = new Map<string, number>();
  for (const d of dailyGoals) {
    if (d.status !== "done" || !d.parentWeeklyId) continue;
    actionsByWeekly.set(d.parentWeeklyId, (actionsByWeekly.get(d.parentWeeklyId) ?? 0) + (d.quantity ?? 1));
  }

  // Goals measured by a counter read its values straight from the counter.
  const metricIds = [...new Set([...tree.yearly, ...tree.monthly, ...tree.weekly].map((g) => g.metricId).filter((id): id is string => Boolean(id)))];
  const metrics = new Map<string, { aggregation: "sum" | "latest"; values: DayValues }>();
  if (metricIds.length > 0) {
    const [defs, entries] = await Promise.all([
      supabase.from("metrics").select("id,aggregation").in("id", metricIds),
      fetchAll<{ metric_id: string; local_date: string; value: number }>((a, b) =>
        supabase.from("metric_entries").select("metric_id,local_date,value").in("metric_id", metricIds).gte("local_date", from).lte("local_date", execTo).order("id").range(a, b),
      ),
    ]);
    for (const d of defs.data ?? []) metrics.set(d.id, { aggregation: d.aggregation, values: new Map() });
    for (const e of entries) metrics.get(e.metric_id)?.values.set(e.local_date, Number(e.value));
  }

  const wordKept = await loadWordKept(viewer, [...tree.yearly, ...tree.monthly, ...tree.weekly]);

  const exec: ExecutionData = { workMinutes, habitDays, actionsByWeekly, milestones, metrics, wordKept };
  return { year, tree, milestones, progress: evaluateGoals(tree, exec, viewer.today), exec, daily: dailyGoals };
});

/**
 * Keep My Word by day, for goals measured by it: the same day scores and streak line as the
 * streak and Progress, counting each day once it's over (today once it's closed). Only loaded
 * when a goal needs it.
 */
async function loadWordKept(viewer: Viewer, goals: AnyGoal[]): Promise<Map<LocalDate, boolean> | undefined> {
  const periods = goals.filter((g) => g.progressSource === "keep_word").map(periodOf);
  if (periods.length === 0) return undefined;
  const first = firstDayOf(viewer);
  const start = periods.reduce((min, p) => (p.start < min ? p.start : min), periods[0].start);
  const end = periods.reduce((max, p) => (p.end > max ? p.end : max), periods[0].end);
  const from = start > first ? start : first;
  const to = end < viewer.today ? end : viewer.today;
  const kept = new Map<LocalDate, boolean>();
  if (from > to) return kept;
  for (const s of await loadSummaries(viewer.supabase, from, to)) {
    const day = scoreForSummary(s, viewer.profile.workTargetHours);
    if (day.date === viewer.today && !day.locked) continue;
    kept.set(day.date, keepsChain(day, viewer.profile.streakThreshold));
  }
  return kept;
}

/** The chain above a weekly goal, for "Today → Week → Month → Year". */
export interface Lineage {
  weekly: WeeklyGoal | null;
  monthly: MonthlyGoal | null;
  yearly: YearlyGoal | null;
}

export function lineageOf(data: GoalYear, weeklyId: string | null): Lineage {
  const weekly = weeklyId ? data.tree.weekly.find((w) => w.id === weeklyId) ?? null : null;
  const monthly = weekly?.parentMonthlyId ? data.tree.monthly.find((m) => m.id === weekly.parentMonthlyId) ?? null : null;
  const yearly = monthly?.parentYearlyId ? data.tree.yearly.find((y) => y.id === monthly.parentYearlyId) ?? null : null;
  return { weekly, monthly, yearly };
}

/** The year whose goals govern a week (by the week's month). */
export function yearOfWeek(weekStart: LocalDate): number {
  return Number(monthOfWeek(weekStart).slice(0, 4));
}

export function chainOf(data: GoalYear, weeklyId: string | null): GoalChain | null {
  const l = lineageOf(data, weeklyId);
  if (!l.weekly) return null;
  return {
    weekly: { id: l.weekly.id, title: l.weekly.title, weekStart: l.weekly.weekStart },
    monthly: l.monthly ? { id: l.monthly.id, title: l.monthly.title, monthStart: l.monthly.monthStart } : null,
    yearly: l.yearly ? { id: l.yearly.id, title: l.yearly.title, year: l.yearly.year } : null,
  };
}
