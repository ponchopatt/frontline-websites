import { describe, expect, it } from "vitest";
import { detectArea } from "./areas";
import { nextInPlan } from "./bible";
import { formatDuration, isoWeekday } from "./day";
import type { DailyGoal } from "./goals/model";
import { stretchTarget, suggestGoals, type Answers, type SuggestContext } from "./goals/suggest-goals";
import { dailyTarget, metricTaskTitle, parseQuickTask, totalOver, weekShare, workDaysLeft, type Metric } from "./metrics";
import { minutesIntoDay, planDay, type PlanInput } from "./plan";
import { morningTally, scoreboard, type BoardHabit } from "./scoreboard";

const MON_FRI = [1, 2, 3, 4, 5];

function metric(p: Partial<Metric>): Metric {
  return {
    id: "m",
    area: "imperium",
    key: "leads_called",
    label: "Leads called",
    grp: "sales",
    unit: "leads",
    aggregation: "sum",
    dailyTarget: null,
    weeklyTarget: 50,
    pinned: true,
    sortOrder: 1,
    createdAt: "2026-01-01T00:00:00Z",
    ...p,
  };
}

function task(p: Partial<DailyGoal>): DailyGoal {
  return {
    id: "t",
    localDate: "2026-09-24",
    parentWeeklyId: null,
    title: "Task",
    quantity: null,
    unit: null,
    estimatedMinutes: null,
    rank: null,
    status: "pending",
    source: "manual",
    workBlockId: null,
    carriedFromId: null,
    completedAt: null,
    area: null,
    metricId: null,
    priority: 2,
    dueDate: null,
    notes: null,
    category: null,
    ...p,
  };
}

