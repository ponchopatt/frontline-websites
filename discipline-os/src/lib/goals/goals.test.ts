import { describe, expect, it } from "vitest";
import { distribute, monthToWeeks, sourceFor, yearToMonths } from "./breakdown";
import { formatCompact, formatTarget, formatValue } from "./format";
import type { DailyGoal, GoalCore, MonthlyGoal, WeeklyGoal, YearlyGoal } from "./model";
import { elapsedFraction, monthOfWeek, weekRangeLabel, weeksOfMonth } from "./periods";
import { assess, evaluateGoals, type ExecutionData } from "./progress";
import { checkGoal, isVague } from "./quality";
import { suggestToday, type WeeklyContext } from "./suggest";

const core: GoalCore = {
  id: "g",
  title: "Goal",
  description: null,
  why: null,
  success: null,
  lifeAreaId: null,
  goalType: "outcome",
  metric: null,
  unit: null,
  cadence: "total",
  aggregation: "sum",
  progressSource: "manual",
  startValue: null,
  targetValue: null,
  currentValue: null,
  habitId: null,
  priority: 2,
  state: "active",
  deadline: null,
  completedAt: null,
  sortOrder: 0,
  createdOn: null,
};

const yearly = (p: Partial<YearlyGoal>): YearlyGoal => ({ ...core, level: "yearly", year: 2027, progressSource: "children", ...p });
const monthly = (p: Partial<MonthlyGoal>): MonthlyGoal => ({ ...core, level: "monthly", monthStart: "2026-11-01", parentYearlyId: null, ...p });
const weekly = (p: Partial<WeeklyGoal>): WeeklyGoal => ({ ...core, level: "weekly", weekStart: "2026-09-21", parentMonthlyId: null, isMajor: true, carriedFromId: null, goalType: "process", progressSource: "actions", ...p });

const noExec: ExecutionData = { workMinutes: new Map(), habitDays: new Map(), actionsByWeekly: new Map(), milestones: [] };

describe("periods", () => {
  it("gives each week to the month holding its Thursday", () => {
    // 1 Oct 2026 is a Thursday, so the week of 28 Sep belongs to October.
    expect(weeksOfMonth("2026-10-01")).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(weeksOfMonth("2026-11-01")[0]).toBe("2026-11-02");
    expect(monthOfWeek("2026-09-28")).toBe("2026-10-01");
    expect(weekRangeLabel("2026-09-28")).toBe("28 Sep – 4 Oct");
  });

  it("counts elapsed time by whole days", () => {
    expect(elapsedFraction({ start: "2026-11-01", end: "2026-11-30" }, "2026-11-20")).toBeCloseTo(20 / 30);
    expect(elapsedFraction({ start: "2026-11-01", end: "2026-11-30" }, "2026-10-20")).toBe(0);
  });
});

