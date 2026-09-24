import { describe, expect, it } from "vitest";
import {
  addDays,
  dateRange,
  dayBounds,
  daysBetween,
  formatElapsed,
  isLocalDate,
  localDateAt,
  startOfWeek,
} from "./day";
import { keepWord, weekAverage } from "./keep-word";
import { computeStreaks, scoreForSummary, type DayScore, type DaySummary } from "./streak";
import { nextReading } from "./bible";

const SYD = "Australia/Sydney";

describe("what counts as a day", () => {
  it("puts 01:30 on the previous day with a 04:00 start", () => {
    // 2026-03-10 01:30 in Sydney (UTC+11) = 2026-03-09 14:30Z
    expect(localDateAt(new Date("2026-03-09T14:30:00Z"), SYD, 4)).toBe("2026-03-09");
  });

  it("puts 04:00 exactly on the new day", () => {
    // 2026-03-10 04:00 Sydney = 2026-03-09 17:00Z
    expect(localDateAt(new Date("2026-03-09T17:00:00Z"), SYD, 4)).toBe("2026-03-10");
  });

  it("does not roll over at midnight", () => {
    // 2026-03-10 00:05 Sydney = 2026-03-09 13:05Z
    expect(localDateAt(new Date("2026-03-09T13:05:00Z"), SYD, 4)).toBe("2026-03-09");
  });

  it("uses a midnight start when day_start_hour is 0", () => {
    expect(localDateAt(new Date("2026-03-09T13:05:00Z"), SYD, 0)).toBe("2026-03-10");
  });

  it("keeps the 04:00 boundary across daylight saving (Sydney, 5 Apr 2026)", () => {
    // DST ends 03:00 → 02:00 on 5 Apr 2026. 03:30 AEST (UTC+10) is still 4 Apr's day.
    expect(localDateAt(new Date("2026-04-04T17:30:00Z"), SYD, 4)).toBe("2026-04-04");
    // 04:10 AEST on 5 Apr belongs to 5 Apr.
    expect(localDateAt(new Date("2026-04-04T18:10:00Z"), SYD, 4)).toBe("2026-04-05");
  });

  it("works in other timezones", () => {
    // 2026-06-01 02:00 in New York (UTC-4) = 06:00Z
    expect(localDateAt(new Date("2026-06-01T06:00:00Z"), "America/New_York", 4)).toBe("2026-05-31");
  });

  it("does calendar maths on plain dates", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(daysBetween("2026-01-01", "2026-03-01")).toBe(59);
    expect(dateRange("2026-01-30", "2026-02-02")).toEqual([
      "2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02",
    ]);
    expect(startOfWeek("2026-09-24")).toBe("2026-09-21"); // Thursday → Monday
    expect(startOfWeek("2026-09-21")).toBe("2026-09-21");
    expect(startOfWeek("2026-09-27")).toBe("2026-09-21"); // Sunday → previous Monday
  });

  it("validates local dates", () => {
    expect(isLocalDate("2026-09-24")).toBe(true);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("24/09/2026")).toBe(false);
    expect(isLocalDate(20260924)).toBe(false);
  });

  it("knows the instants a day covers", () => {
    const { start, end } = dayBounds("2026-03-10", SYD, 4);
    expect(start.toISOString()).toBe("2026-03-09T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-10T17:00:00.000Z");
  });

  it("formats timers", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(65_000)).toBe("1:05");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
  });
});

