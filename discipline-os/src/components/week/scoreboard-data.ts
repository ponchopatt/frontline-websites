import "server-only";
import { AREA_SHORT, type Area } from "@/lib/areas";
import { countersFor, firstDayOf, habitDueOn, loadCounterData, loadMilestone, requestTime, type CounterData, type Viewer } from "@/lib/data";
import { addDays, dateRange, formatHours, isoWeekday, localDateAt, type LocalDate } from "@/lib/day";
import type { GoalYear } from "@/lib/goals/data";
import { formatValue } from "@/lib/goals/format";
import type { MilestoneItem, ProfileSettings } from "@/lib/types";

/**
 * The week's scoreboard, and the Weekly Boss made of its targets: work hours, Faith, Fitness,
 * the two businesses and the AI bot, each line "done/target" for one week. Counted from the
 * same ticks, counters and timer as Today.
 *
 *   Work      hours on the timer against the daily target on each work day
 *   Faith     days Bible / Prayer were ticked (a week in progress: out of the days so far)
 *   Fitness   days Gym / Cardio were ticked, out of the days they're due this week
 *   Imperium  leads, revenue, reels: the week's total against the week's target
 *   Websites  demos, calls, closed, delivered, revenue: the same
 *   AI Bot    hours on the timer, and how far the current milestone is
 */

export interface ScoreRow {
  label: string;
  /** "6", "$18,400", "9.5h", "85%" */
  value: string;
  /** The target, written like the value. Null when there isn't one. */
  of: string | null;
  /** 0–1 for the meter. Null: no meter. */
  ratio: number | null;
  /** A quiet word after the label: "so far", the milestone's name. */
  note?: string;
}

export interface ScoreGroup {
  title: string;
  rows: ScoreRow[];
}

/** A habit the scoreboard knows, with the local days it existed: from, up to (not incl.) to. */
interface KindHabit {
  id: string;
  kind: string;
  days: number[] | null;
  from: LocalDate;
  to: LocalDate | null;
}

export interface ScoreboardFacts {
  week: LocalDate;
  today: LocalDate;
  firstDay: LocalDate;
  profile: ProfileSettings;
  habits: KindHabit[];
  ticks: Array<{ habit_id: string; local_date: string }>;
  counters: CounterData;
  botMinutes: number;
  workMinutes: number;
  milestone: MilestoneItem | null;
}

const KINDS = ["bible", "prayer", "gym", "cardio"];

/** Everything the scoreboard counts for the week starting `week`. Load it alongside the goals. */
export async function loadScoreboard(viewer: Viewer, week: LocalDate): Promise<ScoreboardFacts> {
  const { supabase, profile, today } = viewer;
  const end = addDays(week, 6);
  const [habitsRes, ticksRes, sessionsRes, counters, milestone] = await Promise.all([
    supabase.from("habits").select("id,kind,days,created_at,archived_at").in("kind", KINDS),
    supabase.from("habit_completions").select("habit_id,local_date").gte("local_date", week).lte("local_date", end),
    supabase.from("work_sessions").select("started_at,ended_at,area").gte("local_date", week).lte("local_date", end),
    loadCounterData(supabase, week, end),
    loadMilestone(supabase),
  ]);
  for (const res of [habitsRes, ticksRes, sessionsRes]) {
    if (res.error) throw new Error(`The scoreboard couldn't be loaded: ${res.error.message}`);
  }

  const localDay = (at: string) => localDateAt(new Date(at), profile.timezone, profile.dayStartHour);
  // A session still running counts up to now.
  const now = requestTime();
  const minutes = (s: { started_at: string; ended_at: string | null }) =>
    Math.max(0, ((s.ended_at ? new Date(s.ended_at).getTime() : now) - new Date(s.started_at).getTime()) / 60000);
  const sessions = sessionsRes.data ?? [];
  const botMinutes = sessions.filter((s) => s.area === "trading").reduce((sum, s) => sum + minutes(s), 0);
  const workMinutes = sessions.reduce((sum, s) => sum + minutes(s), 0);

  return {
    week,
    today,
    firstDay: firstDayOf(viewer),
    profile,
    habits: (habitsRes.data ?? []).map((h) => ({
      id: h.id,
      kind: h.kind ?? "",
      days: h.days,
      from: localDay(h.created_at),
      to: h.archived_at ? localDay(h.archived_at) : null,
    })),
    ticks: ticksRes.data ?? [],
    counters,
    botMinutes,
    workMinutes,
    milestone,
  };
}

/** "6/7" with a meter; just the total when there's no target. */
function tally(label: string, done: number, target: number | null, unit: string | null, note?: string): ScoreRow {
  const hasTarget = target !== null && target > 0;
  return {
    label,
    value: formatValue(done, unit),
    of: hasTarget ? formatValue(target, unit) : null,
    ratio: hasTarget ? done / target : null,
    note,
  };
}

