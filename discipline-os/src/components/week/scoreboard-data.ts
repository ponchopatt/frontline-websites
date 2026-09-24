import "server-only";
import { AREA_SHORT, type Area } from "@/lib/areas";
import { countersFor, habitDueOn, loadCounterData, loadMilestone, requestTime, type CounterData, type Viewer } from "@/lib/data";
import { addDays, dateRange, formatHours, localDateAt, type LocalDate } from "@/lib/day";
import type { GoalYear } from "@/lib/goals/data";
import { formatValue } from "@/lib/goals/format";
import type { MilestoneItem, ProfileSettings } from "@/lib/types";

/**
 * The week's scoreboard: Faith, Fitness, the two businesses and the AI bot, each line
 * "done/target" for one week. Counted from the same ticks, counters and timer as Today.
 *
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
  profile: ProfileSettings;
  habits: KindHabit[];
  ticks: Array<{ habit_id: string; local_date: string }>;
  counters: CounterData;
  botMinutes: number;
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
    supabase.from("work_sessions").select("started_at,ended_at").eq("area", "trading").gte("local_date", week).lte("local_date", end),
    loadCounterData(supabase, week, end),
    loadMilestone(supabase),
  ]);
  for (const res of [habitsRes, ticksRes, sessionsRes]) {
    if (res.error) throw new Error(`The scoreboard couldn't be loaded: ${res.error.message}`);
  }

  const localDay = (at: string) => localDateAt(new Date(at), profile.timezone, profile.dayStartHour);
  // A session still running counts up to now.
  const now = requestTime();
  const botMinutes = (sessionsRes.data ?? []).reduce(
    (sum, s) => sum + Math.max(0, ((s.ended_at ? new Date(s.ended_at).getTime() : now) - new Date(s.started_at).getTime()) / 60000),
    0,
  );

  return {
    week,
    today,
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

  const groups: Array<{ title: string; rows: Array<ScoreRow | null> }> = [
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
