"use server";

import { z } from "zod";
import { dbFail, fail, invalid, localDateSchema, ok, uuidSchema } from "@/lib/action-helpers";
import { getViewer } from "@/lib/data";
import { addDays } from "@/lib/day";
import { formatValue } from "@/lib/goals/format";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types";

type Tables = Database["public"]["Tables"];
type CommonColumn =
  | "title" | "description" | "why" | "success" | "life_area_id" | "goal_type" | "metric" | "unit" | "cadence"
  | "aggregation" | "progress_source" | "start_value" | "target_value" | "habit_id" | "metric_id" | "priority" | "deadline";
/** The columns every goal level shares. */
type CommonUpdate = Pick<Tables["yearly_goals"]["Update"], CommonColumn>;

const LEVEL_TABLE = { yearly: "yearly_goals", monthly: "monthly_goals", weekly: "weekly_goals" } as const;
const levelSchema = z.enum(["yearly", "monthly", "weekly"]);

const numberOrNull = z
  .union([z.number(), z.null()])
  .refine((n) => n === null || Number.isFinite(n), { message: "Enter a number." });

const text = (max: number, label: string) =>
  z.string().trim().max(max, `Keep ${label} under ${max} characters.`).nullish().transform((v) => (v ? v : null));

/** Fields every goal shares, as the forms send them. */
const goalFields = z.object({
  title: z.string().trim().min(1, "Give the goal a name.").max(140, "Keep the name under 140 characters."),
  description: text(2000, "the description"),
  why: text(2000, "the reason"),
  success: text(500, "what success looks like"),
  lifeAreaId: uuidSchema.nullish().transform((v) => v ?? null),
  goalType: z.enum(["outcome", "performance", "process", "habit", "milestone", "binary"]),
  metric: text(60, "the measurement"),
  unit: text(20, "the unit"),
  cadence: z.enum(["total", "per_week", "per_month"]).default("total"),
  aggregation: z.enum(["sum", "latest"]).default("sum"),
  progressSource: z.enum(["manual", "children", "work_hours", "habit", "actions", "milestones", "metric"]),
  startValue: numberOrNull.default(null),
  targetValue: numberOrNull.default(null),
  habitId: uuidSchema.nullish().transform((v) => v ?? null),
  metricId: uuidSchema.nullish().transform((v) => v ?? null),
  priority: z.number().int().min(1).max(3).default(2),
  deadline: localDateSchema.nullish().transform((v) => v ?? null),
});
type GoalFields = z.infer<typeof goalFields>;

function goalColumns(f: GoalFields) {
  return {
    title: f.title,
    description: f.description,
    why: f.why,
    success: f.success,
    life_area_id: f.lifeAreaId,
    goal_type: f.goalType,
    metric: f.metric,
    unit: f.unit,
    cadence: f.cadence,
    aggregation: f.aggregation,
    progress_source: f.progressSource,
    start_value: f.startValue,
    target_value: f.targetValue,
    habit_id: f.habitId,
    metric_id: f.progressSource === "metric" ? f.metricId : null,
    priority: f.priority,
    deadline: f.deadline,
  };
}

/**
 * Counter ids for plan rows: a row that names its counter by key ("leads_called") gets the id
 * of that counter in the parent goal's business.
 */
async function resolveMetrics(
  supabase: Awaited<ReturnType<typeof getViewer>>["supabase"],
  lifeAreaId: string | null,
  drafts: Array<{ metricId: string | null; metricKey: string | null; progressSource: string }>,
): Promise<Array<string | null>> {
  const keys = [...new Set(drafts.map((d) => d.metricKey).filter((k): k is string => Boolean(k)))];
  let byKey = new Map<string, string>();
  if (keys.length > 0 && lifeAreaId) {
    const { data: area } = await supabase.from("life_areas").select("key").eq("id", lifeAreaId).maybeSingle();
    if (area?.key) {
      const { data } = await supabase.from("metrics").select("id,key").eq("area", area.key).in("key", keys);
      byKey = new Map((data ?? []).map((m) => [m.key, m.id]));
    }
  }
  return drafts.map((d) => (d.progressSource === "metric" ? d.metricId ?? (d.metricKey ? byKey.get(d.metricKey) ?? null : null) : null));
}

