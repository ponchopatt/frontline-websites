/**
 * The goal system's full loop, against the real app and a real (local) Supabase:
 * yearly goal → monthly plan → weekly plan → today's actions → done → progress rolls up →
 * weekly review → what's left carries into next week. Then a counter goal carried forward, and
 * a Keep My Word goal measured from the days. Run: npm run test:e2e
 */
import { expect, test, type Locator } from "@playwright/test";
import { fromZonedTime } from "date-fns-tz";
import { shortDate, startOfWeek } from "../src/lib/day";
import { formatValue } from "../src/lib/goals/format";
import { monthOfWeek, monthStartOf } from "../src/lib/goals/periods";
import { TZ, addDays, admin, backdateAccount, completeEverything, signUp, today, waitForApp } from "./helpers";

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
  test.skip(month < monthStartOf(date), "This week belongs to last month, and a year's breakdown starts at this month.");

  const { userId } = await signUp(page);
  // Label and text lookups are scoped to <main>: while a page streams in, React briefly holds a
  // hidden copy of it outside <main>. Role lookups already skip hidden elements.
  const main = page.locator("main");

  // 1. A yearly goal. The quality check flags the outcome goal and offers a process goal.
  await page.goto(`/goals/new?year=${year}`);
  await ready(page.getByRole("button", { name: "Save goal" }));
  await main.getByLabel("Area of life").selectOption({ label: "Websites" });
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
  // The website activities are measured by the business counters on Today.
  const activities = weekly!.filter((w) => !w.is_major && w.progress_source === "metric");
  expect(activities.length).toBeGreaterThan(0);
  expect(activities.every((a) => a.metric_id)).toBe(true);

  // 4. Plan my day turns this week's goals into today's Big 3 and supporting tasks.
  await page.goto("/");
  await waitForApp(page);
  const plan = page.getByRole("button", { name: "Plan my day" });
  await ready(plan);
  await plan.click();
  const planDialog = page.getByRole("dialog", { name: "Plan my day" });
  await planDialog.getByRole("button", { name: "Use this plan" }).click();
  // The plan saves task by task; the sheet closes once all of it is in.
  await expect(page.getByText("Today is planned.")).toBeVisible();
  await expect(planDialog).toBeHidden();
  const { data: planned } = await admin
    .from("daily_goals")
    .select("id,title,quantity,parent_weekly_goal_id,rank,metric_id")
    .eq("user_id", userId)
    .eq("local_date", date)
    .order("rank", { nullsFirst: false });
  expect(planned!.filter((t) => t.rank !== null).length).toBeLessThanOrEqual(3);
  expect(planned!.length).toBeLessThanOrEqual(7);
  await expect(page.locator("#big3").getByText("$60,000 revenue from demo sites").first()).toBeVisible();
  // With goals, tasks and their chains on screen, Today still fits the phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // 5. Do the work: every planned task ticked off.
  for (const t of planned!) await page.getByRole("checkbox", { name: `Mark "${t.title}" done` }).click();
  await expect
    .poll(async () => (await admin.from("daily_goals").select("status").in("id", planned!.map((t) => t.id))).data?.every((d) => d.status === "done"))
    .toBe(true);
  const ranked = planned!;

  // 6. The week counts the finished actions.
  const counted = ranked!.find((r) => activities.some((a) => a.id === r.parent_weekly_goal_id))!;
  expect(counted).toBeTruthy();
  const activity = activities.find((a) => a.id === counted.parent_weekly_goal_id)!;
  await page.goto(`/goals/week/${week}`);
  const activityBar = page.getByRole("progressbar", { name: `${activity.title} progress` }).first();
  // Ticking a counter task brings its counter up to the task's number; the week reads the counter.
  await expect(activityBar).toHaveAttribute("aria-valuenow", String(Math.min(100, Math.round((100 * Number(counted.quantity ?? 1)) / Number(activity.target_value)))));

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
  await main.getByLabel("Biggest win").fill("Called every lead on the list.");
  await main.getByLabel("Biggest failure").fill("Sales calls took longer than I planned for.");
  await page.getByRole("button", { name: "Complete review" }).click();
  await expect(main.getByText("Partly done · Underestimated the time · Carry forward")).toBeVisible();

  const { data: review } = await admin.from("goal_reviews").select("*").eq("weekly_goal_id", revenue.id).single();
  expect(review).toMatchObject({ period: "week", outcome: "partial", reason: "underestimated_time", decision: "carry_forward" });
  expect(Number(review!.actual_value)).toBe(logged);
  const { data: closed } = await admin.from("weekly_goals").select("state").eq("id", revenue.id).single();
  expect(closed!.state).toBe("missed");
  const { data: weekReview } = await admin.from("weekly_reviews").select("wins,failure,completed_at").eq("user_id", userId).eq("week_start_date", week).single();
  expect(weekReview!.wins).toBe("Called every lead on the list.");
  expect(weekReview!.failure).toBe("Sales calls took longer than I planned for.");
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

