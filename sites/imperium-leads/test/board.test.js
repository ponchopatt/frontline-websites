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

test("a lead being chased is only cold once it's past due, so the schedule's gaps never count", () => {
  const touch = { at: at("2026-10-09"), by: "Angus", type: "text" };
  // Day 3 to day 7 of the schedule: four days with no touch, but it isn't due yet.
  assert.equal(M.coldness(lead({ stage: "Chasing", nextFollowUp: "2026-10-16", log: [touch] }), TODAY), null);
  assert.equal(M.coldness(lead({ stage: "Chasing", nextFollowUp: "2026-10-15", log: [touch] }), TODAY), null);
  assert.equal(M.coldness(lead({ stage: "Chasing", nextFollowUp: "2026-10-14", log: [touch] }), TODAY).level, "warm");
  assert.deepEqual(plain(M.coldness(lead({ stage: "Quoted", nextFollowUp: "2026-10-11", log: [touch] }), TODAY)), { level: "cold", days: 4, since: "due" });
});

test("a paused lead counts from its last touch; waiting, snoozed, booked and not-real leads are never cold", () => {
  const touch = { at: at("2026-10-12"), by: "Angus", type: "call" };
  assert.deepEqual(plain(M.coldness(lead({ stage: "Chasing", paused: true, log: [touch] }), TODAY)), { level: "warm", days: 3, since: "touch" });
  assert.equal(M.coldness(lead({ stage: "Chasing", paused: true, log: [{ ...touch, at: at("2026-10-09") }] }), TODAY).level, "cold");
  const old = { createdAt: at("2026-10-01"), date: "2026-10-01" };
  assert.equal(M.coldness(lead({ ...old, stage: "Waiting", nextFollowUp: "2026-10-02" }), TODAY), null);
  assert.equal(M.coldness(lead({ ...old, snoozeUntil: "2026-10-20" }), TODAY), null);
  assert.equal(M.coldness(lead({ ...old, stage: "Booked", status: "Booked", jobDate: "2026-10-20" }), TODAY), null);
  assert.equal(M.coldness(lead({ ...old, junk: true }), TODAY), null);
});

test("a lead's worth is the booked price, else the quote, else the price sheet as an estimate", () => {
  const booked = lead({ stage: "Booked", status: "Booked", jobDate: "2026-10-20", revenue: 320, quoted: 300 });
  assert.deepEqual(plain(M.dealValue(booked, TODAY, 225)), { amount: 320, est: false });
  assert.deepEqual(plain(M.dealValue(lead({ stage: "Quoted", quoted: 450 }), TODAY, 225)), { amount: 450, est: false });
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
    lead({ stage: "Quoted", quoted: 900, jobDate: "2026-10-16" }), // not booked
  ];
  assert.deepEqual(plain(M.weekMoney(L, TODAY, 3000)), { weekOf: "2026-10-12", done: 550, booked: 300, total: 850, goal: 3000, left: 2150, daysLeft: 3, pct: 28 });
  assert.equal(M.weekMoney(L, TODAY, 500).left, 0);
  assert.equal(M.weekMoney(L, TODAY, 500).pct, 100);
  assert.equal(M.weekMoney(L, TODAY, "").goal, null);
});

test("coming up lists who's due on each of the next days, mine or everyone's", () => {
  const due = (d, o = {}) => lead({ stage: "Chasing", status: "Contacted", touches: 2, chaseFrom: "2026-10-13", nextFollowUp: d, owner: "Angus", ...o });
  const L = [due("2026-10-15"), due("2026-10-16", { id: "a" }), due("2026-10-18", { id: "b", owner: "Ananth" }), due("2026-10-30"), due("2026-10-16", { junk: true })];
  const mine = M.upcoming(L, TODAY, 7, { who: "Angus" }), all = M.upcoming(L, TODAY, 7, { all: true });
  assert.deepEqual(plain(mine.map(d => d.leads.length)), [1, 0, 0, 0, 0, 0, 0]);
  assert.equal(mine[0].day, "2026-10-16");
  assert.deepEqual(plain(all.map(d => d.leads.length)), [1, 0, 1, 0, 0, 0, 0]);
  assert.equal(M.nextStep(L[0], TODAY), "Follow-up 3 of 4");
  assert.equal(M.nextStep(lead({ stage: "Quoted", quoted: 300, touches: 0 }), TODAY), "Quote follow-up 1 of 3");
});

test("a job added by hand finds the booked lead it's already here as, so the money isn't counted twice", () => {
  const booked = lead({ id: "s", name: "Shahmir Siraj", phone: "0412 345 678", stage: "Booked", status: "Booked", jobDate: "2026-10-09", revenue: 260 });
  const L = [booked, lead({ id: "x", name: "Sam", stage: "Booked", status: "Booked", jobDate: "2026-10-09" })];
  assert.equal(M.sameJob(L, { name: "Shahmir", jobDate: "2026-10-09" }).id, "s");
  assert.equal(M.sameJob(L, { name: "", phone: "+61 412 345 678", jobDate: "2026-10-11" }).id, "s");
  assert.equal(M.sameJob(L, { name: "Shahmir", jobDate: "2026-10-20" }), null); // a different week: a new job
  assert.equal(M.sameJob(L, { name: "Jo", jobDate: "2026-10-09" }), null);
});
