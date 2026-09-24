import { addDays, dateRange, daysBetween, formatDuration, isoWeekday, shortDate, startOfWeek, type LocalDate } from "./day";
import { formatValue } from "./goals/format";
import { keepWord } from "./keep-word";
import { keepsChain, scoreForSummary, summaryToTally, type DayScore, type DaySummary } from "./streak";
import type { HabitCategory, HabitKind } from "./types";

/**
 * My progress, worked out from what's stored and nothing else: streaks with their
 * consistency, personal records, momentum, Keep My Word over weeks and months, the year in
 * squares, and plain sentences about the history. Pure functions over HistoryFacts, so the
 * Progress page, Today and Close Day all read the same numbers.
 */

export interface FactHabit {
  id: string;
  name: string;
  category: HabitCategory;
  kind: HabitKind | null;
  days: number[] | null;
  /** The local days it existed: from, up to (not including) to. */
  from: LocalDate;
  to: LocalDate | null;
}

export interface FactCounter {
  id: string;
  area: string;
  key: string;
  unit: string | null;
}

export interface HistoryFacts {
  today: LocalDate;
  firstDay: LocalDate;
  threshold: number;
  workTargetMinutes: number;
  workDays: number[];
  /** Every day from firstDay to today, oldest first. */
  days: DaySummary[];
  habits: FactHabit[];
  ticks: Array<{ habitId: string; date: LocalDate }>;
  counters: FactCounter[];
  entries: Array<{ metricId: string; date: LocalDate; value: number }>;
}

/* ------------------------------------------------------------------ index */

export interface HistoryIndex {
  facts: HistoryFacts;
  /** firstDay … today. */
  dates: LocalDate[];
  summary: Map<LocalDate, DaySummary>;
  score: Map<LocalDate, DayScore>;
  doneOn: Map<string, Set<LocalDate>>;
  /** A counter's value by day; revenue adds up both businesses. */
  counter: (area: string, key: string) => Map<LocalDate, number>;
}

export function indexHistory(facts: HistoryFacts): HistoryIndex {
  const summary = new Map(facts.days.map((d) => [d.local_date, d]));
  const score = new Map(facts.days.map((d) => [d.local_date, scoreForSummary(d, facts.workTargetMinutes / 60)]));
  const doneOn = new Map<string, Set<LocalDate>>();
  for (const t of facts.ticks) {
    if (!doneOn.has(t.habitId)) doneOn.set(t.habitId, new Set());
    doneOn.get(t.habitId)!.add(t.date);
  }
  const byMetric = new Map<string, Map<LocalDate, number>>();
  for (const e of facts.entries) {
    if (!byMetric.has(e.metricId)) byMetric.set(e.metricId, new Map());
    byMetric.get(e.metricId)!.set(e.date, Number(e.value));
  }
  const cache = new Map<string, Map<LocalDate, number>>();
  const counter = (area: string, key: string) => {
    const id = `${area}.${key}`;
    if (!cache.has(id)) {
      const out = new Map<LocalDate, number>();
      for (const c of facts.counters.filter((x) => (area === "*" || x.area === area) && x.key === key)) {
        for (const [d, v] of byMetric.get(c.id) ?? []) out.set(d, (out.get(d) ?? 0) + v);
      }
      cache.set(id, out);
    }
    return cache.get(id)!;
  };
  const dates = facts.firstDay <= facts.today ? dateRange(facts.firstDay, facts.today) : [];
  return { facts, dates, summary, score, doneOn, counter };
}

function existed(h: FactHabit, d: LocalDate) {
  return h.from <= d && (h.to === null || h.to > d);
}

function dueByDays(days: number[] | null, d: LocalDate) {
  return !days || days.length === 0 || days.includes(isoWeekday(d));
}

/* ------------------------------------------------------------------ streaks */

export type StreakKey = "word" | "morning" | "bible" | "prayer" | "gym" | "cardio" | "fitness" | "work" | "review";

interface StreakDef {
  key: StreakKey;
  label: string;
  due: (d: LocalDate) => boolean;
  done: (d: LocalDate) => boolean;
}

