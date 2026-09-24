import { formatDuration } from "./day";
import { formatValue } from "./goals/format";

/**
 * "One more": a short nudge when something is nearly done, and only then. Nothing when it's
 * far off (that's just the number), and nothing once it's done (that gets a tick, not a push
 * to do more).
 */

const WORDS: Record<string, [string, string]> = {
  leads: ["lead", "leads"],
  calls: ["call", "calls"],
  demos: ["demo", "demos"],
  reels: ["reel", "reels"],
  deals: ["deal", "deals"],
  jobs: ["job", "jobs"],
  "follow-ups": ["follow-up", "follow-ups"],
  quotes: ["quote", "quotes"],
  bookings: ["booking", "bookings"],
  posts: ["post", "posts"],
  stories: ["story", "stories"],
  ideas: ["idea", "ideas"],
  websites: ["website", "websites"],
};

const SMALL = ["", "One", "Two", "Three"];

function noun(unit: string | null, n: number): string | null {
  const w = unit ? WORDS[unit] : undefined;
  return w ? (n === 1 ? w[0] : w[1]) : null;
}

/** How close counts as "nearly": within 3, or the last 15% of a bigger target. */
export function isNear(done: number, target: number): boolean {
  if (!(target > 0) || done >= target || done <= 0) return false;
  const left = target - done;
  return left <= Math.max(3, Math.ceil(target * 0.15)) && left < target;
}

/** "One more call." · "3 more calls." · "$150 to go." — or null when it isn't nearly there. */
export function counterNudge(done: number, target: number | null, unit: string | null): string | null {
  if (target === null || !isNear(done, target)) return null;
  const left = target - done;
  if (unit === "$") return `${formatValue(left, "$")} to go.`;
  const n = Math.ceil(left);
  const lead = n <= 3 ? SMALL[n] : String(n);
  const w = noun(unit, n);
  return w ? `${lead} more ${w}.` : `${lead} more.`;
}

/** "3 more calls to hit today's target." — the plain remaining line, for a counter with a target. */
export function remainingLine(done: number, target: number | null, unit: string | null): string | null {
  if (target === null || !(target > 0) || done >= target) return null;
  const left = target - done;
  if (unit === "$") return `${formatValue(left, "$")} to today's target.`;
  const n = Math.ceil(left);
  const w = noun(unit, n);
  return w ? `${n} more ${w} to today's target.` : `${n} more to today's target.`;
}

/** Work: within 45 minutes (or the last 10%) of the day's target. */
export function workNudge(minutes: number, targetMinutes: number): string | null {
  if (!(targetMinutes > 0) || minutes >= targetMinutes || minutes <= 0) return null;
  const left = Math.ceil(targetMinutes - minutes);
  if (left > Math.max(45, targetMinutes * 0.1)) return null;
  if (left === 1) return "One minute left. Finish it.";
  return left < 60 ? `${left} minutes left. Finish it.` : `${formatDuration(left)} left. Finish it.`;
}

/** Cardio or any minutes target: within 5 minutes. */
export function minutesNudge(minutes: number, target: number | null): string | null {
  if (target === null || !(target > 0) || minutes >= target || minutes <= 0) return null;
  const left = Math.ceil(target - minutes);
  if (left > 5) return null;
  return left === 1 ? "One minute left." : `${left} minutes left.`;
}

/** Things out of a list: "One commitment left." once it's down to the last one or two. */
export function itemsNudge(done: number, total: number, word: [string, string]): string | null {
  if (total < 2 || done >= total || done === 0) return null;
  const left = total - done;
  if (left > 2) return null;
  return left === 1 ? `One ${word[0]} left.` : `Two ${word[1]} left.`;
}
