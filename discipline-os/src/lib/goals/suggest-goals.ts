import type { Area } from "../areas";
import { formatValue } from "./format";

/**
 * "Suggest my goals": concrete goals for this week, from what was actually done over the last
 * few weeks. Each one names a number and says why that number. Nothing is created until the
 * user approves it. (With an API key the suggestions can be refined by Claude; see
 * suggest-ai.ts. These rules are the dependable floor.)
 */

export type HabitKind = "bible" | "prayer" | "gym" | "cardio";

export interface CounterHistory {
  metricId: string;
  area: Area;
  key: string;
  label: string;
  unit: string | null;
  /** Average per week over the weeks with data, or null with no history. */
  weeklyAvg: number | null;
  /** The counter's own weekly target. */
  weeklyTarget: number | null;
}

export interface HabitHistory {
  kind: HabitKind;
  habitId: string;
  /** Average days a week it was done, or null with no history. */
  daysPerWeek: number | null;
  /** Days a week it's due (5 for Gym on weekdays). */
  dueDays: number;
}

export interface SuggestContext {
  /** Whole weeks of history looked at (0–4). */
  weeks: number;
  counters: CounterHistory[];
  habits: HabitHistory[];
  workDays: number;
  milestone: { title: string; nextStep: string | null } | null;
  /** Keys already covered by a goal this week, e.g. "metric:<id>", "habit:<id>". */
  taken: Set<string>;
}

export interface Answers {
  /** What they want to achieve, by area, in their own words. */
  aims: Partial<Record<Area, string>>;
  /** Hours free for work a week, if they said. */
  hoursPerWeek: number | null;
  /** Things already booked in this week. */
  commitments: string;
}

export interface GoalSuggestion {
  key: string;
  area: Area;
  title: string;
  /** A number to hit this week, or null for a yes/no goal. */
  target: number | null;
  unit: string | null;
  /** Measured by a counter or a habit's ticks; neither means it's ticked off by hand. */
  metricId: string | null;
  habitId: string | null;
  /** One of this week's 1–3 major outcomes. */
  major: boolean;
  reason: string;
}

/** Rounds up to a tidy step: 5s for calls, $100s for revenue, whole numbers otherwise. */
function tidy(n: number, unit: string | null): number {
  if (unit === "$") return Math.max(100, Math.ceil(n / 100) * 100);
  if (n >= 30) return Math.ceil(n / 5) * 5;
  return Math.max(1, Math.ceil(n));
}

/**
 * The week's number: a real step up from what's been done (about 15%), pulled towards the
 * counter's own target but never more than 30% past the average in one go.
 */
export function stretchTarget(avg: number | null, target: number | null, unit: string | null): number | null {
  if (avg === null || avg <= 0) return target;
  const step = avg * 1.15;
  const cap = avg * 1.3;
  const want = target !== null && target > avg ? Math.min(target, cap) : step;
  return tidy(Math.max(want, step), unit);
}

function perDay(total: number, workDays: number, unit: string | null): string {
  const n = total / Math.max(1, workDays);
  return unit === "$" ? formatValue(Math.round(n / 10) * 10, "$") : String(Math.ceil(n));
}

const COUNTER_TITLES: Record<string, (n: number) => string> = {
  "imperium.leads_called": (n) => `Call ${n} qualified leads this week`,
  "imperium.follow_ups": (n) => `Do ${n} follow-ups this week`,
  "imperium.reels_posted": (n) => `Post ${n} ${n === 1 ? "reel" : "reels"} this week`,
  "imperium.revenue": (n) => `Bring in ${formatValue(n, "$")} Imperium revenue this week`,
  "websites.demos_built": (n) => `Build ${n} website ${n === 1 ? "demo" : "demos"} this week`,
  "websites.cold_calls": (n) => `Make ${n} cold calls this week`,
  "websites.closed": (n) => `Close ${n} website ${n === 1 ? "deal" : "deals"} this week`,
};
const MAJOR = new Set(["imperium.leads_called", "websites.cold_calls"]);

