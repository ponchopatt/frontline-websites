import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isWorkArea, type Area, type WorkArea } from "./areas";
import { isPlanKey, nextInPlan } from "./bible";
import { asCloseSummary } from "./close-day";
import { addDays, daysBetween, isoWeekday, localDateAt, startOfWeek, type LocalDate } from "./day";
import { formatValue } from "./goals/format";
import { indexHistory, memoryCard, momentum, recordBaseline, type HistoryFacts } from "./history";
import { readUnlockToken } from "./lock";
import { chainOf, loadGoalYear, loadLifeAreas, yearOfWeek, type GoalYear } from "./goals/data";
import { monthStartOf } from "./goals/periods";
import { dailyTarget, totalOver, weekShare, type DayValues, type Metric } from "./metrics";
import { computeStreaks, scoreForSummary, type DayScore, type DaySummary } from "./streak";
import { createClient, type Supabase } from "./supabase/server";
import type { Database } from "./supabase/database.types";
import type {
  BibleState,
  CounterItem,
  DayView,
  GoalLadder,
  HabitCategory,
  HabitItem,
  HabitKind,
  MilestoneItem,
  MilestoneStep,
  ProfileSettings,
  ProofItem,
  ProofTopic,
  ReviewState,
  TaskItem,
  WorkSessionItem,
} from "./types";
import { PROOF_TOPICS, REVIEW_FIELDS } from "./types";

type TaskRow = Database["public"]["Tables"]["daily_goals"]["Row"];
type MetricRow = Database["public"]["Tables"]["metrics"]["Row"];

export interface Viewer {
  supabase: Supabase;
  userId: string;
  profile: ProfileSettings;
  createdAt: string;
  today: LocalDate;
  /** When first-run setup was finished, or null. */
  onboardedAt: string | null;
  passcodeSet: boolean;
}

/**
 * The signed-in user behind the passcode lock: everything in the app goes through here. With
 * a passcode set and no valid unlock token in this browser, it sends them to /unlock.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const viewer = await getSession();
  if (viewer.passcodeSet) {
    const { data, error } = await viewer.supabase.rpc("lock_state", { p_token: await readUnlockToken() });
    if (error || (data !== "open" && data !== "none")) redirect("/unlock");
  }
  return viewer;
});

/**
 * The signed-in user, their profile and their "today", without the passcode check (for the
 * unlock screen itself). Signs out to /login if there is no session. Creates the profile and
 * default habits on the first visit if the sign-up trigger did not (an account made before
 * the migration, or by an admin).
 */
export const getSession = cache(async (): Promise<Viewer> => {
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
    workDays: (row.work_days ?? [1, 2, 3, 4, 5]).map(Number),
    hourTargets: hourTargetsOf(row.area_hour_targets),
    biblePlan: isPlanKey(row.bible_plan) ? row.bible_plan : "bible",
    minimumWorkMinutes: row.minimum_work_minutes,
    minimumFitness: row.minimum_fitness,
  };
  return {
    supabase,
    userId,
    profile,
    createdAt: row.created_at,
    today: localDateAt(new Date(), profile.timezone, profile.dayStartHour),
    onboardedAt: row.onboarded_at,
    passcodeSet: row.passcode_set,
  };
});

function hourTargetsOf(raw: unknown): Partial<Record<WorkArea, number>> {
  const out: Partial<Record<WorkArea, number>> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v);
      if (isWorkArea(k) && Number.isFinite(n) && n >= 0) out[k] = n;
    }
  }
  return out;
}

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
    habits_total: Number(row.habits_total ?? 0),
    habits_done: Number(row.habits_done ?? 0),
    tasks_total: Number(row.tasks_total ?? 0),
    tasks_done: Number(row.tasks_done ?? 0),
    review_done: Number(row.review_done ?? 0),
    work_minutes: Number(row.work_minutes ?? 0),
    final_score: row.final_score === null || row.final_score === undefined ? null : Number(row.final_score),
    completed_at: (row.completed_at as string | null) ?? null,
    minimum_on: Boolean(row.minimum_on),
    minimum_total: Number(row.minimum_total ?? 0),
    minimum_done: Number(row.minimum_done ?? 0),
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

/** Whether a habit is due on `date` by its schedule (every day when it has none). */
export function habitDueOn(days: number[] | null, date: LocalDate): boolean {
  return !days || days.length === 0 || days.includes(isoWeekday(date));
}

