import assert from "node:assert/strict";
import { test } from "node:test";
import M from "../lib/model.js";
import { spendPatches, weeksOf } from "../lib/meta.js";

test("Meta's days add up into weeks, Monday to Sunday, to the cent", () => {
  const rows = [
    { day: "2026-10-12", ad: "Raptor Ad", spend: 10.1 }, { day: "2026-10-18", ad: "Raptor Ad", spend: 20.2 }, // Mon and Sun: one week
    { day: "2026-10-19", ad: "Vw Ad", spend: 5.55 }, { day: "2026-10-19", ad: "Raptor Ad", spend: 1 },
    { day: "2026-09-28", ad: "Raptor Ad", spend: 99 }, // before the first week asked for
  ];
  const w = weeksOf(rows, "2026-10-14", "2026-10-26");
  assert.deepEqual(Object.keys(w), ["2026-10-12", "2026-10-19", "2026-10-26"]);
  assert.deepEqual(w["2026-10-12"], { total: 30.3, byAd: { "Raptor Ad": 30.3 } });
  assert.deepEqual(w["2026-10-19"], { total: 6.55, byAd: { "Vw Ad": 5.55, "Raptor Ad": 1 } });
  assert.deepEqual(w["2026-10-26"], { total: 0, byAd: {} }); // nothing spent: $0, not left out
});

test("a total typed in by hand is kept the first time Meta's replaces it", () => {
  const weeks = { "2026-10-05": { total: 540.2, byAd: { A: 540.2 } }, "2026-10-12": { total: 462, byAd: {} }, "2026-10-19": { total: 80, byAd: {} } };
  const existing = { "2026-10-05": { weekOf: "2026-10-05", total: 543 }, "2026-10-12": { weekOf: "2026-10-12", total: 470, from: "meta", handTotal: 462 } };
  const p = spendPatches(weeks, existing, "2026-10-22T00:00:00.000Z");
  assert.deepEqual(p.map((x) => [x.id, x.data.total, x.data.handTotal, x.data.from, x.isNew]), [
    ["2026-10-05", 540.2, 543, "meta", false],
    ["2026-10-12", 462, undefined, "meta", false],
    ["2026-10-19", 80, undefined, "meta", true],
  ]);
  assert.equal(M.adSpend(p.map((x) => x.data)), 540.2 + 462 + 80);
});

// A pretend Meta and a pretend Supabase, behind one fetch.
function fake({ spend = [], metaError = null } = {}) {
  const calls = [], real = globalThis.fetch;
  const ok = (body, status = 200) => new Response(body == null || status === 204 ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url)), method = (init.method || "GET").toUpperCase(), body = init.body ? JSON.parse(init.body) : null;
    const auth = init.headers && (init.headers.Authorization || init.headers.authorization || (init.headers.get && init.headers.get("authorization")));
    calls.push({ method, host: u.host, path: u.pathname, query: u.searchParams, body });
    if (u.host === "graph.facebook.com") {
      if (metaError) return ok({ error: metaError }, 400);
      const { since, until } = JSON.parse(u.searchParams.get("time_range"));
      const days = [];
      for (let d = since; d <= until; d = M.addDays(d, 1)) days.push(d);
      const all = days.flatMap((d) => [{ ad_name: "Raptor Ad", spend: "10.00", date_start: d, date_stop: d }, { ad_name: "Vw Ad", spend: "5.50", date_start: d, date_stop: d }]);
      // Two pages, as Meta does.
      const after = u.searchParams.get("after"), half = Math.ceil(all.length / 2);
      if (!after) { const next = new URL(u); next.searchParams.set("after", "p2"); return ok({ data: all.slice(0, half), paging: { next: next.toString() } }); }
      return ok({ data: all.slice(half) });
    }
    if (u.pathname === "/auth/v1/user") return String(auth).endsWith("team-token") ? ok({ id: "u1", email: "team@imperiumdetailing.com.au" }) : ok({ msg: "bad jwt" }, 401);
    if (u.pathname === "/rest/v1/docs" && method === "GET") return ok(spend.map((r) => ({ id: r.id, data: r.data })));
    if (u.pathname === "/rest/v1/rpc/docs_merge") return ok(null, 204);
    if (u.pathname === "/rest/v1/docs") return ok(null, 201);
    return ok({ message: "not here" }, 404);
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
Object.assign(process.env, { SUPABASE_URL: "https://fake.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-key", META_ACCESS_TOKEN: "meta-token", META_AD_ACCOUNT_ID: "act_123", CRON_SECRET: "cron-s3cret", VERCEL_ENV: "production" });
delete process.env.META_APP_SECRET;
const { GET, POST } = await import("../api/ad-spend.js");
const req = (q, auth, method = "POST") => new Request("https://x.vercel.app/api/ad-spend" + q, { method, headers: auth ? { authorization: "Bearer " + auth } : {} });

