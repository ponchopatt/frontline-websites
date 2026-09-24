import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { FIRST_READING, nextReading } from "./bible";
import { addDays, daysBetween, localDateAt, type LocalDate } from "./day";
import { computeStreaks, scoreForSummary, type DayScore, type DaySummary } from "./streak";
import { createClient, type Supabase } from "./supabase/server";
import type {
  BibleState,
  DayView,
  HabitCategory,
  HabitItem,
  PriorityItem,
  ProfileSettings,
  ReviewState,
  WorkSessionItem,
} from "./types";
import { REVIEW_FIELDS } from "./types";
import { loadTodayPlan } from "./goals/data";

export interface Viewer {
  supabase: Supabase;
  userId: string;
  profile: ProfileSettings;
  createdAt: string;
  today: LocalDate;
}

/**
 * The signed-in user, their profile and their "today". Signs out to /login if there is no
 * session. Creates the profile and default habits on the first visit if the sign-up trigger
 * did not (an account made before the migration, or by an admin).
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  let { data: row } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (!row) {
    await supabase.rpc("ensure_profile");
    ({ data: row } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle());
  }
  if (!row) throw new Error("Your profile could not be created. Sign out and back in to try again.");

  const profile: ProfileSettings = {
    displayName: row.display_name,
    timezone: row.timezone,
    dayStartHour: row.day_start_hour,
    workTargetHours: Number(row.work_target_hours),
    streakThreshold: row.streak_threshold,
    bestStreak: row.best_streak,
  };
  return {
    supabase,
    userId,
    profile,
    createdAt: row.created_at,
    today: localDateAt(new Date(), profile.timezone, profile.dayStartHour),
  };
});

/** The request time, for server pages that show running totals. */
export function requestTime(): number {
  return Date.now();
}

export function firstDayOf(viewer: Pick<Viewer, "createdAt" | "profile">): LocalDate {
  return localDateAt(new Date(viewer.createdAt), viewer.profile.timezone, viewer.profile.dayStartHour);
}

function toSummary(row: Record<string, unknown>): DaySummary {
  return {
    local_date: String(row.local_date),
    morning_total: Number(row.morning_total ?? 0),
    morning_done: Number(row.morning_done ?? 0),
    body_total: Number(row.body_total ?? 0),
    body_done: Number(row.body_done ?? 0),
    discipline_total: Number(row.discipline_total ?? 0),
    discipline_done: Number(row.discipline_done ?? 0),
    god_total: Number(row.god_total ?? 0),
    god_done: Number(row.god_done ?? 0),
    bible_done: Number(row.bible_done ?? 0),
    review_filled: Number(row.review_filled ?? 0),
    work_minutes: Number(row.work_minutes ?? 0),
    final_score: row.final_score === null || row.final_score === undefined ? null : Number(row.final_score),
    completed_at: (row.completed_at as string | null) ?? null,
  };
}

/** Day summaries from `from` to `to` inclusive, fetched in chunks the database accepts. */
export async function loadSummaries(
  supabase: Supabase,
  from: LocalDate,
  to: LocalDate,
): Promise<DaySummary[]> {
  const out: DaySummary[] = [];
  let start = from;
  while (start <= to) {
    const end = daysBetween(start, to) > 365 ? addDays(start, 365) : to;
    const { data, error } = await supabase.rpc("day_summaries", { p_from: start, p_to: end });
    if (error) throw new Error(`Could not load your history: ${error.message}`);
    for (const row of data ?? []) out.push(toSummary(row as unknown as Record<string, unknown>));
    start = addDays(end, 1);
  }
  return out;
}

export interface HistoryInfo {
  scores: DayScore[];
  current: number;
  best: number;
}

/** Scores for every day since the account started, and the streaks they add up to. */
export async function loadHistory(viewer: Viewer): Promise<HistoryInfo> {
  const first = firstDayOf(viewer);
  const summaries = await loadSummaries(viewer.supabase, first, viewer.today);
  const scores = summaries.map((s) => scoreForSummary(s, viewer.profile.workTargetHours));
  const { current, best } = computeStreaks(scores, viewer.profile.streakThreshold, viewer.today);
  return { scores, current, best };
}

/**
 * best_streak is derived: recomputed from stored days after anything that can change a past
 * day's score (completing, reopening, editing an earlier day). Never incremented in place.
 */
export async function recomputeBestStreak(viewer: Viewer): Promise<number> {
  const { best } = await loadHistory(viewer);
  if (best !== viewer.profile.bestStreak) {
    await viewer.supabase.from("profiles").update({ best_streak: best }).eq("user_id", viewer.userId);
  }
  return best;
}

