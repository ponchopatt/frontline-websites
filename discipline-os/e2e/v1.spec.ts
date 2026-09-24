/**
 * The V1 definition of done, one test per item, against the real app and a real (local)
 * Supabase, on the Today screen as it is now (Keep My Word, the Big 3 as tasks). Run: npm run test:e2e
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
  keptOfMade,
  ringScore,
  signUp,
  today,
  waitForApp,
} from "./helpers";

const MORNING = ["Wake up on time", "Shower", "Make bed", "Water", "Bible", "Journal", "Pray", "Plan day"];
const DISCIPLINE = ["No porn", "No pointless scrolling", "No procrastination"];
const HABIT_COUNT = 17;

/** Every habit tick on the screen, once each: the morning routine, fitness, discipline, evening prayer. */
function allTicks(page: import("@playwright/test").Page) {
  return page.locator("#morning [role=checkbox], #fitness [role=checkbox], #discipline [role=checkbox], #faith [role=checkbox][aria-label=Prayer]");
}

test("1. a new user signs up and lands on Today seeded with the default habits", async ({ page }) => {
  await signUp(page);
  await expect(page).toHaveURL("/");
  for (const name of [...MORNING, ...DISCIPLINE]) await expect(habit(page, name)).toBeVisible();
  await expect(page.locator("#morning [role=checkbox]")).toHaveCount(8);
  await expect(page.locator("#fitness [role=checkbox]")).toHaveCount(5);
  await expect(page.locator("#discipline [role=checkbox]")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Today's Big 3" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Scoreboard" })).toBeVisible();
});

test("2. every habit ticks and unticks, and the timestamp is stored correctly", async ({ page }) => {
  const { userId } = await signUp(page);
  const date = today();
  const ticks = allTicks(page);
  await expect(ticks).toHaveCount(HABIT_COUNT);

  for (let i = 0; i < HABIT_COUNT; i += 1) await ticks.nth(i).click();
  for (let i = 0; i < HABIT_COUNT; i += 1) await expect(ticks.nth(i)).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await admin.from("habit_completions").select("id").eq("user_id", userId)).data?.length).toBe(HABIT_COUNT);

  const { data: rows } = await admin.from("habit_completions").select("local_date,completed_at,edited_at").eq("user_id", userId);
  for (const r of rows ?? []) {
    expect(r.local_date).toBe(date);
    expect(Math.abs(Date.now() - new Date(r.completed_at).getTime())).toBeLessThan(120_000);
    expect(r.edited_at).toBeNull();
  }

  for (let i = 0; i < HABIT_COUNT; i += 1) await ticks.nth(i).click();
  for (let i = 0; i < HABIT_COUNT; i += 1) await expect(ticks.nth(i)).toHaveAttribute("aria-checked", "false");
  await expect.poll(async () => (await admin.from("habit_completions").select("id").eq("user_id", userId)).data?.length).toBe(0);

  // A double tap never creates two rows: the unique index and the set-state action see to it.
  await habit(page, "Shower").click();
  await habit(page, "Shower").click();
  await habit(page, "Shower").click();
  await expect(habit(page, "Shower")).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await admin.from("habit_completions").select("id").eq("user_id", userId)).data?.length).toBe(1);

  // Bible in the morning routine and Read on the faith card are the same tick.
  await habit(page, "Bible").click();
  await expect(page.locator("#faith").getByRole("checkbox", { name: "Read" })).toHaveAttribute("aria-checked", "true");

  await page.reload();
  await waitForApp(page);
  await expect(habit(page, "Shower")).toHaveAttribute("aria-checked", "true");
});

