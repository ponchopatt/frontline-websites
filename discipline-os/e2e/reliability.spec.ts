/**
 * Taps and saves that must hold on a phone: a tick tapped before the page is ready, the journal
 * left without a blur, Back after a change elsewhere, a quick Save, nested sheets, and the timer
 * bar following a timer. Run: npm run test:e2e
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { admin, openArea, signUp, today, waitForApp } from "./helpers";

const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

function errorsOf(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function press(l: Locator, browserName: string) {
  if (browserName === "webkit") await l.tap();
  else await l.click();
}

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true });

async function habitDone(userId: string, kind: string, date = today()) {
  const { data: h } = await admin.from("habits").select("id").eq("user_id", userId).eq("kind", kind).single();
  return ((await admin.from("habit_completions").select("id").eq("habit_id", h!.id).eq("local_date", date)).data?.length ?? 0) > 0;
}

async function journal(userId: string) {
  return (await admin.from("bible_entries").select("journal").eq("user_id", userId).maybeSingle()).data?.journal ?? null;
}

test("a tick tapped before the page is ready still counts", async ({ page, browserName }) => {
  const errors = errorsOf(page);
  const { userId } = await signUp(page);
  // Hold the app's script back for 2.5 s, like a slow phone connection after a release.
  await page.route(/\/_next\/static\/chunks\/.*\.js/, async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto("/faith", { waitUntil: "commit" });
  const read = page.getByRole("checkbox", { name: "Read", exact: true });
  await read.waitFor({ state: "visible" });
  const hydratedBefore = await page.evaluate(() => Object.keys(document).some((k) => k.startsWith("__reactContainer$")));
  expect(hydratedBefore, "tap lands before React runs").toBe(false);
  // Three quick taps because nothing seemed to happen: still one tick.
  await press(read, browserName);
  await press(read, browserName);
  await press(read, browserName);
  await expect(read).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
  await expect.poll(() => habitDone(userId, "bible"), { timeout: 10_000 }).toBe(true);
  await page.unroute(/\/_next\/static\/chunks\/.*\.js/);
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Read", exact: true })).toHaveAttribute("aria-checked", "true");
  expect(errors.filter((e) => !/Load failed|access control/.test(e))).toEqual([]);
});

test("the journal saves on a phone tap beside it, and shows on Today straight away", async ({ page, browserName }) => {
  const errors = errorsOf(page);
  const { userId } = await signUp(page);
  await page.goto("/faith");
  await waitForApp(page).catch(() => undefined);
  await page.waitForLoadState("networkidle");
  const field = page.getByLabel("What stood out, and what will I do about it?");
  await press(field, browserName);
  await field.pressSequentially("Round one", { delay: 20 });
  await press(page.getByRole("heading", { name: "Faith", exact: true }), browserName);
  await expect.poll(() => journal(userId), { timeout: 5000 }).toBe("Round one");
  await page.reload();
  await expect(page.getByLabel("What stood out, and what will I do about it?")).toHaveValue("Round one");

  // Type, then go straight to Today: the Faith sheet shows the new words.
  for (const words of ["Round two", "Round three"]) {
    const f = page.getByLabel("What stood out, and what will I do about it?");
    await press(f, browserName);
    await f.fill(words);
    await press(page.getByRole("link", { name: "Today" }).last(), browserName);
    await page.waitForURL("**/");
    await waitForApp(page);
    await openArea(page, "Faith");
    await expect(page.locator("main #faith").getByRole("textbox", { name: "Journal" })).toHaveValue(words, { timeout: 8000 });
    await expect.poll(() => journal(userId)).toBe(words);
    await page.keyboard.press("Escape");
    await page.goto("/faith");
    await page.waitForLoadState("networkidle");
  }
  expect(errors).toEqual([]);
});

