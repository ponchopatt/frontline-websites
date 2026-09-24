import { describe, expect, it } from "vitest";
import { GOAL_TEMPLATES, goalsToAdd, roundGoal, suggestedTarget, type WelcomeGoalKey } from "./welcome";

const template = (key: WelcomeGoalKey) => GOAL_TEMPLATES.find((t) => t.key === key)!;

describe("setup's suggested targets", () => {
  it("rounds to two significant figures", () => {
    expect(roundGoal(67_308)).toBe(67_000);
    expect(roundGoal(80.77)).toBe(81);
    expect(roundGoal(6.46)).toBe(6);
    expect(roundGoal(0)).toBe(0);
  });

  it("gives this year its share of the weeks left", () => {
    // 24 Sep to 31 Dec is 14 weeks.
    expect(suggestedTarget(template("imperium"), 2026, "2026-09-24")).toBe(67_000);
    expect(suggestedTarget(template("websites"), 2026, "2026-09-24")).toBe(6);
    expect(suggestedTarget(template("faith"), 2026, "2026-09-24")).toBe(81);
  });

  it("gives a year ahead all of it", () => {
    expect(suggestedTarget(template("imperium"), 2027, "2026-09-24")).toBe(250_000);
    expect(suggestedTarget(template("fitness"), 2027, "2026-09-24")).toBe(250);
  });

  it("keeps a percentage and a finish line as they are", () => {
    expect(suggestedTarget(template("discipline"), 2026, "2026-09-24")).toBe(85);
    expect(suggestedTarget(template("trading"), 2026, "2026-09-24")).toBeNull();
  });

  it("offers the full year once the counter has entries, since the goal counts them", () => {
    expect(suggestedTarget(template("imperium"), 2026, "2026-09-24", 80_000)).toBe(250_000);
    expect(suggestedTarget(template("websites"), 2026, "2026-09-24", 3)).toBe(24);
    expect(suggestedTarget(template("imperium"), 2026, "2026-09-24", 0)).toBe(67_000);
  });

  it("never suggests less than one", () => {
    expect(suggestedTarget(template("websites"), 2026, "2026-12-31")).toBe(1);
  });

  it("names only the goals a counter measures", () => {
    expect(GOAL_TEMPLATES.filter((t) => t.counter).map((t) => [t.area, t.counter])).toEqual([
      ["imperium", "revenue"],
      ["websites", "closed"],
    ]);
  });
});

describe("the goals setup adds", () => {
  const sent = [
    { title: "Make $67,000 in Imperium revenue", life_area_id: "imperium" },
    { title: "Sell 6 websites", life_area_id: "websites" },
    { title: "Finish the AI trading bot and run it live", life_area_id: "trading" },
  ];

  it("adds them all to an empty year", () => {
    expect(goalsToAdd(sent, [])).toEqual(sent);
  });

  it("adds nothing when they're all there already (a retry after a lost reply)", () => {
    expect(goalsToAdd(sent, sent)).toEqual([]);
  });

  it("skips an area that already has a goal, whatever it's called", () => {
    // Redo setup a few weeks on suggests a smaller number, so the title no longer matches.
    const kept = goalsToAdd(sent, [{ title: "Sell 5 websites", life_area_id: "websites" }]);
    expect(kept.map((g) => g.life_area_id)).toEqual(["imperium", "trading"]);
  });

  it("skips a name already used, ignoring case and spaces", () => {
    const kept = goalsToAdd(sent, [{ title: "  finish the AI trading bot and run it LIVE ", life_area_id: null }]);
    expect(kept.map((g) => g.life_area_id)).toEqual(["imperium", "websites"]);
  });

  it("doesn't treat goals without an area as the same area", () => {
    const kept = goalsToAdd([{ title: "Save $20,000", life_area_id: null }], [{ title: "Run a marathon", life_area_id: null }]);
    expect(kept).toHaveLength(1);
  });

  it("adds one goal per area and name even if sent twice", () => {
    expect(goalsToAdd([...sent, ...sent], [])).toEqual(sent);
  });
});
