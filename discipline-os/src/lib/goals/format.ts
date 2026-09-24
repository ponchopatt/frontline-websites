import type { GoalCore } from "./model";

function round(n: number): number {
  return Math.abs(n) >= 10_000 ? Math.round(n) : Math.round(n * 10) / 10;
}

/** "$300,000", "165 kg", "12 hours", "85%", "4" */
export function formatValue(value: number | null, unit: string | null): string {
  if (value === null || !Number.isFinite(value)) return "–";
  const u = unit?.trim() ?? "";
  if (u === "$") {
    const n = Math.round(value);
    return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-AU")}`;
  }
  const n = round(value).toLocaleString("en-AU");
  if (u === "%") return `${n}%`;
  // "1 call", not "1 calls"
  const word = value === 1 && /[a-z]s$/i.test(u) && u.length > 2 ? u.slice(0, -1) : u;
  return word ? `${n} ${word}` : n;
}

/** Short form for tight spaces: "$300k", "$1.2m". */
export function formatCompact(value: number | null, unit: string | null): string {
  if (value === null || !Number.isFinite(value)) return "–";
  if (unit?.trim() === "$") {
    const a = Math.abs(value);
    if (a >= 1_000_000) return `$${round(value / 1_000_000)}m`;
    if (a >= 10_000) return `$${Math.round(value / 1000)}k`;
    if (a >= 1000) return `$${round(value / 1000)}k`;
  }
  return formatValue(value, unit);
}

const CADENCE_SUFFIX = { total: "", per_week: " a week", per_month: " a month" } as const;

/** "$300,000", "40 hours a week", "Done or not done". */
export function formatTarget(goal: Pick<GoalCore, "goalType" | "targetValue" | "unit" | "cadence">): string {
  if (goal.goalType === "binary") return "Done or not done";
  if (goal.goalType === "milestone") return "All milestones done";
  if (goal.targetValue === null) return "No target set";
  return `${formatValue(goal.targetValue, goal.unit)}${CADENCE_SUFFIX[goal.cadence]}`;
}

export function percent(ratio: number | null): string {
  return ratio === null ? "–" : `${Math.round(ratio * 100)}%`;
}