function streakDefs(ix: HistoryIndex): StreakDef[] {
  const { facts, doneOn, summary, score } = ix;
  const ofKinds = (kinds: string[]) => facts.habits.filter((h) => h.kind && kinds.includes(h.kind));
  const kindDef = (key: StreakKey, label: string, kinds: string[]): StreakDef | null => {
    const list = ofKinds(kinds);
    if (list.length === 0) return null;
    return {
      key,
      label,
      due: (d) => list.some((h) => existed(h, d) && dueByDays(h.days, d)),
      done: (d) => list.some((h) => doneOn.get(h.id)?.has(d)),
    };
  };
  const morning = facts.habits.filter((h) => h.category === "morning");
  const morningDue = (d: LocalDate) => morning.filter((h) => existed(h, d) && dueByDays(h.days, d));
  const defs: Array<StreakDef | null> = [
    { key: "word", label: "Keep my word", due: () => true, done: (d) => Boolean(score.get(d) && keepsChain(score.get(d)!, facts.threshold)) },
    morning.length > 0
      ? { key: "morning", label: "Morning routine", due: (d) => morningDue(d).length > 0, done: (d) => morningDue(d).every((h) => doneOn.get(h.id)?.has(d)) }
      : null,
    kindDef("bible", "Bible", ["bible"]),
    kindDef("prayer", "Prayer", ["prayer", "evening_prayer"]),
    kindDef("gym", "Gym", ["gym"]),
    kindDef("cardio", "Cardio", ["cardio"]),
    kindDef("fitness", "Gym or cardio", ["gym", "cardio"]),
    facts.workTargetMinutes > 0
      ? {
          key: "work",
          label: "Work target",
          due: (d) => facts.workDays.includes(isoWeekday(d)),
          done: (d) => Number(summary.get(d)?.work_minutes ?? 0) >= facts.workTargetMinutes,
        }
      : null,
    { key: "review", label: "Night review", due: () => true, done: (d) => (summary.get(d)?.review_done ?? 0) > 0 },
  ];
  return defs.filter((d): d is StreakDef => d !== null);
}

export interface Run {
  start: LocalDate;
  end: LocalDate;
  length: number;
}

export interface RunStats {
  /** The run still going: it reaches today, or yesterday while today is open. */
  current: number;
  best: number;
  /** The best run other than the one still going. */
  bestBefore: number;
  runs: Run[];
}

/**
 * Consecutive due days done. A day it isn't due (a rest day) neither breaks nor adds to it;
 * today only adds once it's done, and never breaks it while it's still open.
 */
export function runStats(dates: LocalDate[], today: LocalDate, due: (d: LocalDate) => boolean, done: (d: LocalDate) => boolean): RunStats {
  const runs: Run[] = [];
  let open: Run | null = null;
  for (const d of dates) {
    if (d > today || !due(d)) continue;
    const hit = done(d);
    if (d === today && !hit) continue;
    if (hit) {
      if (open) {
        open.end = d;
        open.length += 1;
      } else open = { start: d, end: d, length: 1 };
    } else if (open) {
      runs.push(open);
      open = null;
    }
  }
  const current = open?.length ?? 0;
  const bestBefore = runs.reduce((m, r) => Math.max(m, r.length), 0);
  if (open) runs.push(open);
  return { current, best: Math.max(current, bestBefore), bestBefore, runs };
}

export interface StreakRow {
  key: StreakKey;
  label: string;
  current: number;
  best: number;
  bestBefore: number;
  /** Done of due over the last 30 days (today only once it's done). Null with nothing due. */
  consistency: number | null;
  doneToday: boolean;
  /** The last six weeks, oldest first, one per day: for the dot grid. */
  recent: DotState[];
  /** Done and due over those six weeks. */
  recentDone: number;
  recentDue: number;
}

/** A day in a streak's dot grid: done, due and missed, not due (or before the start), or today still open. */
export type DotState = "done" | "missed" | "off" | "open";

const RECENT_DAYS = 42;

export function streaks(ix: HistoryIndex): StreakRow[] {
  const { dates, facts } = ix;
  const since = addDays(facts.today, -29);
  return streakDefs(ix).map((def) => {
    const s = runStats(dates, facts.today, def.due, def.done);
    let due = 0;
    let hit = 0;
    for (const d of dates) {
      if (d < since || !def.due(d)) continue;
      const ok = def.done(d);
      if (d === facts.today && !ok) continue;
      due += 1;
      if (ok) hit += 1;
    }
    const recent: DotState[] = dateRange(addDays(facts.today, -(RECENT_DAYS - 1)), facts.today).map((d) => {
      if (d < facts.firstDay || !def.due(d)) return "off";
      if (def.done(d)) return "done";
      return d === facts.today ? "open" : "missed";
    });
    return {
      key: def.key,
      label: def.label,
      current: s.current,
      best: s.best,
      bestBefore: s.bestBefore,
      consistency: due === 0 ? null : hit / due,
      doneToday: def.due(facts.today) && def.done(facts.today),
      recent,
      recentDone: recent.filter((x) => x === "done").length,
      recentDue: recent.filter((x) => x === "done" || x === "missed").length,
    };
  });
}

/* ------------------------------------------------------------------ trophies */

/** Streak lengths worth a trophy. */
export const MILESTONES = [3, 7, 14, 30, 60, 100, 365] as const;

export interface TrophyShelf {
  key: StreakKey;
  label: string;
  best: number;
  /** Every milestone reached, then the next one still to reach. */
  items: Array<{ days: number; unlocked: boolean }>;
  unlocked: number;
}

/**
 * Trophies for streaks actually kept: one for each milestone the best run has reached, and
 * the next one, locked, to aim at. Nothing is given for anything but days kept.
 */
