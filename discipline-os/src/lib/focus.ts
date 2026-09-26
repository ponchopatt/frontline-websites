import { AREA_SHORT, type WorkArea } from "./areas";
import { addDays, formatDuration, isoWeekday, type LocalDate } from "./day";

/*
  Focus weeks. Three businesses can't all get deep work at once, so a week (or a run of days
  inside one) goes to one of them: it gets the long blocks, and the other two get a short
  keep-alive each day (answer the leads, check the bot runs) so nothing dies while it waits.
*/

export const FOCUS_AREAS = ["imperium", "websites", "trading"] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

/** Minutes a day a business gets while another has the focus. 0 leaves it alone. */
export type KeepAlive = Record<FocusArea, number>;

export const DEFAULT_KEEP_ALIVE: KeepAlive = { imperium: 20, websites: 20, trading: 15 };

/** The least deep work a focus day asks for, whatever the day's work target. */
const MIN_DEEP_MINUTES = 60;

export function isFocusArea(value: unknown): value is FocusArea {
  return typeof value === "string" && (FOCUS_AREAS as readonly string[]).includes(value);
}

export function keepAliveOf(raw: unknown): KeepAlive {
  const out = { ...DEFAULT_KEEP_ALIVE };
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v);
      if (isFocusArea(k) && Number.isFinite(n) && n >= 0) out[k] = Math.min(240, Math.round(n));
    }
  }
  return out;
}

export interface DayFocus {
  area: FocusArea;
  /** Minutes of deep work the focus asks for today. */
  deepMinutes: number;
  /** Minutes a day each other business keeps getting (0 left out). */
  keepAlive: Partial<Record<FocusArea, number>>;
}

/**
 * A focus day: the focus gets the day's work time less the keep-alives (at least an hour), the
 * others their keep-alive minutes.
 */
export function dayFocus(area: FocusArea, keepAlive: KeepAlive, workTargetHours: number): DayFocus {
  const others: Partial<Record<FocusArea, number>> = {};
  for (const a of FOCUS_AREAS) if (a !== area && keepAlive[a] > 0) others[a] = keepAlive[a];
  const kept = Object.values(others).reduce((s, m) => s + (m ?? 0), 0);
  const deep = Math.max(MIN_DEEP_MINUTES, Math.round(workTargetHours * 60) - kept);
  return { area, deepMinutes: deep, keepAlive: others };
}

/**
 * The day's hours per business, for Up next, Plan my day and the scoreboard. With a focus the
 * focus comes first (its deep hours), then each keep-alive; without one, the owner's own targets.
 */
export function hourTargetsFor(focus: DayFocus | null, own: Partial<Record<WorkArea, number>>): Partial<Record<WorkArea, number>> {
  if (!focus) return own;
  const out: Partial<Record<WorkArea, number>> = { [focus.area]: focus.deepMinutes / 60 };
  for (const [a, m] of Object.entries(focus.keepAlive) as Array<[FocusArea, number]>) out[a] = m / 60;
  return out;
}

export interface FocusDay {
  date: LocalDate;
  area: FocusArea | null;
}

const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The week in a line: "Imperium all week", "Imperium Mon–Wed, Websites Thu–Sat", or null when
 * nothing is chosen. Days without a focus are left out.
 */
export function weekLine(days: FocusDay[]): string | null {
  const set = days.filter((d) => d.area);
  if (set.length === 0) return null;
  if (set.length === 7 && set.every((d) => d.area === set[0].area)) return `${AREA_SHORT[set[0].area!]} all week`;
  const runs: Array<{ area: FocusArea; from: LocalDate; to: LocalDate }> = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (d.area && last && last.area === d.area && addDays(last.to, 1) === d.date) last.to = d.date;
    else if (d.area) runs.push({ area: d.area, from: d.date, to: d.date });
  }
  return runs
    .map((r) => `${AREA_SHORT[r.area]} ${r.from === r.to ? DAY_SHORT[isoWeekday(r.from)] : `${DAY_SHORT[isoWeekday(r.from)]}–${DAY_SHORT[isoWeekday(r.to)]}`}`)
    .join(", ");
}

/** "Day 2 of 3" within the run of focus days today belongs to. */
export function runPosition(days: FocusDay[], date: LocalDate): { day: number; of: number } | null {
  const i = days.findIndex((d) => d.date === date);
  if (i === -1 || !days[i].area) return null;
  const area = days[i].area;
  let start = i;
  while (start > 0 && days[start - 1].area === area) start -= 1;
  let end = i;
  while (end < days.length - 1 && days[end + 1].area === area) end += 1;
  return { day: i - start + 1, of: end - start + 1 };
}

export interface FocusSuggestion {
  area: FocusArea;
  why: string;
}

/**
 * Which business to focus on next: the one that has had the least of your time lately, leaving
 * out last week's focus (it just had its turn) unless it's the only choice.
 */
export function suggestFocus(minutes: Partial<Record<FocusArea, number>>, lastFocus: FocusArea | null, days = 14): FocusSuggestion {
  const pool = FOCUS_AREAS.filter((a) => a !== lastFocus);
  const pick = [...pool].sort((a, b) => (minutes[a] ?? 0) - (minutes[b] ?? 0))[0];
  const m = minutes[pick] ?? 0;
  const had = m < 1 ? "no time" : formatDuration(m);
  const turn = lastFocus ? ` ${AREA_SHORT[lastFocus]} just had its week.` : "";
  return { area: pick, why: `${AREA_SHORT[pick]} has had ${had} in the last ${days} days: the least of the three.${turn}` };
}
