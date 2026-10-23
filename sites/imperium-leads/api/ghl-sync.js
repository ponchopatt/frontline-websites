import { appointment, bodyFor, calendars, contact, customFields, events, locationOf } from "../lib/ghl-api.js";
import { applyWrites, hasAppt, planBooking } from "../lib/ghl.js";
import { json, sameSecret } from "../lib/http.js";
import J from "../lib/jobs.js";
import M from "../lib/model.js";
import { adminClient, readCollection, readDoc, writeDoc } from "../lib/supabase.js";
import { isTeam } from "../lib/team.js";

/*
  GET or POST /api/ghl-sync — makes the calendar match GHL, for what the webhook doesn't hear
  about (GHL sends nothing when a booking is deleted, and not always when one is moved in its
  phone app). GHL wins.

  Every appointment from a week ago to six months ahead goes through the webhook's rules
  (planBooking): one that isn't here is booked in, a moved one moves its job, a cancelled one
  cancels it. A job here whose GHL appointment has been deleted is cancelled too. A job deleted
  in the app is left alone, and so is a job done here (it only moves to GHL's day).

  Who: the app (signed in), the webhook's key (?key=GHL_WEBHOOK_SECRET), or Vercel's hourly run
  (Authorization: Bearer <CRON_SECRET>). Only the live site saves; a preview, or ?dry=1, answers
  what it would change. Each run that changes something is in the GHL log, and settings/ghlsync
  says when it last ran.
*/

const live = () => process.env.VERCEL_ENV === "production";
const TURN = ["_system", "owner-turn"];
const PEOPLE = ["Angus", "Ananth"];
const BACK = 7, AHEAD = 183;