/** The scoreboard's lines, grouped. Lines with nothing behind them (no such habit or counter) are left out. */
export function scoreboardGroups(facts: ScoreboardFacts, goals: GoalYear | null): ScoreGroup[] {
  const { week, today, profile, habits, ticks } = facts;
  const end = addDays(week, 6);
  const current = week <= today && today <= end;
  // Faith counts every day, so a week in progress is out of the days so far.
  const faithTo = current ? today : end;
  const soFar = current ? "so far" : undefined;

  const habitRow = (label: string, kind: string, to: LocalDate, note?: string): ScoreRow | null => {
    const existed = (h: KindHabit, d: LocalDate) => h.from <= d && (h.to === null || h.to > d);
    const list = habits.filter((h) => h.kind === kind && dateRange(week, end).some((d) => existed(h, d)));
    if (list.length === 0) return null;
    const ids = new Set(list.map((h) => h.id));
    const done = new Set(ticks.filter((t) => ids.has(t.habit_id) && t.local_date <= to).map((t) => t.local_date)).size;
    const due = dateRange(week, to).filter((d) => list.some((h) => existed(h, d) && habitDueOn(h.days, d))).length;
    return tally(label, done, due, null, note);
  };

  // The week's totals as of today, or its last day once it's over.
  const asOf = today < week ? week : today > end ? end : today;
  const counters = countersFor(facts.counters, asOf, profile, goals);
  const counterRow = (label: string, area: Area, key: string): ScoreRow | null => {
    const c = counters.find((x) => x.area === area && x.key === key);
    return c ? tally(label, c.weekTotal, c.weekTarget, c.unit === "$" ? "$" : null) : null;
  };

  const m = facts.milestone;
  const pct = m && m.steps.length > 0 ? Math.round((100 * m.steps.filter((s) => s.done).length) / m.steps.length) : 0;
  const milestone: ScoreRow | null = m
    ? { label: "Milestone", value: `${pct}%`, of: null, ratio: pct / 100, note: end < today ? `Now: ${m.title}` : m.title }
    : null;

  // Work: the daily target on each work day of the week the account existed for.
  const workDays = dateRange(week, end).filter((d) => d >= facts.firstDay && profile.workDays.includes(isoWeekday(d))).length;
  const workTarget = profile.workTargetHours * 60 * workDays;
  const work: ScoreRow = {
    label: "Focused work",
    value: formatHours(facts.workMinutes),
    of: workTarget > 0 ? formatHours(workTarget) : null,
    ratio: workTarget > 0 ? facts.workMinutes / workTarget : null,
  };

  const groups: Array<{ title: string; rows: Array<ScoreRow | null> }> = [
    { title: "Work", rows: [work] },
    { title: AREA_SHORT.faith, rows: [habitRow("Bible", "bible", faithTo, soFar), habitRow("Prayer", "prayer", faithTo, soFar)] },
    { title: AREA_SHORT.fitness, rows: [habitRow("Gym", "gym", end), habitRow("Cardio", "cardio", end)] },
    {
      title: AREA_SHORT.imperium,
      rows: [counterRow("Leads", "imperium", "leads_called"), counterRow("Revenue", "imperium", "revenue"), counterRow("Reels", "imperium", "reels_posted")],
    },
    {
      title: AREA_SHORT.websites,
      rows: [
        counterRow("Demos", "websites", "demos_built"),
        counterRow("Calls", "websites", "cold_calls"),
        counterRow("Closed", "websites", "closed"),
        counterRow("Delivered", "websites", "delivered"),
        counterRow("Revenue", "websites", "revenue"),
      ],
    },
    { title: AREA_SHORT.trading, rows: [{ label: "Hours", value: formatHours(facts.botMinutes), of: null, ratio: null }, milestone] },
  ];
  return groups
    .map((g) => ({ title: g.title, rows: g.rows.filter((r): r is ScoreRow => r !== null) }))
    .filter((g) => g.rows.length > 0);
}

export interface Boss {
  /** Targets hit, of those set. */
  hit: number;
  total: number;
  /** 0–1: how far through the targets, each capped at done. */
  ratio: number;
  /** "fighting" while the week runs; once it's over, beaten when most targets were hit. */
  state: "fighting" | "defeated" | "survived";
  /** The targets, nearest to done first among those not yet hit. */
  rows: ScoreRow[];
}

/**
 * The Weekly Boss: this week's targets, one fight. It's beaten when most of them are hit by
 * the end of the week. Lines without a target (a total, the milestone) aren't part of it.
 */
export function bossOf(groups: ScoreGroup[], weekOver: boolean): Boss | null {
  const rows = groups.flatMap((g) => g.rows).filter((r) => r.of !== null && r.ratio !== null);
  if (rows.length === 0) return null;
  const hit = rows.filter((r) => (r.ratio ?? 0) >= 1).length;
  const ratio = rows.reduce((s, r) => s + Math.min(1, r.ratio ?? 0), 0) / rows.length;
  return {
    hit,
    total: rows.length,
    ratio,
    state: !weekOver ? "fighting" : hit * 2 > rows.length ? "defeated" : "survived",
    rows,
  };
}
