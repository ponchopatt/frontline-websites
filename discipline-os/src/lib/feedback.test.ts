import { describe, expect, it } from "vitest";
import { closeSummary, verdictLine, type CloseInput } from "./close-day";
import { addDays, dateRange, isoWeekday, type LocalDate } from "./day";
import { counterNudge, itemsNudge, minutesNudge, remainingLine, workNudge } from "./gradient";
import {
  indexHistory,
  trophyShelves,
  memoryCard,
  momentum,
  newRecords,
  progressStats,
  recordBaseline,
  records,
  runStats,
  streaks,
  wordTrend,
  yearDays,
  type FactHabit,
  type HistoryFacts,
} from "./history";
import { nextActions, type NextInput } from "./next-action";
import { buildReplay } from "./replay";
import type { DaySummary } from "./streak";

const TODAY = "2026-09-24"; // a Thursday

function summary(date: LocalDate, p: Partial<DaySummary> = {}): DaySummary {
  return {
    local_date: date,
    habits_total: 10,
    habits_done: 0,
    tasks_total: 0,
    tasks_done: 0,
    review_done: 0,
    work_minutes: 0,
    final_score: null,
    completed_at: null,
    minimum_on: false,
    minimum_total: 7,
    minimum_done: 0,
    ...p,
  };
}

function habit(p: Partial<FactHabit> & { id: string }): FactHabit {
  return { name: p.id, category: "body", kind: null, days: null, from: "2026-01-01", to: null, ...p };
}

function facts(p: Partial<HistoryFacts> & { first?: LocalDate; day?: (d: LocalDate) => Partial<DaySummary> } = {}): HistoryFacts {
  const first = p.first ?? "2026-09-01";
  const today = p.today ?? TODAY;
  return {
    today,
    firstDay: first,
    threshold: 80,
    workTargetMinutes: 480,
    workDays: [1, 2, 3, 4, 5],
    days: dateRange(first, today).map((d) => summary(d, p.day?.(d) ?? {})),
    habits: [],
    ticks: [],
    counters: [
      { id: "leads", area: "imperium", key: "leads_called", unit: "leads" },
      { id: "calls", area: "websites", key: "cold_calls", unit: "calls" },
      { id: "rev-i", area: "imperium", key: "revenue", unit: "$" },
      { id: "rev-w", area: "websites", key: "revenue", unit: "$" },
      { id: "cardio", area: "fitness", key: "cardio_minutes", unit: "min" },
    ],
    entries: [],
    ...p,
  };
}

