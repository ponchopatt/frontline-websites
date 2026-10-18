import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

// The lead model is a plain browser script (public/model.js); run it as the page does.
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL("../public/model.js", import.meta.url), "utf8"), sandbox);
const M = sandbox.window.ILModel;
const plain = (x) => JSON.parse(JSON.stringify(x));
const TODAY = "2026-10-15";
const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString(); // Canberra, daylight saving
const lead = (o) => ({ modelVersion: M.VERSION, stage: "New", createdAt: at("2026-10-15"), date: "2026-10-15", log: [], ...o });

test("a new lead goes orange after a day with no contact and red after two", () => {
  assert.equal(M.coldness(lead({}), TODAY), null);
  assert.deepEqual(plain(M.coldness(lead({ createdAt: at("2026-10-14"), date: "2026-10-14" }), TODAY)), { level: "warm", days: 1, since: "in" });
  assert.deepEqual(plain(M.coldness(lead({ createdAt: at("2026-10-11"), date: "2026-10-11" }), TODAY)), { level: "cold", days: 4, since: "in" });
});

test("a lead being chased is only cold once its touch is past due, so the planned gaps never count", () => {
  const touch = { at: at("2026-10-09"), by: "Angus", type: "text" };
  // Day 3 to day 7: four days with no touch, but it isn't due yet.
  assert.equal(M.coldness(lead({ stage: "Chasing", nextFollowUp: "2026-10-16", log: [touch] }), TODAY), null);
  assert.equal(M.coldness(lead({ stage: "Chasing", nextFollowUp: "2026-10-15", log: [touch] }), TODAY), null);
  assert.equal(M.coldness(lead({ stage: "Chasing", nextFollowUp: "2026-10-14", log: [touch] }), TODAY).level, "warm");
  assert.deepEqual(plain(M.coldness(lead({ stage: "Chasing", nextFollowUp: "2026-10-11", log: [touch] }), TODAY)), { level: "cold", days: 4, since: "due" });
});

test("waiting, booked and not-real leads are never cold", () => {
  const old = { createdAt: at("2026-10-01"), date: "2026-10-01" };
  assert.equal(M.coldness(lead({ ...old, stage: "Waiting", nextFollowUp: "2026-10-02" }), TODAY), null);
  assert.equal(M.coldness(lead({ ...old, stage: "Booked", status: "Booked", jobDate: "2026-10-20" }), TODAY), null);
  assert.equal(M.coldness(lead({ ...old, junk: true }), TODAY), null);
});

test("a lead's worth is the booked price, else the quote, else the price sheet as an estimate", () => {
  const booked = lead({ stage: "Booked", status: "Booked", jobDate: "2026-10-20", revenue: 320, quoted: 300 });
  assert.deepEqual(plain(M.dealValue(booked, TODAY, 225)), { amount: 320, est: false });
  assert.deepEqual(plain(M.dealValue(lead({ stage: "Chasing", quoted: 450 }), TODAY, 225)), { amount: 450, est: false });
  assert.deepEqual(plain(M.dealValue(lead({ quoted: null }), TODAY, 225)), { amount: 225, est: true });
  assert.equal(M.dealValue(lead({ quoted: "" }), TODAY, null), null);
});

test("the weekly goal counts this week's booked jobs by job day: done once the day comes, else booked", () => {
  const job = (jobDate, o = {}) => lead({ stage: "Booked", status: "Booked", jobDate, revenue: 300, ...o });
  const L = [
    job("2026-10-12"), // Monday, done
    job("2026-10-15", { revenue: null, quoted: 250 }), // today, done, counts the quote
    job("2026-10-18"), // Sunday, still booked
    job("2026-10-11"), // last week
    job("2026-10-19"), // next week
    job("2026-10-16", { junk: true }),
    lead({ stage: "Chasing", quoted: 900, jobDate: "2026-10-16" }), // not booked
  ];
  assert.deepEqual(plain(M.weekMoney(L, TODAY, 3000)), { weekOf: "2026-10-12", done: 550, booked: 300, total: 850, goal: 3000, left: 2150, daysLeft: 3, pct: 28 });
  assert.equal(M.weekMoney(L, TODAY, 500).left, 0);
  assert.equal(M.weekMoney(L, TODAY, 500).pct, 100);
  assert.equal(M.weekMoney(L, TODAY, "").goal, null);
});

