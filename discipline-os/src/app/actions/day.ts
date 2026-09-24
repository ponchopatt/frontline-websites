"use server";

import { z } from "zod";
import { chaptersIn } from "@/lib/bible";
import { ensureReading } from "@/lib/bible-server";
import { dbFail, fail, guardDate, invalid, localDateSchema, ok } from "@/lib/action-helpers";
import { isWorkArea, type WorkArea } from "@/lib/areas";
import { asCloseSummary, closeSummary, type CloseSummary } from "@/lib/close-day";
import { getViewer, loadDay, loadSummaries, recomputeBestStreak, type Viewer } from "@/lib/data";
import type { LocalDate } from "@/lib/day";
import { indexHistory, liveFromHistory, newRecords, recordBaseline } from "@/lib/history";
import { loadFacts, loadReplay } from "@/lib/history-server";
import { keepWord } from "@/lib/keep-word";
import type { ReplayEvent } from "@/lib/replay";
import { minimumState, summaryToTally } from "@/lib/streak";
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

/* ------------------------------------------------------------------ minimum day */

const minimumSchema = z.object({ date: localDateSchema, on: z.boolean() });

/**
 * Switches Minimum Day on or off for a day. It changes what the day asks for, not how it's
 * scored: Keep My Word still counts every commitment.
 */
export async function setMinimumDay(input: z.input<typeof minimumSchema>): Promise<ActionResult<{ minimumAt: string | null }>> {
  const parsed = minimumSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, on } = parsed.data;
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  const { data: plan } = await viewer.supabase.from("daily_plans").select("completed_at").eq("local_date", date).maybeSingle();
  if (plan?.completed_at) return fail("This day is closed. Reopen it to change it.");
  const minimumAt = on ? new Date().toISOString() : null;
  const { error } = await viewer.supabase
    .from("daily_plans")
    .upsert({ user_id: viewer.userId, local_date: date, minimum_at: minimumAt }, { onConflict: "user_id,local_date" });
  if (error) return dbFail(error);
  if (date < viewer.today) await recomputeBestStreak(viewer);
  return ok({ minimumAt });
}

/* ------------------------------------------------------------------ close / reopen */

const dateOnly = z.object({ date: localDateSchema });

function minutesByArea(sessions: Array<{ area: WorkArea | null; startedAt: string; endedAt: string | null }>): Partial<Record<WorkArea, number>> {
  const out: Partial<Record<WorkArea, number>> = {};
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const key = isWorkArea(s.area) ? s.area : "other";
    out[key] = (out[key] ?? 0) + Math.max(0, (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000);
  }
  return out;
}

export interface Closed {
  score: number;
  completedAt: string;
  best: number;
  summary: CloseSummary;
  replay: ReplayEvent[];
  /** The timer that was still running on the day, and when closing it stopped it. */
  stopped: { id: string; endedAt: string } | null;
}

/** Scores the day from the database and stores it as closed, with its summary. */
async function scoreAndClose(viewer: Viewer, date: LocalDate): Promise<ActionResult<{ score: number; completedAt: string; summary: CloseSummary }>> {
  const facts = loadFacts(viewer);
  const [[summary], view] = await Promise.all([loadSummaries(viewer.supabase, date, date), loadDay(viewer, date, facts)]);
  if (!summary) return fail("This day couldn't be scored. Try again.");
  const result = keepWord(summaryToTally(summary, viewer.profile.workTargetHours));
  const score = result.percent ?? 0;

  // Records are today's to break; closing an earlier day doesn't set them.
  let broken: ReturnType<typeof newRecords> = [];
  if (date === viewer.today) {
    const ix = indexHistory(await facts);
    broken = newRecords(recordBaseline(ix), liveFromHistory(ix));
  }

  const due = view.habits.filter((h) => h.due || h.completedAt);
  const morning = due.filter((h) => h.category === "morning");
  const faith = view.habits.filter((h) => h.kind === "bible" || h.kind === "journal" || h.kind === "prayer");
  const big3 = view.tasks.filter((t) => t.rank !== null);
  const cardio = view.counters.find((c) => c.area === "fitness" && c.key === "cardio_minutes");
  const summaryOut = closeSummary({
    made: result.made,
    kept: result.kept,
    percent: score,
    threshold: viewer.profile.streakThreshold,
    workMinutes: Number(summary.work_minutes),
    workTargetMinutes: viewer.profile.workTargetHours * 60,
    byArea: minutesByArea(view.sessions),
    tasks: { done: view.tasks.filter((t) => t.status === "done").length, total: view.tasks.length },
    big3: { done: big3.filter((t) => t.status === "done").length, total: big3.length },
    habits: { done: Math.min(summary.habits_done, summary.habits_total), total: summary.habits_total },
    morning: { done: morning.filter((h) => h.completedAt).length, total: morning.length },
    faithDone: faith.filter((h) => h.completedAt).length,
    faithTotal: faith.length,
    gym: view.habits.some((h) => h.kind === "gym" && h.completedAt),
    cardio: view.habits.some((h) => h.kind === "cardio" && h.completedAt),
    cardioMinutes: cardio?.value ?? 0,
    counters: view.counters
      .filter((c) => (c.area === "imperium" || c.area === "websites") && c.pinned && c.aggregation === "sum")
      .map((c) => ({ label: c.label, unit: c.unit, value: c.value, target: c.target })),
    reviewDone: summary.review_done > 0,
    minimum: minimumState(summary),
    records: broken,
  });
  const completedAt = new Date().toISOString();

  const { error } = await viewer.supabase.from("daily_plans").upsert(
    {
      user_id: viewer.userId,
      local_date: date,
      final_score: score,
      score_breakdown: summaryOut as unknown as Database["public"]["Tables"]["daily_plans"]["Insert"]["score_breakdown"],
      completed_at: completedAt,
    },
    { onConflict: "user_id,local_date" },
  );
  if (error) return dbFail(error, "The day wasn't closed. Try again.");
  return ok({ score, completedAt, summary: summaryOut });
}

