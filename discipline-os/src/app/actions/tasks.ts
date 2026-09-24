"use server";

import { z } from "zod";
import { AREAS, AREA_LABEL, WORK_AREAS, type Area } from "@/lib/areas";
import { dbFail, fail, guardDate, invalid, localDateSchema, ok, uuidSchema } from "@/lib/action-helpers";
import { getViewer, mapTask, recomputeBestStreak, type Viewer } from "@/lib/data";
import type { LocalDate } from "@/lib/day";
import { parseQuickTask } from "@/lib/metrics";
import type { DayPlan } from "@/lib/plan";
import { buildPlan } from "@/lib/plan-server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult, TaskItem, TaskStatus } from "@/lib/types";

type TaskInsert = Database["public"]["Tables"]["daily_goals"]["Insert"];

const titleSchema = z.string().trim().min(1, "Write the task first.").max(140, "Keep a task under 140 characters.");
const prioritySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/** The first Big 3 slot free on a day, or null when all three are taken. */
async function freeRank(viewer: Viewer, date: LocalDate): Promise<1 | 2 | 3 | null> {
  const { data } = await viewer.supabase.from("daily_goals").select("rank").eq("local_date", date).not("rank", "is", null);
  const used = new Set((data ?? []).map((r) => r.rank));
  return ([1, 2, 3] as const).find((r) => !used.has(r)) ?? null;
}

/** Brings a counter up to at least `value` for a day (never down). */
async function raiseCounter(viewer: Viewer, metricId: string, date: LocalDate, value: number) {
  const { data: entry } = await viewer.supabase.from("metric_entries").select("value").eq("metric_id", metricId).eq("local_date", date).maybeSingle();
  if (entry && Number(entry.value) >= value) return Number(entry.value);
  await viewer.supabase
    .from("metric_entries")
    .upsert({ user_id: viewer.userId, metric_id: metricId, local_date: date, value }, { onConflict: "metric_id,local_date" });
  return value;
}

/* ------------------------------------------------------------------ add */

const addSchema = z.object({
  /** Null parks it for later. */
  date: localDateSchema.nullable(),
  title: titleSchema,
  /** Left out: worked out from the words. Null: no area. */
  area: z.enum(AREAS).nullish(),
  category: z.string().trim().max(40, "Keep the category short.").nullish(),
  priority: prioritySchema.optional(),
  dueDate: localDateSchema.nullish(),
  notes: z.string().trim().max(1000, "Keep notes under 1000 characters.").nullish(),
  /** Put it straight into the Big 3. */
  big3: z.boolean().optional(),
  weeklyGoalId: uuidSchema.nullish(),
});

/**
 * Quick add. "Call 10 Imperium leads" becomes an Imperium task tied to the leads counter, so
 * it ticks itself when the counter reaches 10.
 */
export async function addTask(input: z.input<typeof addSchema>): Promise<ActionResult<TaskItem>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, title, category, priority, dueDate, notes, big3, weeklyGoalId } = parsed.data;
  const viewer = await getViewer();
  if (date) {
    const refused = guardDate(viewer, date);
    if (refused) return refused;
  }

  const quick = parseQuickTask(title);
  const area: Area | null = parsed.data.area === undefined ? quick.area : parsed.data.area;
  let metricId: string | null = null;
  let unit: string | null = null;
  if (quick.metric && (area === quick.metric.area)) {
    const { data: m } = await viewer.supabase.from("metrics").select("id,unit").eq("area", quick.metric.area).eq("key", quick.metric.key).eq("is_active", true).maybeSingle();
    if (m) {
      metricId = m.id;
      unit = m.unit;
    }
  }

  let rank: 1 | 2 | 3 | null = null;
  if (big3 && date) {
    rank = await freeRank(viewer, date);
    if (rank === null) return fail("Your Big 3 is full. Finish one or move it out first.");
  }

  const row: TaskInsert = {
    local_date: date,
    title: quick.title,
    area,
    category: category || null,
    priority: priority ?? 2,
    due_date: dueDate ?? null,
    notes: notes || null,
    rank,
    metric_id: metricId,
    quantity: metricId ? quick.quantity : null,
    unit: metricId ? unit : null,
    parent_weekly_goal_id: weeklyGoalId ?? null,
    source: "manual",
  };
  const { data, error } = await viewer.supabase.from("daily_goals").insert(row).select("*").single();
  if (error?.code === "23505") return fail("That Big 3 slot was just taken. Try again.");
  if (error || !data) return dbFail(error ?? {}, "The task wasn't added. Try again.");
  if (date && date < viewer.today) await recomputeBestStreak(viewer);
  return ok(mapTask(data, null));
}

/* ------------------------------------------------------------------ edit */

const updateSchema = z.object({
  id: uuidSchema,
  title: titleSchema.optional(),
  area: z.enum(AREAS).nullable().optional(),
  category: z.string().trim().max(40).nullable().optional(),
  priority: prioritySchema.optional(),
  dueDate: localDateSchema.nullable().optional(),
  notes: z.string().trim().max(1000, "Keep notes under 1000 characters.").nullable().optional(),
  weeklyGoalId: uuidSchema.nullable().optional(),
});