describe("goal health", () => {
  it("marks $7k of $20k on day 20 of 30 as behind, and says why in plain words", () => {
    const g = monthly({ targetValue: 20000, currentValue: 7000, startValue: 0, unit: "$" });
    const p = assess(g, 7000, noExec, "2026-11-20");
    expect(p.health).toBe("behind");
    expect(p.explanation).toBe("Below the pace needed to reach the target: 35% done with 67% of the time gone.");
  });

  it("is on track at pace, at risk just under it, complete at the target", () => {
    const g = monthly({ targetValue: 20000, startValue: 0, unit: "$" });
    expect(assess(g, 14000, noExec, "2026-11-20").health).toBe("on_track");
    expect(assess(g, 10000, noExec, "2026-11-20").health).toBe("at_risk");
    expect(assess(g, 20000, noExec, "2026-11-20").health).toBe("complete");
  });

  it("is not started before its period, or with nothing logged early on", () => {
    const g = monthly({ targetValue: 20000, startValue: 0, unit: "$" });
    expect(assess(g, 0, noExec, "2026-10-30").health).toBe("not_started");
    expect(assess(g, 0, noExec, "2026-11-03").health).toBe("not_started");
    // A week set on its Thursday isn't behind on that Thursday.
    const w = weekly({ targetValue: 2000, unit: "$", progressSource: "manual", createdOn: "2026-09-24" });
    expect(assess(w, 0, noExec, "2026-09-24").health).toBe("not_started");
  });

  it("paces a goal set part-way through its period from the day it was set", () => {
    // Set on 24 Sep for the year: nothing logged yet is "not started", not nine months behind.
    const g = yearly({ year: 2026, targetValue: 60000, startValue: 0, unit: "$", progressSource: "manual", createdOn: "2026-09-24" });
    expect(assess(g, 0, noExec, "2026-09-24").health).toBe("not_started");
    expect(assess(g, 0, noExec, "2026-09-24").expected).toBeLessThan(0.02);
    // A goal made before its period starts still counts from the period start.
    const early = monthly({ targetValue: 20000, startValue: 0, unit: "$", createdOn: "2026-10-15" });
    expect(assess(early, 7000, noExec, "2026-11-20").health).toBe("behind");
  });

  it("tracks a level from its starting point", () => {
    const g = yearly({ goalType: "performance", startValue: 160, targetValue: 180, unit: "kg", aggregation: "latest", progressSource: "manual" });
    expect(assess(g, 170, noExec, "2027-07-02").ratio).toBeCloseTo(0.5);
  });

  it("flags overdue milestones", () => {
    const g = yearly({ id: "y1", goalType: "milestone", progressSource: "milestones" });
    const exec = {
      ...noExec,
      milestones: [
        { id: "a", yearlyGoalId: "y1", monthlyGoalId: null, title: "Design", dueDate: "2027-02-01", done: true },
        { id: "b", yearlyGoalId: "y1", monthlyGoalId: null, title: "Build", dueDate: "2027-03-01", done: false },
      ],
    };
    const p = assess(g, null, exec, "2027-04-01");
    expect(p.ratio).toBe(0.5);
    expect(p.health).toBe("behind");
  });
});

describe("progress rolls up the hierarchy", () => {
  it("adds logged weekly revenue up through the month to the year", () => {
    const y = yearly({ id: "y", targetValue: 300000, startValue: 0, unit: "$" });
    const m = monthly({ id: "m", monthStart: "2027-01-01", parentYearlyId: "y", targetValue: 10000, unit: "$", progressSource: "children" });
    const w1 = weekly({ id: "w1", weekStart: "2027-01-04", parentMonthlyId: "m", unit: "$", targetValue: 2500, currentValue: 3000, progressSource: "manual" });
    const w2 = weekly({ id: "w2", weekStart: "2027-01-11", parentMonthlyId: "m", unit: "$", targetValue: 2500, currentValue: 1000, progressSource: "manual" });
    const leads = weekly({ id: "w3", weekStart: "2027-01-04", parentMonthlyId: "m", unit: "leads", targetValue: 30, isMajor: false });
    const exec = { ...noExec, actionsByWeekly: new Map([["w3", 15]]) };
    const out = evaluateGoals({ yearly: [y], monthly: [m], weekly: [w1, w2, leads] }, exec, "2027-01-14");
    expect(out.get("m")?.current).toBe(4000);
    expect(out.get("y")?.current).toBe(4000);
    expect(out.get("w3")?.current).toBe(15);
    expect(out.get("w3")?.ratio).toBe(0.5);
  });

  it("counts focused hours from the timer, and a weekly rate as an average", () => {
    const minutes = new Map([["2027-01-04", 600], ["2027-01-05", 600], ["2027-01-11", 1200]]);
    const exec = { ...noExec, workMinutes: minutes };
    const week = weekly({ id: "w", weekStart: "2027-01-04", unit: "hours", targetValue: 40, progressSource: "work_hours" });
    const year = yearly({ id: "y", goalType: "process", unit: "hours", targetValue: 40, cadence: "per_week", progressSource: "work_hours" });
    const out = evaluateGoals({ yearly: [year], monthly: [], weekly: [week] }, exec, "2027-01-14");
    expect(out.get("w")?.current).toBe(20);
    expect(out.get("w")?.ratio).toBe(0.5);
    // 40 hours over the first 14 days = 20 hours a week against 40.
    expect(out.get("y")?.current).toBeCloseTo(20);
    expect(out.get("y")?.health).toBe("behind");
  });
});

