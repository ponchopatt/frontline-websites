/**
 * Streaks read the same everywhere: a closed day is over, and a habit's numbers count only the
 * days it's due, on the Habits page as on Progress.
 * Run: npm run test:e2e
 */
import { expect, test } from "@playwright/test";
import { dateRange, isoWeekday, localDateAt, weekdayName } from "../src/lib/day";
import { TZ, addDays, admin, backdateAccount, completeEverything, openArea, signUp, today, waitForApp } from "./helpers";

test("a day closed under the line ends the streak straight away", async ({ page }) => {
  test.setTimeout(120_000);
  const { userId } = await signUp(page);
  const main = page.locator("main");
  const date = today();
  await backdateAccount(userId, 4);
  await admin.from("profiles").update({ work_target_hours: 0 }).eq("user_id", userId);
  for (const back of [3, 2, 1]) await completeEverything(userId, addDays(date, -back));
  await page.reload();
  await waitForApp(page);

  // Today is still open: the three days before it are the streak.
  const card = main.getByRole("list", { name: "This week's streak" });
  await expect(main.getByText(/Streak 3 days/)).toBeVisible();
  await expect(card.getByRole("listitem", { name: `${weekdayName(date)}: today, in progress`, exact: true })).toBeVisible();

  // Close it with nothing done. The day is over, so the streak is too.
  await openArea(page, "Night review");
  await main.locator("#review").getByRole("button", { name: "Close day" }).click();
  await page.getByRole("dialog", { name: "Day complete" }).getByRole("button", { name: "Done" }).click();
  await expect(main.getByText(/Streak 0 days/)).toBeVisible();
  await expect(card.getByRole("listitem", { name: `${weekdayName(date)}: not kept`, exact: true })).toBeVisible();

  await page.goto("/habits");
  const figures = main.locator("dl").first();
  await expect(figures).toContainText("Current streak0days");
  await expect(figures).toContainText("Best streak3days");

  await page.goto("/progress");
  const word = main.locator("#streaks li").filter({ has: page.getByText("Keep my word", { exact: true }) });
  await expect(word).toContainText("No streak yet");
  await expect(word).toContainText("best 3");
});

test("the Habits page counts a habit's due days only, the same as Progress", async ({ page }) => {
  const { userId } = await signUp(page);
  const main = page.locator("main");
  await backdateAccount(userId, 24);
  const { data: profile } = await admin.from("profiles").select("created_at").eq("user_id", userId).single();
  const first = localDateAt(new Date(profile!.created_at), TZ, 4);

  // Gym on every day it's due (Monday to Friday by default) up to yesterday. Today is still open.
  const { data: gym } = await admin.from("habits").select("id,days").eq("user_id", userId).eq("name", "Gym").single();
  const due = dateRange(first, addDays(today(), -1)).filter((d) => !gym!.days || gym!.days.includes(isoWeekday(d)));
  await admin.from("habit_completions").insert(due.map((d) => ({ user_id: userId, habit_id: gym!.id, local_date: d })));

  await page.goto("/habits");
  const row = main.getByRole("button", { name: /^Gym,/ });
  await expect(row).toHaveAccessibleName(`Gym, Mon–Fri, ${due.length} in a row, 100% of the last 30 days`);
  await row.click();
  const sheet = page.getByRole("dialog", { name: "Gym" });
  await expect(sheet).toContainText("Due 5 days a week");
  await expect(sheet).toContainText(`Last 7 days100%Last 30 days100%In a row${due.length}`);

  await page.goto("/progress");
  const streak = main.locator("#streaks li").filter({ has: page.getByText("Gym", { exact: true }) });
  await expect(streak).toContainText(`${due.length}-day streak`);
});
