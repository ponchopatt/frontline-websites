import { bodyFor, calendars, contact, customFields, events, locationOf, opportunities } from "../lib/ghl-api.js";
import { applyWrites, planPast, readBooking } from "../lib/ghl.js";
import { json, sameSecret } from "../lib/http.js";
import J from "../lib/jobs.js";
import { adminClient, readCollection, readDoc, writeDoc } from "../lib/supabase.js";
import { isTeam } from "../lib/team.js";

/*
  POST /api/ghl-import?key=<GHL_WEBHOOK_SECRET> — brings in the past GHL appointments, with the
  token in GHL_API_TOKEN (GHL → Settings → Private Integrations).

  Each appointment from `from` to `to` (two years back to a year ahead, by default) goes through
  planPast (lib/ghl.js): matched to its lead's job, an open lead made Done with it, or a new lead
  and its job; the price read from its description, else its opportunity's value. A lead keeps
  what it has; only the gaps are filled.

  It's a practice run unless &go=1 (and only the live site ever writes): it answers what it
  would do. A real run backs up every lead and job first. A run does up to `max` appointments
  (default 120) from `start`; the answer's `next` is where the next run starts.
*/

const live = () => process.env.VERCEL_ENV === "production";
const keyOf = (request) => {
  const url = new URL(request.url);
  return url.searchParams.get("key") || request.headers.get("x-ghl-secret") || "";
};
const day = (d) => d.toISOString().slice(0, 10);

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

