"use server";

import { z } from "zod";
import { dbFail, fail, invalid, ok, uuidSchema } from "@/lib/action-helpers";
import { getViewer } from "@/lib/data";
import type { ActionResult, MilestoneItem } from "@/lib/types";

/**
 * The AI trading bot: one current milestone, its steps, and one notes area. No trade journal.
 */

const DEFAULT_STEPS = ["Implement", "Test", "Backtest", "Compare", "Fix", "Document", "Go live"];
const titleSchema = z.string().trim().min(1, "Name the milestone.").max(120, "Keep the name under 120 characters.");
const stepsSchema = z
  .array(z.object({ title: z.string().trim().min(1, "A step needs a name.").max(60, "Keep a step under 60 characters."), done: z.boolean() }))
  .max(20, "Twenty steps is plenty. Split the milestone instead.");

/** Starts a new current milestone (the default steps unless others are given). */
export async function startMilestone(input: { title: string }): Promise<ActionResult<MilestoneItem>> {
  const parsed = z.object({ title: titleSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { data: current } = await supabase.from("project_milestones").select("id").eq("area", "trading").eq("state", "active").maybeSingle();
  if (current) return fail("Finish or close the current milestone first.");
  const steps = DEFAULT_STEPS.map((title) => ({ title, done: false }));
  const { data, error } = await supabase
    .from("project_milestones")
    .insert({ area: "trading", title: parsed.data.title, steps })
    .select("id,title")
    .single();
  if (error || !data) return dbFail(error ?? {}, "The milestone wasn't started. Try again.");
  return ok({ id: data.id, title: data.title, steps });
}

const saveSchema = z.object({ id: uuidSchema, title: titleSchema.optional(), steps: stepsSchema.optional() });

/** Renames the milestone or saves its steps (ticks, new steps, removed steps). */
export async function saveMilestone(input: z.input<typeof saveSchema>): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, title, steps } = parsed.data;
  const patch: { title?: string; steps?: Array<{ title: string; done: boolean }> } = {};
  if (title !== undefined) patch.title = title;
  if (steps !== undefined) patch.steps = steps;
  const { supabase } = await getViewer();
  const { error } = await supabase.from("project_milestones").update(patch).eq("id", id).eq("state", "active");
  if (error) return dbFail(error, "That wasn't saved. Try again.");
  return ok();
}

/** Marks the milestone done. The next one starts when you name it. */
export async function completeMilestone(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: uuidSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { error } = await supabase
    .from("project_milestones")
    .update({ state: "done", completed_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return dbFail(error, "The milestone wasn't closed. Try again.");
  return ok();
}

/** The one notes area for findings worth keeping. */
export async function saveBotNotes(input: { content: string }): Promise<ActionResult> {
  const parsed = z.object({ content: z.string().max(4000, "Notes are limited to 4000 characters.") }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  const { error } = await viewer.supabase
    .from("goals")
    .upsert({ user_id: viewer.userId, kind: "notes:trading", content: parsed.data.content.trim() || null }, { onConflict: "user_id,kind" });
  if (error) return dbFail(error, "The notes weren't saved. Try again.");
  return ok();
}