export function trophyShelves(rows: StreakRow[]): TrophyShelf[] {
  return rows
    .filter((r) => r.key !== "fitness")
    .map((r) => {
      const reached = MILESTONES.filter((m) => r.best >= m);
      const next = MILESTONES.find((m) => r.best < m);
      const items = [...reached.map((days) => ({ days, unlocked: true })), ...(next ? [{ days: next, unlocked: false }] : [])];
      return { key: r.key, label: r.label, best: r.best, items, unlocked: reached.length };
    });
}

/* ------------------------------------------------------------------ records */

export type RecordKey =
  | "work_day"
  | "work_week"
  | "leads_day"
  | "calls_day"
  | "revenue_day"
  | "revenue_week"
  | "revenue_month"
  | "cardio_day"
  | "gym_week"
  | "word_day"
  | "word_week"
  | `streak_${StreakKey}`;

export type RecordGroup = "work" | "business" | "fitness" | "discipline";

export interface RecordRow {
  key: RecordKey;
  group: RecordGroup;
  label: string;
  value: number;
  /** How the value reads: "9h 14m", "34", "$1,250", "21 days", "96%". */
  display: string;
  /** When it was set: "Tue 12 Aug", "Week of 4 Aug", "August 2026". */
  when: string | null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Kind = "minutes" | "count" | "$" | "days" | "percent" | "sessions";

function show(value: number, kind: Kind): string {
  if (kind === "minutes") return formatDuration(value);
  if (kind === "$") return formatValue(value, "$");
  if (kind === "days") return `${value} ${value === 1 ? "day" : "days"}`;
  if (kind === "percent") return `${Math.round(value)}%`;
  if (kind === "sessions") return `${value} ${value === 1 ? "session" : "sessions"}`;
  return formatValue(value, null);
}

interface PeriodDef {
  key: RecordKey;
  group: RecordGroup;
  label: string;
  kind: Kind;
  period: "day" | "week" | "month";
  /** The value for each day. */
  value: (d: LocalDate) => number;
}

function periodKey(d: LocalDate, period: PeriodDef["period"]) {
  return period === "day" ? d : period === "week" ? startOfWeek(d) : d.slice(0, 7);
}

function periodLabel(key: string, period: PeriodDef["period"]) {
  if (period === "day") return shortDate(key);
  if (period === "week") return `Week of ${shortDate(key).slice(4)}`;
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function periodDefs(ix: HistoryIndex): PeriodDef[] {
  const work = (d: LocalDate) => Number(ix.summary.get(d)?.work_minutes ?? 0);
  const leads = ix.counter("imperium", "leads_called");
  const calls = ix.counter("websites", "cold_calls");
  const revenue = ix.counter("*", "revenue");
  const cardio = ix.counter("fitness", "cardio_minutes");
  const gym = ix.facts.habits.filter((h) => h.kind === "gym");
  return [
    { key: "work_day", group: "work", label: "Most work in a day", kind: "minutes", period: "day", value: work },
    { key: "work_week", group: "work", label: "Most work in a week", kind: "minutes", period: "week", value: work },
    { key: "leads_day", group: "business", label: "Most Imperium leads in a day", kind: "count", period: "day", value: (d) => leads.get(d) ?? 0 },
    { key: "calls_day", group: "business", label: "Most website calls in a day", kind: "count", period: "day", value: (d) => calls.get(d) ?? 0 },
    { key: "revenue_day", group: "business", label: "Best revenue day", kind: "$", period: "day", value: (d) => revenue.get(d) ?? 0 },
    { key: "revenue_week", group: "business", label: "Best revenue week", kind: "$", period: "week", value: (d) => revenue.get(d) ?? 0 },
    { key: "revenue_month", group: "business", label: "Best revenue month", kind: "$", period: "month", value: (d) => revenue.get(d) ?? 0 },
    { key: "cardio_day", group: "fitness", label: "Longest cardio session", kind: "minutes", period: "day", value: (d) => cardio.get(d) ?? 0 },
    {
      key: "gym_week",
      group: "fitness",
      label: "Most gym sessions in a week",
      kind: "sessions",
      period: "week",
      value: (d) => (gym.some((h) => ix.doneOn.get(h.id)?.has(d)) ? 1 : 0),
    },
  ];
}

/** Totals per period for the days up to `until`. */
function totals(ix: HistoryIndex, def: PeriodDef, until: LocalDate): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of ix.dates) {
    if (d > until) break;
    const v = def.value(d);
    if (!v) continue;
    const k = periodKey(d, def.period);
    out.set(k, (out.get(k) ?? 0) + v);
  }
  return out;
}

function best(map: Map<string, number>, except?: string): { key: string; value: number } | null {
  let top: { key: string; value: number } | null = null;
  for (const [k, v] of map) {
    if (k === except) continue;
    if (!top || v > top.value) top = { key: k, value: v };
  }
  return top;
}

