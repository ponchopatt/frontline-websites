/**
 * First-run setup and the passcode lock: a new account sets its name (Angus by default), the
 * 1906 passcode, the year's goals, why, and its daily and weekly numbers; then the app asks
 * for the passcode each time it's opened. Run: npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, admin, ready, signUp, today, waitForApp } from "./helpers";

async function typePin(page: Page, pin: string) {
  for (const d of pin) await page.getByRole("button", { name: d, exact: true }).click();
}

/** The page fits the phone: nothing scrolls sideways. */
async function fits(page: Page, where: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${where} scrolls sideways`).toBeLessThanOrEqual(0);
}

/** From the name, through setup with what it suggests, to the week's numbers. */
async function toTheWeek(page: Page, { passcode = true } = {}) {
  const main = page.locator("main");
  await main.getByRole("button", { name: "Next" }).click();
  if (passcode) await main.getByRole("button", { name: "Set passcode" }).click();
  for (const heading of ["What do you want to achieve?", "Who are you becoming, and why?", "What does a good day look like?"]) {
    await expect(main.getByRole("heading", { name: heading })).toBeVisible();
    await main.getByRole("button", { name: "Next" }).click();
  }
  await expect(main.getByRole("heading", { name: "What numbers will you hit each week?" })).toBeVisible();
}

/** The next action sent from /welcome reaches the server and saves, but its reply is lost. */
async function loseNextReply(page: Page) {
  let dropped = false;
  await page.route(
    (url) => url.pathname === "/welcome",
    async (route) => {
      const request = route.request();
      if (dropped || request.method() !== "POST" || !request.headers()["next-action"]) return route.fallback();
      dropped = true;
      await route.fetch();
      await route.abort("connectionreset");
    },
  );
}

/** A new account with the 1906 passcode and the rest of setup skipped, on Today. */
async function withPasscode(page: Page) {
  const account = await signUp(page, undefined, { setup: true });
  const main = page.locator("main");
  await main.getByRole("button", { name: "Next" }).click();
  await main.getByRole("button", { name: "Set passcode" }).click();
  await main.getByRole("button", { name: "Skip the rest" }).click();
  await page.waitForURL("/");
  await waitForApp(page);
  return account;
}

test("setup: name, passcode, the year's goals, why, and the numbers", async ({ page }) => {
  test.setTimeout(120_000);
  const { userId } = await signUp(page, undefined, { setup: true });
  const main = page.locator("main");

  // Name: Angus unless the account already has a real first name.
  await expect(main.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
  await expect(main.getByLabel("Your first name")).toHaveValue("Angus");
  await fits(page, "the name step");
  await main.getByRole("button", { name: "Next" }).click();

  // The passcode, 1906 to start.
  await expect(main.getByLabel("Passcode")).toHaveValue("1906");
  await fits(page, "the passcode step");
  await main.getByRole("button", { name: "Set passcode" }).click();
  await expect(main.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  await expect.poll(async () => (await admin.from("profiles").select("passcode_set").eq("user_id", userId).single()).data?.passcode_set).toBe(true);
  // Saving the passcode doesn't take its step away: this is still step 3 of 7.
  await expect(main.getByRole("list", { name: "Step 3 of 7" })).toBeVisible();
  await fits(page, "the goals step");

  // Goals: a number typed by hand survives a change of year and back.
  const imperium = main.getByRole("listitem").filter({ has: page.getByRole("switch", { name: "Imperium goal" }) });
  await imperium.getByLabel("Target ($)", { exact: true }).fill("100000");
  await main.getByRole("radio", { name: /^Next year/ }).click();
  await expect(imperium.getByLabel("Target ($)", { exact: true })).toHaveValue("100000");
  await main.getByRole("radio", { name: /^This year/ }).click();
  await expect(imperium.getByLabel("Target ($)", { exact: true })).toHaveValue("100000");
  await expect(imperium.getByRole("textbox", { name: "Imperium goal" })).toHaveValue("Make $100,000 in Imperium revenue");

  // The suggestions are on (Money off); switch Money on and set it.
  await main.getByRole("switch", { name: "Money goal" }).click();
  await main.getByRole("button", { name: "Next" }).click();

  // Why.
  await expect(main.getByRole("heading", { name: "Who are you becoming, and why?" })).toBeVisible();
  await fits(page, "the why step");
  await main.getByLabel("Who am I becoming?").fill("A man who keeps his word.");
  await main.getByLabel("Why does it matter?").fill("For my family.");
  await main.getByRole("button", { name: "Next" }).click();

  // The day: one more hour of work, and 1.5 hours on the bot typed in.
  await expect(main.getByRole("heading", { name: "What does a good day look like?" })).toBeVisible();
  await fits(page, "the day step");
  await main.getByRole("button", { name: "Hours of focused work a day: more" }).click();
  await expect(main.getByLabel("Hours of focused work a day", { exact: true })).toHaveValue("9");
  const bot = main.getByLabel("Hours a day on the AI bot", { exact: true });
  await bot.fill("");
  await bot.pressSequentially("1.5");
  await expect(bot).toHaveValue("1.5");

  // No gym days isn't a choice (it would make the gym due every day); Mon, Wed and Fri are.
  const gym = main.getByRole("group", { name: "Gym days" });
  while ((await gym.getByRole("button", { pressed: true }).count()) > 0) await gym.getByRole("button", { pressed: true }).first().click();
  await expect(main.getByText("Pick at least one day.")).toBeVisible();
  await expect(main.getByRole("button", { name: "Next" })).toBeDisabled();
  for (const d of ["Mon", "Wed", "Fri"]) await gym.getByRole("button", { name: `Gym days: ${d}` }).click();
  await main.getByRole("button", { name: "Next" }).click();

  // The week: 60 leads.
  await expect(main.getByRole("heading", { name: "What numbers will you hit each week?" })).toBeVisible();
  await fits(page, "the week step");
  await main.getByLabel("Imperium leads called", { exact: true }).fill("60");
  await main.getByRole("button", { name: "Finish setup" }).click();
  await expect(main.getByRole("heading", { name: "You're set, Angus." })).toBeVisible();
  await fits(page, "the last step");

  const { data: goals } = await admin
    .from("yearly_goals")
    .select("title,progress_source,metric_id,habit_id,target_value,current_value,goal_type,unit")
    .eq("user_id", userId);
  expect(goals).toHaveLength(7);
  const revenue = goals!.find((g) => /Imperium revenue/.test(g.title))!;
  expect(revenue.progress_source).toBe("metric");
  expect(revenue.metric_id).not.toBeNull();
  expect(Number(revenue.target_value)).toBe(100_000);
  expect(goals!.find((g) => /Bible/.test(g.title))?.progress_source).toBe("habit");
  // Keeping my word is measured from the days, not typed in.
  expect(goals!.find((g) => /Keep my word/.test(g.title))).toMatchObject({ progress_source: "keep_word", goal_type: "performance", unit: "%", current_value: null });
  const { data: profile } = await admin.from("profiles").select("display_name,work_target_hours,area_hour_targets,onboarded_at").eq("user_id", userId).single();
  expect(profile).toMatchObject({ display_name: "Angus" });
  expect(Number(profile!.work_target_hours)).toBe(9);
  expect(Number((profile!.area_hour_targets as { trading?: number }).trading)).toBe(1.5);
  expect(profile!.onboarded_at).not.toBeNull();
  const { data: gymHabit } = await admin.from("habits").select("days").eq("user_id", userId).eq("kind", "gym").single();
  expect(gymHabit?.days).toEqual([1, 3, 5]);
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
  await fits(page, "/unlock");
  // Signed in minutes ago, but no reset was asked for: there's no way round the passcode.
  await expect(page.getByRole("button", { name: "Forgot your passcode?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Forgot it? Choose a new passcode" })).toHaveCount(0);
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

test("skipping later on keeps the goals and why already answered", async ({ page }) => {
  const { userId } = await signUp(page, undefined, { setup: true });
  const main = page.locator("main");
  await main.getByRole("button", { name: "Next" }).click();
  await main.getByRole("button", { name: "Set passcode" }).click();
  await expect(main.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  await main.getByRole("button", { name: "Next" }).click();
  await main.getByLabel("Who am I becoming?").fill("A man who keeps his word.");
  await main.getByLabel("Why does it matter?").fill("For my family.");
  await main.getByRole("button", { name: "Next" }).click();
  await expect(main.getByRole("heading", { name: "What does a good day look like?" })).toBeVisible();
  await main.getByRole("button", { name: "Skip the rest" }).click();
  await page.waitForURL("/");
  await waitForApp(page);

  // The six suggested goals and the why were answered; the day and week keep their defaults.
  const { data: goals } = await admin.from("yearly_goals").select("id").eq("user_id", userId);
  expect(goals).toHaveLength(6);
  const { data: why } = await admin.from("goals").select("kind").eq("user_id", userId).order("kind");
  expect(why?.map((w) => w.kind)).toEqual(["becoming", "why"]);
  const { data: profile } = await admin.from("profiles").select("work_target_hours,onboarded_at").eq("user_id", userId).single();
  expect(Number(profile!.work_target_hours)).toBe(8);
  expect(profile!.onboarded_at).not.toBeNull();
});

test("redo setup leaves the goals already set alone and adds none twice", async ({ page }) => {
  test.setTimeout(120_000);
  const { userId } = await signUp(page, undefined, { setup: true });
  const main = page.locator("main");
  await toTheWeek(page);
  await main.getByRole("button", { name: "Finish setup" }).click();
  await expect(main.getByRole("heading", { name: "You're set, Angus." })).toBeVisible();
  await expect.poll(async () => (await admin.from("yearly_goals").select("id").eq("user_id", userId)).data?.length).toBe(6);
  // The gym every day since: a habit with no days.
  await admin.from("habits").update({ days: null }).eq("user_id", userId).eq("kind", "gym");

  await page.goto("/settings");
  await page.getByRole("link", { name: "Redo setup" }).click();
  await page.waitForURL("**/welcome");
  await expect(main.getByText("Redo setup")).toBeVisible();
  await main.getByRole("button", { name: "Next" }).click();

  // The passcode is set, so there's no step for it. Every area with a goal is off and stays off.
  await expect(main.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  await expect(main.getByRole("list", { name: "Step 2 of 6" })).toBeVisible();
  await expect(main.getByText(/Areas with a goal are switched off here\.$/)).toBeVisible();
  for (const area of ["Imperium", "Websites", "AI Trading", "Faith", "Fitness", "Discipline"]) {
    const on = main.getByRole("switch", { name: `${area} goal` });
    await expect(on).toBeDisabled();
    await expect(on).toHaveAttribute("aria-checked", "false");
  }
  await expect(main.getByRole("switch", { name: "Money goal" })).toBeEnabled();
  for (const heading of ["What do you want to achieve?", "Who are you becoming, and why?"]) {
    await expect(main.getByRole("heading", { name: heading })).toBeVisible();
    await main.getByRole("button", { name: "Next" }).click();
  }

  // Every day at the gym shows as all seven days, and stays every day.
  await expect(main.getByRole("heading", { name: "What does a good day look like?" })).toBeVisible();
  await expect(main.getByRole("group", { name: "Gym days" }).getByRole("button", { pressed: true })).toHaveCount(7);
  await main.getByRole("button", { name: "Next" }).click();
  await main.getByRole("button", { name: "Finish setup" }).click();
  await expect(main.getByRole("heading", { name: "You're set, Angus." })).toBeVisible();

  const { data: goals } = await admin.from("yearly_goals").select("title").eq("user_id", userId);
  expect(goals).toHaveLength(6);
  const { data: gymHabit } = await admin.from("habits").select("days").eq("user_id", userId).eq("kind", "gym").single();
  expect(gymHabit?.days).toBeNull();
});

test("redo setup offers the full year for a goal whose counter already has this year's entries", async ({ page }) => {
  const { userId } = await signUp(page);
  // $80,000 of Imperium revenue logged this year, and some website revenue, which isn't a website sold.
  const { data: metrics } = await admin.from("metrics").select("id,area").eq("user_id", userId).eq("key", "revenue");
  const revenue = (area: string) => metrics!.find((m) => m.area === area)!.id;
  await admin.from("metric_entries").insert([
    { user_id: userId, metric_id: revenue("imperium"), local_date: today(), value: 80_000 },
    { user_id: userId, metric_id: revenue("websites"), local_date: today(), value: 5_000 },
  ]);

  await page.goto("/welcome");
  const main = page.locator("main");
  await ready(main.getByRole("button", { name: "Next" }));
  await main.getByRole("button", { name: "Next" }).click();
  await main.getByRole("button", { name: "Set passcode" }).click();
  await expect(main.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();

  // The goal counts the counter from 1 January, so a share of the year would be passed already.
  const imperium = main.getByRole("listitem").filter({ has: page.getByRole("switch", { name: "Imperium goal" }) });
  await expect(imperium.getByLabel("Target ($)", { exact: true })).toHaveValue("250000");
  await expect(imperium.getByText("Counts the $80,000 already logged this year.", { exact: true })).toBeVisible();
  await expect(main.getByText(/^Counts the /)).toHaveCount(1);
});

test("a Set passcode tapped again after a lost reply moves on", async ({ page }) => {
  const { userId } = await signUp(page, undefined, { setup: true });
  const main = page.locator("main");
  await main.getByRole("button", { name: "Next" }).click();

  // The first one reaches the server and saves, but the reply is lost on the way back.
  await loseNextReply(page);
  await main.getByRole("button", { name: "Set passcode" }).click();
  await expect(page.getByText("That didn't save. Check your connection and try again.")).toBeVisible();
  await expect.poll(async () => (await admin.from("profiles").select("passcode_set").eq("user_id", userId).single()).data?.passcode_set).toBe(true);

  // Tapped again: the same passcode is taken as the current one, and setup goes on.
  await main.getByRole("button", { name: "Set passcode" }).click();
  await expect(main.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  await expect(page.getByText("That isn't your current passcode.")).toHaveCount(0);
});

test("a Finish tapped again after a lost reply adds each goal once", async ({ page }) => {
  test.setTimeout(120_000);
  const { userId } = await signUp(page, undefined, { setup: true });
  const main = page.locator("main");
  await toTheWeek(page);

  // The first Finish reaches the server and saves, but the reply is lost on the way back.
  await loseNextReply(page);
  await main.getByRole("button", { name: "Finish setup" }).click();
  await expect(page.getByText("That didn't save. Check your connection and try again.")).toBeVisible();
  await expect.poll(async () => (await admin.from("yearly_goals").select("id").eq("user_id", userId)).data?.length).toBe(6);

  // Tapped again: it goes through, and the goals it already saved aren't added twice.
  await main.getByRole("button", { name: "Finish setup" }).click();
  await expect(main.getByRole("heading", { name: "You're set, Angus." })).toBeVisible();
  await expect(main.getByText(/^6 goals for \d{4}$/)).toBeVisible();
  const { data: goals } = await admin.from("yearly_goals").select("title").eq("user_id", userId);
  expect(goals).toHaveLength(6);
  expect(new Set(goals!.map((g) => g.title)).size).toBe(6);
});

test("a forgotten passcode is replaced after asking for it and signing in again", async ({ page }) => {
  test.setTimeout(120_000);
  const { email, userId } = await withPasscode(page);

  await page.context().clearCookies({ name: "dos_unlock" });
  await page.goto("/");
  await page.waitForURL("**/unlock");
  await expect(page.getByRole("button", { name: "Forgot it? Choose a new passcode" })).toHaveCount(0);
  await page.getByRole("button", { name: "Forgot your passcode?" }).click();

  // Asking signs out and notes the request; the next sign-in may choose a new one.
  await page.waitForURL((url) => url.pathname === "/login" && url.searchParams.get("reset") === "passcode");
  await expect(page.getByText("Sign in with your email and password, then choose a new passcode.")).toBeVisible();
  const { data: lock } = await admin.from("app_locks").select("reset_requested_at").eq("user_id", userId).single();
  expect(lock?.reset_requested_at).not.toBeNull();
  // The sign-in has to come in a later second than the request.
  await page.waitForTimeout(1_000);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/unlock");

  // Two that don't match say so and start again; two that do replace it.
  await page.getByRole("button", { name: "Forgot it? Choose a new passcode" }).click();
  await expect(page.getByRole("heading", { name: "Choose a new passcode." })).toBeVisible();
  await typePin(page, "1234");
  await expect(page.getByRole("heading", { name: "Enter it again." })).toBeVisible();
  await typePin(page, "5678");
  await expect(page.getByText("Those didn't match. Choose it again.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose a new passcode." })).toBeVisible();
  await typePin(page, "4321");
  await expect(page.getByRole("heading", { name: "Enter it again." })).toBeVisible();
  await typePin(page, "4321");
  await page.waitForURL("/");
  await waitForApp(page);

  // The new one opens the app, the old one doesn't, and the reset can't be used twice.
  await page.context().clearCookies({ name: "dos_unlock" });
  await page.goto("/");
  await page.waitForURL("**/unlock");
  await expect(page.getByRole("button", { name: "Forgot it? Choose a new passcode" })).toHaveCount(0);
  await typePin(page, "1906");
  await expect(page.getByText("That passcode isn't right.")).toBeVisible();
  await typePin(page, "4321");
  await page.waitForURL("/");
});

test("settings: change the passcode, lock now, and turn it off", async ({ page }) => {
  test.setTimeout(120_000);
  const { userId } = await withPasscode(page);
  const card = page.locator("#passcode").filter({ visible: true });

  // 1906 becomes 2222.
  await page.goto("/settings");
  await ready(card.getByLabel("Current passcode", { exact: true }));
  await card.getByLabel("Current passcode", { exact: true }).fill("1906");
  await card.getByLabel("New passcode", { exact: true }).fill("2222");
  await card.getByRole("button", { name: "Change passcode" }).click();
  await expect(page.getByText("Passcode changed.")).toBeVisible();

  // Locked: the old one is refused and the new one opens it.
  await card.getByRole("button", { name: "Lock now" }).click();
  await page.waitForURL("**/unlock");
  await typePin(page, "1906");
  await expect(page.getByText("That passcode isn't right.")).toBeVisible();
  await typePin(page, "2222");
  await page.waitForURL("/");
  await waitForApp(page);

  // Turned off with the current one: opening the app goes straight in.
  await page.goto("/settings");
  await ready(card.getByLabel("Current passcode", { exact: true }));
  await card.getByLabel("Current passcode", { exact: true }).fill("2222");
  await card.getByRole("button", { name: "Turn passcode off" }).click();
  await expect(card.getByText("Off. Set one to lock the app when it's opened.")).toBeVisible();
  await expect.poll(async () => (await admin.from("profiles").select("passcode_set").eq("user_id", userId).single()).data?.passcode_set).toBe(false);
  await page.context().clearCookies({ name: "dos_unlock" });
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "My progress" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/progress");
});
