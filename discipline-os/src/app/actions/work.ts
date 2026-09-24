"use server";

import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { dbFail, fail, guardDate, invalid, localDateSchema, ok, uuidSchema } from "@/lib/action-helpers";
import { getViewer, recomputeBestStreak } from "@/lib/data";
import type { ActionResult, WorkBlockItem, WorkSessionItem } from "@/lib/types";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30.")
  .nullish();

const addBlockSchema = z
  .object({
    date: localDateSchema,
    task: z.string().trim().min(1, "Say what the block is for.").max(120, "Keep the task under 120 characters."),
    plannedStart: timeSchema,
    plannedEnd: timeSchema,
  })
  .refine((b) => !b.plannedStart || !b.plannedEnd || b.plannedEnd > b.plannedStart, {
    message: "The block has to end after it starts.",
    path: ["plannedEnd"],
  });

export async function addBlock(input: z.input<typeof addBlockSchema>): Promise<ActionResult<WorkBlockItem>> {
  const parsed = addBlockSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, task, plannedStart, plannedEnd } = parsed.data;
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  const { data, error } = await viewer.supabase
    .from("work_blocks")
    .insert({ local_date: date, task, planned_start: plannedStart ?? null, planned_end: plannedEnd ?? null })
    .select("id,task,planned_start,planned_end")
    .single();
  if (error || !data) return dbFail(error ?? {}, "The block wasn't added. Try again.");
  return ok({
    id: data.id,
    task: data.task,
    plannedStart: data.planned_start?.slice(0, 5) ?? null,
    plannedEnd: data.planned_end?.slice(0, 5) ?? null,
  });
}

const blockIdSchema = z.object({ blockId: uuidSchema });

/** Removes a planned block. Time already logged against it stays, as unplanned time. */
export async function deleteBlock(input: z.input<typeof blockIdSchema>): Promise<ActionResult> {
  const parsed = blockIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { error } = await supabase.from("work_blocks").delete().eq("id", parsed.data.blockId);
  if (error) return dbFail(error, "The block wasn't removed. Try again.");
  return ok();
}

type SessionRow = {
  id: string;
  work_block_id: string | null;
  local_date: string;
  started_at: string;
  ended_at: string | null;
  accomplishment_note: string | null;
};

function toItem(row: SessionRow): WorkSessionItem {
  return {
    id: row.id,
    blockId: row.work_block_id,
    localDate: row.local_date,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    note: row.accomplishment_note,
  };
}

const startSchema = z.object({
  blockId: uuidSchema.nullable(),
  /** Stop whatever is running first. Without it, a running session is reported back instead. */
  replaceRunning: z.boolean().default(false),
});

export type StartResult =
  | { started: WorkSessionItem }
  | { running: WorkSessionItem & { task: string | null } };

/**
 * Starts the timer now. The row is written on start (ended_at null), so the timer survives
 * refreshes, closed tabs and other devices. Only one can run at a time.
 */
export async function startSession(input: z.input<typeof startSchema>): Promise<ActionResult<StartResult>> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { blockId, replaceRunning } = parsed.data;
  const viewer = await getViewer();
  const { supabase } = viewer;

  if (blockId) {
    const { data: block } = await supabase.from("work_blocks").select("local_date").eq("id", blockId).maybeSingle();
    if (!block) return fail("That block couldn't be found.");
    if (block.local_date !== viewer.today) return fail("Only today's blocks can be started.");
  }

  const { data: running } = await supabase
    .from("work_sessions")
    .select("*, work_blocks(task)")
    .is("ended_at", null)
    .maybeSingle();
  if (running) {
    if (!replaceRunning) {
      const task = (running as unknown as { work_blocks: { task: string } | null }).work_blocks?.task ?? null;
      return ok({ running: { ...toItem(running), task } });
    }
    const { error: stopError } = await supabase
      .from("work_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", running.id)
      .is("ended_at", null);
    if (stopError) return dbFail(stopError, "The running timer couldn't be stopped. Try again.");
  }

  const { data, error } = await supabase
    .from("work_sessions")
    .insert({ work_block_id: blockId, started_at: new Date().toISOString(), local_date: viewer.today })
    .select("*")
    .single();
  if (error?.code === "23505") return fail("A timer is already running. Stop it first.");
  if (error || !data) return dbFail(error ?? {}, "The timer didn't start. Try again.");
  return ok({ started: toItem(data) });
}

const sessionIdSchema = z.object({ sessionId: uuidSchema });

export async function stopSession(input: z.input<typeof sessionIdSchema>): Promise<ActionResult<WorkSessionItem>> {
  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();

  const { data, error } = await supabase
    .from("work_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", parsed.data.sessionId)
    .is("ended_at", null)
    .select("*")
    .maybeSingle();
  if (error) return dbFail(error, "The timer didn't stop. Try again.");
  if (data) return ok(toItem(data));

  // Already stopped (another tab or a double tap): return it as it is.
  const { data: existing } = await supabase.from("work_sessions").select("*").eq("id", parsed.data.sessionId).maybeSingle();
  if (!existing) return fail("That session couldn't be found.");
  return ok(toItem(existing));
}

const noteSchema = z.object({
  sessionId: uuidSchema,
  note: z.string().trim().max(1000, "Keep the note under 1000 characters."),
});

export async function saveSessionNote(input: z.input<typeof noteSchema>): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { error } = await supabase
    .from("work_sessions")
    .update({ accomplishment_note: parsed.data.note || null })
    .eq("id", parsed.data.sessionId);
  if (error) return dbFail(error, "The note wasn't saved. Try again.");
  return ok();
}

const fixEndSchema = z.object({
  sessionId: uuidSchema,
  endDate: localDateSchema,
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 17:30."),
});

/**
 * Ends a session that was left running, at the time the user says they actually stopped.
 * The local date and time are read in the user's timezone on the server.
 */
export async function endSessionAt(input: z.input<typeof fixEndSchema>): Promise<ActionResult<WorkSessionItem>> {
  const parsed = fixEndSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  const { supabase, profile } = viewer;

  const { data: session } = await supabase
    .from("work_sessions")
    .select("*")
    .eq("id", parsed.data.sessionId)
    .maybeSingle();
  if (!session) return fail("That session couldn't be found.");

  const endedAt = fromZonedTime(`${parsed.data.endDate}T${parsed.data.endTime}:00`, profile.timezone);
  if (Number.isNaN(endedAt.getTime())) return fail("That time isn't valid.");
  if (endedAt.getTime() < new Date(session.started_at).getTime()) return fail("The end has to be after the start.");
  if (endedAt.getTime() > Date.now()) return fail("The end can't be in the future.");

  const { data, error } = await supabase
    .from("work_sessions")
    .update({ ended_at: endedAt.toISOString() })
    .eq("id", session.id)
    .select("*")
    .single();
  if (error || !data) return dbFail(error ?? {}, "The end time wasn't saved. Try again.");
  if (data.local_date < viewer.today) await recomputeBestStreak(viewer);
  return ok(toItem(data));
}

const deleteSessionSchema = z.object({ sessionId: uuidSchema, date: localDateSchema });

/** Removes a logged session (for one started by mistake). */
export async function deleteSession(input: z.input<typeof deleteSessionSchema>): Promise<ActionResult> {
  const parsed = deleteSessionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  const refused = guardDate(viewer, parsed.data.date);
  if (refused) return refused;
  const { error } = await viewer.supabase.from("work_sessions").delete().eq("id", parsed.data.sessionId);
  if (error) return dbFail(error, "The session wasn't removed. Try again.");
  if (parsed.data.date < viewer.today) await recomputeBestStreak(viewer);
  return ok();
}
