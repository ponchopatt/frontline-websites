import { formatValue } from "./format";
import type { Cadence, GoalType, ProgressSource } from "./model";
import { isNumeric } from "./model";

/**
 * A goal check that flags, and never blocks. Ambition is allowed; vagueness and forgettable
 * goals are pointed out, with a concrete fix where there is one.
 */

export interface QualityInput {
  title: string;
  goalType: GoalType;
  unit: string | null;
  metric: string | null;
  startValue: number | null;
  targetValue: number | null;
  cadence: Cadence;
  deadline: string | null;
  year: number;
  why: string | null;
  success: string | null;
  areaName: string | null;
  /** Months between now and the deadline. */
  monthsLeft: number;
}

export type QualityKey = "specific" | "measurable" | "time_bound" | "realistic" | "control" | "reason";

export interface QualityFlag {
  key: QualityKey;
  ok: boolean;
  label: string;
  message: string;
}

export interface ProcessSuggestion {
  title: string;
  goalType: "process" | "habit";
  unit: string;
  metric: string;
  targetValue: number;
  cadence: Cadence;
  progressSource: ProgressSource;
}

const VAGUE = [
  /^(read|exercise|work|train|pray|save|study|run|write|sleep|eat)( \w+)? (more|less|better)\b/i,
  /\b(get|be|become|feel|stay) (better|fit|fitter|healthier|productive|consistent|disciplined|richer|happier|organised|organized)\b/i,
  /^(improve|grow|work on|focus on|try to)\b/i,
  /\b(more|less) (often|productive|consistent)\b/i,
];

function hasNumber(s: string): boolean {
  return /\d/.test(s);
}

export function isVague(title: string): boolean {
  const t = title.trim();
  if (t.split(/\s+/).length < 3 && !hasNumber(t)) return true;
  return VAGUE.some((re) => re.test(t)) && !hasNumber(t);
}

/** A process goal that drives an outcome, suited to the area of life. */
export function processFor(input: Pick<QualityInput, "areaName" | "unit" | "startValue" | "targetValue" | "monthsLeft" | "title">): ProcessSuggestion {
  const area = (input.areaName ?? "").toLowerCase();
  if (area === "money" && input.unit?.trim() === "$" && input.targetValue !== null) {
    const perMonth = Math.ceil((input.targetValue - (input.startValue ?? 0)) / Math.max(1, input.monthsLeft) / 50) * 50;
    return { title: `Save ${formatValue(perMonth, "$")} every month`, goalType: "process", unit: "$", metric: "Saved", targetValue: perMonth, cadence: "per_month", progressSource: "manual" };
  }
  if (area === "business" || area === "career" || area === "money") {
    return { title: "Complete 10 focused business-development hours a week", goalType: "process", unit: "hours", metric: "Focused hours", targetValue: 10, cadence: "per_week", progressSource: "work_hours" };
  }
  if (area === "fitness" || area === "health") {
    return { title: "Train 4 times a week", goalType: "habit", unit: "sessions", metric: "Training sessions", targetValue: 4, cadence: "per_week", progressSource: "manual" };
  }
  if (area === "faith") {
    return { title: "Bible study 6 days a week", goalType: "habit", unit: "days", metric: "Study days", targetValue: 6, cadence: "per_week", progressSource: "manual" };
  }
  if (area === "learning") {
    return { title: "Study 5 hours a week", goalType: "process", unit: "hours", metric: "Study hours", targetValue: 5, cadence: "per_week", progressSource: "manual" };
  }
  if (area === "relationships" || area === "family") {
    return { title: "3 evenings a week without phones", goalType: "habit", unit: "evenings", metric: "Evenings", targetValue: 3, cadence: "per_week", progressSource: "manual" };
  }
  return { title: `Work on ${input.title.toLowerCase()} 5 hours a week`, goalType: "process", unit: "hours", metric: "Hours", targetValue: 5, cadence: "per_week", progressSource: "manual" };
}

export function checkGoal(input: QualityInput): { flags: QualityFlag[]; process: ProcessSuggestion | null } {
  const flags: QualityFlag[] = [];
  const numeric = isNumeric(input.goalType);

  // Specific
  const vague = isVague(input.title);
  flags.push({
    key: "specific",
    ok: !vague,
    label: "Specific",
    message: vague
      ? "Say exactly what you'll have or do. \"Get fit\" becomes \"Bench 180 kg\" or \"Train 4 times a week\"."
      : "Clear about what it is.",
  });

  // Measurable
  let measurable = true;
  let measureMsg = "You'll know when it's done.";
  if (numeric && (input.targetValue === null || !input.unit?.trim())) {
    measurable = false;
    measureMsg = "Add a target number and a unit, so progress can be tracked.";
  } else if (input.goalType === "binary" && !input.success?.trim()) {
    measurable = false;
    measureMsg = "Describe what done looks like, so there's no doubt when you get there.";
  }
  flags.push({ key: "measurable", ok: measurable, label: "Measurable", message: measureMsg });

  // Time-bound
  flags.push({
    key: "time_bound",
    ok: true,
    label: "Time-bound",
    message: input.deadline ? `Due ${input.deadline}.` : `Due by the end of ${input.year}.`,
  });

  // Realistic, given where you start. Flags, never rejects.
  let realistic = true;
  let realMsg = "The pace looks achievable from where you're starting.";
  if (numeric && input.targetValue !== null) {
    const start = input.startValue ?? 0;
    const months = Math.max(1, input.monthsLeft);
    if (input.cadence === "per_week" && (input.unit ?? "").toLowerCase().startsWith("hour") && input.targetValue > 60) {
      realistic = false;
      realMsg = `${input.targetValue} hours a week leaves little room for anything else. Keep it if you mean it.`;
    } else if (input.goalType === "performance" && start > 0 && (input.targetValue - start) / start > 0.5 * (months / 12)) {
      realistic = false;
      realMsg = `That's a ${Math.round(((input.targetValue - start) / start) * 100)}% jump in ${months} months. Ambitious is fine; the monthly steps will show the pace.`;
    } else if (input.goalType === "outcome" && start > 0 && input.targetValue / start > 4) {
      realistic = false;
      realMsg = `That's ${Math.round(input.targetValue / start)}× where you are now. Keep it if you mean it, and plan the steps.`;
    } else if (start === 0 && input.goalType === "outcome") {
      realMsg = "Starting from zero. The monthly plan will show the pace it needs.";
    }
  }
  flags.push({ key: "realistic", ok: realistic, label: "Realistic", message: realMsg });

  // Within your control
  const outcome = input.goalType === "outcome";
  flags.push({
    key: "control",
    ok: !outcome,
    label: "In your control",
    message: outcome
      ? "This is an outcome goal. You can't directly control the outcome, only the work that drives it."
      : "It depends on what you do.",
  });

  // Connected to a reason
  const hasWhy = Boolean(input.why?.trim());
  flags.push({
    key: "reason",
    ok: hasWhy,
    label: "Has a reason",
    message: hasWhy ? "You've said why it matters." : "Say why it matters. A goal with a reason is harder to drop.",
  });

  return { flags, process: outcome ? processFor(input) : null };
}
