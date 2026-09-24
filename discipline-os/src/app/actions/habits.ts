"use server";

import { z } from "zod";
import { dbFail, fail, guardDate, invalid, localDateSchema, ok, uuidSchema } from "@/lib/action-helpers";
import { getViewer, recomputeBestStreak } from "@/lib/data";
import type { ActionResult, HabitCategory } from "@/lib/types";

const setDoneSchema = z.object({
  habitId: uuidSchema,
  date: localDateSchema,
  done: z.boolean(),
});

/**
 * Sets a habit's state for a day. Takes the state you want, not "toggle", so a double tap
 * or a retried request lands in the same place. The unique index on (habit_id, local_date)
 * makes a second insert a no-op.
 */
export async function setHabitDone(
  input: z.input<typeof setDoneSchema>,
): Promise<ActionResult<{ completedAt: string | null; editedAt: string | null }>> {
  const parsed = setDoneSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { habitId, date, done } = parsed.data;

  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;
  const { supabase } = viewer;
  const isPast = date < viewer.today;

  if (done) {
    const { error } = await supabase
      .from("habit_completions")
      .insert({ habit_id: habitId, local_date: date, edited_at: isPast ? new Date().toISOString() : null });
    if (error && error.code !== "23505") return dbFail(error);
    const { data: row, error: readError } = await supabase
      .from("habit_completions")
      .select("completed_at,edited_at")
      .eq("habit_id", habitId)
      .eq("local_date", date)
      .maybeSingle();
    if (readError || !row) return fail("That didn't save. Check your connection and try again.");
    if (isPast) await recomputeBestStreak(viewer);
    return ok({ completedAt: row.completed_at, editedAt: row.edited_at });
  }

  const { error } = await supabase
    .from("habit_completions")
    .delete()
    .eq("habit_id", habitId)
    .eq("local_date", date);
  if (error) return dbFail(error);
  if (isPast) await recomputeBestStreak(viewer);
  return ok({ completedAt: null, editedAt: null });
}

const categorySchema = z.enum(["morning", "body", "discipline", "god"], {
  message: "Pick a section for the habit.",
});
const nameSchema = z
  .string()
  .trim()
  .min(1, "Give the habit a name.")
  .max(80, "Keep the name under 80 characters.");

const createSchema = z.object({ name: nameSchema, category: categorySchema });

export async function createHabit(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string; name: string; category: HabitCategory; sortOrder: number }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();

  const { data: last } = await supabase
    .from("habits")
    .select("sort_order")
    .eq("category", parsed.data.category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("habits")
    .insert({ name: parsed.data.name, category: parsed.data.category, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("id,name,category,sort_order")
    .single();
  if (error || !data) return dbFail(error ?? {}, "The habit wasn't added. Try again.");
  return ok({ id: data.id, name: data.name, category: data.category, sortOrder: data.sort_order });
}

const renameSchema = z.object({ habitId: uuidSchema, name: nameSchema });

export async function renameHabit(input: z.input<typeof renameSchema>): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { error } = await supabase.from("habits").update({ name: parsed.data.name }).eq("id", parsed.data.habitId);
  if (error) return dbFail(error, "The new name wasn't saved. Try again.");
  return ok();
}

const archiveSchema = z.object({ habitId: uuidSchema, archived: z.boolean() });

/** Archiving hides a habit from today on and keeps every day it was used. */
export async function setHabitArchived(input: z.input<typeof archiveSchema>): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { error } = await supabase
    .from("habits")
    .update(
      parsed.data.archived
        ? { is_active: false, archived_at: new Date().toISOString() }
        : { is_active: true, archived_at: null },
    )
    .eq("id", parsed.data.habitId);
  if (error) return dbFail(error, "That change wasn't saved. Try again.");
  return ok();
}

const moveSchema = z.object({ habitId: uuidSchema, direction: z.enum(["up", "down"]) });

/** Swaps a habit with its neighbour in the same section. */
export async function moveHabit(input: z.input<typeof moveSchema>): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();

  const { data: habit } = await supabase
    .from("habits")
    .select("id,category,sort_order")
    .eq("id", parsed.data.habitId)
    .maybeSingle();
  if (!habit) return fail("That habit couldn't be found.");

  const { data: siblings, error } = await supabase
    .from("habits")
    .select("id,sort_order")
    .eq("category", habit.category)
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  if (error || !siblings) return dbFail(error ?? {}, "The order wasn't saved. Try again.");

  const index = siblings.findIndex((s) => s.id === habit.id);
  const swapWith = parsed.data.direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= siblings.length) return ok();

  // Renumber the whole section so equal sort_orders can never make the swap a no-op.
  const order = siblings.map((s) => s.id);
  [order[index], order[swapWith]] = [order[swapWith], order[index]];
  for (let i = 0; i < order.length; i += 1) {
    const { error: updateError } = await supabase.from("habits").update({ sort_order: i + 1 }).eq("id", order[i]);
    if (updateError) return dbFail(updateError, "The order wasn't saved. Try again.");
  }
  return ok();
}