/** Whether a habit existed on `date`: created on or before it, not archived on or before it. */
function habitActiveOn(
  habit: { created_at: string; archived_at: string | null },
  date: LocalDate,
  profile: ProfileSettings,
): boolean {
  const from = localDateAt(new Date(habit.created_at), profile.timezone, profile.dayStartHour);
  if (from > date) return false;
  if (!habit.archived_at) return true;
  const to = localDateAt(new Date(habit.archived_at), profile.timezone, profile.dayStartHour);
  return to > date;
}

function emptyPriority(position: 1 | 2 | 3): PriorityItem {
  return { position, id: null, dailyGoalId: null, title: "", description: null, status: "pending", completedAt: null };
}

function mapSession(row: {
  id: string;
  work_block_id: string | null;
  local_date: string;
  started_at: string;
  ended_at: string | null;
  accomplishment_note: string | null;
}): WorkSessionItem {
  return {
    id: row.id,
    blockId: row.work_block_id,
    localDate: row.local_date,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    note: row.accomplishment_note,
  };
}

/** Everything the dashboard needs for one day. */
export async function loadDay(viewer: Viewer, date: LocalDate): Promise<DayView> {
  const { supabase, profile, today } = viewer;

  const [
    habitsRes,
    completionsRes,
    prioritiesRes,
    prevReviewRes,
    blocksRes,
    sessionsRes,
    openRes,
    readingRes,
    lastReadingRes,
    reviewRes,
    planRes,
    history,
  ] = await Promise.all([
    supabase.from("habits").select("id,name,category,sort_order,created_at,archived_at").order("sort_order"),
    supabase.from("habit_completions").select("habit_id,completed_at,edited_at").eq("local_date", date),
    supabase.from("daily_priorities").select("*").eq("local_date", date),
    supabase.from("daily_reviews").select("tomorrow_priority").eq("local_date", addDays(date, -1)).maybeSingle(),
    supabase.from("work_blocks").select("id,task,planned_start,planned_end").eq("local_date", date)
      .order("planned_start", { ascending: true, nullsFirst: false }).order("created_at"),
    supabase.from("work_sessions").select("*").eq("local_date", date).order("started_at"),
    supabase.from("work_sessions").select("*, work_blocks(task)").is("ended_at", null).maybeSingle(),
    supabase.from("bible_readings").select("*, bible_entries(*)").eq("local_date", date).maybeSingle(),
    supabase.from("bible_readings").select("book,chapter").lt("local_date", date)
      .order("local_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("daily_reviews").select("*").eq("local_date", date).maybeSingle(),
    supabase.from("daily_plans").select("final_score,completed_at").eq("local_date", date).maybeSingle(),
    loadHistory(viewer),
  ]);

  for (const res of [habitsRes, completionsRes, prioritiesRes, blocksRes, sessionsRes, readingRes, reviewRes, planRes]) {
    if (res.error) throw new Error(`Could not load this day: ${res.error.message}`);
  }

  const done = new Map((completionsRes.data ?? []).map((c) => [c.habit_id, c]));
  const habits: HabitItem[] = (habitsRes.data ?? [])
    .filter((h) => habitActiveOn(h, date, profile) || done.has(h.id))
    .map((h) => ({
      id: h.id,
      name: h.name,
      category: h.category as HabitCategory,
      sortOrder: h.sort_order,
      completedAt: done.get(h.id)?.completed_at ?? null,
      editedAt: done.get(h.id)?.edited_at ?? null,
    }));

  const priorities: [PriorityItem, PriorityItem, PriorityItem] = [
    emptyPriority(1),
    emptyPriority(2),
    emptyPriority(3),
  ];
  for (const p of prioritiesRes.data ?? []) {
    const pos = p.position as 1 | 2 | 3;
    priorities[pos - 1] = {
      position: pos,
      id: p.id,
      dailyGoalId: p.daily_goal_id,
      title: p.title,
      description: p.description,
      status: p.status,
      completedAt: p.completed_at,
    };
  }

  const reading = readingRes.data;
  const entry = reading?.bible_entries ?? null;
  const entryRow = Array.isArray(entry) ? entry[0] ?? null : entry;
  const suggested = lastReadingRes.data
    ? nextReading({ book: lastReadingRes.data.book, chapter: lastReadingRes.data.chapter })
    : FIRST_READING;
  const bible: BibleState = reading
    ? {
        readingId: reading.id,
        book: reading.book,
        chapter: reading.chapter,
        passage: reading.passage,
        suggested: false,
        checks: {
          reading: reading.is_completed,
          soap: entryRow?.soap_done ?? false,
          prayer: entryRow?.prayer_done ?? false,
          application: entryRow?.application_done ?? false,
        },
        obeyToday: entryRow?.obey_today ?? "",
      }
    : {
        readingId: null,
        book: suggested.book,
        chapter: suggested.chapter,
        passage: null,
        suggested: true,
        checks: { reading: false, soap: false, prayer: false, application: false },
        obeyToday: "",
      };

  const reviewRow = reviewRes.data;
  const review = Object.fromEntries(
    REVIEW_FIELDS.map((f) => [f, (reviewRow?.[f] as string | null | undefined) ?? ""]),
  ) as ReviewState;

  const open = openRes.data;
  const openTask = open
    ? ((open as unknown as { work_blocks: { task: string } | null }).work_blocks?.task ?? null)
    : null;

  const plan = planRes.data;
  const locked =
    plan?.completed_at && plan.final_score !== null
      ? { score: plan.final_score, completedAt: plan.completed_at }
      : null;

  const suggestion = prevReviewRes.data?.tomorrow_priority?.trim() || null;

  const blocks = (blocksRes.data ?? []).map((b) => ({
    id: b.id,
    task: b.task,
    plannedStart: b.planned_start?.slice(0, 5) ?? null,
    plannedEnd: b.planned_end?.slice(0, 5) ?? null,
  }));
  const plannedMinutes = blocks.reduce((m, b) => {
    if (!b.plannedStart || !b.plannedEnd) return m;
    const [sh, sm] = b.plannedStart.split(":").map(Number);
    const [eh, em] = b.plannedEnd.split(":").map(Number);
    return m + Math.max(0, eh * 60 + em - sh * 60 - sm);
  }, 0);
  const goalPlan = await loadTodayPlan(viewer, date, { plannedMinutes, locked: Boolean(locked) });

  return {
    date,
    today,
    isToday: date === today,
    locked,
    profile,
    habits,
    priorities,
    prioritySuggestion: suggestion,
    blocks,
    sessions: (sessionsRes.data ?? []).map(mapSession),
    openSession: open ? { ...mapSession(open), task: openTask } : null,
    bible,
    review,
    streak: { current: history.current, best: Math.max(history.best, profile.bestStreak) },
    history: history.scores.slice(-30),
    firstDay: firstDayOf(viewer),
    plan: goalPlan,
  };
}

/** Every row of a query, page by page (PostgREST returns at most 1000 at a time). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

export interface HabitStats {
  id: string;
  name: string;
  category: HabitCategory;
  sortOrder: number;
  archivedAt: string | null;
  doneToday: boolean;
  /** Completion rate over the days the habit existed in the window, 0–1, or null if it didn't. */
  week: number | null;
  month: number | null;
  /** Consecutive days done, ending today (or yesterday while today is still open). */
  run: number;
}

