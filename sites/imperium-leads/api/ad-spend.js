import { json, sameSecret } from "../lib/http.js";
import { dailySpend, ready, spendPatches, weeksOf } from "../lib/meta.js";
import M from "../lib/model.js";
import { adminClient, readCollection, writeDoc } from "../lib/supabase.js";
import { isTeam } from "../lib/team.js";

/*
  GET or POST /api/ad-spend — brings in the ad spend from Meta, so nobody types it each week.

  For the app (it sends its sign-in), or Vercel's daily run (vercel.json; it sends
  "Authorization: Bearer <CRON_SECRET>" once CRON_SECRET is set in Vercel). ?weeks=N is how many
  weeks back, this one included (3 unless said, 26 at most).

  Saves spend/<Monday> for each week: Meta's total and each ad's (byAd), marked from: "meta". A
  total typed in by hand is kept as handTotal. Then settings/meta: when it last ran and how it
  went. Only the live site saves; a preview, or ?dry=1, answers what it would save.
*/

const live = () => process.env.VERCEL_ENV === "production";
const MAX_WEEKS = 26;

async function who(request) {
  const cron = process.env.CRON_SECRET, given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (cron && given && sameSecret(given, cron)) return "Daily run";
  return (await isTeam(request)) ? "App" : null;
}

async function run(request) {
  const by = await who(request);
  if (!by) return json({ error: "Sign in first" }, 401);
  if (!ready()) return json({ ok: false, error: "not_set_up", note: "Add META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in Vercel." }, 503);
  let db;
  try {
    db = adminClient();
  } catch {
    return json({ ok: false, error: "The database isn't set up" }, 500);
  }
  const url = new URL(request.url), at = new Date().toISOString();
  const weeks = Math.min(MAX_WEEKS, Math.max(1, Math.floor(Number(url.searchParams.get("weeks"))) || 3));
  const today = M.canberraDate(new Date()), since = M.addDays(M.mondayOf(today), -7 * (weeks - 1));
  const dry = !live() || url.searchParams.get("dry") === "1";

  let found;
  try {
    found = weeksOf(await dailySpend(since, today), since, today);
  } catch (e) {
    const error = e.code === 190 ? "The Meta token has run out or been turned off. Make a new one." : String((e && e.message) || e).slice(0, 300);
    console.error("ad-spend:", error);
    if (!dry) await writeDoc(db, "settings", "meta", { lastSync: at, ok: false, error, by }).catch(() => {});
    return json({ ok: false, error }, 502);
  }
  let patches;
  try {
    const existing = Object.fromEntries((await readCollection(db, "spend")).map((r) => [r.id, r.data]));
    patches = spendPatches(found, existing, at);
    if (!dry) {
      for (const p of patches) {
        const { error } = await db.rpc("docs_merge", { p_collection: "spend", p_id: p.id, p_patch: p.data });
        if (error) throw new Error(error.message);
      }
      await writeDoc(db, "settings", "meta", { lastSync: at, ok: true, error: "", by, weeks: patches.map((p) => ({ weekOf: p.id, total: p.data.total })) });
    }
  } catch (e) {
    console.error("ad-spend: couldn't save", e && e.message);
    return json({ ok: false, error: "Couldn't save: " + (e && e.message) }, 500);
  }
  console.log("ad-spend:", dry ? "(dry run)" : "", by, patches.map((p) => p.id + " $" + p.data.total).join(", "));
  return json({ ok: true, dryRun: dry, weeks: patches.map((p) => ({ weekOf: p.id, total: p.data.total, ads: Object.keys(p.data.byAd).length })) });
}

export const GET = run;
export const POST = run;
