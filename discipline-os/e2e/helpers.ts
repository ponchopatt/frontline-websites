import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { addDays, localDateAt, type LocalDate } from "../src/lib/day";
import type { Database } from "../src/lib/supabase/database.types";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SERVICE_KEY || !ANON_KEY) {
  throw new Error("Run e2e with the local Supabase keys: npm run test:e2e (see README).");
}

/** Service-role client for arranging test data. Never used by the app. */
export const admin: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const TZ = "Australia/Sydney";
export const PASSWORD = "correct-horse-battery-9";

export function today(): LocalDate {
  return localDateAt(new Date(), TZ, 4);
}
export { addDays };

let counter = 0;
export function uniqueEmail(tag: string) {
  counter += 1;
  return `${tag}-${Date.now()}-${process.pid}-${counter}@e2e.test`;
}

/** Signs up through the real form and waits for the dashboard to be interactive. */
export async function signUp(page: Page, email = uniqueEmail("user")): Promise<{ email: string; userId: string }> {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/");
  await waitForApp(page);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`User ${email} was not created`);
  return { email, userId: user.id };
}

/** The Today screen is hydrated once the Keep My Word ring shows and a habit responds. */
export async function waitForApp(page: Page) {
  await expect(page.getByRole("img", { name: /^(Keep my word|Kept my word)/ })).toBeVisible();
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="checkbox"]');
    return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactProps")));
  });
}

/** The Keep My Word percentage in the header ring. */
export async function ringScore(page: Page): Promise<number> {
  const label = await page.getByRole("img", { name: /^(Keep my word|Kept my word)/ }).getAttribute("aria-label");
  const m = label?.match(/: (\d+)%/);
  if (!m) throw new Error(`No score in "${label}"`);
  return Number(m[1]);
}

/**
 * A habit's tick by its name. Bible, Journal and Pray show in both the morning routine and the
 * faith card; the morning routine's comes first.
 */
export function habit(page: Page, name: string) {
  return page.locator(`main button[role="checkbox"][aria-label="${name}"]`).first();
}

/** "13 of 15" in the header: commitments kept and made today. */
export async function keptOfMade(page: Page): Promise<[number, number]> {
  const text = await page.locator("#kept").innerText();
  const m = text.match(/(\d+) of (\d+)/);
  if (!m) throw new Error(`No "kept of made" in "${text}"`);
  return [Number(m[1]), Number(m[2])];
}

/** Moves an account's start (and its habits) back, so earlier days exist to edit. */
export async function backdateAccount(userId: string, days: number) {
  const at = new Date(Date.now() - days * 86_400_000).toISOString();
  await admin.from("profiles").update({ created_at: at }).eq("user_id", userId);
  await admin.from("habits").update({ created_at: at }).eq("user_id", userId);
}

/** Everything done for a past day: every active habit, the four Bible checks and the review. */
export async function completeEverything(userId: string, date: LocalDate) {
  const { data: habits } = await admin.from("habits").select("id").eq("user_id", userId).eq("is_active", true);
  await admin.from("habit_completions").insert((habits ?? []).map((h) => ({ user_id: userId, habit_id: h.id, local_date: date })));
  const { data: reading } = await admin
    .from("bible_readings")
    .insert({ user_id: userId, local_date: date, book: "John", chapter: 1, is_completed: true })
    .select("id")
    .single();
  await admin.from("bible_entries").insert({
    user_id: userId,
    reading_id: reading!.id,
    local_date: date,
    soap_done: true,
    prayer_done: true,
    application_done: true,
  });
  await admin.from("daily_reviews").insert({
    user_id: userId,
    local_date: date,
    accomplished: "a",
    wasted_time_on: "b",
    broke_word_where: "c",
    sought_god: "d",
    grateful_for: "e",
    tomorrow_priority: "f",
  });
}