/** Habits with their 7- and 30-day completion and current run. */
export async function loadHabitStats(viewer: Viewer): Promise<HabitStats[]> {
  const { supabase, profile, today } = viewer;
  const since = addDays(today, -89);
  const [habitsRes, completions] = await Promise.all([
    supabase.from("habits").select("id,name,category,sort_order,created_at,archived_at").order("sort_order"),
    fetchAll<{ habit_id: string; local_date: string }>((from, to) =>
      supabase
        .from("habit_completions")
        .select("habit_id,local_date")
        .gte("local_date", since)
        .order("local_date")
        .range(from, to),
    ),
  ]);
  if (habitsRes.error) throw new Error(`Could not load your habits: ${habitsRes.error.message}`);

  const doneOn = new Map<string, Set<string>>();
  for (const c of completions) {
    if (!doneOn.has(c.habit_id)) doneOn.set(c.habit_id, new Set());
    doneOn.get(c.habit_id)!.add(c.local_date);
  }

  return (habitsRes.data ?? []).map((h) => {
    const done = doneOn.get(h.id) ?? new Set<string>();
    const rate = (days: number): number | null => {
      let active = 0;
      let hit = 0;
      for (let i = 0; i < days; i += 1) {
        const d = addDays(today, -i);
        if (!habitActiveOn(h, d, profile)) continue;
        active += 1;
        if (done.has(d)) hit += 1;
      }
      return active === 0 ? null : hit / active;
    };
    let run = 0;
    for (let i = done.has(today) ? 0 : 1; i < 90; i += 1) {
      if (done.has(addDays(today, -i))) run += 1;
      else break;
    }
    return {
      id: h.id,
      name: h.name,
      category: h.category as HabitCategory,
      sortOrder: h.sort_order,
      archivedAt: h.archived_at,
      doneToday: done.has(today),
      week: rate(7),
      month: rate(30),
      run,
    };
  });
}
