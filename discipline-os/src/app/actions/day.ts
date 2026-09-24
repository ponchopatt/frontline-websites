"use server";

import { z } from "zod";
import { chaptersIn } from "@/lib/bible";
import { dbFail, fail, guardDate, invalid, localDateSchema, ok } from "@/lib/action-helpers";
import { getViewer, loadSummaries, recomputeBestStreak, type Viewer } from "@/lib/data";
import { computeScore } from "@/lib/score";
import { summaryToScoreInput } from "@/lib/streak";
import type { LocalDate } from "@/lib/day";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult, BibleCheck, PriorityStatus } from "@/lib/types";

type EntryInsert = Database["public"]["Tables"]["bible_entries"]["Insert"];
type ReviewInsert = Database["public"]["Tables"]["daily_reviews"]["Insert"];
import { REVIEW_FIELDS } from "@/lib/types";

/* ------------------------------------------------------------------ priorities */

const positionSchema = z.union([z.literal(1), z.literal(2), z.literal(3)], {
  message: "There are three priorities a day.",
});

const savePrioritySchema = z.object({
  date: localDateSchema,
  position: positionSchema,
  title: z.string().trim().max(120, "Keep a priority under 120 characters."),
  description: z.string().trim().max(500, "Keep the detail under 500 characters.").nullish(),
});

/** Saves a priority's title (and detail). An empty title clears the slot. */
export async function savePriority(
  input: z.input<typeof savePrioritySchema>,
): Promise<ActionResult<{ id: string | null }>> {
  const parsed = savePrioritySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, position, title, description } = parsed.data;
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  if (!title) {
    const { error } = await viewer.supabase
      .from("daily_priorities")
      .delete()
      .eq("local_date", date)
      .eq("position", position);
    if (error) return dbFail(error);
    return ok({ id: null });
  }

  const row: { user_id: string; local_date: string; position: number; title: string; description?: string | null } = {
    user_id: viewer.userId,
    local_date: date,
    position,
    title,
  };
  if (description !== undefined) row.description = description || null;

  const { data, error } = await viewer.supabase
    .from("daily_priorities")
    .upsert(row, { onConflict: "user_id,local_date,position" })
    .select("id")
    .single();
  if (error || !data) return dbFail(error ?? {});
  return ok({ id: data.id });
}

const statusSchema = z.object({
  date: localDateSchema,
  position: positionSchema,
  status: z.enum(["pending", "done", "dropped"]),
});

export async function setPriorityStatus(
  input: z.input<typeof statusSchema>,
): Promise<ActionResult<{ status: PriorityStatus; completedAt: string | null }>> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, position, status } = parsed.data;
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  const completedAt = status === "done" ? new Date().toISOString() : null;
  const { data, error } = await viewer.supabase
    .from("daily_priorities")
    .update({ status, completed_at: completedAt })
    .eq("local_date", date)
    .eq("position", position)
    .select("status,completed_at")
    .maybeSingle();
  if (error) return dbFail(error);
  if (!data) return fail("Write the priority first.");
  return ok({ status: data.status, completedAt: data.completed_at });
}

/* ------------------------------------------------------------------ bible */

const bookSchema = z.string().refine((b) => chaptersIn(b) !== null, { message: "Pick a book of the Bible." });

const readingRefSchema = z
  .object({ book: bookSchema, chapter: z.number().int().min(1) })
  .refine((r) => r.chapter <= (chaptersIn(r.book) ?? 0), {
    message: "That chapter isn't in the book.",
    path: ["chapter"],
  });

/** The day's reading row, created from `ref` if the day has none yet. */
async function ensureReading(
  viewer: Viewer,
  date: LocalDate,
  ref: { book: string; chapter: number },
): Promise<{ id: string } | { error: { code?: string; hint?: string | null } }> {
  const { data: existing } = await viewer.supabase
    .from("bible_readings")
    .select("id")
    .eq("local_date", date)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await viewer.supabase
    .from("bible_readings")
    .insert({ local_date: date, book: ref.book, chapter: ref.chapter })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: again } = await viewer.supabase.from("bible_readings").select("id").eq("local_date", date).maybeSingle();
    if (again) return again;
  }
  if (error || !data) return { error: error ?? {} };
  return data;
}

const checkSchema = z.object({
  date: localDateSchema,
  item: z.enum(["reading", "soap", "prayer", "application"]),
  done: z.boolean(),
  reading: readingRefSchema,
});

export async function setBibleCheck(input: z.input<typeof checkSchema>): Promise<ActionResult<{ readingId: string }>> {
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, item, done, reading } = parsed.data;
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  const r = await ensureReading(viewer, date, reading);
  if ("error" in r) return dbFail(r.error);

  if (item === "reading") {
    const { error } = await viewer.supabase.from("bible_readings").update({ is_completed: done }).eq("id", r.id);
    if (error) return dbFail(error);
  } else {
    const column = ({ soap: "soap_done", prayer: "prayer_done", application: "application_done" } as const)[
      item as Exclude<BibleCheck, "reading">
    ];
    const row: EntryInsert = { reading_id: r.id, local_date: date };
    row[column] = done;
    const { error } = await viewer.supabase.from("bible_entries").upsert(row, { onConflict: "reading_id" });
    if (error) return dbFail(error);
  }
  if (date < viewer.today) await recomputeBestStreak(viewer);
  return ok({ readingId: r.id });
}

