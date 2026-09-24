/**
 * First-run setup and the passcode lock: a new account sets its name (Angus by default), the
 * 1906 passcode, the year's goals, why, and its daily and weekly numbers; then the app asks
 * for the passcode each time it's opened. Run: npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { admin, signUp, waitForApp } from "./helpers";

async function typePin(page: Page, pin: string) {
  for (const d of pin) await page.getByRole("button", { name: d, exact: true }).click();
}

test("setup: name, passcode, the year's goals, why, and the numbers", async ({ page }) => {
  test.setTimeout(120_000);
  const { userId } = await signUp(page, undefined, { setup: true });
  const main = page.locator("main");

  // Name: Angus unless the account already has a real first name.
  await expect(main.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
  await expect(main.getByLabel("Your first name")).toHaveValue("Angus");
  await main.getByRole("button", { name: "Next" }).click();

  // The passcode, 1906 to start.
  await expect(main.getByLabel("Passcode")).toHaveValue("1906");
  await main.getByRole("button", { name: "Set passcode" }).click();
  await expect(main.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  await expect.poll(async () => (await admin.from("profiles").select("passcode_set").eq("user_id", userId).single()).data?.passcode_set).toBe(true);

  // Goals: the suggestions are on (Money off); switch Money on and set it.
  await main.getByRole("switch", { name: "Money goal" }).click();
  await main.getByRole("button", { name: "Next" }).click();

  // Why.
  await main.getByLabel("Who am I becoming?").fill("A man who keeps his word.");
  await main.getByLabel("Why does it matter?").fill("For my family.");
  await main.getByRole("button", { name: "Next" }).click();

  // The day: one more hour of work.
  await main.getByRole("button", { name: "Hours of focused work a day: more" }).click();
  await expect(main.getByLabel("Hours of focused work a day", { exact: true })).toHaveValue("9");
  await main.getByRole("button", { name: "Next" }).click();

  // The week: 60 leads.
  await main.getByLabel("Imperium leads called", { exact: true }).fill("60");
  await main.getByRole("button", { name: "Finish setup" }).click();
  await expect(main.getByRole("heading", { name: "You're set, Angus." })).toBeVisible();

  const { data: goals } = await admin.from("yearly_goals").select("title,progress_source,metric_id,habit_id,target_value").eq("user_id", userId);
  expect(goals).toHaveLength(7);
  const revenue = goals!.find((g) => /Imperium revenue/.test(g.title))!;
  expect(revenue.progress_source).toBe("metric");
  expect(revenue.metric_id).not.toBeNull();
  expect(goals!.find((g) => /Bible/.test(g.title))?.progress_source).toBe("habit");
  const { data: profile } = await admin.from("profiles").select("display_name,work_target_hours,onboarded_at").eq("user_id", userId).single();
  expect(profile).toMatchObject({ display_name: "Angus" });
  expect(Number(profile!.work_target_hours)).toBe(9);
  expect(profile!.onboarded_at).not.toBeNull();
  const { data: leads } = await admin.from("metrics").select("weekly_target").eq("user_id", userId).eq("key", "leads_called").single();
  expect(Number(leads!.weekly_target)).toBe(60);
  const { data: why } = await admin.from("goals").select("kind,content").eq("user_id", userId).order("kind");
  expect(why?.map((w) => w.kind)).toEqual(["becoming", "why"]);

  await main.getByRole("button", { name: "Go to Today" }).click();
  await page.waitForURL("/");
  await waitForApp(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Angus.");

  // Opening the app again asks for the passcode. A wrong one is refused; 1906 opens it.
  await page.context().clearCookies({ name: "dos_unlock" });
  await page.goto("/");
  await page.waitForURL("**/unlock");
  await expect(page.getByRole("heading", { name: "Welcome back, Angus." })).toBeVisible();
  await typePin(page, "1111");
  await expect(page.getByText("That passcode isn't right.")).toBeVisible();
  await typePin(page, "1906");
  await page.waitForURL("/");
  await waitForApp(page);

  // Settings: lock now.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Lock now" }).click();
  await page.waitForURL("**/unlock");
  await typePin(page, "1906");
  await page.waitForURL("/");
});

test("setup can be skipped after the passcode, and the lock still holds", async ({ page }) => {
  const { userId } = await signUp(page, undefined, { setup: true });
  const main = page.locator("main");
  await main.getByLabel("Your first name").fill("Pat");
  await main.getByRole("button", { name: "Next" }).click();
  await main.getByRole("button", { name: "Set passcode" }).click();
  await main.getByRole("button", { name: "Skip the rest" }).click();
  await page.waitForURL("/");
  await waitForApp(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pat.");
  const { data: goals } = await admin.from("yearly_goals").select("id").eq("user_id", userId);
  expect(goals).toHaveLength(0);

  // Without the unlock cookie, even a direct page is locked.
  await page.context().clearCookies({ name: "dos_unlock" });
  await page.goto("/progress");
  await page.waitForURL("**/unlock");
});
