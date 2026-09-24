import type { WorkArea } from "@/lib/areas";
import type { LocalDate } from "@/lib/day";

/**
 * Plain data for the Business page, built on the server and handed to the browser. Totals are
 * kept "before today" so a tap on today's number adds straight onto the week, month and year.
 */

export interface BoardCounter {
  id: string;
  label: string;
  grp: string | null;
  unit: string | null;
  /** sum: days add up. latest: a level, like demos ready to call. */
  aggregation: "sum" | "latest";
  pinned: boolean;
  /** Today's number (for a level, where it stands now). */
  value: number;
  /** A fixed daily target on the counter. Beats the one spread over the week. */
  fixedDaily: number | null;
  /** The counter's own weekly target, editable here. */
  ownTarget: number | null;
  /** This week's target from a weekly goal on the counter, which wins over its own. */
  goalTarget: number | null;
  /** Share of this week's work days the counter existed for (1 except in its first week). */
  weekShare: number;
  weekBefore: number;
  monthBefore: number;
  yearBefore: number;
}

export interface HoursSession {
  id: string;
  localDate: LocalDate;
  startedAt: string;
  endedAt: string | null;
}

/** The one timer that can run, whichever business it's for. */
export interface RunningTimer {
  id: string;
  area: WorkArea | null;
  localDate: LocalDate;
  startedAt: string;
  task: string | null;
}

export interface HoursData {
  area: WorkArea;
  today: LocalDate;
  weekStart: LocalDate;
  monthStart: LocalDate;
  /** This business's sessions since the start of the week or month, whichever is earlier. */
  sessions: HoursSession[];
  running: RunningTimer | null;
  /** Hours a day to give it, when set. */
  targetHours: number | null;
  /** The request time, so the first paint counts a running timer the same on both sides. */
  serverNow: number;
}

export interface DoneMilestone {
  id: string;
  title: string;
  doneOn: LocalDate | null;
}