const setReadingSchema = z.object({
  date: localDateSchema,
  reading: readingRefSchema,
  passage: z.string().trim().max(80, "Keep the verses under 80 characters.").nullish(),
});

/** Changes the day's reading (book, chapter, optional verses). */
export async function setReading(input: z.input<typeof setReadingSchema>): Promise<ActionResult<{ readingId: string }>> {
  const parsed = setReadingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, reading, passage } = parsed.data;
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  const { data, error } = await viewer.supabase
    .from("bible_readings")
    .upsert(
      { user_id: viewer.userId, local_date: date, book: reading.book, chapter: reading.chapter, passage: passage || null },
      { onConflict: "user_id,local_date" },
    )
    .select("id")
    .single();
  if (error || !data) return dbFail(error ?? {});
  return ok({ readingId: data.id });
}

const textSchema = z.object({
  date: localDateSchema,
  field: z.enum(["scripture_notes", "observation", "application", "prayer", "obey_today"]),
  value: z.string().max(4000, "That's too long to save in one field."),
  reading: readingRefSchema,
});

export async function saveBibleText(input: z.input<typeof textSchema>): Promise<ActionResult> {
  const parsed = textSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, field, value, reading } = parsed.data;
  if (field === "obey_today" && value.length > 500) return fail("Keep this under 500 characters.");
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  const r = await ensureReading(viewer, date, reading);
  if ("error" in r) return dbFail(r.error);
  const row: EntryInsert = { reading_id: r.id, local_date: date };
  row[field] = value.trim() || null;
  const { error } = await viewer.supabase.from("bible_entries").upsert(row, { onConflict: "reading_id" });
  if (error) return dbFail(error);
  return ok();
}

/* ------------------------------------------------------------------ night review */

const reviewSchema = z.object({
  date: localDateSchema,
  field: z.enum(REVIEW_FIELDS),
  value: z.string().max(2000, "That's too long to save in one answer."),
});

export async function saveReviewField(input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, field, value } = parsed.data;
  if (field === "tomorrow_priority" && value.length > 120) return fail("Keep tomorrow's #1 under 120 characters.");
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  const row: ReviewInsert = { user_id: viewer.userId, local_date: date };
  row[field] = value.trim() || null;
  const { error } = await viewer.supabase.from("daily_reviews").upsert(row, { onConflict: "user_id,local_date" });
  if (error) return dbFail(error);
  if (date < viewer.today) await recomputeBestStreak(viewer);
  return ok();
}

/* ------------------------------------------------------------------ complete / reopen */

const dateOnly = z.object({ date: localDateSchema });

/**
 * Locks the day and stores its score. The score is computed here from what is in the
 * database, not taken from the browser.
 */
export async function completeDay(
  input: z.input<typeof dateOnly>,
): Promise<ActionResult<{ score: number; completedAt: string; best: number }>> {
  const parsed = dateOnly.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date } = parsed.data;
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  const { data: running } = await viewer.supabase
    .from("work_sessions")
    .select("id")
    .is("ended_at", null)
    .eq("local_date", date)
    .maybeSingle();
  if (running) return fail("Stop the running timer before you complete the day.");

  const [summary] = await loadSummaries(viewer.supabase, date, date);
  if (!summary) return fail("This day couldn't be scored. Try again.");
  const result = computeScore(summaryToScoreInput(summary, viewer.profile.workTargetHours));
  const completedAt = new Date().toISOString();

  const { error } = await viewer.supabase.from("daily_plans").upsert(
    {
      user_id: viewer.userId,
      local_date: date,
      final_score: result.score,
      score_breakdown: result.categories as unknown as Record<string, never>,
      completed_at: completedAt,
    },
    { onConflict: "user_id,local_date" },
  );
  if (error) return dbFail(error, "The day wasn't completed. Try again.");

  const best = await recomputeBestStreak(viewer);
  return ok({ score: result.score, completedAt, best });
}

/** Unlocks a completed day so it can be changed. Its stored score is cleared until it is completed again. */
export async function reopenDay(input: z.input<typeof dateOnly>): Promise<ActionResult> {
  const parsed = dateOnly.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  const { error } = await viewer.supabase
    .from("daily_plans")
    .update({ completed_at: null, final_score: null, score_breakdown: null })
    .eq("local_date", parsed.data.date);
  if (error) return dbFail(error, "The day wasn't reopened. Try again.");
  await recomputeBestStreak(viewer);
  return ok();
}