describe("days", () => {
  it("numbers weekdays from Monday and writes hours and minutes", () => {
    expect(isoWeekday("2026-09-21")).toBe(1);
    expect(isoWeekday("2026-09-27")).toBe(7);
    expect(formatDuration(324)).toBe("5h 24m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
  });
});

describe("counters", () => {
  it("adds up days, and reads a level as its latest value", () => {
    const values = new Map([["2026-09-21", 12], ["2026-09-22", 8], ["2026-09-28", 5]]);
    expect(totalOver(values, "2026-09-21", "2026-09-27", "sum")).toBe(20);
    expect(totalOver(values, "2026-09-23", "2026-09-27", "latest")).toBe(8);
  });

  it("spreads the week's target over the work days left", () => {
    // 50 leads a week over Mon–Fri is 10 a day…
    expect(dailyTarget({ metric: metric({}), weeklyTarget: 50, doneBeforeToday: 0, today: "2026-09-21", workDays: MON_FRI })).toBe(10);
    // …a slow start raises Thursday's number: 26 left over Thu and Fri.
    expect(workDaysLeft("2026-09-24", MON_FRI)).toBe(2);
    expect(dailyTarget({ metric: metric({}), weeklyTarget: 50, doneBeforeToday: 24, today: "2026-09-24", workDays: MON_FRI })).toBe(13);
    // $5,000 a week is $1,000 a work day, in tens.
    expect(dailyTarget({ metric: metric({ unit: "$" }), weeklyTarget: 5000, doneBeforeToday: 0, today: "2026-09-21", workDays: MON_FRI })).toBe(1000);
  });

  it("gives a counter that started mid-week only that part of the week's target", () => {
    // Started on Thursday: 2 of 5 work days, so 20 of the 50 leads, and $2,000 of $5,000.
    expect(weekShare(50, "2026-09-21", "2026-09-24", MON_FRI, "leads")).toBe(20);
    expect(weekShare(5000, "2026-09-21", "2026-09-24", MON_FRI, "$")).toBe(2000);
    expect(weekShare(50, "2026-09-21", "2026-09-01", MON_FRI, "leads")).toBe(50);
  });

  it("has no target on a day off, for a level, or once the week is done", () => {
    expect(dailyTarget({ metric: metric({}), weeklyTarget: 50, doneBeforeToday: 0, today: "2026-09-26", workDays: MON_FRI })).toBeNull();
    expect(dailyTarget({ metric: metric({ aggregation: "latest" }), weeklyTarget: 5, doneBeforeToday: 0, today: "2026-09-21", workDays: MON_FRI })).toBeNull();
    expect(dailyTarget({ metric: metric({}), weeklyTarget: 50, doneBeforeToday: 60, today: "2026-09-24", workDays: MON_FRI })).toBe(0);
    expect(dailyTarget({ metric: metric({ dailyTarget: 20 }), weeklyTarget: null, doneBeforeToday: 0, today: "2026-09-26", workDays: MON_FRI })).toBe(20);
  });

  it("names a target as something to do", () => {
    expect(metricTaskTitle({ area: "imperium", key: "leads_called" }, 10)).toBe("Call 10 Imperium leads");
    expect(metricTaskTitle({ area: "websites", key: "cold_calls" }, 30)).toBe("Make 30 website cold calls");
    expect(metricTaskTitle({ area: "imperium", key: "reels_posted" }, 1)).toBe("Post 1 reel");
    expect(metricTaskTitle({ area: "imperium", key: "revenue" }, 1000)).toBeNull();
  });
});

describe("quick add", () => {
  it("reads the business and the counter from what was typed", () => {
    expect(parseQuickTask("Call 10 Imperium leads")).toEqual({
      title: "Call 10 Imperium leads",
      area: "imperium",
      quantity: 10,
      metric: { area: "imperium", key: "leads_called" },
    });
    expect(parseQuickTask("make 30 website cold calls").metric).toEqual({ area: "websites", key: "cold_calls" });
    expect(parseQuickTask("Backtest the London open").area).toBe("trading");
  });

  it("leaves a plain task plain", () => {
    expect(parseQuickTask("  Pick up   the keys ")).toEqual({ title: "Pick up the keys", area: null, quantity: null, metric: null });
    expect(detectArea("Gym at 6")).toBe("fitness");
    // A number with no counter word isn't a counter.
    expect(parseQuickTask("Detail 2 cars").metric).toBeNull();
  });
});

describe("scoreboard", () => {
  const habits: BoardHabit[] = [
    { category: "morning", kind: null, due: true, done: true },
    { category: "morning", kind: "bible", due: true, done: true },
    { category: "morning", kind: "journal", due: true, done: false },
    { category: "morning", kind: "prayer", due: true, done: true },
    { category: "god", kind: "evening_prayer", due: true, done: false },
    { category: "body", kind: "gym", due: false, done: false }, // rest day
    { category: "body", kind: "cardio", due: true, done: true },
    { category: "discipline", kind: null, due: true, done: true },
  ];

  it("counts each part of life from the same ticks, tasks and counters", () => {
    const board = scoreboard({
      habits,
      tasks: [
        { area: "imperium", status: "done" },
        { area: "websites", status: "dropped" },
        { area: null, status: "done" },
      ],
      counters: [
        { area: "imperium", target: 10, value: 12 },
        { area: "imperium", target: 1, value: 0 },
        { area: "imperium", target: null, value: 850 },
        { area: "websites", target: 30, value: 30 },
      ],
      workedByArea: { trading: 60 },
      hourTargets: { trading: 2 },
      reviewDone: false,
    });
    expect(board.faith).toEqual({ done: 2, total: 5 });
    expect(board.fitness).toEqual({ done: 1, total: 1 });
    expect(board.imperium).toEqual({ done: 2, total: 3 });
    expect(board.websites).toEqual({ done: 1, total: 2 });
    expect(board.trading).toEqual({ done: 0, total: 1 });
    expect(board.discipline).toEqual({ done: 1, total: 1 });
  });

  it("gives the morning routine its own count", () => {
    expect(morningTally(habits)).toEqual({ done: 3, total: 4 });
  });
});

describe("plan my day", () => {
  const leads = metric({ id: "leads" });
  const calls = metric({ id: "calls", area: "websites", key: "cold_calls", label: "Cold calls", unit: "calls", weeklyTarget: 100 });
  const reels = metric({ id: "reels", key: "reels_posted", label: "Reels posted", unit: "reels", weeklyTarget: 5 });
  const base: PlanInput = {
    today: "2026-09-24",
    nowMinutes: 7 * 60 + 10,
    todayTasks: [],
    unfinished: [],
    later: [],
    weekly: [],
    weeklyArea: new Map(),
    counters: [
      { metric: leads, target: 10, value: 0 },
      { metric: calls, target: 30, value: 0 },
      { metric: reels, target: 1, value: 0 },
    ],
    milestone: { title: "TradingView comparison", nextStep: "Backtest" },
    workTargetMinutes: 480,
    worked: {},
    planned: {},
    hourTargets: { trading: 2 },
  };

  it("picks a Big 3 across the businesses, with a short supporting list", () => {
    const plan = planDay(base);
    expect(plan.big3.map((b) => b.title)).toEqual(["Call 10 Imperium leads", "Make 30 website cold calls", "Backtest: TradingView comparison"]);
    expect(plan.big3[0].metricId).toBe("leads");
    expect(plan.supporting.map((s) => s.title)).toEqual(["Post 1 reel"]);
    expect(plan.big3.length + plan.supporting.length).toBeLessThanOrEqual(7);
  });

  it("gives the AI bot its hours and splits the rest of the day into blocks of two hours or less", () => {
    const { blocks } = planDay(base);
    expect(blocks[0]).toEqual({ area: "imperium", start: "08:00", end: "10:00", minutes: 120 });
    const byArea = (a: string) => blocks.filter((b) => b.area === a).reduce((s, b) => s + b.minutes, 0);
    expect(byArea("trading")).toBe(120);
    expect(byArea("imperium") + byArea("websites") + byArea("trading")).toBe(480);
    expect(blocks.every((b) => b.minutes <= 120)).toBe(true);
  });

  it("brings back unfinished tasks and keeps today's Big 3", () => {
    const plan = planDay({
      ...base,
      todayTasks: [task({ id: "a", title: "Quote the Hilux", rank: 1, area: "imperium" }), task({ id: "b", title: "Call 10 Imperium leads", metricId: "leads", area: "imperium" })],
      unfinished: [task({ id: "old", localDate: "2026-09-23", title: "Send the Smith invoice", area: "money", priority: 1 })],
    });
    expect(plan.big3).toHaveLength(2);
    expect(plan.big3[0]).toMatchObject({ title: "Send the Smith invoice", carriedFromId: "old" });
    // Imperium already has a Big 3 slot, so the second goes to another business…
    expect(plan.big3[1].title).toBe("Make 30 website cold calls");
    // …and the leads task already on today's list is never added a second time.
    expect([...plan.big3, ...plan.supporting].filter((p) => p.metricId === "leads" && !p.taskId)).toEqual([]);
  });

  it("skips counters already hit and leaves no hours when the day's work is in", () => {
    const plan = planDay({ ...base, counters: [{ metric: leads, target: 10, value: 10 }], milestone: null, worked: { imperium: 480 } });
    expect(plan.big3).toEqual([]);
    expect(plan.blocks).toEqual([]);
  });

  it("plans no blocks after midnight, when the day is all but over", () => {
    expect(minutesIntoDay(90, 4)).toBe(25 * 60 + 30); // 01:30 with a 04:00 start is still last night
    expect(minutesIntoDay(10 * 60, 4)).toBe(10 * 60);
    expect(minutesIntoDay(90, 0)).toBe(90);
    expect(planDay({ ...base, nowMinutes: minutesIntoDay(90, 4) }).blocks).toEqual([]);
    expect(planDay({ ...base, nowMinutes: minutesIntoDay(10 * 60, 4) }).blocks[0].start).toBe("10:00");
  });
});

describe("reading plans", () => {
  it("goes on from the last chapter read, within the plan", () => {
    expect(nextInPlan("gospels", { book: "Mark", chapter: 16 })).toEqual({ book: "Luke", chapter: 1 });
    expect(nextInPlan("gospels", { book: "John", chapter: 21 })).toEqual({ book: "Matthew", chapter: 1 });
    expect(nextInPlan("psalms_proverbs", { book: "Genesis", chapter: 3 })).toEqual({ book: "Psalms", chapter: 1 });
    expect(nextInPlan("bible", null)).toEqual({ book: "John", chapter: 1 });
  });
});

describe("suggest my goals", () => {
  const base: SuggestContext = {
    weeks: 4,
    workDays: 5,
    counters: [
      { metricId: "leads", area: "imperium", key: "leads_called", label: "Leads called", unit: "leads", weeklyAvg: 38, weeklyTarget: 50 },
      { metricId: "rev", area: "imperium", key: "revenue", label: "Revenue", unit: "$", weeklyAvg: 3200, weeklyTarget: 5000 },
      { metricId: "calls", area: "websites", key: "cold_calls", label: "Cold calls", unit: "calls", weeklyAvg: null, weeklyTarget: 100 },
      { metricId: "jobs", area: "imperium", key: "jobs_completed", label: "Jobs", unit: "jobs", weeklyAvg: 4, weeklyTarget: null },
    ],
    habits: [{ kind: "gym", habitId: "gym", daysPerWeek: 3, dueDays: 5 }],
    milestone: { title: "TradingView comparison", nextStep: "Backtest" },
    taken: new Set(),
  };
  const none: Answers = { aims: {}, hoursPerWeek: null, commitments: "" };

  it("steps up from the real average, and explains the number", () => {
    const out = suggestGoals(base, none);
    const leads = out.find((s) => s.metricId === "leads")!;
    expect(leads.title).toBe("Call 50 qualified leads this week");
    expect(leads.reason).toContain("You averaged 38 a week over the last 4 weeks");
    expect(leads.major).toBe(true);
    expect(out.find((s) => s.metricId === "rev")!.title).toBe("Bring in $4,200 Imperium revenue this week");
    // No history: start from the weekly target.
    expect(out.find((s) => s.metricId === "calls")!.reason).toContain("No history yet");
    // A counter that's an outcome with no goal wording isn't suggested.
    expect(out.find((s) => s.metricId === "jobs")).toBeUndefined();
    expect(out.find((s) => s.habitId === "gym")!.title).toBe("Complete 4 gym sessions this week");
    expect(out.find((s) => s.area === "trading")!.title).toBe("Backtest: TradingView comparison");
  });

  it("skips what already has a goal, and trims to the hours free", () => {
    const out = suggestGoals({ ...base, taken: new Set(["metric:leads"]) }, { aims: { money: "Save $2,000 this month" }, hoursPerWeek: 20, commitments: "" });
    expect(out.find((s) => s.metricId === "leads")).toBeUndefined();
    const calls = out.find((s) => s.metricId === "calls")!;
    expect(calls.target).toBe(50);
    expect(calls.reason).toContain("Cut to fit the 20 hours");
    expect(out.find((s) => s.area === "money")!.title).toBe("Put aside $470 this week");
  });

  it("never stretches more than a step at a time", () => {
    expect(stretchTarget(10, 100, "leads")).toBe(13);
    expect(stretchTarget(null, 100, "leads")).toBe(100);
    expect(stretchTarget(60, 50, "calls")).toBe(70);
  });
});
