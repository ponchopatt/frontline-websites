/**
 * The execution dashboard end to end: quick add with a counter, counters ticking tasks, work
 * by business, the AI bot milestone, a proof photo, the weekly scoreboard and "Suggest my
 * goals". Run: npm run test:e2e
 */
import { expect, test, type Locator } from "@playwright/test";
import { dayBounds, startOfWeek } from "../src/lib/day";
import { TZ, addDays, admin, backdateAccount, keptOfMade, ringScore, signUp, today, waitForApp } from "./helpers";

/** `ms` ago, but never before the start of today: a session's day is set by when it started. */
function earlierToday(ms: number): string {
  return new Date(Math.max(Date.now() - ms, dayBounds(today(), TZ, 4).start.getTime() + 1_000)).toISOString();
}

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

// A 1×1 JPEG, for the proof upload.
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

test("the day runs from one screen: tasks, counters, work, the bot, proof and the week", async ({ page }) => {
  test.setTimeout(150_000);
  const { userId } = await signUp(page);
  const date = today();
  const main = page.locator("main");

  // Quick add into the Big 3. The business and the counter come from the words.
  await page.getByRole("button", { name: "Add your #1" }).click();
  const input = main.getByLabel("New task");
  await ready(input);
  await input.fill("Call 10 Imperium leads");
  await input.press("Enter");
  await expect.poll(async () => (await admin.from("daily_goals").select("id").eq("user_id", userId)).data?.length).toBe(1);
  const { data: task } = await admin.from("daily_goals").select("id,area,rank,quantity,metric_id,local_date").eq("user_id", userId).single();
  const { data: leads } = await admin.from("metrics").select("id").eq("user_id", userId).eq("area", "imperium").eq("key", "leads_called").single();
  expect(task).toMatchObject({ area: "imperium", rank: 1, local_date: date, metric_id: leads!.id });
  expect(Number(task!.quantity)).toBe(10);

  // Typing 10 into the leads counter finishes the task by itself.
  const counter = page.locator("#imperium").getByRole("textbox", { name: "Leads called", exact: true });
  await counter.click();
  await counter.fill("10");
  await counter.press("Enter");
  await expect(page.getByRole("checkbox", { name: 'Mark "Call 10 Imperium leads" done' })).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await admin.from("daily_goals").select("status").eq("id", task!.id).single()).data?.status).toBe("done");
  const { data: entry } = await admin.from("metric_entries").select("value,local_date").eq("metric_id", leads!.id).single();
  expect(entry).toMatchObject({ local_date: date });
  expect(Number(entry!.value)).toBe(10);

  // + adds one, and the week total follows.
  await page.locator("#imperium").getByRole("button", { name: "Leads called: one more" }).click();
  await expect.poll(async () => Number((await admin.from("metric_entries").select("value").eq("metric_id", leads!.id).single()).data?.value)).toBe(11);

  // Work: choose the business, start, stop. The time is logged against it.
  const work = page.locator("#work");
  await work.getByRole("radio", { name: "Websites" }).click();
  await work.getByRole("button", { name: "Start Websites", exact: true }).click();
  await expect(work.getByRole("timer")).toBeVisible();
  await page.waitForTimeout(1500);
  await work.getByRole("button", { name: "Stop" }).click();
  await expect(work.getByRole("timer")).toHaveCount(0);
  const { data: session } = await admin.from("work_sessions").select("area,ended_at").eq("user_id", userId).single();
  expect(session).toMatchObject({ area: "websites" });
  expect(session!.ended_at).not.toBeNull();

  // The AI bot: a milestone set on the Business page shows on Today, and its steps tick there.
  await page.goto("/business?tab=bot");
  const milestoneInput = main.getByPlaceholder("e.g. Complete TradingView comparison");
  await ready(milestoneInput);
  await milestoneInput.fill("TradingView comparison");
  await main.getByRole("button", { name: "Start milestone" }).click();
  await expect.poll(async () => (await admin.from("project_milestones").select("title").eq("user_id", userId)).data?.length).toBe(1);
  await page.goto("/");
  await waitForApp(page);
  const bot = page.locator("#trading");
  await expect(bot).toContainText("TradingView comparison");
  await bot.getByRole("checkbox", { name: "Implement" }).click();
  await expect(bot).toContainText("14%");
  await expect
    .poll(async () => ((await admin.from("project_milestones").select("steps").eq("user_id", userId).single()).data?.steps as Array<{ done: boolean }>)[0].done)
    .toBe(true);

  // A proof photo for the day.
  const proofInput = page.locator("#proof input[type=file]");
  await proofInput.setInputFiles({ name: "gym.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await expect(page.locator("#proof").getByRole("button", { name: /Open proof/ })).toHaveCount(1);
  const { data: proof } = await admin.from("proof_uploads").select("storage_path,local_date").eq("user_id", userId).single();
  expect(proof!.local_date).toBe(date);
  expect(proof!.storage_path.startsWith(`${userId}/${date}/`)).toBe(true);

  // Keep My Word counts the finished task.
  const [kept, made] = await keptOfMade(page);
  expect(kept).toBeGreaterThanOrEqual(1);
  const live = await ringScore(page);
  expect(live).toBe(Math.round((kept / made) * 100));

  // The week's scoreboard has today's leads in it.
  await page.goto("/week");
  await page.waitForURL(`**/goals/week/${startOfWeek(date)}`);
  await expect(main.getByRole("heading", { name: "Weekly boss" })).toBeVisible();
  const leadsRow = main.locator("#boss li").filter({ has: page.getByText("Leads", { exact: true }) });
  await expect(leadsRow).toContainText(/^Leads\s*11/);

  // Suggest my goals: concrete, with a reason, and nothing saved until approved.
  await page.goto("/goals/suggest");
  const suggest = main.getByRole("button", { name: "Suggest my goals" });
  await ready(suggest);
  await suggest.click();
  await expect(main.getByRole("checkbox", { name: /Make \d+ cold calls this week/ })).toBeVisible();
  expect((await admin.from("weekly_goals").select("id").eq("user_id", userId)).data?.length).toBe(0);
  await main.getByRole("button", { name: /^Add \d+ goals? to this week$/ }).click();
  await page.waitForURL(`**/goals/week/${startOfWeek(date)}`);
  const { data: weekly } = await admin.from("weekly_goals").select("title,progress_source,metric_id,week_start").eq("user_id", userId);
  expect(weekly!.length).toBeGreaterThan(0);
  const calls = weekly!.find((w) => /cold calls/.test(w.title))!;
  expect(calls).toMatchObject({ progress_source: "metric", week_start: startOfWeek(date) });
  expect(calls.metric_id).not.toBeNull();
});