test("this week: money against the target, jobs done, ceramics, new plans, replies within 5 minutes and upsell ticks", () => {
  const job = (jobDate, o = {}) => lead({ stage: "Booked", status: "Booked", jobDate, revenue: 300, createdAt: at("2026-09-01"), date: "2026-09-01", ...o });
  const L = [
    job("2026-10-13", { completedAt: at("2026-10-13"), service: "Ceramic", offeredPlan: "Yes" }), // done, a ceramic
    job("2026-10-14", { offeredCeramic: "Yes", offeredPlan: "Yes" }), // done (its day has passed)
    job("2026-10-17", { service: "Maintenance plan" }), // booked: a new plan
    job("2026-10-08", { service: "Ceramic" }), // last week
    lead({ plan: "Yes", planSince: "2026-10-12", stage: "Done", completedAt: at("2026-10-01"), jobDate: "2026-10-01" }), // went on a plan this week
    lead({ plan: "Yes", planSince: "2026-09-01", stage: "Done", completedAt: at("2026-09-01"), jobDate: "2026-09-01" }), // an old plan
    // New leads this week: replied in 3, in 12, not yet (came in an hour ago), and one just now.
    lead({ createdAt: at("2026-10-13", "10:00"), date: "2026-10-13", replyMins: 3, stage: "Chasing" }),
    lead({ createdAt: at("2026-10-14", "10:00"), date: "2026-10-14", replyMins: 12, stage: "Chasing" }),
    lead({ createdAt: at(TODAY, "09:00"), date: TODAY }),
    lead({ createdAt: at(TODAY, "09:58"), date: TODAY }),
    lead({ createdAt: at("2026-10-13", "10:00"), date: "2026-10-13", junk: true, replyMins: 1 }),
  ];
  const w = M.weekStats(L, TODAY, { goal: 5000, now: new Date(at(TODAY, "10:00")) });
  assert.equal(w.weekOf, "2026-10-12");
  assert.deepEqual([w.money.total, w.money.goal, w.money.pct], [900, 5000, 18]);
  assert.deepEqual([w.jobsDone.n, w.ceramics.n, w.plans.n], [2, 1, 2]);
  assert.deepEqual([w.replied.fast, w.replied.of], [1, 3]);
  assert.deepEqual([w.upsell.jobs, w.upsell.ceramic, w.upsell.plan], [3, 1, 2]);
});

test("by ad: leads, booked, booked $ and close rate; leads with no ad show as Unknown", () => {
  const L = [
    lead({ ad: "Raptor Ad", stage: "Booked", jobDate: "2026-10-20", revenue: 280 }),
    lead({ ad: "Raptor Ad", stage: "Chasing" }),
    lead({ ad: "Vw Ad", stage: "Done", completedAt: at("2026-10-10"), revenue: 250 }),
    lead({ fromAd: "none", stage: "New" }),
    lead({ fromAd: "referral", stage: "Booked", jobDate: "2026-10-20", revenue: 320 }),
    lead({ source: "Referral" }), // an older lead with no ad: Unknown
    lead({ ad: "Vw Ad", junk: true }),
  ];
  const t = plain(M.byAd(L, TODAY)).map(({ ad, leads, booked, money, rate }) => [ad, leads, booked, money, rate]);
  assert.deepEqual(t, [
    ["Raptor Ad", 2, 1, 280, 0.5],
    ["Not from an ad", 1, 0, 0, 0],
    ["Referral / repeat", 1, 1, 320, 1],
    ["Vw Ad", 1, 1, 250, 1],
    ["Unknown", 1, 0, 0, 0],
  ]);
});

test("a job added by hand finds the booked lead it's already here as, so the money isn't counted twice", () => {
  const booked = lead({ id: "s", name: "Shahmir Siraj", phone: "0412 345 678", stage: "Booked", status: "Booked", jobDate: "2026-10-09", revenue: 260 });
  const L = [booked, lead({ id: "x", name: "Sam", stage: "Booked", status: "Booked", jobDate: "2026-10-09" })];
  assert.equal(M.sameJob(L, { name: "Shahmir", jobDate: "2026-10-09" }).id, "s");
  assert.equal(M.sameJob(L, { name: "", phone: "+61 412 345 678", jobDate: "2026-10-11" }).id, "s");
  assert.equal(M.sameJob(L, { name: "Shahmir", jobDate: "2026-10-20" }), null); // a different week: a new job
  assert.equal(M.sameJob(L, { name: "Jo", jobDate: "2026-10-09" }), null);
});
