import { formatValue } from "./goals/format";

/**
 * First-run setup: the goals it offers for the year, and their suggested numbers. A year
 * already under way gets its share of the full-year number.
 */

export const WELCOME_GOALS = ["imperium", "websites", "trading", "faith", "fitness", "discipline", "money"] as const;
export type WelcomeGoalKey = (typeof WELCOME_GOALS)[number];

export interface GoalTemplate {
  key: WelcomeGoalKey;
  area: string;
  label: string;
  /** For the whole year; null for a finish-line goal. */
  target: number | null;
  unit: string | null;
  /** The counter in its area that measures it. A counter totals the whole year, from 1 January. */
  counter?: string;
  /** The goal's name for a target. */
  title: (target: number | null) => string;
  on: boolean;
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  { key: "imperium", area: "imperium", label: "Imperium", target: 250000, unit: "$", counter: "revenue", title: (t) => `Make ${formatValue(t, "$")} in Imperium revenue`, on: true },
  { key: "websites", area: "websites", label: "Websites", target: 24, unit: "websites", counter: "closed", title: (t) => `Sell ${formatValue(t, null)} websites`, on: true },
  { key: "trading", area: "trading", label: "AI Trading", target: null, unit: null, title: () => "Finish the AI trading bot and run it live", on: true },
  { key: "faith", area: "faith", label: "Faith", target: 300, unit: "days", title: (t) => `Read my Bible on ${formatValue(t, null)} days`, on: true },
  { key: "fitness", area: "fitness", label: "Fitness", target: 250, unit: "sessions", title: (t) => `Train ${formatValue(t, null)} sessions at the gym`, on: true },
  { key: "discipline", area: "discipline", label: "Discipline", target: 85, unit: "%", title: (t) => `Keep my word on ${formatValue(t, null)}% of days`, on: true },
  { key: "money", area: "money", label: "Money", target: 20000, unit: "$", title: (t) => `Save ${formatValue(t, "$")}`, on: false },
];

/** Two significant figures, so a scaled number still reads like a goal: 67,308 → 67,000. */
export function roundGoal(n: number): number {
  if (n <= 0) return 0;
  if (n < 10) return Math.round(n);
  const mag = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}

/**
 * The suggested target for a year: all of it for a year ahead, the weeks left for this one.
 * `soFar` is what the goal's counter already holds this year. The counter counts from 1
 * January, so once it has entries the full-year number is the fair one.
 */
export function suggestedTarget(t: GoalTemplate, year: number, today: string, soFar = 0): number | null {
  if (t.target === null) return null;
  if (t.unit === "%") return t.target;
  const thisYear = Number(today.slice(0, 4));
  if (year !== thisYear || soFar > 0) return t.target;
  const end = Date.UTC(year, 11, 31);
  const [y, m, d] = today.split("-").map(Number);
  const weeksLeft = Math.max(1, (end - Date.UTC(y, m - 1, d)) / (7 * 86_400_000));
  return Math.max(1, roundGoal((t.target * Math.min(52, weeksLeft)) / 52));
}

interface NamedGoal {
  title: string;
  life_area_id: string | null;
}

/**
 * The goals setup still has to add for a year. One whose area already has a goal, or whose
 * name is taken, is left out, so a retry, a double tap or Redo setup never doubles up.
 */
export function goalsToAdd<T extends NamedGoal>(goals: T[], existing: NamedGoal[]): T[] {
  const areas = new Set(existing.map((g) => g.life_area_id).filter(Boolean));
  const titles = new Set(existing.map((g) => g.title.trim().toLowerCase()));
  return goals.filter((g) => {
    const title = g.title.trim().toLowerCase();
    if ((g.life_area_id && areas.has(g.life_area_id)) || titles.has(title)) return false;
    if (g.life_area_id) areas.add(g.life_area_id);
    titles.add(title);
    return true;
  });
}
