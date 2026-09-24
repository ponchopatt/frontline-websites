import { formatValue } from "./format";
import type { AnyGoal } from "./model";
import type { GoalProgress } from "./progress";

/** The weekly review's vocabulary, shared by the form and the saved summary. */

export type Outcome = "completed" | "partial" | "missed";
export type Reason = "underestimated_time" | "too_ambitious" | "procrastination" | "unexpected_event" | "no_longer_matters" | "poor_planning" | "other";
export type Decision = "carry_forward" | "modify" | "replace" | "cancel";

export const REASONS: Array<{ value: Reason; label: string }> = [
  { value: "underestimated_time", label: "Underestimated the time" },
  { value: "too_ambitious", label: "Goal was too ambitious" },
  { value: "procrastination", label: "Procrastination" },
  { value: "unexpected_event", label: "Something unexpected came up" },
  { value: "no_longer_matters", label: "It no longer matters" },
  { value: "poor_planning", label: "Poor planning" },
  { value: "other", label: "Other" },
];

export const DECISIONS: Array<{ value: Decision; label: string; hint: string }> = [
  { value: "carry_forward", label: "Carry forward", hint: "What's left moves to next week." },
  { value: "modify", label: "Modify", hint: "It moves to next week for you to adjust." },
  { value: "replace", label: "Replace", hint: "Close it; plan something better next week." },
  { value: "cancel", label: "Cancel", hint: "Close it. The history stays." },
];

/**
 * The outcome a goal's review starts on. A share of days (Keep My Word) can still fall on the
 * days left, so it's only done once the week is over, however it stands on an early review.
 */
export function suggestedOutcome(goal: Pick<AnyGoal, "state" | "progressSource">, progress: GoalProgress | undefined): Outcome {
  if (goal.state === "completed") return "completed";
  const ratio = progress?.ratio ?? 0;
  const done = goal.progressSource === "keep_word" ? progress?.health === "complete" : ratio >= 1;
  return done ? "completed" : ratio > 0 ? "partial" : "missed";
}

/**
 * A carried goal's name with what's left: "$2,000 revenue" with $1,500 left becomes "$1,500
 * revenue", and "Call 60 qualified leads this week" with 50 left says 50. The target is looked
 * for with its unit, then as a bare number, and only swapped when it appears once and not inside
 * a bigger number (not the 60 in "160" or "60.5"). Any other name stays as written.
 */
export function carriedTitle(title: string, target: number | null, left: number | null, unit: string | null): string {
  if (target === null || left === null || left === Number(target)) return title;
  const forms: Array<[string, string]> = [
    [formatValue(Number(target), unit), formatValue(left, unit)],
    [formatValue(Number(target), null), formatValue(left, null)],
  ];
  for (const [was, now] of forms) {
    const re = new RegExp(`(^|[^\\d.,])${was.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d|[.,]\\d)`, "g");
    const found = title.match(re)?.length ?? 0;
    if (found === 1) return title.replace(re, (_, before: string) => before + now);
    if (found > 1) return title;
  }
  return title;
}

