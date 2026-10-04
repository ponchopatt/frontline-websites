import assert from "node:assert/strict";
import { test } from "node:test";
import M from "../lib/model.js";

const TODAY = "2026-10-12";
const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString();
const H = M.hours();
const lead = (id, p) => ({ id, date: "2026-10-01", createdAt: at("2026-10-01"), owner: "Angus", name: "Jo", phone: "0400 111 222", car: "", log: [], ...M.newFields(""), ...p });
const fresh = { source: "Meta ad", ad: "Brand film", service: "Ceramic", car: "Kluger", email: "jo@x.com", notes: "Dog hair", timeline: "asap", score: "Hot", scoreBy: "timeline" };

test("the same phone number goes on the lead that's still open, however it's written", () => {
  const leads = [lead("open", { stage: "Chasing", touches: 2, chaseFrom: "2026-10-02", nextFollowUp: "2026-10-16", log: [{ at: at("2026-10-05"), type: "text" }] })];
  const m = M.matchPhone(leads, "+61 400 111 222", TODAY);
  assert.equal(m.merge.id, "open");
  const p = M.mergeEnquiry(m.merge, fresh, at(TODAY, "09:00"));
  assert.deepEqual([p.enquiries.length, p.enquiries[0].source, p.enquiries[0].notes, p.againAt, p.nextFollowUp], [1, "Meta ad", "Dog hair", at(TODAY, "09:00"), TODAY]);
  assert.deepEqual([p.car, p.email, p.service], ["Kluger", "jo@x.com", "Ceramic"]); // gaps filled
  const after = M.sync({ ...leads[0], ...p }, TODAY);
  assert.equal(after.stage, "Chasing"); // its schedule carries on
  assert.equal(M.place(after, TODAY, new Date(at(TODAY, "09:05")), H), "fresh"); // shows as new again
  // Once someone texts, it's back to its place in the schedule.
  const texted = M.sync({ ...after, ...M.touch(after, { at: at(TODAY, "09:10"), type: "text" }) }, TODAY);
  assert.deepEqual([M.againPending(texted), texted.touches], [false, 3]);
});

test("Waiting or Lost within 30 days: back to New with a fresh schedule", () => {
  for (const stage of ["Waiting", "Lost"]) {
    const l = lead("x", { stage, status: stage === "Lost" ? "Lost" : "Contacted", touches: 4, chaseFrom: "2026-09-01", date: stage === "Lost" ? "2026-09-20" : "2026-08-01" });
    const m = M.matchPhone([l], "0400111222", TODAY);
    assert.equal(m.merge.id, "x", stage);
    const after = M.sync({ ...l, ...M.mergeEnquiry(l, fresh, at(TODAY)) }, TODAY);
    assert.deepEqual([after.stage, after.status, after.touches, after.chaseFrom], ["New", "New", 0, ""], stage);
  }
});

test("a booking or job from the last 30 days takes the enquiry; older ones make a new lead marked Repeat", () => {
  const booked = lead("b", { stage: "Booked", status: "Booked", date: "2026-10-02", jobDate: "2026-10-20" });
  assert.equal(M.matchPhone([booked], "0400 111 222", TODAY).merge.id, "b");
  const after = M.sync({ ...booked, ...M.mergeEnquiry(booked, fresh, at(TODAY)) }, TODAY);
  assert.deepEqual([after.stage, M.place(after, TODAY, new Date(at(TODAY, "11:00")), H)], ["Booked", "fresh"]);
  const oldJob = lead("old", { stage: "Done", status: "Booked", date: "2026-08-01", createdAt: at("2026-08-01"), jobDate: "2026-08-05", completedAt: at("2026-08-05") });
  const oldLost = lead("lost", { stage: "Lost", status: "Lost", date: "2026-07-01", createdAt: at("2026-07-01") });
  assert.deepEqual(M.matchPhone([oldLost, oldJob], "0400 111 222", TODAY), { repeatOf: "old" }); // the newest
  assert.deepEqual(M.matchPhone([oldJob], "0499 999 999", TODAY), {});
  // A lead marked Not real is never matched.
  assert.deepEqual(M.matchPhone([lead("fake", { stage: "Chasing", junk: true })], "0400 111 222", TODAY), {});
});

test("weekly ad spend: cost per booked job by ad, and spend changes it", () => {
  assert.equal(M.mondayOf("2026-10-04"), "2026-09-28"); // a Sunday
  assert.equal(M.mondayOf("2026-10-05"), "2026-10-05");
  const leads = [
    lead("a", { ad: "Brand film", stage: "Booked", jobDate: "2026-10-20" }),
    lead("b", { ad: "Brand film", stage: "Chasing" }),
    lead("c", { ad: "Snow foam", stage: "Done", completedAt: at("2026-10-03") }),
    lead("d", { ad: "Snow foam", stage: "Booked", jobDate: "2026-10-20" }),
    lead("e", { ad: "", stage: "Booked" }),
  ];
  const weeks = [{ weekOf: "2026-09-28", byAd: { "Brand film": 100, "Snow foam": 60 } }, { weekOf: "2026-10-05", byAd: { "Brand film": 50, Nothing: "" } }, { weekOf: "2026-08-03", byAd: { "Brand film": 999 } }];
  const spend = M.spendByAd(weeks, (w) => w >= "2026-09-01");
  assert.deepEqual(spend, { byAd: { "Brand film": 150, "Snow foam": 60 }, total: 210 });
  const c = M.costPerBooked(leads, spend, TODAY);
  assert.deepEqual(c.rows.map((r) => [r.ad, r.spend, r.leads, r.booked, r.perBooked]), [["Brand film", 150, 2, 1, 150], ["Snow foam", 60, 2, 2, 30]]);
  assert.equal(c.all, 70);
  // Spend goes up, cost per booked job goes up.
  const more = M.costPerBooked(leads, M.spendByAd([...weeks, { weekOf: "2026-10-05", byAd: { "Snow foam": 40 } }], (w) => w >= "2026-09-01"), TODAY);
  assert.equal(more.rows.find((r) => r.ad === "Snow foam").perBooked, 50);
});