test("goals: a counter goal carried into next week keeps its counter", async ({ page }) => {
  const date = today();
  const week = startOfWeek(date);
  const last = addDays(week, -7);
  const { userId } = await signUp(page);
  await backdateAccount(userId, 8);
  const main = page.locator("main");

  // Last week: 60 leads, measured by the leads counter. 10 were called then, and 20 today.
  const { data: leads } = await admin.from("metrics").select("id").eq("user_id", userId).eq("area", "imperium").eq("key", "leads_called").single();
  const { data: goal } = await admin
    .from("weekly_goals")
    .insert({ user_id: userId, week_start: last, title: "Call 60 qualified leads this week", goal_type: "process", unit: "leads", progress_source: "metric", metric_id: leads!.id, target_value: 60, is_major: true })
    .select("id")
    .single();
  await admin.from("metric_entries").insert([
    { user_id: userId, metric_id: leads!.id, local_date: last, value: 10 },
    { user_id: userId, metric_id: leads!.id, local_date: date, value: 20 },
  ]);

  // Close last week. Carrying what's left forward is the default.
  await page.goto(`/goals/week/${last}`);
  const item = main.locator("form li").filter({ has: page.getByRole("radiogroup", { name: "How did “Call 60 qualified leads this week” go?" }) });
  await expect(item.getByRole("radio", { name: /^partial$/i })).toHaveAttribute("aria-checked", "true");
  await expect(item.getByRole("radio", { name: /Carry forward/ })).toBeChecked();
  const complete = page.getByRole("button", { name: "Complete review" });
  await ready(complete);
  await complete.click();
  await expect(main.getByText("Partly done · Carry forward")).toBeVisible();

  // This week's goal is still measured by the counter, and its name says what's left.
  const { data: carried } = await admin.from("weekly_goals").select("*").eq("carried_from_id", goal!.id).single();
  expect(carried).toMatchObject({ week_start: week, progress_source: "metric", metric_id: leads!.id, title: "Call 50 qualified leads this week" });
  expect(Number(carried!.target_value)).toBe(50);

  await page.goto(`/goals/week/${week}`);
  const row = main.locator("li").filter({ hasText: "Call 50 qualified leads this week" }).filter({ hasText: "carried" }).first();
  await expect(row).toContainText("20 leads of 50 leads");
  await expect(row.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
});

test("goals: keep my word on 85% of days is measured from the days themselves", async ({ page }) => {
  const date = today();
  const [d3, d1] = [addDays(date, -3), addDays(date, -1)];
  test.skip(d3.slice(0, 4) !== date.slice(0, 4), "The goal is for this year, and it was set last year.");
  const { userId } = await signUp(page);
  await backdateAccount(userId, 4);
  await admin.from("profiles").update({ work_target_hours: 0 }).eq("user_id", userId);

  // Set three days ago. Since then: kept, missed, kept. Today isn't over, so it doesn't count yet.
  await completeEverything(userId, d3);
  // The day in between is missed.
  await completeEverything(userId, d1);
  const { data: goal } = await admin
    .from("yearly_goals")
    .insert({
      user_id: userId,
      year: Number(date.slice(0, 4)),
      title: "Keep my word on 85% of days",
      goal_type: "performance",
      unit: "%",
      target_value: 85,
      aggregation: "latest",
      progress_source: "keep_word",
      created_at: fromZonedTime(`${d3} 12:00`, TZ).toISOString(),
    })
    .select("id")
    .single();

  // 2 of 3 days is 67%: under the line, whatever share of the year has gone.
  await page.goto(`/goals/year/${goal!.id}`);
  const main = page.locator("main");
  await expect(main.getByText(`Kept your word on 67% of days since ${shortDate(d3).slice(4)}, against 85%.`)).toBeVisible();
  await expect(main.getByText("67% of 85%").first()).toBeVisible();
  await expect(main.getByText("Behind", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progress this year" })).toHaveAttribute("aria-valuenow", "79");
});