/** Keep My Word for days that are over (and today once it's closed). */
function settledScores(ix: HistoryIndex): DayScore[] {
  const today = ix.facts.today;
  return [...ix.score.values()].filter((s) => s.date < today || (s.date === today && s.locked));
}

/** Every personal record set so far, best first within its group. */
export function records(ix: HistoryIndex): RecordRow[] {
  const today = ix.facts.today;
  const out: RecordRow[] = [];
  for (const def of periodDefs(ix)) {
    const top = best(totals(ix, def, today));
    if (top && top.value > 0) {
      out.push({ key: def.key, group: def.group, label: def.label, value: top.value, display: show(top.value, def.kind), when: periodLabel(top.key, def.period) });
    }
  }

  const settled = settledScores(ix);
  const topDay = settled.reduce<DayScore | null>((m, s) => (!m || s.score > m.score ? s : m), null);
  if (topDay && topDay.score > 0) {
    out.push({ key: "word_day", group: "discipline", label: "Best Keep My Word day", value: topDay.score, display: show(topDay.score, "percent"), when: shortDate(topDay.date) });
  }
  // A week counts once it's over and every day of it was on the account.
  const weeks = new Map<string, number[]>();
  for (const s of settled) {
    const w = startOfWeek(s.date);
    if (w < ix.facts.firstDay || addDays(w, 6) >= today) continue;
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w)!.push(s.score);
  }
  let topWeek: { key: string; value: number } | null = null;
  for (const [w, list] of weeks) {
    if (list.length < 7) continue;
    const avg = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
    if (!topWeek || avg > topWeek.value) topWeek = { key: w, value: avg };
  }
  if (topWeek && topWeek.value > 0) {
    out.push({ key: "word_week", group: "discipline", label: "Best week", value: topWeek.value, display: `${topWeek.value}% average`, when: periodLabel(topWeek.key, "week") });
  }

  const streakGroup: Partial<Record<StreakKey, RecordGroup>> = { work: "work", gym: "fitness", cardio: "fitness", fitness: "fitness" };
  const streakLabel: Partial<Record<StreakKey, string>> = {
    word: "Longest Keep My Word streak",
    morning: "Longest morning routine streak",
    bible: "Longest Bible streak",
    prayer: "Longest prayer streak",
    fitness: "Longest fitness streak",
    work: "Longest work streak",
    review: "Longest night review streak",
  };
  for (const s of streaks(ix)) {
    const label = streakLabel[s.key];
    if (!label || s.best < 2) continue;
    out.push({ key: `streak_${s.key}`, group: streakGroup[s.key] ?? "discipline", label, value: s.best, display: show(s.best, "days"), when: s.current === s.best ? "Still going" : null });
  }
  return out;
}

/* ------------------------------------------------------------------ new records */

export interface RecordEvent {
  key: RecordKey;
  label: string;
  /** "9h 14m work today" */
  text: string;
  /** "8h 42m" */
  previous: string;
}

type DayRecord = "work" | "leads" | "calls" | "revenue" | "cardio";
type WeekRecord = "work" | "revenue" | "gym";

/**
 * What today has to beat, so the browser can spot a record the moment it happens:
 * each day record's best before today, and each week record's best in another week with this
 * week's total before today.
 */
export interface RecordBaseline {
  day: Partial<Record<DayRecord, number>>;
  week: Partial<Record<WeekRecord, { bestOther: number; before: number }>>;
  /** Streaks that one more day would take past their record: the run so far and the record. */
  streak: Partial<Record<StreakKey, { run: number; record: number }>>;
}

const DAY_DEFS: Record<DayRecord, RecordKey> = { work: "work_day", leads: "leads_day", calls: "calls_day", revenue: "revenue_day", cardio: "cardio_day" };
const WEEK_DEFS: Record<WeekRecord, RecordKey> = { work: "work_week", revenue: "revenue_week", gym: "gym_week" };

export function recordBaseline(ix: HistoryIndex): RecordBaseline {
  const today = ix.facts.today;
  const yesterday = addDays(today, -1);
  const defs = new Map(periodDefs(ix).map((d) => [d.key, d]));
  const day: RecordBaseline["day"] = {};
  for (const [name, key] of Object.entries(DAY_DEFS) as Array<[DayRecord, RecordKey]>) {
    const def = defs.get(key)!;
    day[name] = best(totals(ix, def, yesterday))?.value ?? 0;
  }
  const week: RecordBaseline["week"] = {};
  const thisWeek = startOfWeek(today);
  for (const [name, key] of Object.entries(WEEK_DEFS) as Array<[WeekRecord, RecordKey]>) {
    const def = defs.get(key)!;
    const map = totals(ix, def, yesterday);
    week[name] = { bestOther: best(map, thisWeek)?.value ?? 0, before: map.get(thisWeek) ?? 0 };
  }
  // Streaks as they stood last night (today left open): a run level with the record set by
  // another run beats it with one more day.
  const streak: RecordBaseline["streak"] = {};
  for (const def of streakDefs(ix)) {
    const s = runStats(ix.dates, today, def.due, (d) => d !== today && def.done(d));
    if (s.bestBefore >= 3 && s.current === s.bestBefore) streak[def.key] = { run: s.current, record: s.bestBefore };
  }
  return { day, week, streak };
}