describe("keep my word", () => {
  const base = { habitsDone: 0, habitsTotal: 0, tasksDone: 0, tasksTotal: 0, reviewDone: false, workMinutes: 0, workTargetMinutes: 480 };

  it("counts habits, tasks, the night review and the work target as commitments", () => {
    // 10 habits + 3 tasks + review + work = 15 made; 9 + 3 + review = 13 kept.
    const r = keepWord({ ...base, habitsDone: 9, habitsTotal: 10, tasksDone: 3, tasksTotal: 3, reviewDone: true, workMinutes: 300 });
    expect(r).toEqual({ made: 15, kept: 13, percent: 87 });
  });

  it("keeps the work commitment once the hours are in, and skips it with no target", () => {
    expect(keepWord({ ...base, workMinutes: 480 }).kept).toBe(1);
    expect(keepWord({ ...base, workTargetMinutes: 0 }).made).toBe(1);
  });

  it("averages the days of a week that have a number", () => {
    const days = [
      { date: "2026-09-21", score: 80 },
      { date: "2026-09-22", score: 90 },
      { date: "2026-09-23", score: null },
      { date: "2026-09-28", score: 10 },
    ];
    expect(weekAverage(days, "2026-09-21", "2026-09-24")).toBe(85);
    expect(weekAverage([], "2026-09-21", "2026-09-24")).toBeNull();
  });
});

function days(scores: number[], start = "2026-09-01"): DayScore[] {
  return scores.map((score, i) => ({ date: addDays(start, i), score, locked: false, minimum: null }));
}

describe("streaks", () => {
  it("counts consecutive days at or above the threshold", () => {
    const d = days([80, 90, 70, 75]);
    expect(computeStreaks(d, 70, d[3].date)).toEqual({ current: 4, best: 4 });
  });

  it("does not break the streak for a today still in progress", () => {
    const d = days([80, 90, 20]);
    expect(computeStreaks(d, 70, d[2].date)).toEqual({ current: 2, best: 2 });
  });

  it("ends the streak at once when today is closed below the line", () => {
    const d = days([80, 90, 20]);
    expect(computeStreaks([d[0], d[1], { ...d[2], locked: true }], 70, d[2].date)).toEqual({ current: 0, best: 2 });
    expect(computeStreaks([d[0], d[1], { ...d[2], score: 85, locked: true }], 70, d[2].date)).toEqual({ current: 3, best: 3 });
  });

  it("breaks on a missed day and keeps the best run", () => {
    const d = days([80, 80, 80, 10, 80, 80]);
    expect(computeStreaks(d, 70, d[5].date)).toEqual({ current: 2, best: 3 });
  });

  it("treats a day with nothing logged as a break, not a deletion", () => {
    const d = days([80, 0, 80]);
    expect(computeStreaks(d, 70, d[2].date)).toEqual({ current: 1, best: 1 });
  });

  it("keeps the chain alive through a secured minimum day, not one left open", () => {
    const d = days([80, 30, 80]);
    expect(computeStreaks([d[0], { ...d[1], minimum: "secured" }, d[2]], 70, d[2].date)).toEqual({ current: 3, best: 3 });
    expect(computeStreaks([d[0], { ...d[1], minimum: "on" }, d[2]], 70, d[2].date)).toEqual({ current: 1, best: 1 });
  });

  it("ignores days after today", () => {
    const d = days([80, 80, 80]);
    expect(computeStreaks(d, 70, d[1].date)).toEqual({ current: 2, best: 2 });
  });

  it("uses the stored score for a completed day", () => {
    const summary: DaySummary = {
      local_date: "2026-09-01",
      habits_total: 17, habits_done: 0, tasks_total: 3, tasks_done: 0,
      review_done: 0, work_minutes: 0,
      final_score: 88, completed_at: "2026-09-01T11:00:00Z",
      minimum_on: false, minimum_total: 7, minimum_done: 0,
    };
    expect(scoreForSummary(summary, 6)).toEqual({ date: "2026-09-01", score: 88, locked: true, minimum: null });
    expect(scoreForSummary({ ...summary, minimum_on: true, minimum_done: 7 }, 6).minimum).toBe("secured");
    expect(scoreForSummary({ ...summary, final_score: null, completed_at: null }, 6).score).toBe(0);
  });
});

describe("bible reading order", () => {
  it("moves to the next chapter, then the next book", () => {
    expect(nextReading({ book: "John", chapter: 3 })).toEqual({ book: "John", chapter: 4 });
    expect(nextReading({ book: "John", chapter: 21 })).toEqual({ book: "Acts", chapter: 1 });
    expect(nextReading({ book: "Revelation", chapter: 22 })).toEqual({ book: "Genesis", chapter: 1 });
  });
});