/* ------------------------------------------------------------------ My Life */

const visionSchema = z.object({
  kind: z.enum(["becoming", "why"]),
  content: z.string().max(4000, "Keep this under 4000 characters."),
});

export async function saveVision(input: z.input<typeof visionSchema>): Promise<ActionResult> {
  const parsed = visionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  const { error } = await viewer.supabase
    .from("goals")
    .upsert({ user_id: viewer.userId, kind: parsed.data.kind, content: parsed.data.content.trim() || null }, { onConflict: "user_id,kind" });
  if (error) return dbFail(error);
  return ok();
}

const areaNameSchema = z.string().trim().min(1, "Name the area.").max(40, "Keep the name under 40 characters.");

export async function addLifeArea(input: { name: string }): Promise<ActionResult<{ id: string; name: string; sortOrder: number }>> {
  const parsed = areaNameSchema.safeParse(input.name);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { data: last } = await supabase.from("life_areas").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("life_areas")
    .insert({ name: parsed.data, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("id,name,sort_order")
    .single();
  if (error?.code === "23505") return fail("You already have an area with that name.");
  if (error || !data) return dbFail(error ?? {});
  return ok({ id: data.id, name: data.name, sortOrder: data.sort_order });
}

const areaUpdateSchema = z.object({ id: uuidSchema, name: areaNameSchema.optional(), isActive: z.boolean().optional() });

export async function updateLifeArea(input: z.input<typeof areaUpdateSchema>): Promise<ActionResult> {
  const parsed = areaUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const patch: Tables["life_areas"]["Update"] = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.isActive !== undefined) patch.is_active = parsed.data.isActive;
  const { error } = await supabase.from("life_areas").update(patch).eq("id", parsed.data.id);
  if (error?.code === "23505") return fail("You already have an area with that name.");
  if (error) return dbFail(error);
  return ok();
}

/* ------------------------------------------------------------------ yearly goals */

const createYearlySchema = goalFields.extend({
  year: z.number().int().min(2000).max(2100),
  /** The controllable process goal offered alongside an outcome goal. */
  process: goalFields.nullish(),
});

export async function createYearlyGoal(input: z.input<typeof createYearlySchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = createYearlySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  const { year, process, ...fields } = parsed.data;
  if (fields.deadline && Number(fields.deadline.slice(0, 4)) !== year) return fail(`The deadline has to fall in ${year}.`);

  const { data, error } = await viewer.supabase
    .from("yearly_goals")
    .insert({ year, ...goalColumns(fields), current_value: fields.startValue })
    .select("id")
    .single();
  if (error || !data) return dbFail(error ?? {}, "The goal wasn't saved. Try again.");

  if (process) {
    const { error: processError } = await viewer.supabase
      .from("yearly_goals")
      .insert({ year, ...goalColumns({ ...process, lifeAreaId: process.lifeAreaId ?? fields.lifeAreaId, why: process.why ?? fields.why }) });
    if (processError) return dbFail(processError, "The goal was saved, but its process goal wasn't. Add it again.");
  }
  return ok({ id: data.id });
}

const updateSchema = z.object({
  level: levelSchema,
  id: uuidSchema,
  fields: z.record(z.string(), z.unknown()),
});

const COLUMN: Record<keyof GoalFields, CommonColumn> = {
  title: "title",
  description: "description",
  why: "why",
  success: "success",
  lifeAreaId: "life_area_id",
  metricId: "metric_id",
  goalType: "goal_type",
  metric: "metric",
  unit: "unit",
  cadence: "cadence",
  aggregation: "aggregation",
  progressSource: "progress_source",
  startValue: "start_value",
  targetValue: "target_value",
  habitId: "habit_id",
  priority: "priority",
  deadline: "deadline",
};

/** Edits a goal at any level. Only the fields sent change; each is validated on its own. */
export async function updateGoal(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data.fields)) {
    if (!(key in COLUMN)) return fail("That field can't be changed.");
    const field = goalFields.shape[key as keyof GoalFields];
    const one = field.safeParse(value);
    if (!one.success) return invalid(one.error);
    patch[COLUMN[key as keyof GoalFields]] = one.data;
  }
  if (Object.keys(patch).length === 0) return ok();
  const { supabase } = await getViewer();
  const { error } = await supabase.from(LEVEL_TABLE[parsed.data.level]).update(patch as CommonUpdate).eq("id", parsed.data.id);
  if (error) return dbFail(error, "The change wasn't saved. Try again.");
  return ok();
}

