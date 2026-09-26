import { describe, expect, it } from "vitest";
import { dateRange } from "./day";
import { DEFAULT_KEEP_ALIVE, dayFocus, hourTargetsFor, keepAliveOf, runPosition, suggestFocus, weekLine, type FocusArea, type FocusDay } from "./focus";
import type { Metric } from "./metrics";
import { nextActions, type NextInput } from "./next-action";
import { planDay, type PlanInput } from "./plan";
import { scoreboard } from "./scoreboard";

const WEEK = "2026-09-28"; // a Monday
const days = (areas: Array<FocusArea | null>): FocusDay[] => dateRange(WEEK, "2026-10-04").map((date, i) => ({ date, area: areas[i] ?? null }));

describe("a focus day's hours", () => {
  it("gives the focus the day's work less the others' keep-alive, and at least an hour", () => {
    const f = dayFocus("websites", DEFAULT_KEEP_ALIVE, 8);
    expect(f).toEqual({ area: "websites", deepMinutes: 480 - 20 - 15, keepAlive: { imperium: 20, trading: 15 } });
    expect(dayFocus("imperium", DEFAULT_KEEP_ALIVE, 0.5).deepMinutes).toBe(60);
  });

  it("leaves a business out when its keep-alive is 0", () => {
    expect(dayFocus("imperium", { imperium: 20, websites: 0, trading: 10 }, 6).keepAlive).toEqual({ trading: 10 });
  });

  it("puts the focus first in the hour targets, then the keep-alives; without one, the owner's own", () => {
    const targets = hourTargetsFor(dayFocus("websites", DEFAULT_KEEP_ALIVE, 8), { trading: 2 });
    expect(Object.keys(targets)).toEqual(["websites", "imperium", "trading"]);
    expect(targets.imperium).toBeCloseTo(20 / 60);
    expect(hourTargetsFor(null, { trading: 2 })).toEqual({ trading: 2 });
  });

  it("reads keep-alive minutes safely", () => {
    expect(keepAliveOf(undefined)).toEqual(DEFAULT_KEEP_ALIVE);
    expect(keepAliveOf({ imperium: 30, websites: -5, trading: 999, faith: 10 })).toEqual({ imperium: 30, websites: 20, trading: 240 });
  });
});

describe("the week in a line", () => {
  it("says a whole week, runs of days, and nothing when none is set", () => {
    expect(weekLine(days(Array(7).fill("imperium")))).toBe("Imperium all week");
    expect(weekLine(days(["imperium", "imperium", "imperium", "websites", "websites", "websites", null]))).toBe("Imperium Mon–Wed, Websites Thu–Sat");
    expect(weekLine(days(["trading", null, "trading"]))).toBe("AI Bot Mon, AI Bot Wed");
    expect(weekLine(days([]))).toBeNull();
  });

  it("knows which day of its run today is", () => {
    const split = days(["imperium", "imperium", "imperium", "websites", "websites"]);
    expect(runPosition(split, "2026-09-29")).toEqual({ day: 2, of: 3 });
    expect(runPosition(split, "2026-10-01")).toEqual({ day: 1, of: 2 });
    expect(runPosition(split, "2026-10-04")).toBeNull();
  });
});

describe("which business next", () => {
  it("suggests the one with the least time lately, not last week's focus", () => {
    expect(suggestFocus({ imperium: 600, websites: 180, trading: 30 }, "trading")).toEqual({
      area: "websites",
      why: "Websites has had 3h in the last 14 days: the least of the three. AI Bot just had its week.",
    });
    expect(suggestFocus({ imperium: 600, websites: 180 }, null).area).toBe("trading");
  });
});

function nextInput(p: Partial<NextInput> = {}): NextInput {
  return {
    today: "2026-09-29",
    hour: 9,
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
    milestone: { title: "TradingView comparison", nextStep: "Backtest" },
    ...p,
  };
}

const leads = { id: "leads", area: "imperium" as const, key: "leads_called", label: "Leads called", unit: "leads", aggregation: "sum" as const, pinned: true, value: 2, target: 10, weekTotal: 2, weekTarget: 50 };