export function suggestGoals(ctx: SuggestContext, answers: Answers): GoalSuggestion[] {
  const out: GoalSuggestion[] = [];

  for (const c of ctx.counters) {
    const id = `${c.area}.${c.key}`;
    const title = COUNTER_TITLES[id];
    if (!title || ctx.taken.has(`metric:${c.metricId}`)) continue;
    let target = stretchTarget(c.weeklyAvg, c.weeklyTarget, c.unit);
    // Deals start at one; with no history and no target there's nothing honest to suggest.
    if (target === null && c.key === "closed") target = 1;
    if (target === null || target <= 0) continue;
    const avg = c.weeklyAvg;
    const reason =
      avg !== null && avg > 0
        ? `You averaged ${formatValue(Math.round(avg), c.unit === "$" ? "$" : null)} a week over the last ${ctx.weeks} ${ctx.weeks === 1 ? "week" : "weeks"}. ${formatValue(target, c.unit === "$" ? "$" : null)} is a ${Math.round(((target - avg) / avg) * 100)}% step up: about ${perDay(target, ctx.workDays, c.unit)} a work day.`
        : `No history yet, so this starts from your weekly target: about ${perDay(target, ctx.workDays, c.unit)} a work day. Adjust it after a week.`;
    out.push({
      key: `m-${c.metricId}`,
      area: c.area,
      title: title(target),
      target,
      unit: c.unit,
      metricId: c.metricId,
      habitId: null,
      major: MAJOR.has(id),
      reason,
    });
  }

  const habitGoal = (kind: HabitKind, area: Area, make: (n: number) => string, full: number) => {
    const h = ctx.habits.find((x) => x.kind === kind);
    if (!h || ctx.taken.has(`habit:${h.habitId}`)) return;
    const due = Math.min(full, h.dueDays);
    const avg = h.daysPerWeek;
    const target = avg === null ? due : Math.min(due, Math.max(1, Math.ceil(avg + (avg < due ? 1 : 0))));
    const reason =
      avg === null
        ? `No history yet. ${target} of ${due} due days is the plan as it stands.`
        : avg >= due
          ? `You've been doing ${Math.round(avg * 10) / 10} a week. Keep it at ${target}.`
          : `You've averaged ${Math.round(avg * 10) / 10} a week. One more than that is ${target}: a step you can actually take.`;
    out.push({ key: `h-${h.habitId}`, area, title: make(target), target, unit: "days", metricId: null, habitId: h.habitId, major: false, reason });
  };
  habitGoal("gym", "fitness", (n) => `Complete ${n} gym ${n === 1 ? "session" : "sessions"} this week`, 7);
  habitGoal("cardio", "fitness", (n) => `Do cardio on ${n} ${n === 1 ? "day" : "days"} this week`, 7);
  habitGoal("bible", "faith", (n) => `Read the Bible on ${n} of 7 days this week`, 7);
  habitGoal("prayer", "faith", (n) => (n >= 7 ? "Pray every morning this week" : `Pray on ${n} of 7 mornings this week`), 7);

  if (ctx.milestone?.nextStep) {
    out.push({
      key: "bot-step",
      area: "trading",
      title: `${ctx.milestone.nextStep}: ${ctx.milestone.title}`,
      target: null,
      unit: null,
      metricId: null,
      habitId: null,
      major: true,
      reason: "It's the next unticked step on the bot's current milestone. Finish it this week and the milestone moves.",
    });
  }

  const money = answers.aims.money?.match(/\$?\s?(\d[\d,]*)/);
  if (money) {
    const n = Number(money[1].replace(/,/g, ""));
    if (n > 0) {
      const week = Math.round(n / 4.3 / 10) * 10;
      out.push({
        key: "money",
        area: "money",
        title: `Put aside ${formatValue(week, "$")} this week`,
        target: week,
        unit: "$",
        metricId: null,
        habitId: null,
        major: false,
        reason: `You want ${formatValue(n, "$")}. A month has about 4.3 weeks, so that's ${formatValue(week, "$")} a week.`,
      });
    }
  }

  // Less time than usual: trim the work numbers to fit, and say so.
  if (answers.hoursPerWeek !== null && answers.hoursPerWeek > 0) {
    const usual = ctx.workDays * 8;
    if (answers.hoursPerWeek < usual * 0.8) {
      const scale = answers.hoursPerWeek / usual;
      for (const s of out) {
        if (!s.metricId || s.target === null || (s.area !== "imperium" && s.area !== "websites")) continue;
        const next = tidy(s.target * scale, s.unit);
        if (next < s.target) {
          const counter = ctx.counters.find((c) => c.metricId === s.metricId)!;
          s.title = COUNTER_TITLES[`${counter.area}.${counter.key}`](next);
          s.target = next;
          s.reason += ` Cut to fit the ${answers.hoursPerWeek} hours you have this week.`;
        }
      }
    }
  }

  return out;
}
