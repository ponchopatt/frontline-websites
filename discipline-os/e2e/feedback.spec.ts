/**
 * The daily loop end to end: morning → plan → habits → work → business numbers → cardio →
 * night review → close the day → replay → progress. And a Minimum Day that keeps the chain.
 * The browser's clock is set to the morning, then the evening, so the day's states are fixed.
 * Run: npm run test:e2e
 */
import { expect, test, type Locator } from "@playwright/test";
import { fromZonedTime } from "date-fns-tz";
import { addDays, shortDate } from "../src/lib/day";
import { TZ, admin, backdateAccount, habit, signUp, today, waitForApp } from "./helpers";

const MORNING = ["Wake up on time", "Shower", "Make bed", "Water", "Bible", "Journal", "Pray", "Plan day"];

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

test("a full day: plan it, do it, ask what's next, close it, replay it, see the progress", async ({ page }) => {
  test.setTimeout(180_000);
  const date = today();
  await page.clock.install({ time: fromZonedTime(`${date} 10:30`, TZ) });
  const { userId } = await signUp(page);
  const main = page.locator("main");

  // Some history: yesterday had an hour of Imperium work and 5 leads.
  await backdateAccount(userId, 8);
  const yesterday = addDays(date, -1);
  const { data: leads } = await admin.from("metrics").select("id").eq("user_id", userId).eq("area", "imperium").eq("key", "leads_called").single();
  await admin.from("metric_entries").insert({ user_id: userId, metric_id: leads!.id, local_date: yesterday, value: 5 });
  const yStart = fromZonedTime(`${yesterday} 09:00`, TZ);
  await admin.from("work_sessions").insert({ user_id: userId, local_date: yesterday, started_at: yStart.toISOString(), ended_at: new Date(yStart.getTime() + 3_600_000).toISOString(), area: "imperium" });
  await page.reload();
  await waitForApp(page);

  // Morning: a new day, and the first thing to do is the morning routine.
  await expect(main.getByText("New day.")).toBeVisible();
  await page.getByRole("button", { name: "What should I do next?" }).click();
  const next = main.getByRole("region", { name: "Do this now" });
  await expect(next).toContainText("Finish your morning routine.");
  await expect(next).toContainText("Why:");
  for (const name of MORNING) await habit(page, name).click();
  await expect(main.locator("#morning")).toContainText("Morning complete");
  await expect(main.getByText("Build the day.")).toBeVisible();

  // Plan: today's #1 in one line.
  await page.getByRole("button", { name: "Add your #1" }).click();
  const input = main.getByLabel("New task");
  await ready(input);
  await input.fill("Call 10 Imperium leads");
  await input.press("Enter");
  await expect.poll(async () => (await admin.from("daily_goals").select("id").eq("user_id", userId)).data?.length).toBe(1);
  await page.keyboard.press("Escape");

  // What's next is now the #1, in plain words, with a Start button that starts the timer.
  await expect(next).toContainText("Call the 10 Imperium leads you haven't called yet.");
  await expect(next).toContainText("Today's #1, and it isn't done yet.");
  await next.getByRole("button", { name: "Start Imperium" }).click();
  const work = main.locator("#work");
  await expect(work.getByRole("timer")).toBeVisible();
  await expect.poll(async () => (await admin.from("work_sessions").select("area").eq("user_id", userId).is("ended_at", null)).data?.[0]?.area).toBe("imperium");
  await work.getByRole("button", { name: "Stop" }).click();
  await expect(work.getByRole("timer")).toHaveCount(0);

  // Business numbers: one short of today's target says so; ten finishes the task by itself.
  const imperium = main.locator("#imperium");
  const counter = imperium.getByRole("textbox", { name: "Leads called", exact: true });
  const target = (await imperium.locator("li").filter({ hasText: "Leads called" }).first().innerText()).match(/0 of (\d+) today/);
  if (target && Number(target[1]) >= 2) {
    // Work days have a daily target; days off don't.
    await counter.fill(String(Number(target[1]) - 1));
    await counter.press("Enter");
    await expect(imperium).toContainText("One more lead.");
  }
  await counter.fill("9");
  await counter.press("Enter");
  await expect(counter).toHaveValue("9");
  await imperium.getByRole("button", { name: "Leads called: one more" }).click();
  await expect(page.getByRole("checkbox", { name: 'Mark "Call 10 Imperium leads" done' })).toHaveAttribute("aria-checked", "true");

  // Ten beats yesterday's five: a new personal record, with the one it beat.
  const record = main.getByRole("status", { name: "New personal record" });
  await expect(record).toContainText("10 Imperium leads called today");
  await expect(record).toContainText("Previous record: 5");

  // Cardio: 20 minutes ticks it.
  await main.getByRole("textbox", { name: "Cardio minutes" }).fill("20");
  await main.getByRole("textbox", { name: "Cardio minutes" }).press("Enter");
  await expect(main.getByRole("checkbox", { name: "Cardio done" })).toHaveAttribute("aria-checked", "true");

  // Evening: the header says so, and the night review is next.
  await page.clock.setSystemTime(fromZonedTime(`${date} 21:30`, TZ));
  await expect(main.getByText("Close it out.")).toBeVisible();
  // The card stays open through the day, and follows it.
  await expect(next).toContainText("Do the night review.");
  const review = main.locator("#review");
  await review.getByLabel("What did I accomplish?").fill("Called ten leads");
  await review.getByLabel("What did I waste time on?").fill("Nothing much");
  await review.getByLabel("Where did I break my word?").fill("Skipped the gym");
  await review.getByLabel("What is tomorrow's #1 priority?").fill("Build two demos");
  await review.getByLabel("What did I accomplish?").click();
  await expect(review.getByText("Saved")).toHaveCount(4);

  // Close the day from "what's next": the Day Complete screen and the replay.
  await expect(next).toContainText("Close the day.");
  await next.getByRole("button", { name: "Close the day" }).click();
  const done = page.getByRole("dialog", { name: "Day complete" });
  await expect(done.getByRole("img", { name: /^Kept my word: \d+%/ })).toBeVisible();
  await expect(done).toContainText("Commitments kept");
  await expect(done).toContainText("Morning routine complete");
  await expect(done).toContainText("New personal record");
  await expect(done).toContainText("10 Imperium leads called today");
  const replay = done.getByRole("list", { name: "The day, in order" });
  for (const line of ["Wake up on time", "Imperium work", "Leads called: 10", "Night review", "Day closed"]) await expect(replay).toContainText(line);
  const { data: plan } = await admin.from("daily_plans").select("final_score,score_breakdown").eq("user_id", userId).eq("local_date", date).single();
  expect(plan!.final_score).not.toBeNull();
  expect((plan!.score_breakdown as { version: number; achievements: string[] }).achievements).toContain("Morning routine complete");
  await done.getByRole("button", { name: "Done" }).click();
  await expect(main.getByText("Day complete.")).toBeVisible();

  // Progress: today's square, the streaks, the record, the facts.
  await page.goto("/progress");
  await expect(main.getByRole("heading", { name: "My progress" })).toBeVisible();
  const square = main.getByRole("button", { name: new RegExp(`^${shortDate(date)}: \\d+%`) });
  await ready(square);
  await expect(main.locator("#streaks")).toContainText("Morning routine");
  await expect(main.locator("#records")).toContainText("Most Imperium leads in a day");
  await expect(main.locator("#history")).toContainText("You've called 15 Imperium leads.");
  await square.click();
  const day = page.getByRole("dialog", { name: shortDate(date) });
  await expect(day.getByRole("list", { name: "The day, in order" })).toContainText("Day closed");
  await expect(day.getByRole("link", { name: "Open this day" })).toBeVisible();
});

