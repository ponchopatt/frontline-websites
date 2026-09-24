import type { CloseSummary } from "@/lib/close-day";
import type { LocalDate } from "@/lib/day";
import type { TaskItem, WorkSessionItem } from "@/lib/types";

/**
 * Small rules behind the Today screen, kept apart from the components so they can be tested.
 */

/**
 * "One more gym session this week." Only when one more session makes the week's count and a
 * due day is still open to do it on. Nothing when the week is further off than that.
 */
export function gymWeekNudge(week: Array<{ date: LocalDate; due: boolean; done: boolean }>, today: LocalDate): string | null {
  const done = week.filter((d) => d.done).length;
  const due = week.filter((d) => d.due).length;
  const open = week.filter((d) => d.due && !d.done && d.date >= today).length;
  return done > 0 && due - done === 1 && open > 0 ? "One more gym session this week." : null;
}

/** A task put in a list once. The same task again (a double tap's second answer) replaces it. */
export function withTask(list: TaskItem[], task: TaskItem, at: "start" | "end" = "end"): TaskItem[] {
  if (list.some((t) => t.id === task.id)) return list.map((t) => (t.id === task.id ? task : t));
  return at === "start" ? [task, ...list] : [...list, task];
}

/**
 * The day's sessions with one of them ended. A timer started on another device isn't in the
 * list yet; it's added when it belongs to the day, so its minutes count straight away.
 */
export function withEnded(list: WorkSessionItem[], session: WorkSessionItem, endedAt: string, date: LocalDate): WorkSessionItem[] {
  if (list.some((s) => s.id === session.id)) return list.map((s) => (s.id === session.id ? { ...s, endedAt } : s));
  if (session.localDate !== date) return list;
  const { id, blockId, area, localDate, startedAt, note } = session;
  return [...list, { id, blockId, area, localDate, startedAt, endedAt, note }];
}

/** "9 things done" on a closed day: its tasks and habits, as Day complete counted them. */
export function thingsDone(closed: CloseSummary | null): string | null {
  const n = closed ? closed.tasks.done + closed.habits.done : 0;
  return n > 0 ? `${n} ${n === 1 ? "thing" : "things"} done` : null;
}
