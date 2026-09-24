import { describe, expect, it } from "vitest";
import { closeSummary, type CloseInput } from "../../lib/close-day";
import { addDays, type LocalDate } from "../../lib/day";
import type { TaskItem, WorkSessionItem } from "../../lib/types";
import { gymWeekNudge, thingsDone, withEnded, withTask } from "./helpers";

const MONDAY = "2026-09-21";
const TODAY = "2026-09-24"; // a Thursday

/** A week of gym days: "d" done, "o" due and not done, "-" a rest day. */
function week(days: string): Array<{ date: LocalDate; due: boolean; done: boolean }> {
  return [...days].map((c, i) => ({ date: addDays(MONDAY, i), due: c !== "-", done: c === "d" }));
}

function task(id: string, p: Partial<TaskItem> = {}): TaskItem {
  return {
    id,
    localDate: TODAY,
    title: id,
    area: null,
    category: null,
    rank: null,
    status: "pending",
    priority: 2,
    dueDate: null,
    notes: null,
    quantity: null,
    unit: null,
    metricId: null,
    weeklyGoalId: null,
    carriedFromId: null,
    completedAt: null,
    chain: null,
    proofCount: 0,
    ...p,
  };
}

function session(id: string, p: Partial<WorkSessionItem> = {}): WorkSessionItem {
  return { id, blockId: null, area: "imperium", localDate: TODAY, startedAt: `${TODAY}T01:00:00Z`, endedAt: null, note: null, ...p };
}

describe("one more gym session", () => {
  it("says so only when one more session makes the week", () => {
    // Mon to Thu, three done, today still open.
    expect(gymWeekNudge(week("dddo---"), TODAY)).toBe("One more gym session this week.");
    // Mon to Thu, only Monday done: one more is still 2 of 4.
    expect(gymWeekNudge(week("dooo---"), TODAY)).toBeNull();
    // Mon to Fri on Friday, 2 of 5.
    expect(gymWeekNudge(week("ddooo--"), "2026-09-25")).toBeNull();
  });

  it("stays quiet with no due day left, with nothing done yet, and once the week is made", () => {
    expect(gymWeekNudge(week("ddo----"), TODAY)).toBeNull();
    expect(gymWeekNudge(week("---o---"), TODAY)).toBeNull();
    expect(gymWeekNudge(week("dddd---"), TODAY)).toBeNull();
  });

  it("counts a session on a rest day toward the week", () => {
    const w = week("dd-o-o-").map((d) => (d.date === "2026-09-23" ? { ...d, done: true } : d));
    expect(gymWeekNudge(w, TODAY)).toBe("One more gym session this week.");
  });
});

describe("today's lists", () => {
  it("adds a task once, however many times the answer comes back", () => {
    const list = [task("a")];
    const once = withTask(list, task("b"));
    expect(once.map((t) => t.id)).toEqual(["a", "b"]);
    expect(withTask(once, task("b", { title: "B" })).map((t) => t.title)).toEqual(["a", "B"]);
    expect(withTask(list, task("c", { localDate: null }), "start").map((t) => t.id)).toEqual(["c", "a"]);
  });

  it("ends a session in place, and adds one started on another device", () => {
    const running = session("s1");
    const ended = withEnded([running], running, `${TODAY}T02:00:00Z`, TODAY);
    expect(ended).toEqual([{ ...running, endedAt: `${TODAY}T02:00:00Z` }]);

    const elsewhere = { ...session("s2", { area: "websites" }), task: "Demo site" };
    const added = withEnded(ended, elsewhere, `${TODAY}T03:00:00Z`, TODAY);
    expect(added).toHaveLength(2);
    expect(added[1]).toEqual(session("s2", { area: "websites", endedAt: `${TODAY}T03:00:00Z` }));

    // One from another day stays out of this day's list.
    expect(withEnded(ended, session("s3", { localDate: "2026-09-23" }), `${TODAY}T03:00:00Z`, TODAY)).toBe(ended);
  });
});

describe("a closed day", () => {
  const base: CloseInput = {
    made: 22,
    kept: 7,
    percent: 32,
    threshold: 80,
    workMinutes: 0,
    workTargetMinutes: 480,
    byArea: {},
    tasks: { done: 2, total: 5 },
    big3: { done: 1, total: 3 },
    habits: { done: 5, total: 17 },
    morning: { done: 3, total: 8 },
    faithDone: 1,
    faithTotal: 3,
    gym: false,
    cardio: false,
    cardioMinutes: 0,
    counters: [],
    reviewDone: false,
    minimum: null,
    records: [],
  };

  it("counts the tasks and habits done, not the milestones", () => {
    const s = closeSummary(base);
    expect(s.achievements).toEqual([]);
    expect(thingsDone(s)).toBe("7 things done");
    expect(thingsDone(closeSummary({ ...base, tasks: { done: 0, total: 5 }, habits: { done: 1, total: 17 } }))).toBe("1 thing done");
  });

  it("leaves the count out when nothing was done", () => {
    expect(thingsDone(closeSummary({ ...base, tasks: { done: 0, total: 5 }, habits: { done: 0, total: 17 } }))).toBeNull();
    expect(thingsDone(null)).toBeNull();
  });
});