test("no sign-in, no spend", async () => {
  const s = fake();
  try {
    assert.equal((await POST(req("", null))).status, 401);
    assert.equal((await POST(req("", "someone-else"))).status, 401);
    assert.equal(s.calls.some((c) => c.host === "graph.facebook.com"), false);
  } finally {
    s.restore();
  }
});

test("the app's button: two weeks from Meta, saved for each week, with how it went", async () => {
  const s = fake({ spend: [{ id: M.mondayOf(M.canberraDate(new Date())), data: { weekOf: M.mondayOf(M.canberraDate(new Date())), total: 50 } }] });
  try {
    const out = await (await POST(req("?weeks=2", "team-token"))).json();
    assert.equal(out.ok, true, out.error);
    const today = M.canberraDate(new Date()), mon = M.mondayOf(today), last = M.addDays(mon, -7);
    const daysThisWeek = M.daysBetween(mon, today) + 1;
    assert.deepEqual(out.weeks.map((w) => [w.weekOf, w.total, w.ads]), [[last, 7 * 15.5, 2], [mon, Math.round(daysThisWeek * 15.5 * 100) / 100, 2]]);
    const meta = s.calls.filter((c) => c.host === "graph.facebook.com");
    assert.equal(meta.length, 2); // both pages
    assert.equal(meta[0].path, "/v23.0/act_123/insights");
    assert.deepEqual([meta[0].query.get("level"), meta[0].query.get("time_increment"), meta[0].query.get("access_token")], ["ad", "1", "meta-token"]);
    const merges = s.calls.filter((c) => c.path === "/rest/v1/rpc/docs_merge");
    assert.deepEqual(merges.map((c) => [c.body.p_collection, c.body.p_id, c.body.p_patch.from, c.body.p_patch.byAd["Raptor Ad"] > 0]), [["spend", last, "meta", true], ["spend", mon, "meta", true]]);
    assert.equal(merges[1].body.p_patch.handTotal, 50); // the $50 typed in this week is kept
    const status = s.calls.find((c) => c.path === "/rest/v1/docs" && c.method === "POST");
    assert.deepEqual([status.body.collection, status.body.id, status.body.data.ok, status.body.data.by], ["settings", "meta", true, "App"]);
  } finally {
    s.restore();
  }
});

test("the daily run comes in with the cron secret; a preview only says what it would save", async () => {
  const s = fake();
  try {
    const out = await (await GET(req("", "cron-s3cret", "GET"))).json();
    assert.equal(out.ok, true, out.error);
    assert.equal(out.weeks.length, 3);
    process.env.VERCEL_ENV = "preview";
    const before = s.calls.length;
    const dry = await (await POST(req("", "team-token"))).json();
    assert.equal(dry.dryRun, true);
    assert.equal(s.calls.slice(before).some((c) => c.method === "POST" && c.host !== "graph.facebook.com" && c.path !== "/auth/v1/user"), false);
  } finally {
    process.env.VERCEL_ENV = "production";
    s.restore();
  }
});

test("Meta turning the token down says so, and the app shows it", async () => {
  const s = fake({ metaError: { message: "Error validating access token", code: 190 } });
  try {
    const r = await POST(req("", "team-token"));
    assert.equal(r.status, 502);
    assert.match((await r.json()).error, /token has run out/);
    const status = s.calls.find((c) => c.path === "/rest/v1/docs" && c.method === "POST");
    assert.deepEqual([status.body.id, status.body.data.ok], ["meta", false]);
    assert.equal(s.calls.some((c) => c.path === "/rest/v1/rpc/docs_merge"), false);
  } finally {
    s.restore();
  }
});

test("not linked yet: says so and asks Meta nothing", async () => {
  const s = fake(), tok = process.env.META_ACCESS_TOKEN;
  delete process.env.META_ACCESS_TOKEN;
  try {
    const r = await POST(req("", "team-token"));
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error, "not_set_up");
    assert.equal(s.calls.some((c) => c.host === "graph.facebook.com"), false);
  } finally {
    process.env.META_ACCESS_TOKEN = tok;
    s.restore();
  }
});