function mapSession(row: {
  id: string;
  work_block_id: string | null;
  area: string | null;
  local_date: string;
  started_at: string;
  ended_at: string | null;
  accomplishment_note: string | null;
}): WorkSessionItem {
  return {
    id: row.id,
    blockId: row.work_block_id,
    area: isWorkArea(row.area) ? row.area : null,
    localDate: row.local_date,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    note: row.accomplishment_note,
  };
}

export function mapTask(r: TaskRow, goals: GoalYear | null, proofCount = 0): TaskItem {
  return {
    id: r.id,
    localDate: r.local_date,
    title: r.title,
    area: (r.area as Area | null) ?? null,
    category: r.category,
    rank: (r.rank as 1 | 2 | 3 | null) ?? null,
    status: r.status,
    priority: Math.min(3, Math.max(1, r.priority)) as 1 | 2 | 3,
    dueDate: r.due_date,
    notes: r.notes,
    quantity: r.quantity === null ? null : Number(r.quantity),
    unit: r.unit,
    metricId: r.metric_id,
    weeklyGoalId: r.parent_weekly_goal_id,
    carriedFromId: r.carried_from_id,
    completedAt: r.completed_at,
    chain: goals ? chainOf(goals, r.parent_weekly_goal_id) : null,
    proofCount,
  };
}

export function mapMetric(m: MetricRow): Metric {
  return {
    id: m.id,
    area: m.area as Area,
    key: m.key,
    label: m.label,
    grp: m.grp,
    unit: m.unit,
    aggregation: m.aggregation,
    dailyTarget: m.daily_target === null ? null : Number(m.daily_target),
    weeklyTarget: m.weekly_target === null ? null : Number(m.weekly_target),
    pinned: m.pinned,
    sortOrder: m.sort_order,
    createdAt: m.created_at,
  };
}

export interface CounterData {
  metrics: Metric[];
  values: Map<string, DayValues>;
}

/** Active counters and their values by day from `from` to `to`. */
export async function loadCounterData(supabase: Supabase, from: LocalDate, to: LocalDate): Promise<CounterData> {
  const [metricsRes, entries] = await Promise.all([
    supabase.from("metrics").select("*").eq("is_active", true).order("area").order("sort_order"),
    fetchAll<{ metric_id: string; local_date: string; value: number }>((a, b) =>
      supabase.from("metric_entries").select("metric_id,local_date,value").gte("local_date", from).lte("local_date", to).range(a, b),
    ),
  ]);
  if (metricsRes.error) throw new Error(`Your counters couldn't be loaded: ${metricsRes.error.message}`);
  const values = new Map<string, DayValues>();
  for (const e of entries) {
    if (!values.has(e.metric_id)) values.set(e.metric_id, new Map());
    values.get(e.metric_id)!.set(e.local_date, Number(e.value));
  }
  return { metrics: (metricsRes.data ?? []).map(mapMetric), values };
}

/**
 * Each counter for a day: the day's value, the week so far, and today's target — what's left
 * of the week's target (a weekly goal on the counter, else its own) over the work days left.
 */
export function countersFor(data: CounterData, date: LocalDate, profile: ProfileSettings, goals: GoalYear | null): CounterItem[] {
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  return data.metrics.map((m) => {
    const values = data.values.get(m.id);
    const fromGoals = goals?.tree.weekly.filter((w) => w.weekStart === weekStart && w.state !== "cancelled" && w.progressSource === "metric" && w.metricId === m.id) ?? [];
    const since = localDateAt(new Date(m.createdAt), profile.timezone, profile.dayStartHour);
    const weekTarget =
      fromGoals.length > 0 ? fromGoals.reduce((s, w) => s + (w.targetValue ?? 0), 0) : weekShare(m.weeklyTarget, weekStart, since, profile.workDays, m.unit);
    const value = m.aggregation === "latest" ? totalOver(values, date, date, "latest") : values?.get(date) ?? 0;
    return {
      id: m.id,
      area: m.area,
      key: m.key,
      label: m.label,
      grp: m.grp,
      unit: m.unit,
      aggregation: m.aggregation,
      pinned: m.pinned,
      value,
      target: dailyTarget({
        metric: m,
        weeklyTarget: weekTarget,
        doneBeforeToday: totalOver(values, weekStart, addDays(date, -1), "sum"),
        today: date,
        workDays: profile.workDays,
      }),
      weekTotal: totalOver(values, weekStart, date < weekEnd ? date : weekEnd, m.aggregation),
      weekTarget,
    };
  });
}

