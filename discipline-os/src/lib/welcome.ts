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
  /** The goal's name for a target. */
  title: (target: number | null) => string;
  on: boolean;
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  { key: "imperium", area: "imperium", label: "Imperium", target: 250000, unit: "$", title: (t) => `Make ${formatValue(t, "$")} in Imperium revenue`, on: true },
  { key: "websites", area: "websites", label: "Websites", target: 24, unit: "websites", title: (t) => `Sell ${formatValue(t, null)} websites`, on: true },
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

/** The suggested target for a year: all of it for a year ahead, the weeks left for this one. */
export function suggestedTarget(t: GoalTemplate, year: number, today: string): number | null {
  if (t.target === null) return null;
  if (t.unit === "%") return t.target;
  const thisYear = Number(today.slice(0, 4));
  if (year !== thisYear) return t.target;
  const end = Date.UTC(year, 11, 31);
  const [y, m, d] = today.split("-").map(Number);
  const weeksLeft = Math.max(1, (end - Date.UTC(y, m - 1, d)) / (7 * 86_400_000));
  return Math.max(1, roundGoal((t.target * Math.min(52, weeksLeft)) / 52));
}
