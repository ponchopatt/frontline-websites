import assert from "node:assert/strict";
import { test } from "node:test";
import M from "../lib/model.js";

// Days around today (Canberra), and a time on one, as GHL sends it.
const TODAY = M.canberraDate(new Date());
const day = (n) => M.addDays(TODAY, n);
const at = (d, hm) => M.canberraAt(d, Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3))).toISOString();

// A pretend GHL and a pretend Supabase, behind one fetch. Made-up people only.
function fake({ leads = [], jobs = [], events = [], lookups = {} } = {}) {
  const calls = [], real = globalThis.fetch;
  const ok = (body, status = 200) => new Response(body == null || status === 204 ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url)), method = (init.method || "GET").toUpperCase(), body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, host: u.host, path: u.pathname, query: u.search, body });
    if (u.host === "services.leadconnectorhq.com") {
      if (u.pathname === "/calendars/") return ok({ calendars: [{ id: "cal1", name: "Detailing Bookings" }] });
      if (u.pathname.endsWith("/customFields")) return ok({ customFields: [] });
      if (u.pathname === "/calendars/events") {
        const s = Number(u.searchParams.get("startTime")), e = Number(u.searchParams.get("endTime"));
        return ok({ events: events.filter((x) => { const t = Date.parse(x.startTime); return t >= s && t < e; }) });
      }
      if (u.pathname.startsWith("/calendars/events/appointments/")) {
        const id = u.pathname.split("/").pop();
        return lookups[id] ? ok({ appointment: lookups[id] }) : ok({ message: "not found" }, 404);
      }
      if (u.pathname.startsWith("/contacts/")) {
        const id = u.pathname.split("/").pop();
        return ok({ contact: { id, firstName: "Test", lastName: id.toUpperCase(), phone: "+6140000099" + id.slice(-1), email: id + "@example.com" } });
      }
      return ok({ message: "not here" }, 404);
    }
    const col = decodeURIComponent((/collection=eq\.([^&]+)/.exec(u.search) || [])[1] || "");
    if (method === "GET") return ok((col === "leads" ? leads : col === "jobs" ? jobs : []).map((r) => ({ id: r.id, data: r.data })));
    return ok(null, u.pathname.endsWith("/docs") ? 201 : 204);
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
Object.assign(process.env, { SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-key", GHL_WEBHOOK_SECRET: "s3cret", GHL_API_TOKEN: "pit-test", GHL_LOCATION_ID: "loc1", CRON_SECRET: "cron-s3cret", VERCEL_ENV: "production" });
const { GET, POST } = await import("../api/ghl-sync.js");
const run = (q = "", headers = {}) => POST(new Request("https://x.vercel.app/api/ghl-sync?key=s3cret" + q, { method: "POST", headers }));
const merges = (s) => s.calls.filter((c) => c.path === "/rest/v1/rpc/docs_merge").map((c) => c.body);
const creates = (s) => s.calls.filter((c) => c.method === "POST" && c.path === "/rest/v1/docs").flatMap((c) => (Array.isArray(c.body) ? c.body : [c.body]));

const lead = (id, o = {}) => ({ id, data: { modelVersion: M.VERSION, name: "Test " + id, phone: "0400 000 1" + id.slice(-2), owner: "Angus", stage: "Booked", status: "Booked", revenue: 280, date: day(-20), createdAt: at(day(-20), "09:00"), log: [], ...o } });
const job = (id, leadId, appt, d, o = {}) => ({ id, data: { number: Number(id.slice(-4)), leadId, service: "Full Detail", price: "280", date: d, start: "09:00", end: "12:30", status: "Scheduled", source: "ghl", ghlAppointmentId: appt, ghlStatus: "confirmed", ghlCalendar: "Detailing Bookings", createdAt: at(day(-20), "10:00"), ...o } });
const ev = (id, d, hm, o = {}) => ({ id, calendarId: "cal1", contactId: "c_" + id, startTime: at(d, hm), endTime: at(d, hm === "09:00" ? "12:30" : "15:00"), appointmentStatus: "confirmed", title: "Full Detail", notes: "", ...o });

test("a booking moved in GHL moves its job and the lead's day; one that's the same is left", async () => {
  const s = fake({
    leads: [lead("lA", { jobDate: day(3), jobTime: "09:00" }), lead("lB", { jobDate: day(5), jobTime: "09:00" })],
    jobs: [job("ghl-1001", "lA", "A", day(3)), job("ghl-1002", "lB", "B", day(5))],
    events: [ev("A", day(4), "11:30"), ev("B", day(5), "09:00")],
  });
  try {
    const out = await (await run()).json();
    assert.equal(out.ok, true, out.error);
    assert.equal(out.changes, 1);
    const m = merges(s);
    assert.deepEqual(m.find((x) => x.p_collection === "jobs").p_patch.date, day(4));
    assert.deepEqual([m.find((x) => x.p_collection === "jobs").p_id, m.find((x) => x.p_collection === "leads").p_patch.jobDate, m.find((x) => x.p_collection === "leads").p_patch.jobTime], ["ghl-1001", day(4), "11:30"]);
    assert.equal(m.some((x) => x.p_id === "ghl-1002" || x.p_id === "lB"), false);
  } finally {
    s.restore();
  }
});

test("a booking deleted in GHL cancels its job and puts the lead back in Chasing", async () => {
  const s = fake({
    leads: [lead("lC", { jobDate: day(6), jobTime: "09:00" })],
    jobs: [job("ghl-1003", "lC", "C", day(6))],
    events: [], lookups: { C: { id: "C", calendarId: "cal1", startTime: at(day(6), "09:00"), appointmentStatus: "confirmed", deleted: true } },
  });
  try {
    const out = await (await run()).json();
    assert.equal(out.ok, true, out.error);
    const m = merges(s);
    assert.equal(m.find((x) => x.p_id === "ghl-1003").p_patch.status, "Cancelled");
    assert.equal(m.find((x) => x.p_id === "lC").p_patch.stage, "Chasing");
    assert.ok(s.calls.some((c) => c.path === "/calendars/events/appointments/C"));
  } finally {
    s.restore();
  }
});

test("a booking that isn't here is booked in, as the webhook would", async () => {
  const s = fake({ events: [ev("N", day(2), "09:00")] });
  try {
    const out = await (await run()).json();
    assert.equal(out.ok, true, out.error);
    assert.deepEqual(creates(s).filter((r) => r.collection !== "settings" && r.collection !== "ghl_log" && r.collection !== "_system").map((r) => r.collection + "/" + r.id), ["jobs/ghl-N", "leads/ghl-N"]);
    assert.match(out.lines[0], /New lead Test C_N/);
  } finally {
    s.restore();
  }
});

test("a job done here only moves to GHL's day: the lead stays done", async () => {
  const s = fake({
    leads: [lead("lD", { stage: "Done", jobDate: day(-2), completedAt: at(day(-2), "12:00"), paid: "Yes" })],
    jobs: [job("ghl-1004", "lD", "D", day(-2), { status: "Completed" })],
    events: [ev("D", day(-3), "09:00")],
  });
  try {
    await run();
    const lp = merges(s).find((x) => x.p_id === "lD").p_patch;
    assert.equal(lp.jobDate, day(-3));
    assert.equal(lp.stage, undefined); // not booked again
    assert.equal(lp.completedAt, undefined);
  } finally {
    s.restore();
  }
});

test("a job with two GHL appointments goes by its first one", async () => {
  const s = fake({
    leads: [lead("lE", { jobDate: day(8), jobTime: "09:00" })],
    jobs: [job("ghl-1005", "lE", "E1", day(8), { ghlAppointmentIds: ["E1", "E2"] })],
    events: [ev("E1", day(8), "09:00"), ev("E2", day(9), "09:00"), ev("E3", day(10), "09:00", { appointmentStatus: "cancelled", contactId: "c_E1" })],
  });
  try {
    const out = await (await run()).json();
    assert.equal(out.changes, 0, out.lines.join("\n"));
    assert.equal(merges(s).length, 0);
  } finally {
    s.restore();
  }
});

test("a practice run says what it would change and saves nothing; no key, no sync; the hourly run is let in", async () => {
  const s = fake({ events: [ev("P", day(2), "09:00")] });
  try {
    const dry = await (await run("&dry=1")).json();
    assert.deepEqual([dry.dryRun, dry.changes], [true, 1]);
    assert.equal(s.calls.some((c) => c.host === "fake.supabase.co" && c.method === "POST"), false);
    assert.equal((await POST(new Request("https://x.vercel.app/api/ghl-sync", { method: "POST" }))).status, 401);
    const cron = await GET(new Request("https://x.vercel.app/api/ghl-sync", { headers: { authorization: "Bearer cron-s3cret" } }));
    assert.equal((await cron.json()).ok, true);
  } finally {
    s.restore();
  }
});