export async function updateTask(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, title, area, category, priority, dueDate, notes, weeklyGoalId } = parsed.data;
  const patch: Database["public"]["Tables"]["daily_goals"]["Update"] = {};
  if (title !== undefined) patch.title = title;
  if (area !== undefined) patch.area = area;
  if (category !== undefined) patch.category = category || null;
  if (priority !== undefined) patch.priority = priority;
  if (dueDate !== undefined) patch.due_date = dueDate;
  if (notes !== undefined) patch.notes = notes || null;
  if (weeklyGoalId !== undefined) patch.parent_weekly_goal_id = weeklyGoalId;
  const { supabase } = await getViewer();
  const { error } = await supabase.from("daily_goals").update(patch).eq("id", id);
  if (error) return dbFail(error, "That change wasn't saved. Try again.");
  return ok();
}

const statusSchema = z.object({ id: uuidSchema, status: z.enum(["pending", "done", "dropped"]) });

/**
 * Done, dropped or back to pending. Finishing a counter task ("Call 10 leads") also brings the
 * counter up to 10 if it isn't there yet, so the numbers never disagree.
 */
export async function setTaskStatus(
  input: z.input<typeof statusSchema>,
): Promise<ActionResult<{ status: TaskStatus; completedAt: string | null; counter: { metricId: string; value: number } | null }>> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, status } = parsed.data;
  const viewer = await getViewer();
  const completedAt = status === "done" ? new Date().toISOString() : null;
  const { data, error } = await viewer.supabase
    .from("daily_goals")
    .update({ status, completed_at: completedAt })
    .eq("id", id)
    .select("local_date,metric_id,quantity")
    .maybeSingle();
  if (error) return dbFail(error);
  if (!data) return fail("That task couldn't be found.");

  let counter: { metricId: string; value: number } | null = null;
  if (status === "done" && data.metric_id && data.quantity !== null && data.local_date) {
    counter = { metricId: data.metric_id, value: await raiseCounter(viewer, data.metric_id, data.local_date, Number(data.quantity)) };
  }
  if (data.local_date && data.local_date < viewer.today) await recomputeBestStreak(viewer);
  return ok({ status, completedAt, counter });
}

const rankSchema = z.object({ id: uuidSchema, rank: prioritySchema.nullable() });

/** Puts a task in a Big 3 slot (swapping with whatever was there) or takes it out. */
export async function setTaskRank(input: z.input<typeof rankSchema>): Promise<ActionResult> {
  const parsed = rankSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, rank } = parsed.data;
  const viewer = await getViewer();
  const { supabase } = viewer;
  const { data: task } = await supabase.from("daily_goals").select("local_date,rank").eq("id", id).maybeSingle();
  if (!task) return fail("That task couldn't be found.");
  if (!task.local_date) return fail("Move it to today first.");
  if (task.rank === rank) return ok();

  let other: { id: string } | null = null;
  if (rank !== null) {
    const { data } = await supabase.from("daily_goals").select("id").eq("local_date", task.local_date).eq("rank", rank).maybeSingle();
    other = data;
    if (other) {
      const { error } = await supabase.from("daily_goals").update({ rank: null }).eq("id", other.id);
      if (error) return dbFail(error);
    }
  }
  const { error } = await supabase.from("daily_goals").update({ rank }).eq("id", id);
  if (error) return dbFail(error, "That slot wasn't saved. Try again.");
  if (other && task.rank !== null) await supabase.from("daily_goals").update({ rank: task.rank }).eq("id", other.id);
  return ok();
}

const moveSchema = z.object({ id: uuidSchema, to: z.enum(["today", "later"]) });

/**
 * Moves a task on. A task from an earlier day is copied forward (the old day keeps its record
 * of what happened), once: moving it again (a double tap, or a screen that hadn't caught up)
 * moves that copy instead of making another. A task parked for later, or today's task, just
 * changes day.
 */
