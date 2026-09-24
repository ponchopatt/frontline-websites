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
import { computeScore, type ScoreInput } from "./score";
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

const full: ScoreInput = {
  god: { done: 4, total: 4 },
  body: { done: 5, total: 5 },
  discipline: { done: 14, total: 14 },
  reflection: { done: 6, total: 6 },
  work: { minutes: 360, targetMinutes: 360 },
};

describe("daily score", () => {
  it("is 100 when everything is done", () => {
    expect(computeScore(full).score).toBe(100);
  });

  it("is 0 when nothing is done", () => {
    const none: ScoreInput = {
      god: { done: 0, total: 4 },
      body: { done: 0, total: 5 },
      discipline: { done: 0, total: 14 },
      reflection: { done: 0, total: 6 },
      work: { minutes: 0, targetMinutes: 360 },
    };
    expect(computeScore(none).score).toBe(0);
  });

  it("weights categories 25/30/20/20/5", () => {
    const onlyWork: ScoreInput = {
      god: { done: 0, total: 4 },
      body: { done: 0, total: 5 },
      discipline: { done: 0, total: 14 },
      reflection: { done: 0, total: 6 },
      work: { minutes: 360, targetMinutes: 360 },
    };
    expect(computeScore(onlyWork).score).toBe(30);
    expect(computeScore({ ...onlyWork, work: { minutes: 0, targetMinutes: 360 }, god: { done: 4, total: 4 } }).score).toBe(25);
  });

  it("caps work at the target", () => {
    const over = { ...full, work: { minutes: 900, targetMinutes: 360 } };
    expect(computeScore(over).score).toBe(100);
    expect(computeScore(over).categories.work.ratio).toBe(1);
  });

  it("scores partial work proportionally", () => {
    const half: ScoreInput = { ...full, work: { minutes: 180, targetMinutes: 360 } };
    expect(computeScore(half).score).toBe(85); // 100 − 30 × 0.5
  });

  it("redistributes the weight of a category with nothing active", () => {
    const noBody: ScoreInput = { ...full, body: { done: 0, total: 0 } };
    const result = computeScore(noBody);
    expect(result.score).toBe(100);
    expect(result.categories.body.ratio).toBeNull();
    expect(result.categories.body.weight).toBe(0);
    // God keeps its share of the remaining 80: 25 / 80
    expect(result.categories.god.weight).toBeCloseTo(31.25, 5);
  });

  it("never divides by zero when work has no target", () => {
    const noTarget: ScoreInput = {
      god: { done: 2, total: 4 },
      body: { done: 5, total: 5 },
      discipline: { done: 7, total: 14 },
      reflection: { done: 3, total: 6 },
      work: { minutes: 120, targetMinutes: 0 },
    };
    const result = computeScore(noTarget);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.categories.work.ratio).toBeNull();
    // (25×.5 + 20×1 + 20×.5 + 5×.5) / 70 = 45/70
    expect(result.score).toBe(Math.round((45 / 70) * 100));
  });

  it("scores 0, not NaN, when nothing at all is active", () => {
    const empty: ScoreInput = {
      god: { done: 0, total: 0 },
      body: { done: 0, total: 0 },
      discipline: { done: 0, total: 0 },
      reflection: { done: 0, total: 0 },
      work: { minutes: 0, targetMinutes: 0 },
    };
    expect(computeScore(empty).score).toBe(0);
  });

  it("clamps impossible counts", () => {
    expect(computeScore({ ...full, god: { done: 9, total: 4 } }).score).toBe(100);
  });
});

function days(scores: number[], start = "2026-09-01"): DayScore[] {
  return scores.map((score, i) => ({ date: addDays(start, i), score, locked: false }));
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

  it("breaks on a missed day and keeps the best run", () => {
    const d = days([80, 80, 80, 10, 80, 80]);
    expect(computeStreaks(d, 70, d[5].date)).toEqual({ current: 2, best: 3 });
  });

  it("treats a day with nothing logged as a break, not a deletion", () => {
    const d = days([80, 0, 80]);
    expect(computeStreaks(d, 70, d[2].date)).toEqual({ current: 1, best: 1 });
  });

  it("ignores days after today", () => {
    const d = days([80, 80, 80]);
    expect(computeStreaks(d, 70, d[1].date)).toEqual({ current: 2, best: 2 });
  });

  it("uses the stored score for a completed day", () => {
    const summary: DaySummary = {
      local_date: "2026-09-01",
      morning_total: 10, morning_done: 0, body_total: 5, body_done: 0,
      discipline_total: 4, discipline_done: 0, god_total: 0, god_done: 0,
      bible_done: 0, review_filled: 0, work_minutes: 0,
      final_score: 88, completed_at: "2026-09-01T11:00:00Z",
    };
    expect(scoreForSummary(summary, 6)).toEqual({ date: "2026-09-01", score: 88, locked: true });
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