describe("year → month breakdown", () => {
  it("ramps a revenue target up across the year and adds back to it exactly", () => {
    const g = yearly({ title: "Build a $300k business", metric: "Revenue", targetValue: 300000, startValue: 0, unit: "$" });
    const months = yearToMonths(g, "2026-09-24");
    expect(months).toHaveLength(12);
    expect(months[0].periodStart).toBe("2027-01-01");
    const values = months.map((m) => m.targetValue!);
    expect(values.reduce((s, v) => s + v, 0)).toBe(300000);
    expect(values[0]).toBeLessThan(values[11]);
    expect(values[11] / values[0]).toBeGreaterThan(2);
    expect(months[0].title).toBe(`${formatValue(values[0], "$")} revenue`);
    expect(months[0].progressSource).toBe("children");
  });

  it("only plans the months that are left in the current year", () => {
    const g = yearly({ year: 2026, metric: "Revenue", targetValue: 60000, startValue: 0, unit: "$" });
    const months = yearToMonths(g, "2026-09-24");
    expect(months.map((m) => m.periodStart)).toEqual(["2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"]);
  });

  it("gives the month already under way a smaller share", () => {
    const g = yearly({ year: 2026, metric: "Revenue", targetValue: 60000, startValue: 0, unit: "$" });
    const [sep, oct] = yearToMonths(g, "2026-09-24").map((m) => m.targetValue!);
    // 7 of September's 30 days are left, so it gets far less than a full month.
    expect(sep).toBeLessThan(oct / 3);
    const hours = yearly({ year: 2026, goalType: "process", metric: "Focused hours", targetValue: 40, unit: "hours", cadence: "per_week", progressSource: "work_hours" });
    expect(yearToMonths(hours, "2026-09-24")[0].targetValue).toBe(40); // 40 × 7/7
  });

  it("climbs a lift in plate-sized steps and ends on the target", () => {
    const g = yearly({ goalType: "performance", metric: "Bench press", startValue: 160, targetValue: 180, unit: "kg", aggregation: "latest" });
    const values = yearToMonths(g, "2026-09-24").map((m) => m.targetValue!);
    expect(values[11]).toBe(180);
    expect(values.every((v) => v % 2.5 === 0)).toBe(true);
    expect(values.every((v, i) => i === 0 || v >= values[i - 1])).toBe(true);
    // front-loaded: more of the gain in the first half
    expect(values[5] - 160).toBeGreaterThan(10);
  });

  it("turns a weekly rate into each month's total", () => {
    const g = yearly({ goalType: "process", metric: "Focused hours", targetValue: 40, unit: "hours", cadence: "per_week", progressSource: "work_hours" });
    const jan = yearToMonths(g, "2026-09-24")[0];
    expect(jan.targetValue).toBe(175); // 40 × 31/7 = 177 → nearest 5
    expect(jan.progressSource).toBe("work_hours");
    expect(jan.title).toBe("175 focused hours");
  });

  it("gives a yes/no goal a preparation month and a finishing month", () => {
    const g = yearly({ goalType: "binary", title: "Become a catechumen", deadline: "2027-06-30" });
    expect(yearToMonths(g, "2026-09-24").map((m) => [m.periodStart, m.title])).toEqual([
      ["2027-05-01", "Prepare: Become a catechumen"],
      ["2027-06-01", "Become a catechumen"],
    ]);
  });

  it("splits totals exactly despite rounding", () => {
    expect(distribute(1000, [1, 1, 1], null).reduce((s, v) => s + v, 0)).toBe(1000);
  });
});

