/**
 * A focus week: one business gets the deep work, the other two a short keep-alive. Picked from
 * Today, followed by Up next and the day's list, and split day by day from the week's page.
 * Run: npm run test:e2e
 */
import { expect, test } from "@playwright/test";
import { fromZonedTime } from "date-fns-tz";
import { weekdayName } from "../src/lib/day";
import { admin, signUp, TZ, today, waitForApp } from "./helpers";

test("a focus week: the deep work goes to one business, the others stay alive", async ({ page }) => {
  test.setTimeout(120_000);
  const date = today();
  await page.clock.install({ time: fromZonedTime(`${date} 13:00`, TZ) });
  const { userId } = await signUp(page);
  const main = page.locator("main");

  // Nothing chosen yet: Today offers to pick one.
  await main.getByRole("button", { name: "Pick a focus" }).click();
  const sheet = page.getByRole("dialog", { name: "Focus for the week" });
  const whole = sheet.getByRole("radiogroup", { name: "The whole week" });
  await expect(whole.getByRole("radio")).toHaveCount(3);
  await expect(sheet.getByText("Suggested")).toHaveCount(1);
  await whole.getByRole("radio", { name: /Websites/ }).click();
  await expect(whole.getByRole("radio", { name: /Websites/ })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("button", { name: "Imperium keep-alive minutes: one more" }).click();
  await sheet.getByRole("button", { name: "Save focus" }).click();
  await expect(sheet).toBeHidden();

  // Saved: seven Websites days and 25 minutes to keep Imperium alive.
  await expect
    .poll(async () => (await admin.from("focus_days").select("area").eq("user_id", userId)).data?.map((r) => r.area).join(","))
    .toBe(Array(7).fill("websites").join(","));
  const { data: profile } = await admin.from("profiles").select("keep_alive_minutes").eq("user_id", userId).single();
  expect(profile!.keep_alive_minutes).toEqual({ imperium: 25, websites: 20, trading: 15 });

  // Today follows it: the deep work first, the others on their keep-alive.
  await expect(main.getByRole("button", { name: "Focus: Websites" })).toBeVisible();
  const board = main.locator("#scoreboard");
  await expect(board.getByRole("button", { name: /^Websites:/ })).toContainText("Focus · 0m of");
  await expect(board.getByRole("button", { name: /^Imperium:/ })).toContainText("Keep alive · 0 of 25 min");
  await expect(board.getByRole("button", { name: /^AI Bot:/ })).toContainText("Keep alive · 0 of 15 min");
  const next = main.getByRole("region", { name: "Up next" });
  await expect(next).toContainText("Start a deep Websites block.");
  await next.getByRole("button", { name: "Start Websites" }).click();
  await expect
    .poll(async () => (await admin.from("work_sessions").select("area").eq("user_id", userId).is("ended_at", null).maybeSingle()).data?.area)
    .toBe("websites");
  await page.waitForLoadState("networkidle");

  // A split week from the week's page: today goes to Imperium instead.
  await page.goto("/week");
  await page.waitForURL(/\/goals\/week\//);
  const focus = main.locator("#focus");
  await expect(focus).toContainText("Websites all week");
  await focus.getByRole("button", { name: /Websites all week/ }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("radiogroup", { name: `${weekdayName(date)} focus` }).getByRole("radio", { name: "Imperium" }).click();
  await sheet.getByRole("button", { name: "Save focus" }).click();
  await expect(sheet).toBeHidden();
  await expect(focus).toContainText(`Imperium ${weekdayName(date).slice(0, 3)}`);
  await expect.poll(async () => (await admin.from("focus_days").select("area").eq("user_id", userId).eq("local_date", date).single()).data?.area).toBe("imperium");

  // Back on Today, Imperium has the deep work.
  await page.goto("/");
  await waitForApp(page);
  await expect(main.getByRole("button", { name: "Focus: Imperium" })).toBeVisible();
  await expect(main.locator("#scoreboard").getByRole("button", { name: /^Imperium:/ })).toContainText("Focus ·");
});
