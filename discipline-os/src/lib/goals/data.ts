import "server-only";
import { fetchAll, type Viewer } from "../data";
import { addDays, startOfWeek, type LocalDate } from "../day";
import type { GoalChain, PlanSuggestion, TodayPlan } from "../types";
import type { Database } from "../supabase/database.types";
import {
  coreFromRow,
  type DailyGoal,
  type GoalRow,
  type LifeArea,
  type Milestone,
  type MonthlyGoal,
  type WeeklyGoal,
  type YearlyGoal,
} from "./model";
import { monthOfWeek, weekEndOf, yearEnd, yearStart } from "./periods";
import { evaluateGoals, type ExecutionData, type GoalProgress, type GoalTree } from "./progress";
import { suggestToday, type Suggestion, type WeeklyContext } from "./suggest";

type Tables = Database["public"]["Tables"];
type YearlyRow = Tables["yearly_goals"]["Row"];
type MonthlyRow = Tables["monthly_goals"]["Row"];
type WeeklyRow = Tables["weekly_goals"]["Row"];
type DailyRow = Tables["daily_goals"]["Row"];

export function mapYearly(r: YearlyRow): YearlyGoal {
  return { ...coreFromRow(r as unknown as GoalRow), level: "yearly", year: r.year };
}
export function mapMonthly(r: MonthlyRow): MonthlyGoal {
  return { ...coreFromRow(r as unknown as GoalRow), level: "monthly", monthStart: r.month_start, parentYearlyId: r.parent_yearly_goal_id };
}
export function mapWeekly(r: WeeklyRow): WeeklyGoal {
  return {
    ...coreFromRow(r as unknown as GoalRow),
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
  };
}

