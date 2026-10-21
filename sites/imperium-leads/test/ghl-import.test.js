import assert from "node:assert/strict";
import { test } from "node:test";

// A pretend GHL and a pretend Supabase, behind one fetch.
function fake({ leads = [], jobs = [], log = [] } = {}) {
  const calls = [], real = globalThis.fetch;
  const ok = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url)), method = (init.method || "GET").toUpperCase(), body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, host: u.host, path: u.pathname, query: u.search, body, version: init.headers && init.headers.Version });
    if (u.host === "services.leadconnectorhq.com") {
      if (u.pathname === "/calendars/") return ok({ calendars: [{ id: "cal1", name: "Detailing Bookings" }] });
      if (u.pathname === "/locations/loc1/customFields") return ok({ customFields: [{ id: "f1", name: "What Service" }, { id: "f2", name: "Type Of Vehicle" }] });
      if (u.pathname === "/calendars/events") {
        const s = Number(u.searchParams.get("startTime")), e = Number(u.searchParams.get("endTime"));
        const all = [
          { id: "ev1", calendarId: "cal1", contactId: "c1", title: "Booking", startTime: "2026-08-10T09:00:00+10:00", endTime: "2026-08-10T12:00:00+10:00", appointmentStatus: "showed", notes: "Paid $320" },
          { id: "ev2", calendarId: "cal1", contactId: "c2", title: "Booking", startTime: "2026-09-02T10:00:00+10:00", endTime: "2026-09-02T12:00:00+10:00", appointmentStatus: "confirmed", notes: "" },
          { id: "ev3", calendarId: "cal1", contactId: "c3", title: "Booking", startTime: "2026-09-05T10:00:00+10:00", endTime: "2026-09-05T11:00:00+10:00", appointmentStatus: "cancelled", notes: "" },
        ];
        return ok({ events: all.filter((x) => { const t = Date.parse(x.startTime); return t >= s && t < e; }) });
      }
      if (u.pathname.startsWith("/contacts/")) {
        const id = u.pathname.split("/").pop();
        return ok({ contact: { id, firstName: "Test", lastName: id.toUpperCase(), phone: "+6140000000" + id.slice(1), email: id + "@example.com", city: "Gungahlin", dateAdded: "2026-07-01T00:00:00.000Z", customFields: [{ id: "f1", value: "Interior" }, { id: "f2", value: "SUV" }] } });
      }
      if (u.pathname === "/opportunities/search") return ok({ opportunities: u.searchParams.get("contact_id") === "c2" ? [{ monetaryValue: 250, updatedAt: "2026-08-30" }] : [] });
      return ok({ message: "not here" }, 404);
    }
    // Supabase.
    const col = decodeURIComponent((/collection=eq\.([^&]+)/.exec(u.search) || [])[1] || "");
    if (method === "GET") {
      const rows = col === "leads" ? leads : col === "jobs" ? jobs : col === "ghl_log" ? log : [];
      return ok(rows.map((r) => ({ id: r.id, data: r.data })));
    }
    return new Response(method === "POST" && u.pathname.endsWith("/docs") ? "[]" : "", { status: method === "POST" ? 201 : 204, headers: { "content-type": "application/json" } });
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
Object.assign(process.env, { SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-key", GHL_WEBHOOK_SECRET: "s3cret", GHL_API_TOKEN: "pit-test", VERCEL_ENV: "production", GHL_LOCATION_ID: "loc1" });
const { POST } = await import("../api/ghl-import.js");
const run = (q) => POST(new Request("https://x.vercel.app/api/ghl-import?key=s3cret&from=2026-08-01&to=2026-09-30" + q, { method: "POST" }));

test("a practice run says what it would bring in, and writes nothing", async () => {
  const s = fake();
  try {
    const out = await (await run("")).json();
    assert.equal(out.ok, true, out.error);
    assert.deepEqual([out.dryRun, out.appointments, out.counts.new, out.counts.skipped, out.next], [true, 3, 2, 1, null]);
    assert.match(out.result, /^Practice run: would bring in 2 of 3/);
    assert.match(out.lines.join("\n"), /New lead Test C1: job 1001, Mon 10 Aug, \$320/);
    assert.match(out.lines.join("\n"), /New lead Test C2: job 1002, Wed 2 Sept?, \$250/); // the opportunity's value
    assert.equal(s.calls.some((c) => c.host !== "services.leadconnectorhq.com" && c.method !== "GET"), false);
    assert.ok(s.calls.filter((c) => c.host === "services.leadconnectorhq.com").every((c) => c.version));
  } finally {
    s.restore();
  }
});

test("&go=1 backs up first, then writes each job before its lead", async () => {
  const s = fake({ leads: [{ id: "l1", data: { name: "Kept", phone: "0499 999 999", stage: "Chasing" } }] });
  try {
    const out = await (await run("&go=1")).json();
    assert.equal(out.dryRun, false);
    const w = s.calls.filter((c) => c.host === "fake.supabase.co" && c.method === "POST" && c.body && c.body.collection).map((c) => c.body.collection + "/" + c.body.id);
    assert.deepEqual(w.slice(0, 5), ["backups/" + w[0].split("/")[1], "jobs/ghl-ev1", "leads/ghl-ev1", "jobs/ghl-ev2", "leads/ghl-ev2"]);
    assert.ok(w[0].startsWith("backups/leads-"));
    assert.equal(s.calls.some((c) => c.body && c.body.id === "l1"), false); // a lead not in GHL is never touched
  } finally {
    s.restore();
  }
});

test("no key: turned away; no token yet: says so", async () => {
  const s = fake();
  try {
    assert.equal((await POST(new Request("https://x.vercel.app/api/ghl-import", { method: "POST" }))).status, 401);
    delete process.env.GHL_API_TOKEN;
    const r = await run("");
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /GHL_API_TOKEN/);
  } finally {
    process.env.GHL_API_TOKEN = "pit-test";
    s.restore();
  }
});