function stepsOf(raw: unknown): MilestoneStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is { title: unknown; done: unknown } => Boolean(s) && typeof s === "object")
    .map((s) => ({ title: String(s.title ?? "").slice(0, 60), done: Boolean(s.done) }))
    .filter((s) => s.title.trim());
}

export async function loadMilestone(supabase: Supabase, area: Area = "trading"): Promise<MilestoneItem | null> {
  const { data } = await supabase.from("project_milestones").select("id,title,steps").eq("area", area).eq("state", "active").maybeSingle();
  return data ? { id: data.id, title: data.title, steps: stepsOf(data.steps) } : null;
}

/** Signed, short-lived links for a day's proof photos. */
async function loadProofs(supabase: Supabase, date: LocalDate, labels: Map<string, string>): Promise<ProofItem[]> {
  const { data: rows } = await supabase.from("proof_uploads").select("id,storage_path,task_id,habit_id,note,topic,uploaded_at").eq("local_date", date).order("uploaded_at");
  if (!rows || rows.length === 0) return [];
  const { data: signed } = await supabase.storage.from("proof").createSignedUrls(rows.map((r) => r.storage_path), 60 * 60);
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    url: urlFor.get(r.storage_path) ?? null,
    taskId: r.task_id,
    habitId: r.habit_id,
    label: r.note ?? (r.task_id ? labels.get(r.task_id) : r.habit_id ? labels.get(r.habit_id) : null) ?? null,
    topic: proofTopic(r.topic),
    uploadedAt: r.uploaded_at,
  }));
}

export function proofTopic(raw: string | null): ProofTopic {
  return (PROOF_TOPICS as readonly string[]).includes(raw ?? "") ? (raw as ProofTopic) : "other";
}

/** Today → Week → Month → Year for the year's main goals. */
function laddersFor(goals: GoalYear, areaKeys: Map<string, Area | null>, date: LocalDate, counters: CounterItem[], tasks: TaskItem[]): GoalLadder[] {
  const month = monthStartOf(date);
  const week = startOfWeek(date);
  const ratio = (id: string) => goals.progress.get(id)?.ratio ?? null;
  return goals.tree.yearly
    .filter((y) => y.state === "active")
    .sort((a, b) => a.priority - b.priority || a.sortOrder - b.sortOrder)
    .slice(0, 4)
    .map((y) => {
      const monthly = goals.tree.monthly.find((m) => m.parentYearlyId === y.id && m.monthStart === month && m.state !== "cancelled") ?? null;
      const weekly = monthly
        ? goals.tree.weekly
            .filter((w) => w.parentMonthlyId === monthly.id && w.weekStart === week && w.state !== "cancelled")
            .sort((a, b) => Number(b.isMajor) - Number(a.isMajor))[0] ?? null
        : null;
      let today: string | null = null;
      if (weekly?.metricId) {
        const c = counters.find((x) => x.id === weekly.metricId);
        if (c && c.target !== null) today = `${formatValue(c.target, c.unit)} ${c.unit === "$" ? c.label.toLowerCase() + " target" : c.label.toLowerCase()}`;
      }
      if (!today && weekly) today = tasks.find((t) => t.weeklyGoalId === weekly.id)?.title ?? null;
      return {
        area: y.lifeAreaId ? areaKeys.get(y.lifeAreaId) ?? null : null,
        yearly: { id: y.id, title: y.title, year: y.year, ratio: ratio(y.id) },
        monthly: monthly ? { id: monthly.id, title: monthly.title, monthStart: monthly.monthStart, ratio: ratio(monthly.id) } : null,
        weekly: weekly ? { id: weekly.id, title: weekly.title, weekStart: weekly.weekStart, ratio: ratio(weekly.id) } : null,
        today,
      };
    });
}

/**
 * Everything the Today screen needs for one day. `facts` is the history since the account
 * started (loadFacts), passed in so it loads alongside everything else.
 */
