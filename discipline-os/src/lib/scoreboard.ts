import type { Area, WorkArea } from "./areas";

/**
 * The daily scoreboard: one line per part of life, "done of planned", worked out from the
 * same ticks, tasks and counters the rest of the screen shows.
 *
 *   Faith       Bible, Journal, Prayer (morning), Evening prayer, Reflection (the night review)
 *   Fitness     fitness habits due today (Gym on its days, Cardio, the optional ones)
 *   Imperium    counters with a target today (met or not) + Imperium tasks
 *   Websites    the same for the website business
 *   AI Bot      the bot's daily hours + AI bot tasks
 *   Discipline  discipline habits
 *
 * Tasks in an area count towards it too.
 */

export type BoardKey = "faith" | "fitness" | "imperium" | "websites" | "trading" | "discipline";
export const BOARD: BoardKey[] = ["faith", "fitness", "imperium", "websites", "trading", "discipline"];

export interface Tally {
  done: number;
  total: number;
}

export interface BoardHabit {
  category: "morning" | "body" | "discipline" | "god";
  kind: string | null;
  due: boolean;
  done: boolean;
}

export interface BoardInput {
  habits: BoardHabit[];
  tasks: Array<{ area: Area | null; status: "pending" | "done" | "dropped" }>;
  counters: Array<{ area: Area; target: number | null; value: number }>;
  workedByArea: Partial<Record<WorkArea, number>>;
  hourTargets: Partial<Record<WorkArea, number>>;
  reviewDone: boolean;
}

const FAITH_KINDS = new Set(["bible", "journal", "prayer"]);

export function scoreboard(input: BoardInput): Record<BoardKey, Tally> {
  const out = Object.fromEntries(BOARD.map((k) => [k, { done: 0, total: 0 }])) as Record<BoardKey, Tally>;
  const count = (key: BoardKey, done: boolean) => {
    out[key].total += 1;
    if (done) out[key].done += 1;
  };

  for (const h of input.habits) {
    if (!h.due && !h.done) continue;
    if (h.kind && FAITH_KINDS.has(h.kind)) count("faith", h.done);
    else if (h.category === "god") count("faith", h.done);
    else if (h.category === "body") count("fitness", h.done);
    else if (h.category === "discipline") count("discipline", h.done);
  }
  count("faith", input.reviewDone);

  for (const c of input.counters) {
    if ((c.area === "imperium" || c.area === "websites") && c.target !== null && c.target > 0) count(c.area, c.value >= c.target);
  }

  const botTarget = (input.hourTargets.trading ?? 0) * 60;
  if (botTarget > 0) count("trading", (input.workedByArea.trading ?? 0) >= botTarget);

  for (const t of input.tasks) {
    const key = t.area && (BOARD as string[]).includes(t.area) ? (t.area as BoardKey) : null;
    if (key) count(key, t.status === "done");
  }
  return out;
}

/** The morning routine: every morning habit due today. */
export function morningTally(habits: BoardHabit[]): Tally {
  const list = habits.filter((h) => h.category === "morning" && (h.due || h.done));
  return { done: list.filter((h) => h.done).length, total: list.length };
}
