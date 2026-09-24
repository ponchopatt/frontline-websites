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