test("a double tap on Today carries an unfinished task over once", async ({ page }) => {
  const { userId } = await signUp(page);
  await backdateAccount(userId, 2);
  const { data: old } = await admin
    .from("daily_goals")
    .insert({ user_id: userId, local_date: addDays(today(), -1), title: "Chase the Smith quote" })
    .select("id")
    .single();
  await page.reload();
  await waitForApp(page);

  const big3 = page.locator("#big3");
  await big3.getByText("1 unfinished from earlier").click();
  await big3.getByRole("button", { name: 'Do "Chase the Smith quote" today' }).dblclick();
  const task = page.getByRole("checkbox", { name: 'Mark "Chase the Smith quote" done' });
  await expect(task).toHaveCount(1);
  await expect(big3.getByText("1 unfinished from earlier")).toHaveCount(0);
  const copies = async () => (await admin.from("daily_goals").select("id").eq("carried_from_id", old!.id)).data?.length;
  expect(await copies()).toBe(1);

  await page.reload();
  await waitForApp(page);
  await expect(task).toHaveCount(1);
  expect(await copies()).toBe(1);
});

test("Start with a timer running on another device asks first, in view, and counts the stopped time", async ({ page }) => {
  const { userId } = await signUp(page);
  // Websites work, started on another device after this page loaded.
  const { data: other } = await admin
    .from("work_sessions")
    .insert({ user_id: userId, local_date: today(), started_at: earlierToday(2 * 3_600_000), area: "websites" })
    .select("id")
    .single();

  // Start from the AI bot card, far below the Work card: the question comes into view.
  await page.locator("#trading").getByRole("button", { name: "Start", exact: true }).click();
  const work = page.locator("#work");
  const ask = work.getByRole("alert");
  await expect(ask).toContainText("Websites is still running");
  await expect(ask).toBeInViewport();
  await ask.getByRole("button", { name: "Stop it and start" }).click();

  // The stopped session counts straight away, next to the new one.
  await expect(work.getByRole("timer")).toBeVisible();
  await expect(work.getByText("2 sessions logged")).toBeVisible();
  const { data: sessions } = await admin.from("work_sessions").select("id,area,ended_at").eq("user_id", userId);
  expect(sessions!.find((s) => s.id === other!.id)!.ended_at).not.toBeNull();
  expect(sessions!.find((s) => s.id !== other!.id)).toMatchObject({ area: "trading", ended_at: null });
});

test("closing the day stops a running timer, and its time stops counting", async ({ page }) => {
  const { userId } = await signUp(page);
  const { data: open } = await admin
    .from("work_sessions")
    .insert({ user_id: userId, local_date: today(), started_at: earlierToday(3_600_000), area: "websites" })
    .select("id")
    .single();
  await page.reload();
  await waitForApp(page);
  const work = page.locator("#work");
  await expect(work.getByRole("timer")).toBeVisible();

  await page.locator("#review").getByRole("button", { name: "Close day" }).click();
  await page.getByRole("dialog", { name: "Day complete" }).getByRole("button", { name: "Done" }).click();
  await expect(work.getByRole("timer")).toHaveCount(0);
  const { data: stopped } = await admin.from("work_sessions").select("ended_at").eq("id", open!.id).single();
  expect(stopped!.ended_at).not.toBeNull();

  // The session shows when it ended, not "now", so the day's hours stand still.
  await work.getByText("1 session logged").click();
  await expect(work.locator("details li")).toHaveCount(1);
  await expect(work.locator("details li")).not.toContainText("now");
});