export async function loadDay(viewer: Viewer, date: LocalDate, facts: Promise<HistoryFacts>): Promise<DayView> {
  const { supabase, profile, today } = viewer;
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  const isToday = date === today;

  const [
    habitsRes,
    completionsRes,
    weekCompletionsRes,
    tasksRes,
    unfinishedRes,
    laterRes,
    prevReviewRes,
    blocksRes,
    sessionsRes,
    openRes,
    readingRes,
    lastReadingRes,
    reviewRes,
    planRes,
    history,
    counterData,
    milestone,
    goals,
    areas,
  ] = await Promise.all([
    supabase.from("habits").select("id,name,category,kind,days,minimum,sort_order,created_at,archived_at").order("sort_order"),
    supabase.from("habit_completions").select("habit_id,completed_at,edited_at").eq("local_date", date),
    supabase.from("habit_completions").select("habit_id,local_date").gte("local_date", weekStart).lte("local_date", weekEnd),
    supabase.from("daily_goals").select("*").eq("local_date", date).order("rank", { nullsFirst: false }).order("created_at"),
    isToday
      ? supabase.from("daily_goals").select("*").gte("local_date", addDays(date, -7)).lt("local_date", date).eq("status", "pending").order("local_date", { ascending: false })
      : Promise.resolve({ data: [] as TaskRow[], error: null }),
    supabase.from("daily_goals").select("*").is("local_date", null).eq("status", "pending").order("due_date", { nullsFirst: false }).order("created_at"),
    supabase.from("daily_reviews").select("tomorrow_priority").eq("local_date", addDays(date, -1)).maybeSingle(),
    supabase.from("work_blocks").select("id,task,area,planned_start,planned_end").eq("local_date", date)
      .order("planned_start", { ascending: true, nullsFirst: false }).order("created_at"),
    supabase.from("work_sessions").select("*").eq("local_date", date).order("started_at"),
    supabase.from("work_sessions").select("*, work_blocks(task)").is("ended_at", null).maybeSingle(),
    supabase.from("bible_readings").select("*, bible_entries(journal)").eq("local_date", date).maybeSingle(),
    supabase.from("bible_readings").select("book,chapter").lt("local_date", date)
      .order("local_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("daily_reviews").select("*").eq("local_date", date).maybeSingle(),
    supabase.from("daily_plans").select("final_score,completed_at,score_breakdown,minimum_at").eq("local_date", date).maybeSingle(),
    facts,
    loadCounterData(supabase, addDays(weekStart, -60), date),
    loadMilestone(supabase),
    loadGoalYear(viewer, yearOfWeek(weekStart)),
    loadLifeAreas(viewer),
  ]);

  for (const res of [habitsRes, completionsRes, tasksRes, unfinishedRes, laterRes, blocksRes, sessionsRes, readingRes, reviewRes, planRes]) {
    if (res.error) throw new Error(`Could not load this day: ${res.error.message}`);
  }

  const done = new Map((completionsRes.data ?? []).map((c) => [c.habit_id, c]));
  const habitRows = (habitsRes.data ?? []).filter((h) => habitActiveOn(h, date, profile) || done.has(h.id));
  const habits: HabitItem[] = habitRows.map((h) => ({
    id: h.id,
    name: h.name,
    category: h.category as HabitCategory,
    kind: (h.kind as HabitKind | null) ?? null,
    days: h.days,
    due: habitDueOn(h.days, date),
    minimum: h.minimum,
    sortOrder: h.sort_order,
    completedAt: done.get(h.id)?.completed_at ?? null,
    editedAt: done.get(h.id)?.edited_at ?? null,
  }));

  // Gym and cardio across this week.
  const weekDone = new Map<string, Set<string>>();
  for (const c of weekCompletionsRes.data ?? []) {
    if (!weekDone.has(c.habit_id)) weekDone.set(c.habit_id, new Set());
    weekDone.get(c.habit_id)!.add(c.local_date);
  }
  const gym = (habitsRes.data ?? []).find((h) => h.kind === "gym" && !h.archived_at);
  const cardio = (habitsRes.data ?? []).find((h) => h.kind === "cardio" && !h.archived_at);
  // Days before the habit existed are neither due nor missed.
  const gymWeek = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const existed = gym ? d >= localDateAt(new Date(gym.created_at), profile.timezone, profile.dayStartHour) : false;
    return { date: d, due: gym && existed ? habitDueOn(gym.days, d) : false, done: gym ? weekDone.get(gym.id)?.has(d) ?? false : false };
  });
  const cardioFrom = cardio ? localDateAt(new Date(cardio.created_at), profile.timezone, profile.dayStartHour) : weekStart;
  const cardioStart = cardioFrom > weekStart ? cardioFrom : weekStart;
  const cardioEnd = date < weekEnd ? date : weekEnd;
  const cardioWeek = {
    done: cardio ? weekDone.get(cardio.id)?.size ?? 0 : 0,
    days: cardioEnd < cardioStart ? 0 : daysBetween(cardioStart, cardioEnd) + 1,
  };

  // Tasks. Unfinished ones that were already moved on don't come back.
  const unfinishedRows = unfinishedRes.data ?? [];
  let carriedAway = new Set<string>();
  if (unfinishedRows.length > 0) {
    const { data: carried } = await supabase.from("daily_goals").select("carried_from_id").in("carried_from_id", unfinishedRows.map((t) => t.id));
    carriedAway = new Set((carried ?? []).map((c) => c.carried_from_id as string));
  }

  const labels = new Map<string, string>([...(tasksRes.data ?? []).map((t) => [t.id, t.title] as const), ...habits.map((h) => [h.id, h.name] as const)]);
  const proofs = await loadProofs(supabase, date, labels);
  const proofCount = (taskId: string) => proofs.filter((p) => p.taskId === taskId).length;
  const tasks = (tasksRes.data ?? []).map((t) => mapTask(t, goals, proofCount(t.id)));
  const unfinished = unfinishedRows.filter((t) => !carriedAway.has(t.id)).map((t) => mapTask(t, goals));
  const later = (laterRes.data ?? []).map((t) => mapTask(t, goals));

  const counters = countersFor(counterData, date, profile, goals);

  // Bible: today's chapter from the plan, and the journal line.
  const reading = readingRes.data;
  const entry = reading?.bible_entries ?? null;
  const entryRow = Array.isArray(entry) ? entry[0] ?? null : entry;
  const planned = nextInPlan(profile.biblePlan, lastReadingRes.data ? { book: lastReadingRes.data.book, chapter: lastReadingRes.data.chapter } : null);
  const bible: BibleState = reading
    ? { readingId: reading.id, book: reading.book, chapter: reading.chapter, passage: reading.passage, suggested: false, journal: entryRow?.journal ?? "", plan: profile.biblePlan }
    : { readingId: null, book: planned.book, chapter: planned.chapter, passage: null, suggested: true, journal: "", plan: profile.biblePlan };

  const reviewRow = reviewRes.data;
  const review = Object.fromEntries(REVIEW_FIELDS.map((f) => [f, (reviewRow?.[f] as string | null | undefined) ?? ""])) as ReviewState;

  const open = openRes.data;
  const openTask = open ? ((open as unknown as { work_blocks: { task: string } | null }).work_blocks?.task ?? null) : null;

  const plan = planRes.data;
  const locked = plan?.completed_at && plan.final_score !== null ? { score: plan.final_score, completedAt: plan.completed_at } : null;

  const areaKeys = new Map(areas.map((a) => [a.id, a.key]));

  // History: the streak, the last 30 days, and (for today) momentum, records and memories.
  const ix = indexHistory(history);
  const scores = ix.dates.map((d) => ix.score.get(d)!);
  const streak = computeStreaks(scores, profile.streakThreshold, today);

  return {
    date,
    today,
    isToday,
    locked,
    profile,
    habits,
    tasks,
    unfinished,
    later,
    lastNightPriority: prevReviewRes.data?.tomorrow_priority?.trim() || null,
    counters,
    blocks: (blocksRes.data ?? []).map((b) => ({
      id: b.id,
      task: b.task,
      area: isWorkArea(b.area) ? b.area : null,
      plannedStart: b.planned_start?.slice(0, 5) ?? null,
      plannedEnd: b.planned_end?.slice(0, 5) ?? null,
    })),
    sessions: (sessionsRes.data ?? []).map(mapSession),
    openSession: open ? { ...mapSession(open), task: openTask } : null,
    bible,
    review,
    milestone,
    gymWeek,
    cardioWeek,
    proofs,
    streak: { current: streak.current, best: Math.max(streak.best, profile.bestStreak) },
    history: scores.slice(-30),
    firstDay: firstDayOf(viewer),
    ladders: laddersFor(goals, areaKeys, date, counters, tasks),
    weekStart,
    minimumAt: plan?.minimum_at ?? null,
    closed: locked ? asCloseSummary(plan?.score_breakdown) : null,
    momentum: isToday ? momentum(ix) : null,
    baseline: isToday ? recordBaseline(ix) : null,
    memory: isToday ? memoryCard(ix) : null,
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
  kind: HabitKind | null;
  days: number[] | null;
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
    supabase.from("habits").select("id,name,category,kind,days,sort_order,created_at,archived_at").order("sort_order"),
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
      kind: (h.kind as HabitKind | null) ?? null,
      days: h.days,
      sortOrder: h.sort_order,
      archivedAt: h.archived_at,
      doneToday: done.has(today),
      week: rate(7),
      month: rate(30),
      run,
    };
  });
}
