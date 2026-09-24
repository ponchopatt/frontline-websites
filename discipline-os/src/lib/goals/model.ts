import type { LocalDate } from "../day";

/**
 * The goal hierarchy: My Life → Year → (Quarter) → Month → Week → Day.
 * Each level is its own table; these are the shapes the app works with.
 */

export type GoalLevel = "yearly" | "monthly" | "weekly";
export type GoalType = "outcome" | "performance" | "process" | "habit" | "milestone" | "binary";
export type GoalState = "draft" | "active" | "completed" | "missed" | "cancelled";
export type Cadence = "total" | "per_week" | "per_month";
export type Aggregation = "sum" | "latest";
export type ProgressSource = "manual" | "children" | "work_hours" | "habit" | "actions" | "milestones" | "metric";
export type DailyStatus = "pending" | "done" | "dropped";

export const GOAL_TYPES: Array<{ value: GoalType; label: string; hint: string; example: string }> = [
  { value: "outcome", label: "Outcome", hint: "A result you want. You influence it but don't control it.", example: "$300k revenue" },
  { value: "performance", label: "Performance", hint: "A level you can reach.", example: "Bench 180 kg" },
  { value: "process", label: "Process", hint: "Work you commit to doing.", example: "40 focused hours a week" },
  { value: "habit", label: "Habit", hint: "Something done on repeat.", example: "Bible study 6 days a week" },
  { value: "milestone", label: "Milestone", hint: "A project with steps.", example: "Launch the website" },
  { value: "binary", label: "Yes or no", hint: "Done or not done.", example: "Become a catechumen" },
];

export function isNumeric(type: GoalType): boolean {
  return type === "outcome" || type === "performance" || type === "process" || type === "habit";
}

export interface GoalCore {
  id: string;
  title: string;
  description: string | null;
  why: string | null;
  success: string | null;
  lifeAreaId: string | null;
  goalType: GoalType;
  metric: string | null;
  unit: string | null;
  cadence: Cadence;
  aggregation: Aggregation;
  progressSource: ProgressSource;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  habitId: string | null;
  /** The counter this goal is measured by, when its progress source is "metric". */
  metricId: string | null;
  priority: 1 | 2 | 3;
  state: GoalState;
  deadline: LocalDate | null;
  completedAt: string | null;
  sortOrder: number;
  /** The day it was set (UTC date of creation). Pace is judged from here, not from 1 January. */
  createdOn: LocalDate | null;
}

export interface YearlyGoal extends GoalCore {
  level: "yearly";
  year: number;
}

export interface MonthlyGoal extends GoalCore {
  level: "monthly";
  monthStart: LocalDate;
  parentYearlyId: string | null;
}

export interface WeeklyGoal extends GoalCore {
  level: "weekly";
  weekStart: LocalDate;
  parentMonthlyId: string | null;
  isMajor: boolean;
  carriedFromId: string | null;
}

export type AnyGoal = YearlyGoal | MonthlyGoal | WeeklyGoal;

/** A task. Big 3 when ranked 1–3; "later" when it has no day yet. */
export interface DailyGoal {
  id: string;
  localDate: LocalDate | null;
  parentWeeklyId: string | null;
  title: string;
  quantity: number | null;
  unit: string | null;
  estimatedMinutes: number | null;
  rank: 1 | 2 | 3 | null;
  status: DailyStatus;
  source: "manual" | "suggested" | "carried";
  workBlockId: string | null;
  carriedFromId: string | null;
  completedAt: string | null;
  area: string | null;
  metricId: string | null;
  priority: 1 | 2 | 3;
  dueDate: LocalDate | null;
  notes: string | null;
  category: string | null;
}

export interface Milestone {
  id: string;
  yearlyGoalId: string | null;
  monthlyGoalId: string | null;
  title: string;
  dueDate: LocalDate | null;
  done: boolean;
}

export interface LifeArea {
  id: string;
  name: string;
  /** Set for the areas the dashboard tracks (imperium, websites, faith…). */
  key: import("../areas").Area | null;
  sortOrder: number;
  isActive: boolean;
}

/** Row → model. Rows come from Supabase with snake_case columns. */
export interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  why: string | null;
  success: string | null;
  life_area_id: string | null;
  goal_type: GoalType;
  metric: string | null;
  unit: string | null;
  cadence: Cadence;
  aggregation: Aggregation;
  progress_source: ProgressSource;
  start_value: number | null;
  target_value: number | null;
  current_value: number | null;
  habit_id: string | null;
  metric_id?: string | null;
  priority: number;
  state: GoalState;
  deadline: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at?: string | null;
}

function num(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function coreFromRow(r: GoalRow): GoalCore {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    why: r.why,
    success: r.success,
    lifeAreaId: r.life_area_id,
    goalType: r.goal_type,
    metric: r.metric,
    unit: r.unit,
    cadence: r.cadence,
    aggregation: r.aggregation,
    progressSource: r.progress_source,
    startValue: num(r.start_value),
    targetValue: num(r.target_value),
    currentValue: num(r.current_value),
    habitId: r.habit_id,
    metricId: r.metric_id ?? null,
    priority: Math.min(3, Math.max(1, r.priority)) as 1 | 2 | 3,
    state: r.state,
    deadline: r.deadline,
    completedAt: r.completed_at,
    sortOrder: r.sort_order,
    createdOn: r.created_at ? r.created_at.slice(0, 10) : null,
  };
}