describe("runs", () => {
  const dates = dateRange("2026-09-14", "2026-09-24");
  const weekdays = (d: LocalDate) => isoWeekday(d) <= 5;

  it("skips rest days and doesn't break on a today that's still open", () => {
    const done = new Set(dateRange("2026-09-14", "2026-09-23").filter(weekdays));
    const s = runStats(dates, TODAY, weekdays, (d) => done.has(d));
    expect(s.current).toBe(8); // Mon 14 – Wed 23, weekend skipped
    expect(s.best).toBe(8);
  });

  it("keeps the best of the runs that ended", () => {
    const done = new Set(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-22", "2026-09-23", "2026-09-24"]);
    const s = runStats(dates, TODAY, weekdays, (d) => done.has(d));
    expect(s).toMatchObject({ current: 3, best: 3, bestBefore: 3 });
  });
});

describe("streaks", () => {
  it("counts gym on its days and gives consistency out of the days it was due", () => {
    const gym = habit({ id: "gym", kind: "gym", days: [1, 2, 3, 4, 5] });
    const ticks = dateRange("2026-09-01", "2026-09-23")
      .filter((d) => isoWeekday(d) <= 5 && d !== "2026-09-10")
      .map((d) => ({ habitId: "gym", date: d }));
    const rows = streaks(indexHistory(facts({ habits: [gym], ticks })));
    const row = rows.find((r) => r.key === "gym")!;
    expect(row.current).toBe(9); // Fri 11 – Wed 23 on weekdays
    expect(row.best).toBe(9);
    expect(row.consistency).toBeCloseTo(16 / 17);
  });

  it("draws the last six weeks as dots, and gives trophies only for days kept", () => {
    const gym = habit({ id: "gym", kind: "gym", days: [1, 2, 3, 4, 5] });
    const ticks = dateRange("2026-09-14", "2026-09-23").filter((d) => isoWeekday(d) <= 5).map((d) => ({ habitId: "gym", date: d }));
    const rows = streaks(indexHistory(facts({ habits: [gym], ticks })));
    const row = rows.find((r) => r.key === "gym")!;
    expect(row.recent).toHaveLength(42);
    expect(row.recent.at(-1)).toBe("open"); // today, not done yet
    expect(row.recent.at(-2)).toBe("done");
    expect(row.recent[0]).toBe("off"); // before the account started
    expect(row.recentDone).toBe(8);
    const shelf = trophyShelves(rows).find((t) => t.key === "gym")!;
    expect(shelf.items).toEqual([
      { days: 3, unlocked: true },
      { days: 7, unlocked: true },
      { days: 14, unlocked: false },
    ]);
    expect(shelf.unlocked).toBe(2);
  });

  it("keeps Keep My Word going through a secured minimum day", () => {
    const f = facts({
      first: "2026-09-20",
      day: (d) => (d === "2026-09-22" ? { habits_done: 2, minimum_on: true, minimum_done: 7 } : { habits_done: 10, tasks_total: 0, review_done: 1, work_minutes: 480 }),
    });
    const word = streaks(indexHistory(f)).find((r) => r.key === "word")!;
    expect(word.current).toBe(5);
  });
});

describe("records", () => {
  const f = facts({
    day: (d) => ({ work_minutes: d === "2026-09-10" ? 540 : d === TODAY ? 560 : 300 }),
    entries: [
      { metricId: "leads", date: "2026-09-10", value: 30 },
      { metricId: "leads", date: TODAY, value: 12 },
      { metricId: "rev-i", date: "2026-09-11", value: 600 },
      { metricId: "rev-w", date: "2026-09-11", value: 900 },
    ],
  });
  const ix = indexHistory(f);

  it("finds the best day, week and revenue across both businesses", () => {
    const list = records(ix);
    expect(list.find((r) => r.key === "work_day")).toMatchObject({ value: 560, display: "9h 20m" });
    expect(list.find((r) => r.key === "leads_day")).toMatchObject({ value: 30, when: "Thu 10 Sep" });
    expect(list.find((r) => r.key === "revenue_day")).toMatchObject({ value: 1500, display: "$1,500" });
    expect(list.find((r) => r.key === "work_week")?.value).toBeGreaterThan(0);
  });

  it("calls a new record only against one that existed, with the previous value", () => {
    const base = recordBaseline(ix);
    expect(base.day.work).toBe(540);
    const events = newRecords(base, { day: { work: 560, leads: 12 }, week: {}, doneToday: {} });
    expect(events).toEqual([{ key: "work_day", label: "Most work in a day", text: "9h 20m of work today", previous: "9h" }]);
    expect(newRecords({ day: { calls: 0 }, week: {}, streak: {} }, { day: { calls: 40 }, week: {}, doneToday: {} })).toEqual([]);
  });

  it("fires a week record once, on the day the week passes it", () => {
    const base = { day: {}, week: { work: { bestOther: 2400, before: 2300 } }, streak: {} };
    expect(newRecords(base, { day: {}, week: { work: 200 }, doneToday: {} })[0]?.key).toBe("work_week");
    const already = { day: {}, week: { work: { bestOther: 2400, before: 2500 } }, streak: {} };
    expect(newRecords(already, { day: {}, week: { work: 200 }, doneToday: {} })).toEqual([]);
  });

  it("marks a streak record the day it passes the old one", () => {
    const bible = habit({ id: "bible", kind: "bible", category: "morning" });
    const ticks = [
      ...dateRange("2026-09-02", "2026-09-06"), // a run of 5
      ...dateRange("2026-09-19", "2026-09-23"), // level with it by last night
    ].map((d) => ({ habitId: "bible", date: d }));
    const base = recordBaseline(indexHistory(facts({ habits: [bible], ticks })));
    expect(base.streak.bible).toEqual({ run: 5, record: 5 });
    const events = newRecords(base, { day: {}, week: {}, doneToday: { bible: true } });
    expect(events.map((e) => [e.text, e.previous])).toEqual([["Bible streak: 6 days", "5 days"]]);
  });
});

describe("momentum", () => {
  it("averages the last seven finished days and says which way it's going", () => {
    const f = facts({
      day: (d) =>
        d >= "2026-09-17"
          ? { habits_done: 9, tasks_total: 3, tasks_done: 3, review_done: 1, work_minutes: 480 }
          : { habits_done: 5, tasks_total: 3, tasks_done: 1, work_minutes: 200 },
    });
    const m = momentum(indexHistory(f))!;
    expect(m.days).toBe(7);
    expect(m.trend).toBe("rising");
    expect(m.parts.map((p) => p.key)).toEqual(["completion", "work", "habits", "tasks"]);
    expect(m.parts.find((p) => p.key === "work")?.value).toBe(100);
  });

  it("waits for three days of history", () => {
    expect(momentum(indexHistory(facts({ first: "2026-09-22" })))).toBeNull();
  });
});

describe("the year and the words", () => {
  const f = facts({ day: (d) => (d === "2026-09-10" ? { habits_done: 10, review_done: 1, work_minutes: 480 } : d === "2026-09-11" ? { habits_done: 6 } : {}) });
  const ix = indexHistory(f);

  it("colours each day by how much of the word was kept", () => {
    const year = yearDays(ix, 2026);
    expect(year).toHaveLength(365);
    const at = (d: LocalDate) => year.find((y) => y.date === d)!.state;
    expect(at("2026-08-31")).toBe("before");
    expect(at("2026-09-10")).toBe("strong");
    expect(at("2026-09-11")).toBe("average");
    expect(at("2026-09-12")).toBe("none");
    expect(at("2026-12-01")).toBe("future");
  });

  it("counts commitments made, kept and broken this month", () => {
    const t = wordTrend(ix);
    expect(t.month.made).toBeGreaterThan(t.month.kept);
    expect(t.month.broken).toBeGreaterThan(0);
    expect(t.weeks).toHaveLength(8);
  });

  it("only says what the history shows", () => {
    const withLeads = indexHistory({ ...f, entries: [{ metricId: "leads", date: "2026-09-10", value: 30 }] });
    const text = progressStats(withLeads).map((s) => s.text);
    expect(text).toContain("You've called 30 Imperium leads.");
    expect(text.some((t) => /revenue/.test(t))).toBe(false);
  });

  it("shows a now-and-then card on some days only", () => {
    const shown = dateRange("2026-09-20", "2026-09-26").map((d) => memoryCard(indexHistory(facts({ first: "2026-06-01", today: d, day: () => ({ work_minutes: 300 }) }))));
    expect(shown.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    expect(shown.filter(Boolean).length).toBeLessThanOrEqual(3);
    expect(memoryCard(indexHistory(facts({ first: addDays(TODAY, -5) })))).toBeNull();
  });
});

describe("one more", () => {
  it("nudges only when it's nearly done", () => {
    expect(counterNudge(9, 10, "calls")).toBe("One more call.");
    expect(counterNudge(7, 10, "leads")).toBe("Three more leads.");
    expect(counterNudge(2, 10, "calls")).toBeNull();
    expect(counterNudge(10, 10, "calls")).toBeNull();
    expect(counterNudge(850, 1000, "$")).toBe("$150 to go.");
    expect(remainingLine(27, 30, "calls")).toBe("3 more calls to today's target.");
    expect(workNudge(462, 480)).toBe("18 minutes left. Finish it.");
    expect(workNudge(300, 480)).toBeNull();
    expect(minutesNudge(18, 20)).toBe("2 minutes left.");
    expect(itemsNudge(14, 15, ["commitment", "commitments"])).toBe("One commitment left.");
  });
});

function nextInput(p: Partial<NextInput> = {}): NextInput {
  return {
    today: TODAY,
    hour: 13,
    locked: false,
    tasks: [],
    overdue: [],
    counters: [],
    habits: [],
    workMinutes: 0,
    workTargetMinutes: 480,
    byArea: {},
    hourTargets: {},
    running: null,
    reviewDone: false,
    minimum: null,
    milestone: null,
    ...p,
  };
}

const leads = { id: "leads", area: "imperium" as const, key: "leads_called", label: "Leads called", unit: "leads", aggregation: "sum" as const, pinned: true, value: 2, target: 10, weekTotal: 2, weekTarget: 50 };

describe("what should I do next", () => {
  it("names today's #1 in plain words, with what's left", () => {
    const [top] = nextActions(
      nextInput({
        counters: [leads],
        tasks: [{ id: "t1", title: "Call 10 Imperium leads", area: "imperium", rank: 1, status: "pending", metricId: "leads", quantity: 10, dueDate: null, localDate: TODAY }],
      }),
    );
    expect(top).toMatchObject({ title: "Call the 8 Imperium leads you haven't called yet.", why: "Today's #1, and it isn't done yet.", do: { type: "task", taskId: "t1", area: "imperium" } });
  });

  it("finishes the morning routine first thing, and the work target when it's nearly in", () => {
    const habits = [{ id: "h", name: "Journal", category: "morning" as const, kind: "journal", due: true, done: false }];
    expect(nextActions(nextInput({ hour: 7, habits }))[0]).toMatchObject({ title: "Journal.", do: { type: "habit", habitId: "h" } });
    const late = nextActions(nextInput({ hour: 16, workMinutes: 462, counters: [leads] }))[0];
    expect(late.title).toBe("Finish your final 18 minutes of work.");
  });

  it("puts a counter behind target ahead of the rest, and closes the day late", () => {
    expect(nextActions(nextInput({ counters: [leads] }))[0].title).toBe("Call 8 more Imperium leads.");
    expect(nextActions(nextInput({ hour: 21.5, reviewDone: true, counters: [leads] }))[0].do).toEqual({ type: "close" });
  });

  it("puts Minimum Day and a running timer first, and stops once the day is closed", () => {
    const minimum = [{ key: "bible", label: "Bible", done: false, kind: "habit" as const, habitId: "b" }];
    expect(nextActions(nextInput({ minimum, counters: [leads] }))[0]).toMatchObject({ title: "Bible", do: { type: "habit", habitId: "b" } });
    expect(nextActions(nextInput({ running: { area: "websites", minutes: 42, task: null } }))[0].title).toBe("Keep going on Websites.");
    expect(nextActions(nextInput({ locked: true }))).toHaveLength(1);
  });

  it("always has something, one per key", () => {
    const list = nextActions(nextInput({ workTargetMinutes: 0, reviewDone: false }));
    expect(list[0].title).toBe("Do the night review.");
    expect(new Set(list.map((a) => a.key)).size).toBe(list.length);
  });
});

describe("close the day", () => {
  const base: CloseInput = {
    made: 25,
    kept: 23,
    percent: 92,
    threshold: 80,
    workMinutes: 484,
    workTargetMinutes: 480,
    byArea: { imperium: 140.4, websites: 182 },
    tasks: { done: 5, total: 6 },
    big3: { done: 3, total: 3 },
    habits: { done: 15, total: 16 },
    morning: { done: 8, total: 8 },
    faithDone: 3,
    faithTotal: 3,
    gym: true,
    cardio: true,
    cardioMinutes: 25,
    counters: [{ label: "Leads called", unit: "leads", value: 12, target: 10 }],
    reviewDone: true,
    minimum: null,
    records: [],
  };

  it("lists what was actually achieved and says the word was kept", () => {
    const s = closeSummary(base);
    expect(s.broken).toBe(2);
    expect(s.achievements).toEqual([
      "Work target hit: 8h 04m",
      "Big 3 done",
      "Morning routine complete",
      "Bible, journal and prayer",
      "Gym",
      "Cardio: 25 min",
      "Leads called: 12 of 10",
      "Night review done",
    ]);
    expect(verdictLine(s.verdict, s.score)).toBe("You kept your word today.");
  });

  it("is plain about a short day, and credits a secured minimum day", () => {
    const short = closeSummary({ ...base, percent: 61, gym: false });
    expect(verdictLine(short.verdict, short.score)).toBe("Closed at 61%. Tomorrow starts clean.");
    const min = closeSummary({ ...base, percent: 40, minimum: "secured" });
    expect(verdictLine(min.verdict, min.score)).toBe("Minimum day secured. You kept the chain alive.");
  });
});

describe("the replay", () => {
  it("puts what was tracked in time order", () => {
    const events = buildReplay(
      {
        habits: [
          { name: "Wake up on time", kind: null, completedAt: "2026-09-23T20:42:00Z", editedAt: null },
          { name: "Bible", kind: "bible", completedAt: "2026-09-23T21:05:00Z", editedAt: null },
        ],
        sessions: [{ startedAt: "2026-09-23T22:00:00Z", endedAt: "2026-09-24T00:12:00Z", area: "websites", task: null, note: "Two demos" }],
        tasks: [],
        counters: [{ label: "Leads called", unit: "leads", value: 12, updatedAt: "2026-09-24T01:00:00Z" }],
        proofs: [],
        review: { updatedAt: "2026-09-24T11:30:00Z" },
        minimumAt: null,
        closedAt: "2026-09-24T11:31:00Z",
      },
      Date.parse("2026-09-24T12:00:00Z"),
    );
    expect(events.map((e) => e.title)).toEqual(["Wake up on time", "Bible", "Websites work", "Leads called: 12", "Night review", "Day closed"]);
    expect(events[2].detail).toBe("2h 12m · Two demos");
  });
});
