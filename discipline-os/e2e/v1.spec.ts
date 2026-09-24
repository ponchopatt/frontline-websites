/**
 * The V1 definition of done, one test per item, against the real app and a real
 * (local) Supabase. Run: npm run test:e2e
 */
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import {
  ANON_KEY,
  PASSWORD,
  SUPABASE_URL,
  addDays,
  admin,
  backdateAccount,
  completeEverything,
  habit,
  ringScore,
  signUp,
  today,
  waitForApp,
} from "./helpers";

const MORNING = ["Wake on time", "No phone on waking", "Shower", "Make bed", "Water", "Coffee", "Bible study", "Prayer", "Journal", "Plan the day"];
const BODY = ["Gym", "Cardio", "Protein target", "Water target", "Sleep target"];
const DISCIPLINE = ["No porn", "No pointless scrolling", "No procrastination", "Kept commitments"];

test("1. a new user signs up and lands on a dashboard seeded with the default habits", async ({ page }) => {
  await signUp(page);
  await expect(page).toHaveURL("/");
  for (const name of [...MORNING, ...BODY, ...DISCIPLINE]) {
    await expect(habit(page, name)).toBeVisible();
  }
  await expect(page.locator("#morning [role=checkbox]")).toHaveCount(10);
  await expect(page.locator("#body [role=checkbox]")).toHaveCount(5);
  await expect(page.locator("#discipline [role=checkbox]")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Today's mission" })).toBeVisible();
});

test("2. every habit ticks and unticks, and the timestamp is stored correctly", async ({ page }) => {
  const { userId } = await signUp(page);
  const date = today();

  for (const name of [...MORNING, ...BODY, ...DISCIPLINE]) await habit(page, name).click();
  for (const name of [...MORNING, ...BODY, ...DISCIPLINE]) await expect(habit(page, name)).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await admin.from("habit_completions").select("id").eq("user_id", userId)).data?.length).toBe(19);

  const { data: rows } = await admin.from("habit_completions").select("local_date,completed_at,edited_at").eq("user_id", userId);
  for (const r of rows ?? []) {
    expect(r.local_date).toBe(date);
    expect(Math.abs(Date.now() - new Date(r.completed_at).getTime())).toBeLessThan(120_000);
    expect(r.edited_at).toBeNull();
  }

  for (const name of [...MORNING, ...BODY, ...DISCIPLINE]) await habit(page, name).click();
  for (const name of [...MORNING, ...BODY, ...DISCIPLINE]) await expect(habit(page, name)).toHaveAttribute("aria-checked", "false");
  await expect.poll(async () => (await admin.from("habit_completions").select("id").eq("user_id", userId)).data?.length).toBe(0);

  // A double tap never creates two rows: the unique index and the set-state action see to it.
  await habit(page, "Shower").click();
  await habit(page, "Shower").click();
  await habit(page, "Shower").click();
  await expect(habit(page, "Shower")).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await admin.from("habit_completions").select("id").eq("user_id", userId)).data?.length).toBe(1);

  await page.reload();
  await waitForApp(page);
  await expect(habit(page, "Shower")).toHaveAttribute("aria-checked", "true");
});

test("3. a running work block survives a refresh with the right elapsed time", async ({ page }) => {
  const { userId } = await signUp(page);
  await page.getByRole("button", { name: "Add a block" }).click();
  await page.locator("#block-task").fill("Deep work");
  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByRole("button", { name: "Start Deep work" }).click();
  await expect(page.getByRole("timer")).toBeVisible();

  const { data: open } = await admin.from("work_sessions").select("id,started_at,ended_at").eq("user_id", userId).single();
  expect(open?.ended_at).toBeNull();

  await page.waitForTimeout(4000);
  await page.reload();
  await waitForApp(page);
  const text = await page.getByRole("timer").first().innerText();
  const [m, s] = text.split(":").map(Number);
  const shown = m * 60 + s;
  const actual = (Date.now() - new Date(open!.started_at).getTime()) / 1000;
  expect(shown).toBeGreaterThanOrEqual(4);
  expect(Math.abs(shown - actual)).toBeLessThan(3);

  // Starting another block while this one runs asks first.
  await page.getByRole("button", { name: "Add a block" }).click();
  await page.locator("#block-task").fill("Admin");
  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByRole("button", { name: "Start Admin" }).click();
  await expect(page.getByText("is still running")).toBeVisible();
  await page.getByRole("button", { name: "Keep it running" }).click();

  // Left running for 9 hours: flagged on load, and the real end time can be set.
  await admin.from("work_sessions").update({ started_at: new Date(Date.now() - 9 * 3_600_000).toISOString() }).eq("id", open!.id);
  await page.reload();
  await waitForApp(page);
  await expect(page.getByText("running for over 8 hours")).toBeVisible();
  await page.getByRole("button", { name: "Save end time" }).click();
  await expect(page.getByRole("timer")).toHaveCount(0);
  const { data: closed } = await admin.from("work_sessions").select("ended_at").eq("id", open!.id).single();
  expect(closed?.ended_at).not.toBeNull();
});