test("3. a running work block survives a refresh with the right elapsed time", async ({ page }) => {
  const { userId } = await signUp(page);
  const work = page.locator("#work");
  await work.getByRole("button", { name: "Plan a block" }).click();
  await page.locator("#block-task").fill("Deep work");
  await work.getByRole("button", { name: "Add block" }).click();
  await work.getByRole("button", { name: "Start the Imperium · Deep work block" }).click();
  await expect(page.getByRole("timer")).toBeVisible();

  const { data: open } = await admin.from("work_sessions").select("id,started_at,ended_at,area").eq("user_id", userId).single();
  expect(open?.ended_at).toBeNull();
  expect(open?.area).toBe("imperium");

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
  await work.getByRole("button", { name: "Plan a block" }).click();
  await page.locator("#block-task").fill("Admin");
  await work.getByRole("button", { name: "Add block" }).click();
  await work.getByRole("button", { name: "Start the Imperium · Admin block" }).click();
  await expect(page.getByText("is still running")).toBeVisible();
  await page.getByRole("button", { name: "Keep it running" }).click();

  // Left running for 9 hours: flagged on load, and the real end time can be set.
  await admin.from("work_sessions").update({ started_at: new Date(Date.now() - 9 * 3_600_000).toISOString() }).eq("id", open!.id);
  await page.reload();
  await waitForApp(page);
  await expect(page.getByText("running for over 8 hours")).toBeVisible();
  await page.getByRole("button", { name: "Save end time" }).click();
  await expect(page.locator("main").getByRole("timer")).toHaveCount(0);
  const { data: closed } = await admin.from("work_sessions").select("ended_at").eq("id", open!.id).single();
  expect(closed?.ended_at).not.toBeNull();
});

test("4. Keep My Word recalculates live as things are done", async ({ page }) => {
  await signUp(page);
  expect(await ringScore(page)).toBe(0);
  const [kept0, made0] = await keptOfMade(page);
  expect(kept0).toBe(0);

  await habit(page, "Wake up on time").click();
  await expect.poll(() => keptOfMade(page)).toEqual([1, made0]);
  expect(await ringScore(page)).toBe(Math.round((1 / made0) * 100));

  // A new task is a new commitment; finishing it keeps it.
  await page.getByRole("button", { name: "Add your #1" }).click();
  await page.getByLabel("New task").fill("Send the Smith invoice");
  await page.getByLabel("New task").press("Enter");
  await expect.poll(() => keptOfMade(page)).toEqual([1, made0 + 1]);
  await page.getByRole("checkbox", { name: 'Mark "Send the Smith invoice" done' }).click();
  await expect.poll(() => keptOfMade(page)).toEqual([2, made0 + 1]);
  expect(await ringScore(page)).toBe(Math.round((2 / (made0 + 1)) * 100));
});

test("5. a part of life with no active habits does not break the numbers", async ({ page }) => {
  const { userId } = await signUp(page);
  await admin
    .from("habits")
    .update({ is_active: false, archived_at: new Date(Date.now() - 60_000).toISOString(), created_at: new Date(Date.now() - 3_600_000).toISOString() })
    .eq("user_id", userId)
    .eq("category", "body");
  await page.reload();
  await waitForApp(page);
  await expect(page.locator("#fitness")).toContainText("No fitness habits.");
  await expect(page.getByRole("region", { name: "Scoreboard" }).getByRole("link", { name: /Fitness/ })).toContainText("–");
  const [, made] = await keptOfMade(page);
  await habit(page, "No porn").click();
  await expect.poll(() => keptOfMade(page)).toEqual([1, made]);
  expect(await ringScore(page)).toBe(Math.round((1 / made) * 100));
});