async function who(request) {
  const url = new URL(request.url), given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (process.env.CRON_SECRET && given && sameSecret(given, process.env.CRON_SECRET)) return "Hourly run";
  if (sameSecret(url.searchParams.get("key") || request.headers.get("x-ghl-secret") || "", process.env.GHL_WEBHOOK_SECRET)) return "Key";
  return (await isTeam(request)) ? "App" : null;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// The writes, in the webhook's order: new jobs, then new leads, then changes.
async function save(db, writes) {
  const stamp = new Date().toISOString();
  for (const col of ["jobs", "leads"]) {
    const rows = writes.filter((w) => w.op === "create" && w.collection === col).map((w) => ({ collection: col, id: w.id, data: w.data, updated_at: stamp }));
    if (rows.length) {
      const { error } = await db.from("docs").upsert(rows, { onConflict: "collection,id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
  }
  for (const w of writes.filter((x) => x.op === "merge")) {
    const { error } = await db.rpc("docs_merge", { p_collection: w.collection, p_id: w.id, p_patch: w.data });
    if (error) throw new Error(error.message);
  }
}

async function run(request, { fetchFn } = {}) {
  const by = await who(request);
  if (!by) return json({ ok: false, error: "Not allowed" }, 401);
  const token = process.env.GHL_API_TOKEN;
  if (!token) return json({ ok: false, error: "not_set_up", note: "GHL_API_TOKEN isn't set in Vercel yet." }, 503);
  const now = new Date(), today = M.canberraDate(now), from = M.addDays(today, -BACK), to = M.addDays(today, AHEAD);
  const dry = !live() || new URL(request.url).searchParams.get("dry") === "1";
  let db;
  try {
    db = adminClient();
  } catch {
    return json({ ok: false, error: "The database isn't set up" }, 500);
  }
  const o = { token, fetchFn };
  try {
    const locationId = await locationOf(db);
    if (!locationId) return json({ ok: false, error: "No GHL location yet: add GHL_LOCATION_ID, or make one booking so it's known." }, 400);
    const [leadRows, jobRows, cfg, turnDoc, cals, fields] = await Promise.all([
      readCollection(db, "leads"), readCollection(db, "jobs"), readDoc(db, "settings", "calendar").catch(() => null), readDoc(db, ...TURN).catch(() => null),
      calendars(locationId, o), customFields(locationId, o).catch(() => []),
    ]);
    const fieldNames = Object.fromEntries(fields.map((f) => [f.id, f.name]));
    const calName = Object.fromEntries(cals.map((c) => [c.id, c.name]));
    const state = { leads: leadRows.map((r) => ({ id: r.id, ...r.data })), jobs: jobRows.map((r) => ({ id: r.id, ...r.data })) };
    const settings = J.settings(cfg || {});
    let turn = PEOPLE.includes(turnDoc && turnDoc.next) ? turnDoc.next : PEOPLE[0], newLeads = 0;

    // Every appointment in the stretch, each once, oldest first.
    const all = new Map();
    for (const list of await pool(cals, 2, (c) => events(locationId, c.id, from, to, o))) for (const ev of list) if (ev && ev.id && !ev.deleted && !all.has(ev.id)) all.set(ev.id, ev);
    const evs = [...all.values()].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    // The person only for a booking that isn't here yet.
    const need = [...new Set(evs.filter((e) => !state.jobs.some((j) => hasAppt(j, e.id))).map((e) => e.contactId).filter(Boolean))];
    const people = Object.fromEntries(await pool(need, 4, async (id) => [id, await contact(id, o).catch(() => null)]));

    const lines = [], writes = [];
    const plan = (ev, ct) => {
      const p = planBooking(bodyFor(ev, ct, calName[ev.calendarId], fieldNames), { leads: state.leads, jobs: state.jobs, cfg: settings, now, turn });
      if (!p.writes.length) return;
      applyWrites(state, p.writes);
      writes.push(...p.writes);
      if (p.summary.newLead) { newLeads++; turn = PEOPLE[(PEOPLE.indexOf(p.summary.owner) + 1) % 2]; }
      lines.push(String(ev.startTime).slice(0, 10) + " " + (calName[ev.calendarId] || "") + ": " + p.result);
    };
    for (const ev of evs) plan(ev, people[ev.contactId]);

    // A job here whose appointment isn't in GHL's list any more: deleted there (or moved off this
    // stretch). Asked about one at a time.
    const seen = new Set(evs.map((e) => e.id));
    const gone = state.jobs.filter((j) => !j.deleted && j.ghlAppointmentId && !seen.has(j.ghlAppointmentId) && !["Cancelled", "Completed"].includes(j.status) && M.isDay(j.date) && j.date >= from && j.date <= to);
    for (const j of gone) {
      let ap = null;
      try {
        ap = await appointment(j.ghlAppointmentId, o);
      } catch (e) {
        if (e.status !== 404) continue; // not sure: left for the next run
      }
      if (!ap || ap.deleted) plan({ ...(ap || {}), id: j.ghlAppointmentId, calendarId: (ap && ap.calendarId) || "", startTime: (ap && ap.startTime) || "", appointmentStatus: "cancelled" }, null);
      else plan(ap, null);
    }

    if (!dry && writes.length) {
      await save(db, writes);
      if (newLeads) await writeDoc(db, ...TURN, { next: turn }).catch(() => {});
      await writeDoc(db, "ghl_log", now.toISOString() + "-sync", { at: now.toISOString(), ok: true, result: "Matched the calendar to GHL: " + lines.length + (lines.length === 1 ? " change." : " changes."), lines: lines.slice(0, 60), by }).catch(() => {});
    }
    if (!dry) await writeDoc(db, "settings", "ghlsync", { lastSync: now.toISOString(), ok: true, error: "", by, changes: lines.length, appointments: evs.length }).catch(() => {});
    return json({ ok: true, dryRun: dry, appointments: evs.length, changes: lines.length, lines, from, to });
  } catch (e) {
    const error = String((e && e.message) || e).slice(0, 300);
    console.error("ghl-sync:", error);
    if (!dry) await writeDoc(db, "settings", "ghlsync", { lastSync: now.toISOString(), ok: false, error, by }).catch(() => {});
    return json({ ok: false, error }, 502);
  }
}

export const GET = run;
export const POST = run;
