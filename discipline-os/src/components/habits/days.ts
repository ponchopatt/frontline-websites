/** ISO weekdays, Monday first, as the day chips show them. */
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * The days something is due, in a few words: "Every day", "Mon–Fri", "Weekends",
 * "Mon, Wed, Fri". Null or all seven is every day.
 */
export function daysLabel(days: number[] | null): string {
  const list = [...new Set(days ?? [])].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (days === null || list.length === 7) return "Every day";
  if (list.length === 0) return "No days";
  if (list.length === 2 && list[0] === 6 && list[1] === 7) return "Weekends";
  const runs: number[][] = [];
  for (const d of list) {
    const last = runs[runs.length - 1];
    if (last && d === last[last.length - 1] + 1) last.push(d);
    else runs.push([d]);
  }
  return runs
    .map((r) => (r.length >= 3 ? `${WEEKDAY_SHORT[r[0] - 1]}–${WEEKDAY_SHORT[r[r.length - 1] - 1]}` : r.map((d) => WEEKDAY_SHORT[d - 1]).join(", ")))
    .join(", ");
}
