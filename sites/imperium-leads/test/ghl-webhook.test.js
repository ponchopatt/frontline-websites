import assert from "node:assert/strict";
import { test } from "node:test";

// A pretend Supabase: every read answers `rows` for its collection; writes are recorded.
function fakeSupabase(rows = {}) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url)), method = (init.method || "GET").toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, path: u.pathname, query: u.search, body });
    const col = (/collection=eq\.([^&]+)/.exec(u.search) || [])[1];
    const id = (/(?:^|&)id=eq\.([^&]+)/.exec(u.search.slice(1)) || [])[1];
    if (method === "GET") {
      let list = (rows[decodeURIComponent(col || "")] || []).map((r) => ({ id: r.id, data: r.data }));
      if (id) list = list.filter((r) => r.id === decodeURIComponent(id));
      return new Response(JSON.stringify(list), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(method === "POST" && u.pathname.endsWith("/docs") ? "[]" : "", { status: method === "POST" ? 201 : 204, headers: { "content-type": "application/json" } });
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
const env = { SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-key", GHL_WEBHOOK_SECRET: "s3cret", VERCEL_ENV: "production" };
Object.assign(process.env, env);
const { GET, POST } = await import("../api/ghl-webhook.js");
const booking = { full_name: "Jo Smith", phone: "0400 111 222", email: "jo@example.com", calendar: { calendarName: "Interior Detail", appointmentId: "appt_7", startTime: "2026-10-24T09:00:00", selectedTimezone: "Australia/Sydney", appoinmentStatus: "confirmed" } };
const post = (q, body = booking, headers = {}) => POST(new Request("https://x.vercel.app/api/ghl-webhook" + q, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));
const writes = (calls) => calls.filter((c) => c.method !== "GET").map((c) => c.method + " " + (c.path.endsWith("/docs_merge") ? "merge " + c.body.p_collection : c.body && c.body.collection ? c.body.collection : c.path));

test("no key, or the wrong one: turned away, and the attempt is logged without what was sent", async () => {
  const s = fakeSupabase();
  try {
    for (const r of [await post(""), await post("?key=nope"), await post("", booking, { "x-ghl-secret": "wrong" })]) assert.equal(r.status, 401);
    const logs = s.calls.filter((c) => c.method === "POST" && c.body && c.body.collection === "ghl_log");
    assert.equal(logs.length, 3);
    assert.equal("body" in logs[0].body.data, false);
    assert.equal(s.calls.some((c) => c.body && (c.body.collection === "leads" || c.body.collection === "jobs")), false);
  } finally {
    s.restore();
  }
});

test("with the key: a booking makes its job, then its lead, and is logged with what came in", async () => {
  const s = fakeSupabase({ jobs: [{ id: "j1", data: { number: 1003, leadId: "z" } }] });
  try {
    const r = await post("?key=s3cret");
    const out = await r.json();
    assert.equal(r.status, 200);
    assert.deepEqual([out.ok, out.dryRun, out.number, out.newLead], [true, false, 1004, true]);
    assert.match(out.result, /New lead Jo Smith: job 1004, Sat 24 Oct 9:00am/);
    assert.deepEqual(writes(s.calls).slice(0, 4), ["POST jobs", "POST leads", "POST _system", "POST ghl_log"]);
    const job = s.calls.find((c) => c.body && c.body.collection === "jobs").body;
    assert.deepEqual([job.id, job.data.service, job.data.ghlAppointmentId, job.data.source], ["ghl-appt_7", "Interior", "appt_7", "ghl"]);
    const log = s.calls.find((c) => c.body && c.body.collection === "ghl_log").body.data;
    assert.deepEqual([log.ok, log.appointmentId, JSON.parse(log.body).full_name], [true, "appt_7", "Jo Smith"]);
    // The key in a header works too.
    assert.equal((await post("", booking, { "x-ghl-secret": "s3cret" })).status, 200);
  } finally {
    s.restore();
  }
});

test("a dry run (or a preview) says what it would do and writes nothing", async () => {
  const s = fakeSupabase();
  try {
    const out = await (await post("?key=s3cret&dry=1")).json();
    assert.deepEqual([out.ok, out.dryRun, out.wouldWrite], [true, true, ["create jobs/ghl-appt_7", "create leads/ghl-appt_7"]]);
    process.env.VERCEL_ENV = "preview";
    const pv = await (await post("?key=s3cret")).json();
    assert.equal(pv.dryRun, true);
    assert.deepEqual(writes(s.calls), []);
  } finally {
    process.env.VERCEL_ENV = "production";
    s.restore();
  }
});

test("GET with the key says it's set up; the log is for the team only", async () => {
  const s = fakeSupabase();
  try {
    const ok = await (await GET(new Request("https://x.vercel.app/api/ghl-webhook?key=s3cret"))).json();
    assert.deepEqual([ok.ok, ok.ready, ok.live], [true, true, true]);
    assert.equal((await GET(new Request("https://x.vercel.app/api/ghl-webhook"))).status, 401);
    assert.equal((await GET(new Request("https://x.vercel.app/api/ghl-webhook?log=1"))).status, 401);
    // With the key, the log can be read (to see what GHL sent).
    const lg = await GET(new Request("https://x.vercel.app/api/ghl-webhook?log=1&key=s3cret"));
    assert.equal(lg.status, 200);
    assert.deepEqual(await lg.json(), { entries: [] });
  } finally {
    s.restore();
  }
});
