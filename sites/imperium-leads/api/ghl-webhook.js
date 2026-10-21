import { planBooking } from "../lib/ghl.js";
import { json, sameSecret } from "../lib/http.js";
import J from "../lib/jobs.js";
import { adminClient, readCollection, readDoc, writeDoc } from "../lib/supabase.js";
import { isTeam } from "../lib/team.js";

/*
  POST /api/ghl-webhook?key=<GHL_WEBHOOK_SECRET> — GoHighLevel tells us about a booking.

  The key can also come in an "x-ghl-secret" header (or "Authorization: Bearer <key>"). Anything
  without it is turned away. A new booking books its lead (found by phone, then email; else a new
  lead, source "GHL booking") and makes its job, keeping GHL's appointment ID on the job so the
  same booking is never added twice. The same appointment again: a new time moves the job,
  cancelled cancels it, no-show flags it, showed leaves it be. lib/ghl.js works it all out.

  Every request is logged (collection "ghl_log": when, what came in, what happened), kept for 60
  days; the app shows it in Settings. Only the live site writes. A preview, or ?dry=1, answers
  what it would do and changes nothing.

  GET with the key: a check that it's set up. GET ?log=1 from the app (team only): the log.
*/

const TURN = ["_system", "owner-turn"];
const PEOPLE = ["Angus", "Ananth"];
const KEEP_DAYS = 60;

function givenKey(request) {
  const url = new URL(request.url);
  return url.searchParams.get("key") || url.searchParams.get("secret") || request.headers.get("x-ghl-secret") || (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}
const live = () => process.env.VERCEL_ENV === "production";

async function log(db, at, record) {
  const id = at.toISOString() + "-" + Math.random().toString(36).slice(2, 6);
  try {
    await writeDoc(db, "ghl_log", id, { at: at.toISOString(), ...record });
    const cutoff = new Date(at.getTime() - KEEP_DAYS * 864e5).toISOString();
    await db.from("docs").delete().eq("collection", "ghl_log").lt("id", cutoff);
  } catch (e) {
    console.error("ghl-webhook: couldn't log", e && e.message);
  }
}

// One write from the plan. A merge only touches the fields named, so a phone saving the same
// lead at that moment loses nothing.
async function apply(db, w) {
  if (w.op === "create") {
    const { error } = await db.from("docs").upsert({ collection: w.collection, id: w.id, data: w.data, updated_at: new Date().toISOString() }, { onConflict: "collection,id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await db.rpc("docs_merge", { p_collection: w.collection, p_id: w.id, p_patch: w.data });
  if (error) throw new Error(error.message);
}

export async function POST(request) {
  const at = new Date();
  const expected = process.env.GHL_WEBHOOK_SECRET;
  if (!expected) return json({ ok: false, error: "GHL_WEBHOOK_SECRET isn't set in Vercel" }, 500);
  let db = null;
  try {
    db = adminClient();
  } catch {
    return json({ ok: false, error: "The database isn't set up" }, 500);
  }
  if (!sameSecret(givenKey(request), expected)) {
    console.warn("ghl-webhook: turned away (no key or the wrong key)");
    if (live()) await log(db, at, { ok: false, result: "Turned away: no key or the wrong key." });
    return json({ ok: false, error: "Not allowed" }, 401);
  }
  const dry = !live() || new URL(request.url).searchParams.get("dry") === "1";

  let text = "", body;
  try {
    text = await request.text();
    if (text.length > 200000) throw new Error("too big");
    body = text ? JSON.parse(text) : {};
  } catch {
    // A form post (key=value&…) is read too.
    try {
      body = Object.fromEntries(new URLSearchParams(text));
    } catch {
      body = null;
    }
  }
  const kept = text.length > 30000 ? text.slice(0, 30000) + "…" : text;
  if (!body || typeof body !== "object") {
    if (!dry) await log(db, at, { ok: false, result: "Couldn't read what was sent (send JSON).", body: kept });
    return json({ ok: false, error: "Send JSON" }, 400);
  }

  let plan;
  try {
    const [leadRows, jobRows, cfg, turn] = await Promise.all([
      readCollection(db, "leads"),
      readCollection(db, "jobs"),
      readDoc(db, "settings", "calendar").catch(() => null),
      readDoc(db, ...TURN).catch(() => null),
    ]);
    plan = planBooking(body, {
      leads: leadRows.map((r) => ({ id: r.id, ...r.data })),
      jobs: jobRows.map((r) => ({ id: r.id, ...r.data })),
      cfg: J.settings(cfg || {}),
      now: at,
      turn: PEOPLE.includes(turn && turn.next) ? turn.next : PEOPLE[0],
    });
  } catch (e) {
    console.error("ghl-webhook: couldn't read the leads", e && e.message);
    if (!dry) await log(db, at, { ok: false, result: "Couldn't read the leads: " + (e && e.message), body: kept });
    return json({ ok: false, error: "Couldn't read the leads. GHL can try again." }, 500);
  }

  const done = [];
  if (!dry) {
    try {
      for (const w of plan.writes) {
        await apply(db, w);
        done.push(w.op + " " + w.collection + "/" + w.id);
      }
      // A new lead was really added: the next one is the other person's.
      if (plan.summary.newLead) await writeDoc(db, ...TURN, { next: PEOPLE[(PEOPLE.indexOf(plan.summary.owner) + 1) % 2] }).catch(() => {});
    } catch (e) {
      console.error("ghl-webhook: couldn't save", e && e.message);
      await log(db, at, { ok: false, result: "Couldn't save: " + (e && e.message), planned: plan.result, done, body: kept });
      return json({ ok: false, error: "Couldn't save. GHL can try again." }, 500);
    }
    await log(db, at, { ok: plan.ok, result: plan.result, ...plan.summary, done, body: kept });
  }
  console.log("ghl-webhook:", dry ? "(dry run)" : "", plan.summary.appointmentId || "-", plan.result);
  // Bad data is answered 200 so GHL doesn't keep sending it; it's in the log.
  return json({ ok: plan.ok, result: plan.result, dryRun: dry, ...plan.summary, ...(dry ? { wouldWrite: plan.writes.map((w) => w.op + " " + w.collection + "/" + w.id) } : { done }) });
}

export async function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.get("log")) {
    if (!(await isTeam(request))) return json({ error: "Sign in first" }, 401);
    const { data, error } = await adminClient().from("docs").select("id,data").eq("collection", "ghl_log").order("id", { ascending: false }).limit(40);
    if (error) return json({ error: "Couldn't read the log" }, 500);
    return json({ entries: data.map((r) => r.data) });
  }
  const expected = process.env.GHL_WEBHOOK_SECRET;
  if (!expected) return json({ ok: false, error: "GHL_WEBHOOK_SECRET isn't set in Vercel" }, 500);
  if (!sameSecret(givenKey(request), expected)) return json({ ok: false, error: "Not allowed" }, 401);
  return json({ ok: true, ready: true, live: live(), note: "The GHL webhook is set up. GHL should POST bookings here." });
}
