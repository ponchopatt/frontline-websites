"use server";

import { z } from "zod";
import { chaptersIn } from "@/lib/bible";
import { ensureReading } from "@/lib/bible-server";
import { dbFail, fail, guardDate, invalid, localDateSchema, ok } from "@/lib/action-helpers";
import { getViewer, loadSummaries, recomputeBestStreak } from "@/lib/data";
import { keepWord } from "@/lib/keep-word";
import { summaryToTally } from "@/lib/streak";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types";
import { REVIEW_FIELDS } from "@/lib/types";

type EntryInsert = Database["public"]["Tables"]["bible_entries"]["Insert"];
type ReviewInsert = Database["public"]["Tables"]["daily_reviews"]["Insert"];

/* ------------------------------------------------------------------ bible */

const bookSchema = z.string().refine((b) => chaptersIn(b) !== null, { message: "Pick a book of the Bible." });

const readingRefSchema = z
  .object({ book: bookSchema, chapter: z.number().int().min(1) })
  .refine((r) => r.chapter <= (chaptersIn(r.book) ?? 0), {
    message: "That chapter isn't in the book.",
    path: ["chapter"],
  });

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

const journalSchema = z.object({
  date: localDateSchema,
  value: z.string().max(4000, "That's too long to save in one entry."),
  reading: readingRefSchema,
});

/** The day's journal line, kept with its reading. */
export async function saveJournal(input: z.input<typeof journalSchema>): Promise<ActionResult> {
  const parsed = journalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, value, reading } = parsed.data;
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  const r = await ensureReading(viewer, date, reading);
  if ("error" in r) return dbFail(r.error);
  const row: EntryInsert = { reading_id: r.id, local_date: date, journal: value.trim() || null };
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
 * Locks the day and stores its Keep My Word. It's worked out here from what is in the
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
  const result = keepWord(summaryToTally(summary, viewer.profile.workTargetHours));
  const score = result.percent ?? 0;
  const completedAt = new Date().toISOString();

  const { error } = await viewer.supabase.from("daily_plans").upsert(
    {
      user_id: viewer.userId,
      local_date: date,
      final_score: score,
      score_breakdown: { made: result.made, kept: result.kept },
      completed_at: completedAt,
    },
    { onConflict: "user_id,local_date" },
  );
  if (error) return dbFail(error, "The day wasn't completed. Try again.");

  const best = await recomputeBestStreak(viewer);
  return ok({ score, completedAt, best });
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