export async function moveTask(input: z.input<typeof moveSchema>): Promise<ActionResult<TaskItem>> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, to } = parsed.data;
  const viewer = await getViewer();
  const { supabase, today } = viewer;
  const { data: task } = await supabase.from("daily_goals").select("*").eq("id", id).maybeSingle();
  if (!task) return fail("That task couldn't be found.");
  const target = to === "today" ? today : null;

  if (task.local_date && task.local_date < today) {
    const { data: copy, error: copyError } = await supabase
      .from("daily_goals")
      .select("*")
      .eq("carried_from_id", task.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (copyError) return dbFail(copyError, "The task wasn't moved. Try again.");
    if (copy) {
      if (copy.local_date === target) return ok(mapTask(copy, null));
      // A copy that's been done, or left on an earlier day, keeps its own record: leave it be.
      if (copy.status !== "pending" || (copy.local_date !== null && copy.local_date < today)) return fail("That task was already moved on.");
      const { data, error } = await supabase.from("daily_goals").update({ local_date: target, rank: null }).eq("id", copy.id).select("*").single();
      if (error || !data) return dbFail(error ?? {}, "The task wasn't moved. Try again.");
      return ok(mapTask(data, null));
    }

    const { data, error } = await supabase
      .from("daily_goals")
      .insert({
        local_date: target,
        title: task.title,
        area: task.area,
        category: task.category,
        priority: task.priority,
        due_date: task.due_date,
        notes: task.notes,
        quantity: task.quantity,
        unit: task.unit,
        metric_id: task.metric_id,
        estimated_minutes: task.estimated_minutes,
        parent_weekly_goal_id: task.parent_weekly_goal_id,
        carried_from_id: task.id,
        source: "carried",
      })
      .select("*")
      .single();
    if (error || !data) return dbFail(error ?? {}, "The task wasn't moved. Try again.");
    return ok(mapTask(data, null));
  }

  const { data, error } = await supabase.from("daily_goals").update({ local_date: target, rank: null }).eq("id", id).select("*").single();
  if (error || !data) return dbFail(error ?? {}, "The task wasn't moved. Try again.");
  return ok(mapTask(data, null));
}

const idSchema = z.object({ id: uuidSchema });

/** For a task added by mistake. To not do a task, drop it: that keeps the record. */
export async function deleteTask(input: z.input<typeof idSchema>): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  const { data, error } = await viewer.supabase.from("daily_goals").delete().eq("id", parsed.data.id).select("local_date").maybeSingle();
  if (error) return dbFail(error, "The task wasn't deleted. Try again.");
  if (data?.local_date && data.local_date < viewer.today) await recomputeBestStreak(viewer);
  return ok();
}

/* ------------------------------------------------------------------ plan my day */

const dateOnly = z.object({ date: localDateSchema });

export async function planMyDay(input: z.input<typeof dateOnly>): Promise<ActionResult<DayPlan>> {
  const parsed = dateOnly.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  if (parsed.data.date !== viewer.today) return fail("Plan my day works on today.");
  try {
    return ok(await buildPlan(viewer, parsed.data.date));
  } catch {
    return fail("The plan couldn't be made. Try again.");
  }
}

const planItemSchema = z.object({
  title: titleSchema,
  area: z.enum(AREAS).nullable(),
  quantity: z.number().positive().nullable(),
  unit: z.string().max(20).nullable(),
  metricId: uuidSchema.nullable(),
  weeklyGoalId: uuidSchema.nullable(),
  carriedFromId: uuidSchema.nullable(),
  taskId: uuidSchema.nullable(),
  estimatedMinutes: z.number().int().min(1).max(960),
});

const applySchema = z.object({
  date: localDateSchema,
  big3: z.array(planItemSchema).max(3),
  supporting: z.array(planItemSchema).max(4),
  blocks: z
    .array(z.object({ area: z.enum(WORK_AREAS), start: z.string().regex(/^\d\d:\d\d$/), end: z.string().regex(/^\d\d:\d\d$/) }))
    .max(12),
});

/** Saves the plan you kept: Big 3 into free slots, supporting tasks, and work blocks. */
export async function applyPlan(input: z.input<typeof applySchema>): Promise<ActionResult<{ tasks: number; blocks: number }>> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, big3, supporting, blocks } = parsed.data;
  const viewer = await getViewer();
  if (date !== viewer.today) return fail("Plan my day works on today.");
  const { supabase } = viewer;

  let tasks = 0;
  const place = async (item: z.infer<typeof planItemSchema>, rank: 1 | 2 | 3 | null) => {
    if (item.taskId) {
      const { error } = await supabase.from("daily_goals").update({ local_date: date, rank }).eq("id", item.taskId);
      if (error) return error;
    } else {
      const { error } = await supabase.from("daily_goals").insert({
        local_date: date,
        title: item.title,
        area: item.area,
        quantity: item.quantity,
        unit: item.unit,
        metric_id: item.metricId,
        parent_weekly_goal_id: item.weeklyGoalId,
        carried_from_id: item.carriedFromId,
        estimated_minutes: item.estimatedMinutes,
        rank,
        source: item.carriedFromId ? "carried" : "suggested",
      });
      if (error) return error;
    }
    tasks += 1;
    return null;
  };

  for (const item of big3) {
    const rank = await freeRank(viewer, date);
    const error = await place(item, rank);
    if (error) return dbFail(error, "The plan wasn't saved. Try again.");
  }
  for (const item of supporting) {
    const error = await place(item, null);
    if (error) return dbFail(error, "The plan wasn't saved. Try again.");
  }
  if (blocks.length > 0) {
    const { error } = await supabase.from("work_blocks").insert(
      blocks.filter((b) => b.end > b.start).map((b) => ({ local_date: date, area: b.area, task: AREA_LABEL[b.area], planned_start: b.start, planned_end: b.end })),
    );
    if (error) return dbFail(error, "The work blocks weren't saved. Try again.");
  }
  return ok({ tasks, blocks: blocks.length });
}