test("4. the daily score recalculates live as items are completed", async ({ page }) => {
  await signUp(page);
  expect(await ringScore(page)).toBe(0);
  await habit(page, "Wake on time").click();
  const one = await ringScore(page);
  await page.getByRole("checkbox", { name: "Reading" }).click();
  const two = await ringScore(page);
  await habit(page, "Gym").click();
  const three = await ringScore(page);
  // Discipline 1/14 of 20 → 1; Bible reading 1/4 of 25 → +6; Gym 1/5 of 20 → +4
  expect(one).toBe(1);
  expect(two).toBe(8);
  expect(three).toBe(12);
});

test("5. a category with no active habits does not break the score", async ({ page }) => {
  const { userId } = await signUp(page);
  await admin
    .from("habits")
    .update({ is_active: false, archived_at: new Date(Date.now() - 60_000).toISOString(), created_at: new Date(Date.now() - 3_600_000).toISOString() })
    .eq("user_id", userId)
    .eq("category", "body");
  await page.reload();
  await waitForApp(page);
  await expect(page.locator("#body")).toContainText("No body habits yet.");
  expect(await ringScore(page)).toBe(0);
  await habit(page, "No porn").click();
  // Body's 20% is shared out: Discipline carries 25% instead of 20%, so 1/14 → 2, not 1.
  expect(await ringScore(page)).toBe(2);
});

test("6. the night review saves and Complete Day locks the day with a stored score", async ({ page }) => {
  const { userId } = await signUp(page);
  await habit(page, "Shower").click();
  await page.getByLabel("What did I accomplish?").fill("Drafted the plan");
  await page.getByLabel("What am I grateful for?").click();
  await expect(page.getByText("Saved").first()).toBeVisible();
  await page.getByLabel("What am I grateful for?").fill("My family");
  await page.getByLabel("Tomorrow's #1").click();
  await expect(page.getByText("Saved")).toHaveCount(2);

  const live = await ringScore(page);
  await page.locator("#review").getByRole("button", { name: "Complete day" }).click();
  await page.locator("#review").getByRole("button", { name: "Complete day" }).click();
  await expect(page.getByText(/Completed at \d\d:\d\d with/)).toBeVisible();

  const { data: plan } = await admin.from("daily_plans").select("final_score,completed_at").eq("user_id", userId).single();
  expect(plan?.final_score).toBe(live);
  expect(plan?.completed_at).not.toBeNull();
  const { data: review } = await admin.from("daily_reviews").select("accomplished,grateful_for").eq("user_id", userId).single();
  expect(review).toEqual({ accomplished: "Drafted the plan", grateful_for: "My family" });

  await page.reload();
  await waitForApp(page);
  await expect(habit(page, "Coffee")).toBeDisabled();
  expect(await ringScore(page)).toBe(live);

  await page.getByRole("button", { name: "Reopen day" }).click();
  await expect(habit(page, "Coffee")).toBeEnabled();
});