describe("up next on a focus day", () => {
  const focus = dayFocus("websites", DEFAULT_KEEP_ALIVE, 8);
  const input = (p: Partial<NextInput> = {}) => nextInput({ focus, hourTargets: hourTargetsFor(focus, { trading: 2 }), counters: [leads], ...p });

  it("starts the deep block first, and the other businesses' numbers wait", () => {
    const list = nextActions(input());
    expect(list[0]).toMatchObject({ title: "Start a deep Websites block.", do: { type: "work", area: "websites" } });
    expect(list[0].why).toBe("Websites is this week's focus: 0m of 7h 25m so far.");
    expect(list.some((a) => a.key === "counter-leads" || a.key === "week-leads")).toBe(false);
    expect(list.some((a) => a.key === "bot")).toBe(false);
  });

  it("offers the keep-alives next, then first once the deep work is in", () => {
    const early = nextActions(input());
    expect(early[1]).toMatchObject({ title: "Keep Imperium alive: 20 minutes.", do: { type: "work", area: "imperium" } });
    const later = nextActions(input({ byArea: { websites: 445, imperium: 5 }, workMinutes: 450 }));
    expect(later[0].title).toBe("Keep Imperium alive: 15 minutes.");
    expect(later.some((a) => a.key === "keep-trading")).toBe(true);
  });

  it("still puts today's #1 first, whatever business it's for", () => {
    const tasks = [{ id: "t1", title: "Send the Hughes quote", area: "imperium" as const, rank: 1 as const, status: "pending" as const, metricId: null, quantity: null, dueDate: null, localDate: "2026-09-29" }];
    expect(nextActions(input({ tasks }))[0].title).toBe("Send the Hughes quote");
  });
});

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

describe("plan my day on a focus day", () => {
  const calls = metric({ id: "calls", area: "websites", key: "cold_calls", label: "Cold calls", unit: "calls", weeklyTarget: 100 });
  const demos = metric({ id: "demos", area: "websites", key: "demos_built", label: "Demos built", unit: "demos", weeklyTarget: 5 });
  const focus = dayFocus("websites", DEFAULT_KEEP_ALIVE, 8);
  const base: PlanInput = {
    today: "2026-09-29",
    nowMinutes: 8 * 60,
    todayTasks: [],
    unfinished: [],
    later: [],
    weekly: [],
    weeklyArea: new Map(),
    counters: [
      { metric: metric({ id: "leads" }), target: 10, value: 0 },
      { metric: calls, target: 30, value: 0 },
      { metric: demos, target: 1, value: 0 },
    ],
    milestone: { title: "TradingView comparison", nextStep: "Backtest" },
    workTargetMinutes: 480,
    worked: {},
    planned: {},
    hourTargets: hourTargetsFor(focus, { trading: 2 }),
    focus: "websites",
  };

  it("puts the focus business's work in the Big 3 and leaves the bot's step for its own week", () => {
    const plan = planDay(base);
    expect(plan.big3.map((b) => b.area)).toEqual(["websites", "websites", "imperium"]);
    expect(plan.big3[0].reasons).toContain("This week's focus");
    expect([...plan.big3, ...plan.supporting].some((i) => i.key === "bot-step")).toBe(false);
  });

  it("lays out a deep block, the keep-alives, then the rest of the deep work", () => {
    const { blocks } = planDay(base);
    expect(blocks.map((b) => [b.area, b.start, b.end])).toEqual([
      ["websites", "08:00", "10:00"],
      ["imperium", "10:00", "10:20"],
      ["trading", "10:20", "10:40"],
      ["websites", "10:40", "12:40"],
      ["websites", "12:40", "14:40"],
      ["websites", "14:40", "15:40"],
    ]);
  });
});

describe("the day's scoreboard on a focus day", () => {
  it("counts the focus's numbers and each business's time, not the others' numbers", () => {
    const focus = dayFocus("websites", DEFAULT_KEEP_ALIVE, 8);
    const board = scoreboard({
      habits: [],
      tasks: [],
      counters: [
        { area: "imperium", target: 10, value: 0 },
        { area: "websites", target: 30, value: 30 },
      ],
      workedByArea: { websites: 200, imperium: 25 },
      hourTargets: hourTargetsFor(focus, { trading: 2 }),
      reviewDone: false,
      focus: "websites",
    });
    expect(board.websites).toEqual({ done: 1, total: 2 });
    expect(board.imperium).toEqual({ done: 1, total: 1 });
    expect(board.trading).toEqual({ done: 0, total: 1 });
  });
});