export interface LiveValues {
  day: Partial<Record<DayRecord, number>>;
  /** Today's share of each week record: minutes worked, revenue, 1 if the gym is ticked. */
  week: Partial<Record<WeekRecord, number>>;
  /** Streaks that are done today. */
  doneToday: Partial<Record<StreakKey, boolean>>;
}

const TEXT: Record<DayRecord | `week_${WeekRecord}`, { label: string; kind: Kind; text: (v: string) => string }> = {
  work: { label: "Most work in a day", kind: "minutes", text: (v) => `${v} of work today` },
  leads: { label: "Most Imperium leads in a day", kind: "count", text: (v) => `${v} Imperium leads called today` },
  calls: { label: "Most website calls in a day", kind: "count", text: (v) => `${v} website calls today` },
  revenue: { label: "Best revenue day", kind: "$", text: (v) => `${v} revenue today` },
  cardio: { label: "Longest cardio session", kind: "minutes", text: (v) => `${v} of cardio today` },
  week_work: { label: "Most work in a week", kind: "minutes", text: (v) => `${v} of work this week` },
  week_revenue: { label: "Best revenue week", kind: "$", text: (v) => `${v} revenue this week` },
  week_gym: { label: "Most gym sessions in a week", kind: "sessions", text: (v) => `${v} this week` },
};

const STREAK_TEXT: Partial<Record<StreakKey, string>> = {
  word: "Keep My Word",
  morning: "Morning routine",
  bible: "Bible",
  prayer: "Prayer",
  gym: "Gym",
  cardio: "Cardio",
  fitness: "Fitness",
  work: "Work target",
  review: "Night review",
};

/**
 * Records broken today, against a record that already existed. A first time is not a record:
 * there has to be something to beat. A week record fires once, the day the week passes it.
 */
export function newRecords(base: RecordBaseline, live: LiveValues): RecordEvent[] {
  const out: RecordEvent[] = [];
  for (const name of Object.keys(DAY_DEFS) as DayRecord[]) {
    const prev = base.day[name] ?? 0;
    const now = live.day[name] ?? 0;
    if (prev > 0 && now > prev) {
      const t = TEXT[name];
      out.push({ key: DAY_DEFS[name], label: t.label, text: t.text(show(Math.floor(now), t.kind)), previous: show(Math.floor(prev), t.kind) });
    }
  }
  for (const name of Object.keys(WEEK_DEFS) as WeekRecord[]) {
    const w = base.week[name];
    const add = live.week[name] ?? 0;
    if (!w || w.bestOther <= 0 || add <= 0) continue;
    if (w.before <= w.bestOther && w.before + add > w.bestOther) {
      const t = TEXT[`week_${name}`];
      out.push({ key: WEEK_DEFS[name], label: t.label, text: t.text(show(Math.floor(w.before + add), t.kind)), previous: show(Math.floor(w.bestOther), t.kind) });
    }
  }
  for (const [key, s] of Object.entries(base.streak) as Array<[StreakKey, { run: number; record: number }]>) {
    if (!live.doneToday[key]) continue;
    const name = STREAK_TEXT[key];
    if (!name) continue;
    out.push({ key: `streak_${key}`, label: `Longest ${name.toLowerCase()} streak`, text: `${name} streak: ${show(s.run + 1, "days")}`, previous: show(s.record, "days") });
  }
  return out;
}

/** Today's values from stored history, for Close Day. */
export function liveFromHistory(ix: HistoryIndex): LiveValues {
  const d = ix.facts.today;
  const work = Number(ix.summary.get(d)?.work_minutes ?? 0);
  const revenue = ix.counter("*", "revenue").get(d) ?? 0;
  const gym = ix.facts.habits.filter((h) => h.kind === "gym").some((h) => ix.doneOn.get(h.id)?.has(d));
  const done: LiveValues["doneToday"] = {};
  for (const s of streaks(ix)) done[s.key] = s.doneToday;
  return {
    day: {
      work,
      leads: ix.counter("imperium", "leads_called").get(d) ?? 0,
      calls: ix.counter("websites", "cold_calls").get(d) ?? 0,
      revenue,
      cardio: ix.counter("fitness", "cardio_minutes").get(d) ?? 0,
    },
    week: { work, revenue, gym: gym ? 1 : 0 },
    doneToday: done,
  };
}

/* ------------------------------------------------------------------ momentum */