test("7. yesterday can be opened and edited; tomorrow cannot", async ({ page }) => {
  const { userId } = await signUp(page);
  await backdateAccount(userId, 3);
  const yesterday = addDays(today(), -1);

  await page.goto(`/?d=${yesterday}`);
  await waitForApp(page);
  await expect(page.getByText(/You're filling in/)).toBeVisible();
  await habit(page, "Shower").click();
  await expect(habit(page, "Shower")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#morning")).toContainText("edited");
  await expect
    .poll(async () => (await admin.from("habit_completions").select("local_date,edited_at").eq("user_id", userId)).data)
    .toEqual([expect.objectContaining({ local_date: yesterday, edited_at: expect.any(String) })]);

  // Tomorrow: the URL is refused, the arrow is disabled, and the database refuses a write.
  await page.goto(`/?d=${addDays(today(), 1)}`);
  await expect(page).toHaveURL("/");
  await waitForApp(page);
  await expect(page.getByLabel("Next day")).toHaveAttribute("aria-disabled", "true");

  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: users } = await admin.auth.admin.getUserById(userId);
  await client.auth.signInWithPassword({ email: users.user!.email!, password: PASSWORD });
  const { data: gym } = await client.from("habits").select("id").eq("name", "Gym").single();
  const { error } = await client.from("habit_completions").insert({ habit_id: gym!.id, local_date: addDays(today(), 1) });
  expect(error?.message).toContain("hasn't started yet");
});

test("8. a missed day breaks the streak and destroys no data", async ({ page }) => {
  const { userId } = await signUp(page);
  await backdateAccount(userId, 4);
  await admin.from("profiles").update({ work_target_hours: 0 }).eq("user_id", userId);
  const d3 = addDays(today(), -3);
  const d2 = addDays(today(), -2);
  const d1 = addDays(today(), -1);
  await completeEverything(userId, d3);
  // d2 is missed.
  await completeEverything(userId, d1);

  await page.goto("/habits");
  await expect(page.getByText("Current streak")).toBeVisible();
  const figures = page.locator("dl").first();
  await expect(figures).toContainText("Current streak1day");
  await expect(figures).toContainText("Best streak1day");

  // The day before the miss is intact.
  await page.goto(`/?d=${d3}`);
  await waitForApp(page);
  for (const name of [...MORNING, ...BODY, ...DISCIPLINE]) await expect(habit(page, name)).toHaveAttribute("aria-checked", "true");
  expect(await ringScore(page)).toBe(100);

  // The missed day is simply empty.
  await page.goto(`/?d=${d2}`);
  await waitForApp(page);
  expect(await ringScore(page)).toBe(0);
  const { data: rows } = await admin.from("habit_completions").select("local_date").eq("user_id", userId);
  expect(rows?.filter((r) => r.local_date === d3).length).toBe(19);
  expect(rows?.filter((r) => r.local_date === d1).length).toBe(19);
});

test("9. everything is usable one-handed on a 390px screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page);
  for (const path of ["/", "/habits", "/bible", "/work", "/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main button, main [role=checkbox], main input:not([type=hidden]), main select, main textarea, nav a")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el: (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim().slice(0, 40), h: el.getBoundingClientRect().height }))
        .filter((t) => t.h < 44),
    );
    expect(small, `${path} has touch targets under 44px`).toEqual([]);
  }
});

test("10. a second user sees none of the first user's data", async ({ browser }) => {
  const a = await browser.newContext();
  const pageA = await a.newPage();
  const { userId: aId } = await signUp(pageA);
  await habit(pageA, "Shower").click();
  await pageA.getByRole("textbox", { name: "First priority" }).fill("A's secret priority");
  await pageA.getByRole("textbox", { name: "First priority" }).press("Enter");
  await expect.poll(async () => (await admin.from("daily_priorities").select("id").eq("user_id", aId)).data?.length).toBe(1);

  const b = await browser.newContext();
  const pageB = await b.newPage();
  const { email: bEmail } = await signUp(pageB);
  await expect(habit(pageB, "Shower")).toHaveAttribute("aria-checked", "false");
  await expect(pageB.getByText("A's secret priority")).toHaveCount(0);

  // Straight at the API with B's session, even with A's ids.
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email: bEmail, password: PASSWORD });
  const { data: aHabits } = await admin.from("habits").select("id").eq("user_id", aId);
  const aIds = (aHabits ?? []).map((h) => h.id);
  const { data: seen } = await client.from("habits").select("id").in("id", aIds);
  expect(seen).toEqual([]);
  for (const table of ["habit_completions", "daily_priorities", "profiles"] as const) {
    const { data } = await client.from(table).select("user_id").eq("user_id", aId);
    expect(data, table).toEqual([]);
  }
  const { error } = await client.from("habit_completions").insert({ habit_id: aIds[0], local_date: today() });
  expect(error).not.toBeNull();
  const { data: stillOne } = await admin.from("habit_completions").select("id").eq("user_id", aId);
  expect(stillOne?.length).toBe(1);

  await a.close();
  await b.close();
});
