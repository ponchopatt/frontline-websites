/**
 * The goal system's full loop, against the real app and a real (local) Supabase:
 * yearly goal → monthly plan → weekly plan → today's actions → done → progress rolls up →
 * weekly review → what's left carries into next week. Run: npm run test:e2e
 */
import { expect, test, type Locator } from "@playwright/test";
import { startOfWeek } from "../src/lib/day";
import { formatValue } from "../src/lib/goals/format";
import { monthOfWeek } from "../src/lib/goals/periods";
import { addDays, admin, signUp, today, waitForApp } from "./helpers";

/** Waits until React has hydrated the element, so typing into it isn't lost. */
async function ready(locator: Locator) {
  await expect(locator).toBeVisible();
  await locator.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        const check = () => (Object.keys(el).some((k) => k.startsWith("__reactProps")) ? resolve() : setTimeout(check, 50));
        check();
      }),
  );
}

test("goals: plan a year down to today, do the work, see progress, review the week", async ({ page }) => {
  test.setTimeout(180_000);
  const date = today();
  const week = startOfWeek(date);
  const month = monthOfWeek(week);
  const year = Number(month.slice(0, 4));
  test.skip(year !== Number(date.slice(0, 4)), "The first days of January belong to December's last week.");

  const { userId } = await signUp(page);
  // Label and text lookups are scoped to <main>: while a page streams in, React briefly holds a
  // hidden copy of it outside <main>. Role lookups already skip hidden elements.
  const main = page.locator("main");

  // 1. A yearly goal. The quality check flags the outcome goal and offers a process goal.
  await page.goto(`/goals/new?year=${year}`);
  await ready(page.getByRole("button", { name: "Save goal" }));
  await main.getByLabel("Area of life").selectOption({ label: "Business" });
  await main.getByLabel("Goal", { exact: true }).fill("$60,000 revenue from demo sites");
  await main.getByLabel("Measured as").fill("Revenue");
  await main.getByLabel("Unit").fill("$");
  await main.getByLabel("Starting at").fill("0");
  await main.getByLabel("Target").fill("60000");
  await expect(main.getByText(/This is an outcome goal\. You can't directly control the outcome/)).toBeVisible();
  await expect(main.getByText("Also add the process goal that drives it:")).toBeVisible();
  await main.getByLabel("Why it matters").fill("To provide for my family.");
  await page.getByRole("button", { name: "Save goal" }).click();
  await page.waitForURL(/\/goals\/year\/[0-9a-f-]{36}$/);
  const yearlyId = page.url().split("/").pop()!;

  const { data: yearly } = await admin.from("yearly_goals").select("id,goal_type,target_value,why").eq("user_id", userId);
  expect(yearly).toHaveLength(2);
  const goal = yearly!.find((y) => y.id === yearlyId)!;
  expect(goal.goal_type).toBe("outcome");
  expect(Number(goal.target_value)).toBe(60000);
  expect(goal.why).toBe("To provide for my family.");
  expect(yearly!.some((y) => y.goal_type === "process")).toBe(true);

  // 2. Break it into months. The months add back up to the year, and this month is small
  //    when little of it is left.
  const breakDown = page.getByRole("button", { name: "Break down goal" });
  await ready(breakDown);
  await breakDown.click();
  await page.getByRole("button", { name: /^Save monthly plan/ }).click();
  await expect(page.getByText(/^Saved \d+ goals?\.$/)).toBeVisible();
  const { data: months } = await admin.from("monthly_goals").select("id,title,month_start,target_value,parent_yearly_goal_id").eq("user_id", userId).order("month_start");
  expect(months!.length).toBeGreaterThan(0);
  expect(months!.every((m) => m.parent_yearly_goal_id === yearlyId)).toBe(true);
  expect(months!.reduce((s, m) => s + Number(m.target_value), 0)).toBe(60000);
  const thisMonth = months!.find((m) => m.month_start === month)!;
  expect(thisMonth).toBeTruthy();

  // 3. Break this month into weeks, with activities that drive it.
  await page.goto(`/goals/month/${month.slice(0, 7)}`);
  const generate = page.getByRole("button", { name: "Generate weekly plan" });
  await ready(generate);
  await generate.click();
  await page.getByRole("button", { name: /^Save weekly plan/ }).click();
  await expect(page.getByText(/^Saved \d+ goals?\.$/)).toBeVisible();
  const { data: weekly } = await admin.from("weekly_goals").select("*").eq("user_id", userId).eq("week_start", week);
  const revenue = weekly!.find((w) => w.is_major && w.unit === "$")!;
  expect(revenue).toBeTruthy();
  expect(revenue.parent_monthly_goal_id).toBe(thisMonth.id);
  const activities = weekly!.filter((w) => !w.is_major && w.progress_source === "actions");
  expect(activities.length).toBeGreaterThan(0);

  // 4. Today suggests the Big 3 from this week's goals, each tied back to the year.
  await page.goto("/");
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: "What should I do today?" })).toBeVisible();
  const accept = page.getByRole("button", { name: /^Make (these today's Big \d|it today's #1)$/ });
  await ready(accept);
  await accept.click();
  await expect
    .poll(async () => (await admin.from("daily_goals").select("id").eq("user_id", userId).eq("local_date", date).not("rank", "is", null)).data?.length)
    .toBeGreaterThan(0);
  const { data: ranked } = await admin
    .from("daily_goals")
    .select("id,title,quantity,parent_weekly_goal_id,rank")
    .eq("user_id", userId)
    .eq("local_date", date)
    .not("rank", "is", null)
    .order("rank");
  const { data: priorities } = await admin.from("daily_priorities").select("position,title,daily_goal_id").eq("user_id", userId).eq("local_date", date).order("position");
  expect(priorities!.map((p) => p.daily_goal_id)).toEqual(ranked!.map((r) => r.id));
  expect(priorities!.map((p) => p.title)).toEqual(ranked!.map((r) => r.title));
  await expect(page.locator("#mission").getByText("$60,000 revenue from demo sites").first()).toBeVisible();

  // 5. Do the work: finishing a priority finishes its action.
  for (const r of ranked!) await page.getByRole("checkbox", { name: `Mark "${r.title}" done` }).click();
  await expect
    .poll(async () => (await admin.from("daily_goals").select("status").in("id", ranked!.map((r) => r.id))).data?.every((d) => d.status === "done"))
    .toBe(true);

  // 6. The week counts the finished actions.
  const counted = ranked!.find((r) => activities.some((a) => a.id === r.parent_weekly_goal_id))!;
  expect(counted).toBeTruthy();
  const activity = activities.find((a) => a.id === counted.parent_weekly_goal_id)!;
  await page.goto(`/goals/week/${week}`);
  const activityBar = page.getByRole("progressbar", { name: `${activity.title} progress` }).first();
  await expect(activityBar).toHaveAttribute("aria-valuenow", String(Math.round((100 * Number(counted.quantity ?? 1)) / Number(activity.target_value))));

  // 7. Log this week's revenue; it rolls up to the month and the year.
  const logged = Math.max(1, Math.round(Number(revenue.target_value) / 4));
  const log = main.locator(`#log-${revenue.id}`);
  await ready(log);
  await log.fill(String(logged));
  await main.locator(`form:has(#log-${revenue.id})`).getByRole("button", { name: "Update" }).click();
  await expect(page.getByRole("progressbar", { name: `${revenue.title} progress` }).first()).toHaveAttribute(
    "aria-valuenow",
    String(Math.round((100 * logged) / Number(revenue.target_value))),
  );
  await page.goto(`/goals/month/${month.slice(0, 7)}`);
  await expect(page.getByRole("progressbar", { name: `${thisMonth.title} progress` }).first()).toHaveAttribute(
    "aria-valuenow",
    String(Math.round((100 * logged) / Number(thisMonth.target_value))),
  );
  await page.goto(`/goals/year/${yearlyId}`);
  await expect(main.getByText(`${formatValue(logged, "$")} of $60,000`).first()).toBeVisible();

  // 8. Review the week early: revenue fell short, so say why and carry what's left forward.
  await page.goto(`/goals/week/${week}?review=now`);
  const item = main.locator("form li").filter({ has: page.getByRole("radiogroup", { name: `How did “${revenue.title}” go?` }) });
  await expect(item.getByRole("radio", { name: /^partial$/i })).toHaveAttribute("aria-checked", "true");
  await ready(item.getByLabel("Why wasn't this completed?"));
  await item.getByLabel("Why wasn't this completed?").selectOption("underestimated_time");
  await expect(item.getByRole("radio", { name: /Carry forward/ })).toBeChecked();
  await main.getByLabel("What went well?").fill("Called every lead on the list.");
  await main.getByLabel("What did I learn?").fill("Sales calls take longer than I plan for.");
  await page.getByRole("button", { name: "Complete review" }).click();
  await expect(main.getByText("Partly done · Underestimated the time · Carry forward")).toBeVisible();

  const { data: review } = await admin.from("goal_reviews").select("*").eq("weekly_goal_id", revenue.id).single();
  expect(review).toMatchObject({ period: "week", outcome: "partial", reason: "underestimated_time", decision: "carry_forward" });
  expect(Number(review!.actual_value)).toBe(logged);
  const { data: closed } = await admin.from("weekly_goals").select("state").eq("id", revenue.id).single();
  expect(closed!.state).toBe("missed");
  const { data: weekReview } = await admin.from("weekly_reviews").select("wins,lessons,completed_at").eq("user_id", userId).eq("week_start_date", week).single();
  expect(weekReview!.wins).toBe("Called every lead on the list.");
  expect(weekReview!.completed_at).not.toBeNull();

  // 9. Next week has the carried goal, with only what's left.
  const left = Number(revenue.target_value) - logged;
  const { data: carried } = await admin.from("weekly_goals").select("*").eq("carried_from_id", revenue.id).single();
  expect(carried!.week_start).toBe(addDays(week, 7));
  expect(Number(carried!.target_value)).toBe(left);
  expect(carried!.state).toBe("active");
  expect(carried!.title).toBe(revenue.title.replace(formatValue(Number(revenue.target_value), "$"), formatValue(left, "$")));

  await page.getByRole("link", { name: "Plan next week" }).click();
  await page.waitForURL(`/goals/week/${addDays(week, 7)}`);
  const carriedRow = main.locator("li").filter({ hasText: carried!.title }).filter({ hasText: "carried" }).first();
  await expect(carriedRow.getByText("carried", { exact: true })).toBeVisible();
  await expect(carriedRow.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
});