describe("month → week breakdown", () => {
  it("splits a monthly revenue target across its weeks and suggests business activities", () => {
    const m = monthly({ monthStart: "2026-10-01", metric: "Revenue", title: "Generate $20k", targetValue: 20000, startValue: 0, unit: "$", progressSource: "children" });
    const drafts = monthToWeeks(m, "Business", "2026-09-24");
    const majors = drafts.filter((d) => d.isMajor);
    expect(majors).toHaveLength(5);
    expect(majors.reduce((s, d) => s + d.targetValue!, 0)).toBe(20000);
    expect(majors[0].progressSource).toBe("manual");
    const activities = drafts.filter((d) => !d.isMajor && d.periodStart === "2026-09-28").map((d) => d.title);
    expect(activities).toContain("Contact prospects");
    expect(activities).toContain("Run sales calls");
    expect(drafts.find((d) => d.title === "Contact prospects")?.progressSource).toBe("actions");
  });

  it("uses the timer for hours and daily actions for counted activities", () => {
    expect(sourceFor("weekly", { progressSource: "work_hours", unit: "hours" })).toBe("work_hours");
    expect(sourceFor("weekly", { progressSource: "children", unit: "leads" })).toBe("actions");
    expect(sourceFor("weekly", { progressSource: "children", unit: "$" })).toBe("manual");
    expect(sourceFor("monthly", { progressSource: "children", unit: "$" })).toBe("children");
  });
});

describe("goal quality check", () => {
  const base = { goalType: "outcome" as const, unit: "$", metric: "Revenue", startValue: 0, targetValue: 300000, cadence: "total" as const, deadline: null, year: 2027, why: "Provide for my family", success: null, areaName: "Business", monthsLeft: 12 };

  it("spots vague goals", () => {
    expect(isVague("Get fit")).toBe(true);
    expect(isVague("Read more")).toBe(true);
    expect(isVague("Be productive")).toBe(true);
    expect(isVague("Bench 180 kg")).toBe(false);
    expect(isVague("Launch the new website")).toBe(false);
  });

  it("flags an outcome goal and offers a process goal to go with it", () => {
    const { flags, process } = checkGoal({ ...base, title: "$300,000 annual revenue" });
    const control = flags.find((f) => f.key === "control")!;
    expect(control.ok).toBe(false);
    expect(control.message).toContain("You can't directly control the outcome");
    expect(process?.title).toBe("Complete 10 focused business-development hours a week");
    expect(flags.find((f) => f.key === "specific")?.ok).toBe(true);
  });

  it("asks for a reason and a number, and never rejects", () => {
    const { flags } = checkGoal({ ...base, title: "Get fit", goalType: "performance", unit: null, targetValue: null, why: "", areaName: "Fitness" });
    expect(flags.find((f) => f.key === "reason")?.ok).toBe(false);
    expect(flags.find((f) => f.key === "measurable")?.ok).toBe(false);
    expect(flags.find((f) => f.key === "specific")?.ok).toBe(false);
  });

  it("calls a big jump ambitious rather than impossible", () => {
    const { flags } = checkGoal({ ...base, title: "Bench 250 kg", goalType: "performance", unit: "kg", startValue: 160, targetValue: 250, areaName: "Fitness" });
    const realistic = flags.find((f) => f.key === "realistic")!;
    expect(realistic.ok).toBe(false);
    expect(realistic.message).toContain("Ambitious is fine");
  });
});