export interface MomentumPart {
  key: "completion" | "work" | "habits" | "tasks";
  label: string;
  /** 0–100. */
  value: number;
}

export interface Momentum {
  /** 0–100: the average of the parts. */
  score: number;
  trend: "rising" | "stable" | "falling" | null;
  /** The last window's score, for the trend. */
  previous: number | null;
  parts: MomentumPart[];
  /** Days in the window (up to 7). */
  days: number;
}

function momentumOver(ix: HistoryIndex, dates: LocalDate[]): { score: number; parts: MomentumPart[] } | null {
  const { facts, summary, score } = ix;
  if (dates.length < 3) return null;
  const parts: MomentumPart[] = [];
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  parts.push({ key: "completion", label: "Keep my word", value: Math.round(avg(dates.map((d) => score.get(d)?.score ?? 0))) });
  const workDays = dates.filter((d) => facts.workDays.includes(isoWeekday(d)));
  if (facts.workTargetMinutes > 0 && workDays.length > 0) {
    parts.push({
      key: "work",
      label: "Work hours",
      value: Math.round(100 * avg(workDays.map((d) => Math.min(1, Number(summary.get(d)?.work_minutes ?? 0) / facts.workTargetMinutes)))),
    });
  }
  const hTotal = dates.reduce((s, d) => s + (summary.get(d)?.habits_total ?? 0), 0);
  if (hTotal > 0) {
    const hDone = dates.reduce((s, d) => s + Math.min(summary.get(d)?.habits_done ?? 0, summary.get(d)?.habits_total ?? 0), 0);
    parts.push({ key: "habits", label: "Habits", value: Math.round((100 * hDone) / hTotal) });
  }
  const tTotal = dates.reduce((s, d) => s + (summary.get(d)?.tasks_total ?? 0), 0);
  if (tTotal > 0) {
    const tDone = dates.reduce((s, d) => s + (summary.get(d)?.tasks_done ?? 0), 0);
    parts.push({ key: "tasks", label: "Tasks done", value: Math.round((100 * tDone) / tTotal) });
  }
  return { score: Math.round(avg(parts.map((p) => p.value))), parts };
}

/**
 * Momentum: the last seven finished days (today counts once it's closed), as the average of
 * Keep My Word, work hours against the target, habits and tasks done. Rising or falling means
 * five points or more against the seven days before.
 */
export function momentum(ix: HistoryIndex): Momentum | null {
  const { facts } = ix;
  const todayClosed = ix.score.get(facts.today)?.locked ?? false;
  const end = todayClosed ? facts.today : addDays(facts.today, -1);
  const window = (to: LocalDate) => dateRange(addDays(to, -6), to).filter((d) => d >= facts.firstDay && d <= facts.today);
  const now = momentumOver(ix, window(end));
  if (!now) return null;
  const before = momentumOver(ix, window(addDays(end, -7)));
  const diff = before ? now.score - before.score : null;
  return {
    score: now.score,
    parts: now.parts,
    previous: before?.score ?? null,
    trend: diff === null ? null : diff >= 5 ? "rising" : diff <= -5 ? "falling" : "stable",
    days: window(end).length,
  };
}

/* ------------------------------------------------------------------ keep my word over time */

export interface WordPeriod {
  /** Week start or "YYYY-MM". */
  key: string;
  label: string;
  average: number | null;
}

export interface WordTrend {
  weeks: WordPeriod[];
  months: WordPeriod[];
  /** This month so far: commitments made, kept, and broken (days that are over). */
  month: { made: number; kept: number; broken: number };
  week: { made: number; kept: number; broken: number };
}

export function wordTrend(ix: HistoryIndex, weeksBack = 8, monthsBack = 6): WordTrend {
  const { facts, score, summary } = ix;
  const today = facts.today;
  const average = (from: LocalDate, to: LocalDate) => {
    const list = ix.dates.filter((d) => d >= from && d <= to).map((d) => score.get(d)!.score);
    return list.length === 0 ? null : Math.round(list.reduce((a, b) => a + b, 0) / list.length);
  };
  const thisWeek = startOfWeek(today);
  const weeks: WordPeriod[] = [];
  for (let i = weeksBack - 1; i >= 0; i -= 1) {
    const w = addDays(thisWeek, -7 * i);
    weeks.push({ key: w, label: shortDate(w).slice(4), average: average(w, addDays(w, 6)) });
  }
  const months: WordPeriod[] = [];
  const [ty, tm] = today.split("-").map(Number);
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const y = ty + Math.floor((tm - 1 - i) / 12);
    const m = ((((tm - 1 - i) % 12) + 12) % 12) + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    months.push({ key, label: MONTHS[m - 1].slice(0, 3), average: average(`${key}-01`, `${key}-31`) });
  }
  const tally = (from: LocalDate) => {
    let made = 0;
    let kept = 0;
    let broken = 0;
    for (const d of ix.dates) {
      if (d < from) continue;
      const s = summary.get(d)!;
      const r = keepWord(summaryToTally(s, facts.workTargetMinutes / 60));
      made += r.made;
      kept += r.kept;
      if (d < today || score.get(d)?.locked) broken += r.made - r.kept;
    }
    return { made, kept, broken };
  };
  return { weeks, months, month: tally(`${today.slice(0, 7)}-01`), week: tally(thisWeek) };
}