export async function POST(request, { fetchFn } = {}) {
  if (!sameSecret(keyOf(request), process.env.GHL_WEBHOOK_SECRET) && !(await isTeam(request))) return json({ ok: false, error: "Not allowed" }, 401);
  const token = process.env.GHL_API_TOKEN;
  if (!token) return json({ ok: false, error: "GHL_API_TOKEN isn't set in Vercel yet." }, 400);
  const url = new URL(request.url), q = (k, d) => url.searchParams.get(k) || d;
  const now = new Date(), go = q("go", "") === "1" && live();
  const from = q("from", day(new Date(now.getTime() - 730 * 864e5))), to = q("to", day(new Date(now.getTime() + 365 * 864e5)));
  const start = Math.max(0, Number(q("start", 0)) || 0), max = Math.min(300, Math.max(1, Number(q("max", 120)) || 120));
  const db = adminClient(), o = { token, fetchFn };
  try {
    const locationId = await locationOf(db);
    if (!locationId) return json({ ok: false, error: "No GHL location yet: add GHL_LOCATION_ID, or make one booking so it's known." }, 400);
    const [leadRows, jobRows, cfg, cals, fields] = await Promise.all([
      readCollection(db, "leads"), readCollection(db, "jobs"), readDoc(db, "settings", "calendar").catch(() => null),
      calendars(locationId, o), customFields(locationId, o).catch(() => []),
    ]);
    const fieldNames = Object.fromEntries(fields.map((f) => [f.id, f.name]));
    const calName = Object.fromEntries(cals.map((c) => [c.id, c.name]));
    // Every appointment, oldest first, each once.
    const all = new Map();
    for (const list of await pool(cals, 3, (c) => events(locationId, c.id, from, to, o))) for (const ev of list) if (ev && ev.id && !all.has(ev.id)) all.set(ev.id, ev);
    const evs = [...all.values()].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    const part = evs.slice(start, start + max);
    // Each contact once; a price from their opportunity only when the description has none.
    const ids = [...new Set(part.map((e) => e.contactId).filter(Boolean))];
    const people = Object.fromEntries((await pool(ids, 6, async (id) => [id, await contact(id, o).catch(() => null)])));
    const needValue = [...new Set(part.filter((e) => !readBooking(bodyFor(e, people[e.contactId], calName[e.calendarId], fieldNames)).price).map((e) => e.contactId).filter(Boolean))];
    const values = Object.fromEntries(await pool(needValue, 6, async (id) => {
      const ops = await opportunities(locationId, id, o).catch(() => []);
      const best = ops.filter((x) => Number(x.monetaryValue) > 0).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0];
      return [id, best ? Math.round(Number(best.monetaryValue)) : 0];
    }));
    // Worked out in order, each seeing what the ones before it made.
    const state = { leads: leadRows.map((r) => ({ id: r.id, ...r.data })), jobs: jobRows.map((r) => ({ id: r.id, ...r.data })) };
    const counts = { new: 0, matched: 0, done: 0, upcoming: 0, repaired: 0, already: 0, skipped: 0 }, lines = [], writes = [];
    let priced = 0;
    for (const ev of part) {
      const ct = people[ev.contactId];
      const body = bodyFor(ev, ct, calName[ev.calendarId], fieldNames, values[ev.contactId] || 0);
      const p = planPast(body, { leads: state.leads, jobs: state.jobs, cfg: J.settings(cfg || {}), now, created: ct && ct.dateAdded });
      counts[p.kind] = (counts[p.kind] || 0) + 1;
      if (p.summary.price || values[ev.contactId]) priced += ["new", "matched", "done"].includes(p.kind) ? 1 : 0;
      if (p.writes.length) { applyWrites(state, p.writes); writes.push(...p.writes); }
      if (lines.length < 400) lines.push(String(ev.startTime).slice(0, 10) + " " + (calName[ev.calendarId] || "") + ": " + p.result);
    }
    const done = [];
    if (go) {
      if (start === 0) {
        const stamp = now.toISOString();
        await writeDoc(db, "backups", "leads-" + stamp.replace(/[:.]/g, "-"), { savedAt: stamp, reason: "before bringing in the past GHL appointments", count: leadRows.length,
          leads: leadRows.map((r) => ({ id: r.id, data: r.data })), jobs: jobRows.map((r) => ({ id: r.id, data: r.data })) });
      }
      // New jobs first (all at once), then new leads, then the changes to what's there, so a stop
      // part way never leaves a lead booked with no job (and a job left without its new lead is
      // put right by the next run).
      const stamp = new Date().toISOString();
      for (const col of ["jobs", "leads"]) {
        const rows = writes.filter((w) => w.op === "create" && w.collection === col).map((w) => ({ collection: col, id: w.id, data: w.data, updated_at: stamp }));
        for (let i = 0; i < rows.length; i += 100) {
          const { error } = await db.from("docs").upsert(rows.slice(i, i + 100), { onConflict: "collection,id", ignoreDuplicates: true });
          if (error) throw new Error(error.message);
        }
        done.push(rows.length + " new " + col);
      }
      const merges = writes.filter((w) => w.op === "merge");
      await pool(merges, 6, async (w) => {
        const { error } = await db.rpc("docs_merge", { p_collection: w.collection, p_id: w.id, p_patch: w.data });
        if (error) throw new Error(error.message);
      });
      done.push(merges.length + " changes");
    }
    const next = start + part.length < evs.length ? start + part.length : null;
    const result = (go ? "Brought in " : "Practice run: would bring in ") + (counts.new + counts.matched + counts.done + counts.upcoming) + " of " + part.length + " appointments (" + counts.new + " new leads, " + counts.matched + " matched to jobs here, " + counts.done + " open leads now done, " + counts.upcoming + " still to come, " + counts.already + " already in, " + counts.skipped + " left out" + (counts.repaired ? ", " + counts.repaired + " missing leads made" : "") + ").";
    if (go) await writeDoc(db, "ghl_log", now.toISOString() + "-import", { at: now.toISOString(), ok: true, result, done: done.slice(0, 50), counts }).catch(() => {});
    return json({ ok: true, dryRun: !go, result, from, to, calendars: cals.map((c) => c.name), appointments: evs.length, start, end: start + part.length, next, counts, priced, lines, writes: writes.length });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
}
