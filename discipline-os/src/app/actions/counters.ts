"use server";

import { z } from "zod";
import { dbFail, fail, guardDate, invalid, localDateSchema, ok, uuidSchema } from "@/lib/action-helpers";
import { getViewer, recomputeBestStreak } from "@/lib/data";
import type { ActionResult } from "@/lib/types";

const setSchema = z.object({
  metricId: uuidSchema,
  date: localDateSchema,
  value: z.number({ message: "Enter a number." }).min(0, "Numbers can't go below zero.").max(99_999_999, "That number is too big."),
});

/**
 * Sets a counter for a day (the number you'd say out loud: "12 leads today"). Tasks tied to
 * the counter tick themselves once it reaches their number, and cardio minutes at or over the
 * daily target tick Cardio.
 */
export async function setCounter(
  input: z.input<typeof setSchema>,
): Promise<ActionResult<{ value: number; completedTaskIds: string[]; tickedHabitId: string | null }>> {
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { metricId, date } = parsed.data;
  const value = Math.round(parsed.data.value * 100) / 100;
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;
  const { supabase } = viewer;

  const { data: metric } = await supabase.from("metrics").select("area,key,daily_target").eq("id", metricId).maybeSingle();
  if (!metric) return fail("That counter couldn't be found.");

  const { error } =
    value === 0
      ? await supabase.from("metric_entries").delete().eq("metric_id", metricId).eq("local_date", date)
      : await supabase
          .from("metric_entries")
          .upsert({ user_id: viewer.userId, metric_id: metricId, local_date: date, value }, { onConflict: "metric_id,local_date" });
  if (error) return dbFail(error);

  // Tasks on this counter that it now covers.
  const { data: tasks } = await supabase
    .from("daily_goals")
    .select("id,quantity")
    .eq("local_date", date)
    .eq("metric_id", metricId)
    .eq("status", "pending");
  const reached = (tasks ?? []).filter((t) => t.quantity !== null && Number(t.quantity) <= value).map((t) => t.id);
  if (reached.length > 0) {
    await supabase.from("daily_goals").update({ status: "done", completed_at: new Date().toISOString() }).in("id", reached);
  }

  let tickedHabitId: string | null = null;
  if (metric.key === "cardio_minutes" && metric.daily_target !== null && value >= Number(metric.daily_target)) {
    const { data: cardio } = await supabase.from("habits").select("id").eq("kind", "cardio").eq("is_active", true).maybeSingle();
    if (cardio) {
      const { error: tickError } = await supabase
        .from("habit_completions")
        .insert({ habit_id: cardio.id, local_date: date, edited_at: date < viewer.today ? new Date().toISOString() : null });
      if (!tickError || tickError.code === "23505") tickedHabitId = cardio.id;
    }
  }

  if (date < viewer.today && (reached.length > 0 || tickedHabitId)) await recomputeBestStreak(viewer);
  return ok({ value, completedTaskIds: reached, tickedHabitId });
}

const targetSchema = z.object({
  metricId: uuidSchema,
  weeklyTarget: z.number().min(0).max(99_999_999).nullable().optional(),
  dailyTarget: z.number().min(0).max(99_999_999).nullable().optional(),
  pinned: z.boolean().optional(),
});

/** A counter's own targets, and whether it shows on the Today screen. */
export async function updateCounter(input: z.input<typeof targetSchema>): Promise<ActionResult> {
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { metricId, weeklyTarget, dailyTarget, pinned } = parsed.data;
  const patch: { weekly_target?: number | null; daily_target?: number | null; pinned?: boolean } = {};
  if (weeklyTarget !== undefined) patch.weekly_target = weeklyTarget;
  if (dailyTarget !== undefined) patch.daily_target = dailyTarget;
  if (pinned !== undefined) patch.pinned = pinned;
  const { supabase } = await getViewer();
  const { error } = await supabase.from("metrics").update(patch).eq("id", metricId);
  if (error) return dbFail(error, "The target wasn't saved. Try again.");
  return ok();
}