/* ------------------------------------------------------------------ the year in squares */

export type DayState = "strong" | "average" | "poor" | "none" | "future" | "before";

export interface YearDay {
  date: LocalDate;
  state: DayState;
  score: number | null;
  minimum: DayScore["minimum"];
  locked: boolean;
}

/** Strong at or above the line, average from 50, poor below, none when nothing was kept. */
export function dayState(score: number, threshold: number): DayState {
  if (score >= threshold) return "strong";
  if (score >= 50) return "average";
  if (score > 0) return "poor";
  return "none";
}

export function yearDays(ix: HistoryIndex, year: number): YearDay[] {
  const { facts, score } = ix;
  return dateRange(`${year}-01-01`, `${year}-12-31`).map((date) => {
    if (date > facts.today) return { date, state: "future", score: null, minimum: null, locked: false };
    if (date < facts.firstDay) return { date, state: "before", score: null, minimum: null, locked: false };
    const s = score.get(date);
    return { date, state: dayState(s?.score ?? 0, facts.threshold), score: s?.score ?? 0, minimum: s?.minimum ?? null, locked: s?.locked ?? false };
  });
}

/* ------------------------------------------------------------------ plain facts */

export interface Stat {
  key: string;
  text: string;
}

function times(n: number) {
  return n === 1 ? "once" : `${n.toLocaleString("en-AU")} times`;
}

