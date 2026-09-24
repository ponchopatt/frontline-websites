import type { BoardCounter } from "./types";
import { formatDuration } from "@/lib/day";
import { formatValue } from "@/lib/goals/format";

/** "12", or "$4,500" for money. The label beside it already says what's counted. */
export function amount(value: number, unit: string | null): string {
  return formatValue(value, unit === "$" ? "$" : null);
}

/** "0h", "45m", "5h 24m". */
export function hours(minutes: number): string {
  return minutes < 1 ? "0h" : formatDuration(minutes);
}

/**
 * This week's target: a weekly goal's, else the counter's own, cut to the part of the week the
 * counter existed for (so a new account isn't asked for a whole week in two days).
 */
export function thisWeekTarget(c: Pick<BoardCounter, "goalTarget" | "ownTarget" | "weekShare" | "unit">): number | null {
  if (c.goalTarget !== null) return c.goalTarget;
  if (c.ownTarget === null) return null;
  const share = c.ownTarget * c.weekShare;
  return c.unit === "$" ? Math.round(share / 10) * 10 : Math.ceil(share);
}