describe("what should I do today?", () => {
  const progress = (current: number, health: "on_track" | "behind" = "on_track") => ({ current, ratio: 0, expected: 0.4, health, explanation: "" });
  const y = yearly({ id: "y", title: "Build a $300k business", priority: 1 });
  const m = monthly({ id: "m", title: "Generate $20k", monthStart: "2026-10-01" });
  const ctx = (goal: WeeklyGoal, current = 0, unblocks: string[] = [], health: "on_track" | "behind" = "on_track"): WeeklyContext => ({
    goal,
    progress: progress(current, health),
    monthly: m,
    monthlyProgress: progress(0),
    yearly: y,
    unblocks,
  });
  const leads = weekly({ id: "leads", title: "Follow up with previous leads", unit: "leads", targetValue: 30, weekStart: "2026-09-21", isMajor: true, priority: 1 });
  const hours = weekly({ id: "hours", title: "40 focused hours", unit: "hours", targetValue: 40, progressSource: "work_hours", isMajor: false });
  const offer = weekly({ id: "offer", title: "Finish the offer revision", goalType: "binary", isMajor: false, targetValue: null });
  const gym = weekly({ id: "gym", title: "Training sessions", unit: "sessions", targetValue: 4, isMajor: false, priority: 3 });

  it("splits what's left across the days left and ranks the Big 3", () => {
    const { big3, supporting } = suggestToday({
      today: "2026-09-23", // Wednesday: 5 days left including today
      weekly: [ctx(leads), ctx(hours, 10), ctx(offer, 0, ["Launch the campaign"]), ctx(gym, 1)],
      todayActions: [],
      unfinished: [],
      availableMinutes: 600,
    });
    expect(big3).toHaveLength(3);
    expect(big3[0].title).toBe("Follow up with previous leads");
    expect(big3[0].quantity).toBe(6);
    expect(big3.map((s) => s.weeklyGoalId)).toContain("offer");
    expect(big3.find((s) => s.weeklyGoalId === "offer")?.reasons).toContain("Needed before Launch the campaign");
    const deep = [...big3, ...supporting].find((s) => s.weeklyGoalId === "hours")!;
    expect(deep.createsWorkBlock).toBe(true);
    expect(deep.title).toBe("4 × 90-minute deep work blocks");
    expect(supporting.length).toBe(1);
  });

  it("brings back unfinished actions, and skips goals already planned today", () => {
    const earlier: DailyGoal = {
      id: "d1", localDate: "2026-09-21", parentWeeklyId: "leads", title: "Follow up with previous leads", quantity: 10, unit: "leads",
      estimatedMinutes: 40, rank: 1, status: "pending", source: "suggested", workBlockId: null, carriedFromId: null, completedAt: null,
    };
    const planned: DailyGoal = { ...earlier, id: "d2", localDate: "2026-09-23", parentWeeklyId: "gym", title: "Training sessions", status: "pending" };
    const { big3, supporting } = suggestToday({
      today: "2026-09-23",
      weekly: [ctx(leads), ctx(gym, 1)],
      todayActions: [planned],
      unfinished: [earlier],
      availableMinutes: 600,
    });
    const all = [...big3, ...supporting];
    expect(all.filter((s) => s.weeklyGoalId === "leads")).toHaveLength(1);
    expect(all[0].carriedFromId).toBe("d1");
    expect(all[0].reasons[0]).toBe("Left from Mon 21 Sep");
    expect(all.some((s) => s.weeklyGoalId === "gym")).toBe(false);
  });

  it("puts what doesn't fit the time left below what does", () => {
    const { big3, supporting } = suggestToday({
      today: "2026-09-23",
      weekly: [ctx(hours, 0), ctx(gym, 0)],
      todayActions: [],
      unfinished: [],
      availableMinutes: 90,
    });
    expect(big3[0].weeklyGoalId).toBe("gym");
    expect([...big3, ...supporting].find((s) => s.weeklyGoalId === "hours")?.reasons).toContain("More than the time left today");
  });
});

describe("formatting", () => {
  it("formats money and units", () => {
    expect(formatValue(300000, "$")).toBe("$300,000");
    expect(formatValue(162.5, "kg")).toBe("162.5 kg");
    expect(formatCompact(300000, "$")).toBe("$300k");
    expect(formatTarget({ goalType: "process", targetValue: 40, unit: "hours", cadence: "per_week" })).toBe("40 hours a week");
  });
});