const stateSchema = z.object({
  level: levelSchema,
  id: uuidSchema,
  state: z.enum(["active", "completed", "missed", "cancelled"]),
});

export async function setGoalState(input: z.input<typeof stateSchema>): Promise<ActionResult> {
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { error } = await supabase
    .from(LEVEL_TABLE[parsed.data.level])
    .update({ state: parsed.data.state, completed_at: parsed.data.state === "completed" ? new Date().toISOString() : null })
    .eq("id", parsed.data.id);
  if (error) return dbFail(error, "The change wasn't saved. Try again.");
  return ok();
}

const logSchema = z.object({ level: levelSchema, id: uuidSchema, value: z.number().refine(Number.isFinite, "Enter a number.") });

/** Records where a manually tracked goal stands now (revenue so far, today's best lift). */
export async function logProgress(input: z.input<typeof logSchema>): Promise<ActionResult> {
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { error } = await supabase.from(LEVEL_TABLE[parsed.data.level]).update({ current_value: parsed.data.value }).eq("id", parsed.data.id);
  if (error) return dbFail(error, "Progress wasn't saved. Try again.");
  return ok();
}

const removeSchema = z.object({ level: z.enum(["monthly", "weekly"]), id: uuidSchema });

/** Removes a monthly or weekly goal added by mistake (and anything planned under it). */
export async function removeGoal(input: z.input<typeof removeSchema>): Promise<ActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { error } = await supabase.from(LEVEL_TABLE[parsed.data.level]).delete().eq("id", parsed.data.id);
  if (error) return dbFail(error, "It wasn't removed. Try again.");
  return ok();
}

/* ------------------------------------------------------------------ milestones */