/** Areas of life, created on first use for accounts made before goals existed. */
export async function loadLifeAreas(viewer: Viewer): Promise<LifeArea[]> {
  let { data } = await viewer.supabase.from("life_areas").select("*").order("sort_order");
  if (!data || data.length === 0) {
    await viewer.supabase.rpc("ensure_life_areas");
    ({ data } = await viewer.supabase.from("life_areas").select("*").order("sort_order"));
  }
  return (data ?? []).map((a) => ({ id: a.id, name: a.name, sortOrder: a.sort_order, isActive: a.is_active }));
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
 * happened (work sessions, habit ticks, completed actions, milestones).
 */
export async function loadGoalYear(viewer: Viewer, year: number): Promise<GoalYear> {
  const { supabase } = viewer;
  const from = addDays(yearStart(year), -6);
  const to = yearEnd(year);

  const [yearlyRes, monthlyRes, weekly, milestonesRes, daily, sessions] = await Promise.all([
    supabase.from("yearly_goals").select("*").eq("year", year).order("priority").order("sort_order").order("created_at"),
    supabase.from("monthly_goals").select("*").gte("month_start", yearStart(year)).lte("month_start", to).order("month_start").order("sort_order").order("created_at"),
    fetchAll<WeeklyRow>((a, b) =>
      supabase.from("weekly_goals").select("*").gte("week_start", from).lte("week_start", to).order("week_start").order("is_major", { ascending: false }).order("sort_order").order("created_at").range(a, b),
    ),
    supabase.from("goal_milestones").select("*").order("sort_order").order("due_date"),
    fetchAll<DailyRow>((a, b) =>
      supabase.from("daily_goals").select("*").gte("local_date", from).lte("local_date", addDays(to, 7)).order("local_date").order("rank").range(a, b),
    ),
    fetchAll<{ local_date: string; started_at: string; ended_at: string | null }>((a, b) =>
      supabase.from("work_sessions").select("local_date,started_at,ended_at").gte("local_date", from).lte("local_date", to).range(a, b),
    ),
  ]);
  for (const res of [yearlyRes, monthlyRes, milestonesRes]) {
    if (res.error) throw new Error(`Your goals couldn't be loaded: ${res.error.message}`);
  }

  const tree: GoalTree = {
    yearly: (yearlyRes.data ?? []).map(mapYearly),
    monthly: (monthlyRes.data ?? []).map(mapMonthly),
    weekly: weekly.map(mapWeekly),
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
      supabase.from("habit_completions").select("habit_id,local_date").in("habit_id", habitIds).gte("local_date", from).lte("local_date", to).range(a, b),
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

  const exec: ExecutionData = { workMinutes, habitDays, actionsByWeekly, milestones };
  return { year, tree, milestones, progress: evaluateGoals(tree, exec, viewer.today), exec, daily: dailyGoals };
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

export function weekIsOver(weekStart: LocalDate, today: LocalDate): boolean {
  return weekEndOf(weekStart) < today;
}

function chainOf(data: GoalYear, weeklyId: string | null): GoalChain | null {
  const l = lineageOf(data, weeklyId);
  if (!l.weekly) return null;
  return {
    weekly: { id: l.weekly.id, title: l.weekly.title, weekStart: l.weekly.weekStart },
    monthly: l.monthly ? { id: l.monthly.id, title: l.monthly.title, monthStart: l.monthly.monthStart } : null,
    yearly: l.yearly ? { id: l.yearly.id, title: l.yearly.title, year: l.yearly.year } : null,
  };
}

/**
 * Today's goal plan: this week's goals turned into ranked suggestions (only for today, and
 * only while the day is open), plus the actions already accepted, each with what it supports.
 */
export async function loadTodayPlan(
  viewer: Viewer,
  date: LocalDate,
  opts: { plannedMinutes: number; locked: boolean },
): Promise<TodayPlan> {
  const weekStart = startOfWeek(date);
  const data = await loadGoalYear(viewer, yearOfWeek(weekStart));
  const { data: deps } = await viewer.supabase.from("goal_dependencies").select("blocker_id,blocked_id").eq("level", "weekly");

  const weekly = data.tree.weekly.filter((w) => w.weekStart === weekStart && w.state === "active");
  const todayActions = data.daily.filter((d) => d.localDate === date);
  const carriedFrom = new Set(data.daily.map((d) => d.carriedFromId).filter(Boolean));
  const unfinished = data.daily.filter(
    (d) => d.localDate >= weekStart && d.localDate < date && d.status === "pending" && !carriedFrom.has(d.id),
  );

  let big3: PlanSuggestion[] = [];
  let supporting: PlanSuggestion[] = [];
  if (date === viewer.today && !opts.locked) {
    const contexts: WeeklyContext[] = weekly.map((goal) => {
      const l = lineageOf(data, goal.id);
      return {
        goal,
        progress: data.progress.get(goal.id)!,
        monthly: l.monthly,
        monthlyProgress: l.monthly ? data.progress.get(l.monthly.id) ?? null : null,
        yearly: l.yearly,
        unblocks: (deps ?? [])
          .filter((d) => d.blocker_id === goal.id)
          .map((d) => weekly.find((w) => w.id === d.blocked_id)?.title)
          .filter((t): t is string => Boolean(t)),
      };
    });
    const pendingMinutes = todayActions.filter((a) => a.status === "pending").reduce((s, a) => s + (a.estimatedMinutes ?? 0), 0);
    const result = suggestToday({
      today: date,
      weekly: contexts,
      todayActions,
      unfinished,
      availableMinutes: Math.max(0, viewer.profile.workTargetHours * 60 - opts.plannedMinutes - pendingMinutes),
    });
    const withChain = (s: Suggestion): PlanSuggestion => ({
      key: s.key,
      title: s.title,
      quantity: s.quantity,
      unit: s.unit,
      estimatedMinutes: s.estimatedMinutes,
      weeklyGoalId: s.weeklyGoalId,
      carriedFromId: s.carriedFromId,
      createsWorkBlock: s.createsWorkBlock,
      reasons: s.reasons,
      chain: chainOf(data, s.weeklyGoalId),
    });
    big3 = result.big3.map(withChain);
    supporting = result.supporting.map(withChain);
  }

  return {
    big3,
    supporting,
    actions: todayActions.map((a) => ({
      id: a.id,
      title: a.title,
      quantity: a.quantity,
      unit: a.unit,
      rank: a.rank,
      status: a.status,
      chain: chainOf(data, a.parentWeeklyId),
    })),
    hasGoals: data.tree.yearly.some((y) => y.state === "active") || data.tree.monthly.some((m) => m.state === "active"),
    hasWeekPlan: weekly.length > 0,
    weekStart,
  };
}