test("minimum day: a bad day cut to the non-negotiables keeps the chain alive", async ({ page }) => {
  test.setTimeout(120_000);
  const { userId } = await signUp(page);
  const main = page.locator("main");
  const date = today();

  await page.getByRole("button", { name: "I'm having a shit day" }).click();
  const sheet = page.getByRole("dialog", { name: "Minimum day" });
  await expect(sheet).toContainText("You don't need a perfect day. You need to stop the bleeding.");
  await sheet.getByRole("button", { name: "Switch to minimum day" }).click();

  const card = main.locator("#minimum");
  await expect(card).toContainText("stop the bleeding");
  await expect(main.locator("#big3")).toHaveCount(0);
  await expect.poll(async () => (await admin.from("daily_plans").select("minimum_at").eq("user_id", userId).single()).data?.minimum_at).not.toBeNull();

  for (const name of ["Shower", "Bible", "Journal", "Pray", "Sleep target", "Cardio"]) await card.getByRole("checkbox", { name, exact: true }).click();
  // Twenty-five minutes of work, logged earlier.
  const start = Date.now() - 30 * 60_000;
  await admin.from("work_sessions").insert({ user_id: userId, local_date: date, started_at: new Date(start).toISOString(), ended_at: new Date(start + 25 * 60_000).toISOString(), area: "websites" });
  await expect.poll(async () => (await admin.from("habit_completions").select("id").eq("user_id", userId)).data?.length).toBe(6);
  await page.reload();
  await waitForApp(page);

  await expect(main.locator("#minimum")).toContainText("Minimum day secured.");
  await expect(main.locator("#minimum")).toContainText("You kept the chain alive.");
  // The day's own number doesn't pretend: it's still out of everything. The streak holds.
  await expect(page.locator("#kept")).not.toHaveText(/^(\d+) of \1$/);
  await expect(main.getByText(/Streak 1 day/)).toBeVisible();

  await main.getByRole("button", { name: "Show the full day" }).click();
  await expect(main.locator("#big3")).toBeVisible();

  await main.locator("#review").getByRole("button", { name: "Close day" }).click();
  const done = page.getByRole("dialog", { name: "Day complete" });
  await expect(done).toContainText("Minimum day secured. You kept the chain alive.");
  await expect(done).toContainText(`${date.slice(8, 10).replace(/^0/, "")}`);
});