test("back to Faith after unticking on Today shows it unticked", async ({ page, browserName }) => {
  const errors = errorsOf(page);
  const { userId } = await signUp(page);
  await page.goto("/faith");
  await page.waitForLoadState("networkidle");
  const read = page.getByRole("checkbox", { name: "Read", exact: true });
  await press(read, browserName);
  await expect.poll(() => habitDone(userId, "bible")).toBe(true);
  await press(page.getByRole("link", { name: "Today" }).last(), browserName);
  await page.waitForURL("**/");
  await waitForApp(page);
  await openArea(page, "Faith");
  const todayRead = page.locator("main #faith").getByRole("checkbox", { name: "Read" });
  await expect(todayRead).toHaveAttribute("aria-checked", "true");
  await press(todayRead, browserName);
  await expect.poll(() => habitDone(userId, "bible")).toBe(false);
  await page.goBack();
  await page.waitForURL("**/faith");
  await expect(page.getByRole("checkbox", { name: "Read", exact: true })).toHaveAttribute("aria-checked", "false", { timeout: 8000 });
  await page.goForward();
  await page.waitForURL(/\/$/);
  await openArea(page, "Faith");
  await expect(page.locator("main #faith").getByRole("checkbox", { name: "Read" })).toHaveAttribute("aria-checked", "false", { timeout: 8000 });
  expect(errors).toEqual([]);
});

test("minimum day minutes keep a quick Save", async ({ page, browserName }) => {
  const { userId } = await signUp(page);
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  await press(page.locator("#minimum").getByRole("button", { name: /Focused work/ }), browserName);
  const sheet = page.getByRole("dialog", { name: "Minimum day" });
  await expect(sheet).toBeVisible();
  const more = sheet.getByRole("button", { name: "Minimum day work minutes: one more" });
  await more.click();
  await more.click();
  await sheet.getByRole("button", { name: "Save minimum day" }).click();
  await expect.poll(async () => (await admin.from("profiles").select("minimum_work_minutes").eq("user_id", userId).single()).data?.minimum_work_minutes).toBe(30);
  await page.reload();
  await expect(page.locator("#minimum")).toContainText("30 min");
});

test("closing a proof photo leaves the night review open; the proof wall link shows", async ({ page, browserName }) => {
  const errors = errorsOf(page);
  await signUp(page);
  await openArea(page, "Night review");
  const review = page.getByRole("dialog", { name: "Night review" });
  await page.locator("#proof input[type=file]").setInputFiles({ name: "gym.jpg", mimeType: "image/jpeg", buffer: JPEG });
  const thumb = page.locator("#proof").getByRole("button", { name: /Open proof/ });
  await expect(thumb).toHaveCount(1);
  await expect(page.locator("#proof")).toContainText("1 photo today");
  await expect(page.locator("#proof").getByRole("link", { name: "Proof wall" })).toHaveAttribute("href", "/progress?tab=proof");
  for (const how of ["button", "escape"]) {
    await press(thumb, browserName);
    const viewer = page.getByRole("dialog", { name: /Proof|gym/ }).last();
    await expect(viewer).toBeVisible();
    if (how === "button") await press(viewer.getByRole("button", { name: "Close" }), browserName);
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await expect(review, `review still open after closing the photo with ${how}`).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("the timer bar follows a timer started and stopped on Business", async ({ page, browserName }) => {
  const errors = errorsOf(page);
  const { userId } = await signUp(page);
  await page.goto("/business?tab=imperium");
  await page.waitForLoadState("networkidle");
  const main = page.locator("main");
  await press(main.getByRole("button", { name: "Start Imperium timer" }), browserName);
  await expect(main.getByRole("button", { name: "Stop" })).toBeVisible();
  const bar = page.locator("div.fixed").filter({ has: page.getByRole("button", { name: "Stop" }) });
  // Straight to another tab: the bar is there without a reload.
  await press(tab(page, "Goals"), browserName);
  await page.waitForURL("**/goals");
  await expect(bar.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 8000 });
  // Back on Business, stop from the bar: the Hours group goes back to Start.
  await page.goto("/business?tab=imperium");
  await page.waitForLoadState("networkidle");
  await press(bar.getByRole("button", { name: "Stop" }), browserName);
  await expect(main.getByRole("button", { name: "Start Imperium timer" })).toBeVisible({ timeout: 8000 });
  await expect(main.getByRole("button", { name: "Stop" })).toHaveCount(0);
  await expect.poll(async () => (await admin.from("work_sessions").select("id").eq("user_id", userId).is("ended_at", null)).data?.length).toBe(0);
  expect(errors).toEqual([]);
});