test("6. the night review saves and Complete Day locks the day with its Keep My Word", async ({ page }) => {
  const { userId } = await signUp(page);
  await habit(page, "Shower").click();
  const review = page.locator("#review");
  await review.getByLabel("What did I accomplish?").fill("Drafted the plan");
  await review.getByLabel("What did I waste time on?").click();
  await expect(review.getByText("Saved").first()).toBeVisible();
  await review.getByLabel("What did I waste time on?").fill("Scrolling after lunch");
  await review.getByLabel("Where did I break my word?").fill("Skipped the gym");
  await review.getByLabel("What is tomorrow's #1 priority?").fill("Call 15 Imperium leads");
  await review.getByLabel("What did I accomplish?").click();
  await expect(review.getByText("Saved")).toHaveCount(4);
  await expect(page.locator("#faith").getByText("Night review done")).toBeVisible();

  const live = await ringScore(page);
  await review.getByRole("button", { name: "Complete day" }).click();
  await review.getByRole("button", { name: "Complete day" }).click();
  await expect(page.getByText(/Completed at \d\d:\d\d\. Kept my word: \d+%/)).toBeVisible();

  const { data: plan } = await admin.from("daily_plans").select("final_score,completed_at").eq("user_id", userId).single();
  expect(plan?.final_score).toBe(live);
  expect(plan?.completed_at).not.toBeNull();
  const { data: saved } = await admin.from("daily_reviews").select("accomplished,tomorrow_priority").eq("user_id", userId).single();
  expect(saved).toEqual({ accomplished: "Drafted the plan", tomorrow_priority: "Call 15 Imperium leads" });

  await page.reload();
  await waitForApp(page);
  await expect(habit(page, "Water")).toBeDisabled();
  expect(await ringScore(page)).toBe(live);

  await page.getByRole("button", { name: "Reopen day" }).click();
  await expect(habit(page, "Water")).toBeEnabled();
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
  // Scoped to <main>: while a page streams in, React briefly holds a hidden copy outside it.
  await expect(page.locator("main").getByText("Current streak")).toBeVisible();
  const figures = page.locator("main dl").first();
  await expect(figures).toContainText("Current streak1day");
  await expect(figures).toContainText("Best streak1day");

  // The day before the miss is intact: every commitment kept. A finished morning folds away.
  await page.goto(`/?d=${d3}`);
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: "Morning complete" })).toBeVisible();
  await page.locator("#morning").getByRole("button", { expanded: false }).click();
  for (const name of [...MORNING, ...DISCIPLINE]) await expect(habit(page, name)).toHaveAttribute("aria-checked", "true");
  expect(await ringScore(page)).toBe(100);

  // The missed day is simply empty.
  await page.goto(`/?d=${d2}`);
  await waitForApp(page);
  expect(await ringScore(page)).toBe(0);
  const { data: rows } = await admin.from("habit_completions").select("local_date").eq("user_id", userId);
  expect(rows?.filter((r) => r.local_date === d3).length).toBe(HABIT_COUNT);
  expect(rows?.filter((r) => r.local_date === d1).length).toBe(HABIT_COUNT);
});

test("9. everything is usable one-handed on a 390px screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page);
  for (const path of ["/", "/business", "/business?tab=websites", "/business?tab=bot", "/week", "/goals", "/goals/suggest", "/habits", "/bible", "/work", "/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main button, main [role=checkbox], main input:not([type=hidden]), main select, main textarea, nav[aria-label=Main] a")]
        .filter((el) => el.offsetParent !== null && !el.classList.contains("sr-only"))
        // A checkbox or radio inside its label is tapped through the label.
        .map((el) => ((el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio") && el.closest("label") ? el.closest("label")! : el)
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
  await pageA.getByRole("button", { name: "Add your #1" }).click();
  await pageA.getByLabel("New task").fill("A's secret task");
  await pageA.getByLabel("New task").press("Enter");
  await expect.poll(async () => (await admin.from("daily_goals").select("id").eq("user_id", aId)).data?.length).toBe(1);

  const b = await browser.newContext();
  const pageB = await b.newPage();
  const { email: bEmail } = await signUp(pageB);
  await expect(habit(pageB, "Shower")).toHaveAttribute("aria-checked", "false");
  await expect(pageB.getByText("A's secret task")).toHaveCount(0);

  // Straight at the API with B's session, even with A's ids.
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email: bEmail, password: PASSWORD });
  const { data: aHabits } = await admin.from("habits").select("id").eq("user_id", aId);
  const aIds = (aHabits ?? []).map((h) => h.id);
  const { data: seen } = await client.from("habits").select("id").in("id", aIds);
  expect(seen).toEqual([]);
  for (const table of ["habit_completions", "daily_goals", "metrics", "profiles"] as const) {
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