/** Sentences about the history, only from what's stored, only when there's something to say. */
export function progressStats(ix: HistoryIndex, proofCount = 0): Stat[] {
  const { facts, summary, dates } = ix;
  const today = facts.today;
  const out: Stat[] = [];
  const sum = (m: Map<LocalDate, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const defs = new Map(streakDefs(ix).map((d) => [d.key, d]));

  const morning = defs.get("morning");
  if (morning) {
    const n = dates.filter((d) => morning.due(d) && morning.done(d)).length;
    if (n > 0) out.push({ key: "morning", text: `You've completed your morning routine ${times(n)}.` });
  }
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthMinutes = dates.filter((d) => d >= monthStart).reduce((s, d) => s + Number(summary.get(d)?.work_minutes ?? 0), 0);
  if (monthMinutes >= 60) out.push({ key: "work_month", text: `You've logged ${Math.floor(monthMinutes / 60).toLocaleString("en-AU")} focused work hours this month.` });
  const allMinutes = dates.reduce((s, d) => s + Number(summary.get(d)?.work_minutes ?? 0), 0);
  if (allMinutes >= 60 && allMinutes - monthMinutes >= 60) {
    out.push({ key: "work_all", text: `${Math.floor(allMinutes / 60).toLocaleString("en-AU")} hours of focused work since ${shortDate(facts.firstDay).slice(4)}.` });
  }

  // The strongest work week this month: this week, if it tops the others that started this month.
  const thisWeek = startOfWeek(today);
  const weekMinutes = new Map<LocalDate, number>();
  for (const d of dates) {
    const w = startOfWeek(d);
    if (w < monthStart && w !== startOfWeek(monthStart)) continue;
    weekMinutes.set(w, (weekMinutes.get(w) ?? 0) + Number(summary.get(d)?.work_minutes ?? 0));
  }
  const mine = weekMinutes.get(thisWeek) ?? 0;
  if (weekMinutes.size >= 2 && mine > 0 && [...weekMinutes.entries()].every(([w, m]) => w === thisWeek || m < mine)) {
    out.push({ key: "strong_week", text: "This is your strongest work week this month." });
  }

  const leads = sum(ix.counter("imperium", "leads_called"));
  if (leads > 0) out.push({ key: "leads", text: `You've called ${leads.toLocaleString("en-AU")} Imperium ${leads === 1 ? "lead" : "leads"}.` });
  const calls = sum(ix.counter("websites", "cold_calls"));
  if (calls > 0) out.push({ key: "calls", text: `You've made ${calls.toLocaleString("en-AU")} website ${calls === 1 ? "call" : "calls"}.` });
  const closed = sum(ix.counter("websites", "closed"));
  if (closed > 0) out.push({ key: "closed", text: `You've closed ${closed.toLocaleString("en-AU")} website ${closed === 1 ? "deal" : "deals"}.` });
  const revenue = sum(ix.counter("*", "revenue"));
  if (revenue > 0) out.push({ key: "revenue", text: `${formatValue(revenue, "$")} in revenue logged.` });

  const rate = (key: StreakKey) => {
    const def = defs.get(key);
    if (!def) return null;
    let due = 0;
    let hit = 0;
    for (const d of dates) {
      if (!def.due(d)) continue;
      const ok = def.done(d);
      if (d === today && !ok) continue;
      due += 1;
      if (ok) hit += 1;
    }
    return due >= 3 ? { due, hit } : null;
  };
  const gym = rate("gym");
  if (gym) out.push({ key: "gym", text: `You've completed ${Math.round((100 * gym.hit) / gym.due)}% of your planned gym sessions.` });
  const bible = defs.get("bible");
  if (bible) {
    const n = dates.filter((d) => bible.done(d)).length;
    if (n > 0) out.push({ key: "bible", text: `You've read your Bible on ${n.toLocaleString("en-AU")} ${n === 1 ? "day" : "days"}.` });
  }
  const closedDays = dates.filter((d) => summary.get(d)?.completed_at).length;
  if (closedDays > 0) out.push({ key: "closed_days", text: `You've closed ${closedDays.toLocaleString("en-AU")} ${closedDays === 1 ? "day" : "days"}.` });
  const kept = dates.reduce((s, d) => s + keepWord(summaryToTally(summary.get(d)!, facts.workTargetMinutes / 60)).kept, 0);
  if (kept > 0) out.push({ key: "kept", text: `You've kept ${kept.toLocaleString("en-AU")} ${kept === 1 ? "commitment" : "commitments"}.` });
  if (proofCount > 0) out.push({ key: "proof", text: `${proofCount.toLocaleString("en-AU")} proof ${proofCount === 1 ? "photo" : "photos"} on the wall.` });
  return out;
}

/* ------------------------------------------------------------------ now and then */

export interface MemoryCard {
  key: string;
  /** "3 months ago: 18h focused work in a week." */
  then: string;
  /** "Last week: 39h." */
  now: string;
}

/**
 * Now and then: one comparison from the history, on some days only (every third day once
 * there are two weeks of it). Null on the other days, or when there's nothing to compare.
 */
export function memoryCard(ix: HistoryIndex): MemoryCard | null {
  const { facts, summary } = ix;
  const today = facts.today;
  const age = daysBetween(facts.firstDay, today);
  if (age < 14) return null;
  const dayNumber = daysBetween("2000-01-01", today);
  if (dayNumber % 3 !== 0) return null;

  const lastWeek = addDays(startOfWeek(today), -7);
  const weekSum = (w: LocalDate, value: (d: LocalDate) => number) =>
    dateRange(w, addDays(w, 6)).filter((d) => d >= facts.firstDay && d <= today).reduce((s, d) => s + value(d), 0);
  const back = [12, 8, 4].map((n) => ({ n, week: addDays(lastWeek, -7 * n) })).find((b) => b.week >= facts.firstDay);
  const ago = back ? (back.n === 12 ? "3 months ago" : back.n === 8 ? "2 months ago" : "A month ago") : null;

  const cards: MemoryCard[] = [];
  const work = (d: LocalDate) => Number(summary.get(d)?.work_minutes ?? 0);
  if (back && ago) {
    const then = weekSum(back.week, work);
    const now = weekSum(lastWeek, work);
    if (then > 0 || now > 0) cards.push({ key: "work", then: `${ago}: ${formatDuration(then)} of focused work in a week.`, now: `Last week: ${formatDuration(now)}.` });
    const word = (w: LocalDate) => {
      const list = dateRange(w, addDays(w, 6)).filter((d) => d >= facts.firstDay && d <= today).map((d) => ix.score.get(d)?.score ?? 0);
      return list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null;
    };
    const wThen = word(back.week);
    const wNow = word(lastWeek);
    if (wThen !== null && wNow !== null) cards.push({ key: "word", then: `${ago}, you kept ${wThen}% of your word.`, now: `Last week: ${wNow}%.` });
    const leads = ix.counter("imperium", "leads_called");
    const lThen = weekSum(back.week, (d) => leads.get(d) ?? 0);
    const lNow = weekSum(lastWeek, (d) => leads.get(d) ?? 0);
    if (lThen > 0 || lNow > 0) cards.push({ key: "leads", then: `${ago}: ${lThen} Imperium leads in a week.`, now: `Last week: ${lNow}.` });
  }
  const rows = streaks(ix);
  const bible = rows.find((s) => s.key === "bible");
  if (bible && bible.best >= 5) cards.push({ key: "bible", then: `Your longest Bible streak is ${show(bible.best, "days")}.`, now: `Now: ${show(bible.current, "days")}.` });
  const morning = rows.find((s) => s.key === "morning");
  if (morning && morning.best >= 5) cards.push({ key: "morning", then: `Your longest morning routine streak is ${show(morning.best, "days")}.`, now: `Now: ${show(morning.current, "days")}.` });
  if (cards.length === 0) return null;
  return cards[Math.floor(dayNumber / 3) % cards.length];
}
