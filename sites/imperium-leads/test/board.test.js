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