/**
 * Closes the day: stops a timer still running on it, stores its Keep My Word with the full
 * summary (numbers, what it achieved, records broken), and returns the replay. The number is
 * worked out here from the database, not taken from the browser. Optional habits left undone
 * don't stop a day being closed; they count as commitments not kept.
 */
export async function completeDay(input: z.input<typeof dateOnly>): Promise<ActionResult<Closed>> {
  const parsed = dateOnly.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date } = parsed.data;
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  const { data: running } = await viewer.supabase.from("work_sessions").select("id").is("ended_at", null).eq("local_date", date).maybeSingle();
  let stopped: Closed["stopped"] = null;
  if (running) {
    const endedAt = new Date().toISOString();
    const { error: stopError } = await viewer.supabase.from("work_sessions").update({ ended_at: endedAt }).eq("id", running.id);
    if (stopError) return dbFail(stopError, "The running timer couldn't be stopped. Stop it and try again.");
    stopped = { id: running.id, endedAt };
  }

  // If the day can't be closed after all, the timer carries on from when it started, as the
  // screen still shows it.
  const restart = async () => {
    if (stopped) await viewer.supabase.from("work_sessions").update({ ended_at: null }).eq("id", stopped.id);
  };
  let closed: Awaited<ReturnType<typeof scoreAndClose>>;
  try {
    closed = await scoreAndClose(viewer, date);
  } catch (e) {
    await restart();
    throw e;
  }
  if (!closed.ok) {
    await restart();
    return closed;
  }

  const { score, completedAt, summary } = closed.data;
  const [best, replay] = await Promise.all([recomputeBestStreak(viewer), loadReplay(viewer, date)]);
  return ok({ score, completedAt, best, summary, replay, stopped });
}

export interface DayDetails {
  date: string;
  score: number;
  made: number;
  kept: number;
  workMinutes: number;
  minimum: "on" | "secured" | null;
  locked: boolean;
  /** The full summary, for a day closed with it. */
  closed: CloseSummary | null;
  replay: ReplayEvent[];
}

/** One day's numbers and replay, for the Day Complete screen and the year view. */
export async function dayDetails(input: z.input<typeof dateOnly>): Promise<ActionResult<DayDetails>> {
  const parsed = dateOnly.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date } = parsed.data;
  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;
  const [[summary], plan, replay] = await Promise.all([
    loadSummaries(viewer.supabase, date, date),
    viewer.supabase.from("daily_plans").select("score_breakdown").eq("local_date", date).maybeSingle(),
    loadReplay(viewer, date),
  ]);
  if (!summary) return fail("That day couldn't be found.");
  const r = keepWord(summaryToTally(summary, viewer.profile.workTargetHours));
  const locked = Boolean(summary.completed_at && summary.final_score !== null);
  return ok({
    date,
    score: locked ? (summary.final_score as number) : (r.percent ?? 0),
    made: r.made,
    kept: r.kept,
    workMinutes: Math.round(Number(summary.work_minutes)),
    minimum: minimumState(summary),
    locked,
    closed: asCloseSummary(plan.data?.score_breakdown),
    replay,
  });
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