export async function addMilestone(input: { yearlyGoalId: string; title: string; dueDate: string | null }): Promise<ActionResult<{ id: string }>> {
  const parsed = z
    .object({
      yearlyGoalId: uuidSchema,
      title: z.string().trim().min(1, "Name the milestone.").max(140, "Keep it under 140 characters."),
      dueDate: localDateSchema.nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { data, error } = await supabase
    .from("goal_milestones")
    .insert({ yearly_goal_id: parsed.data.yearlyGoalId, title: parsed.data.title, due_date: parsed.data.dueDate })
    .select("id")
    .single();
  if (error || !data) return dbFail(error ?? {});
  return ok({ id: data.id });
}

export async function setMilestoneDone(input: { id: string; done: boolean }): Promise<ActionResult> {
  const parsed = z.object({ id: uuidSchema, done: z.boolean() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { error } = await supabase
    .from("goal_milestones")
    .update({ done: parsed.data.done, completed_at: parsed.data.done ? new Date().toISOString() : null })
    .eq("id", parsed.data.id);
  if (error) return dbFail(error);
  return ok();
}

/* ------------------------------------------------------------------ breakdowns */

const draftSchema = z.object({
  periodStart: localDateSchema,
  title: z.string().trim().min(1, "Every row needs a name.").max(140, "Keep each name under 140 characters."),
  goalType: z.enum(["outcome", "performance", "process", "habit", "milestone", "binary"]),
  unit: z.string().trim().max(20).nullable(),
  metric: z.string().trim().max(60).nullable(),
  cadence: z.enum(["total", "per_week", "per_month"]),
  aggregation: z.enum(["sum", "latest"]),
  progressSource: z.enum(["manual", "children", "work_hours", "habit", "actions", "milestones", "metric"]),
  targetValue: numberOrNull,
  isMajor: z.boolean(),
  why: z.string().max(2000).nullable(),
  metricId: uuidSchema.nullish().transform((v) => v ?? null),
  metricKey: z.string().max(40).nullish().transform((v) => v ?? null),
});

const monthlyPlanSchema = z.object({
  yearlyGoalId: uuidSchema,
  drafts: z.array(draftSchema).min(1, "Keep at least one month.").max(24),
});

/** Saves the approved months of a yearly goal's breakdown. */
export async function approveMonthlyPlan(input: z.input<typeof monthlyPlanSchema>): Promise<ActionResult<{ count: number }>> {
  const parsed = monthlyPlanSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { data: parent } = await supabase.from("yearly_goals").select("id,life_area_id,habit_id,priority,year").eq("id", parsed.data.yearlyGoalId).maybeSingle();
  if (!parent) return fail("That goal couldn't be found.");
  if (parsed.data.drafts.some((d) => !d.periodStart.endsWith("-01") || Number(d.periodStart.slice(0, 4)) !== parent.year)) {
    return fail(`Each month has to be in ${parent.year}.`);
  }
  const metricIds = await resolveMetrics(supabase, parent.life_area_id, parsed.data.drafts);
  const rows: Tables["monthly_goals"]["Insert"][] = parsed.data.drafts.map((d, i) => ({
    metric_id: metricIds[i],
    month_start: d.periodStart,
    parent_yearly_goal_id: parent.id,
    life_area_id: parent.life_area_id,
    habit_id: parent.habit_id,
    priority: parent.priority,
    title: d.title,
    goal_type: d.goalType,
    unit: d.unit,
    metric: d.metric,
    cadence: d.cadence,
    aggregation: d.aggregation,
    progress_source: d.progressSource === "metric" && !metricIds[i] ? "actions" : d.progressSource,
    target_value: d.targetValue,
    why: d.why,
    sort_order: i,
  }));
  const { error } = await supabase.from("monthly_goals").insert(rows);
  if (error) return dbFail(error, "The monthly plan wasn't saved. Try again.");
  return ok({ count: rows.length });
}

const weeklyPlanSchema = z.object({
  monthlyGoalId: uuidSchema,
  drafts: z.array(draftSchema).min(1, "Keep at least one goal.").max(60),
});

function isMonday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1;
}

/** Saves the approved weeks of a monthly goal's breakdown. */
export async function approveWeeklyPlan(input: z.input<typeof weeklyPlanSchema>): Promise<ActionResult<{ count: number }>> {
  const parsed = weeklyPlanSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { data: parent } = await supabase.from("monthly_goals").select("id,life_area_id,habit_id,priority").eq("id", parsed.data.monthlyGoalId).maybeSingle();
  if (!parent) return fail("That goal couldn't be found.");
  if (parsed.data.drafts.some((d) => !isMonday(d.periodStart))) return fail("Each week has to start on a Monday.");
  const metricIds = await resolveMetrics(supabase, parent.life_area_id, parsed.data.drafts);
  const rows: Tables["weekly_goals"]["Insert"][] = parsed.data.drafts.map((d, i) => ({
    metric_id: metricIds[i],
    week_start: d.periodStart,
    parent_monthly_goal_id: parent.id,
    life_area_id: parent.life_area_id,
    habit_id: d.progressSource === "habit" ? parent.habit_id : null,
    priority: parent.priority,
    is_major: d.isMajor,
    title: d.title,
    goal_type: d.goalType,
    unit: d.unit,
    metric: d.metric,
    cadence: d.cadence,
    aggregation: d.aggregation,
    progress_source: d.progressSource === "metric" && !metricIds[i] ? "actions" : d.progressSource,
    target_value: d.targetValue,
    why: d.why,
    sort_order: i,
  }));
  const { error } = await supabase.from("weekly_goals").insert(rows);
  if (error) return dbFail(error, "The weekly plan wasn't saved. Try again.");
  return ok({ count: rows.length });
}

const addMonthlySchema = goalFields.extend({ monthStart: localDateSchema, parentYearlyId: uuidSchema.nullish() });

export async function createMonthlyGoal(input: z.input<typeof addMonthlySchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = addMonthlySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!parsed.data.monthStart.endsWith("-01")) return fail("A month starts on the 1st.");
  const { supabase } = await getViewer();
  const { monthStart, parentYearlyId, ...fields } = parsed.data;
  const { data, error } = await supabase
    .from("monthly_goals")
    .insert({ month_start: monthStart, parent_yearly_goal_id: parentYearlyId ?? null, ...goalColumns(fields) })
    .select("id")
    .single();
  if (error || !data) return dbFail(error ?? {}, "The goal wasn't saved. Try again.");
  return ok({ id: data.id });
}

const addWeeklySchema = goalFields.extend({
  weekStart: localDateSchema,
  parentMonthlyId: uuidSchema.nullish(),
  isMajor: z.boolean(),
});

export async function createWeeklyGoal(input: z.input<typeof addWeeklySchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = addWeeklySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!isMonday(parsed.data.weekStart)) return fail("A week starts on a Monday.");
  const { supabase } = await getViewer();
  const { weekStart, parentMonthlyId, isMajor, ...fields } = parsed.data;
  let areaId = fields.lifeAreaId;
  if (!areaId && parentMonthlyId) {
    const { data: parent } = await supabase.from("monthly_goals").select("life_area_id").eq("id", parentMonthlyId).maybeSingle();
    areaId = parent?.life_area_id ?? null;
  }
  const { data, error } = await supabase
    .from("weekly_goals")
    .insert({ week_start: weekStart, parent_monthly_goal_id: parentMonthlyId ?? null, is_major: isMajor, ...goalColumns({ ...fields, lifeAreaId: areaId }) })
    .select("id")
    .single();
  if (error || !data) return dbFail(error ?? {}, "The goal wasn't saved. Try again.");
  return ok({ id: data.id });
}

/* ------------------------------------------------------------------ today's actions */

const reviewItemSchema = z.object({
  weeklyGoalId: uuidSchema,
  outcome: z.enum(["completed", "partial", "missed"]),
  target: numberOrNull,
  actual: numberOrNull,
  reason: z.enum(["underestimated_time", "too_ambitious", "procrastination", "unexpected_event", "no_longer_matters", "poor_planning", "other"]).nullable(),
  reasonNote: z.string().trim().max(1000).nullable(),
  decision: z.enum(["carry_forward", "modify", "replace", "cancel"]).nullable(),
});

const weeklyReviewSchema = z
  .object({
    weekStart: localDateSchema,
    items: z.array(reviewItemSchema).max(60),
    wins: z.string().trim().max(2000),
    failure: z.string().trim().max(2000),
    bottleneck: z.string().trim().max(2000),
    focus: z.string().trim().max(2000),
  })
  .refine((r) => r.items.every((i) => i.outcome === "completed" || i.decision !== null), {
    message: "Choose what happens to each goal that wasn't completed.",
  });

/** "$2,000 revenue" carried with $1,500 left becomes "$1,500 revenue". Other titles stay as written. */
function carriedTitle(title: string, target: number | null, left: number | null, unit: string | null): string {
  if (target === null || left === null || left === Number(target)) return title;
  const was = formatValue(Number(target), unit);
  return title.includes(was) ? title.replace(was, formatValue(left, unit)) : title;
}

/**
 * Closes a week: records what happened to each goal and why, then applies the decisions.
 * Carried goals reappear next week with what's left; nothing is deleted. The four questions
 * (biggest win, biggest failure, main bottleneck, next week's #1) are saved with the week.
 */
export async function saveWeeklyReview(input: z.input<typeof weeklyReviewSchema>): Promise<ActionResult<{ carried: number }>> {
  const parsed = weeklyReviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { weekStart, items, wins, failure, bottleneck, focus } = parsed.data;
  if (!isMonday(weekStart)) return fail("A week starts on a Monday.");
  const viewer = await getViewer();
  const { supabase } = viewer;
  if (weekStart > viewer.today) return fail("This week hasn't started yet.");
  const nextWeek = addDays(weekStart, 7);
  let carried = 0;

  for (const item of items) {
    const { data: goal } = await supabase.from("weekly_goals").select("*").eq("id", item.weeklyGoalId).maybeSingle();
    if (!goal) continue;
    const { error: reviewError } = await supabase.from("goal_reviews").upsert(
      {
        period: "week",
        period_start: weekStart,
        weekly_goal_id: goal.id,
        target_value: item.target,
        actual_value: item.actual,
        outcome: item.outcome,
        reason: item.outcome === "completed" ? null : item.reason,
        reason_note: item.reasonNote || null,
        decision: item.outcome === "completed" ? null : item.decision,
      },
      { onConflict: "weekly_goal_id" },
    );
    if (reviewError) return dbFail(reviewError, "The review wasn't saved. Try again.");

    const state = item.outcome === "completed" ? "completed" : item.decision === "cancel" ? "cancelled" : "missed";
    await supabase
      .from("weekly_goals")
      .update({ state, completed_at: state === "completed" ? new Date().toISOString() : null })
      .eq("id", goal.id);

    if (item.outcome !== "completed" && (item.decision === "carry_forward" || item.decision === "modify")) {
      const { data: already } = await supabase.from("weekly_goals").select("id").eq("carried_from_id", goal.id).maybeSingle();
      if (already) continue;
      // What's left of a total carries over; a level (a lift, a weight) keeps its target.
      const left =
        goal.target_value !== null && item.actual !== null && goal.aggregation !== "latest"
          ? Math.max(1, Number(goal.target_value) - item.actual)
          : goal.target_value;
      const { error: carryError } = await supabase.from("weekly_goals").insert({
        user_id: goal.user_id,
        parent_monthly_goal_id: goal.parent_monthly_goal_id,
        is_major: goal.is_major,
        life_area_id: goal.life_area_id,
        title: carriedTitle(goal.title, goal.target_value, left, goal.unit),
        description: goal.description,
        why: goal.why,
        success: goal.success,
        goal_type: goal.goal_type,
        metric: goal.metric,
        unit: goal.unit,
        cadence: goal.cadence,
        aggregation: goal.aggregation,
        progress_source: goal.progress_source,
        habit_id: goal.habit_id,
        priority: goal.priority,
        sort_order: goal.sort_order,
        week_start: nextWeek,
        state: "active",
        current_value: null,
        target_value: left,
        carried_from_id: goal.id,
      });
      if (carryError) return dbFail(carryError, "The goal couldn't be carried forward. Try again.");
      carried += 1;
    }
  }

  const { error } = await supabase.from("weekly_reviews").upsert(
    {
      user_id: viewer.userId,
      week_start_date: weekStart,
      wins: wins || null,
      failure: failure || null,
      bottleneck: bottleneck || null,
      focus_for_next_week: focus || null,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start_date" },
  );
  if (error) return dbFail(error, "The review wasn't saved. Try again.");
  return ok({ carried });
}
