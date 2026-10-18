import assert from "node:assert/strict";
import { test } from "node:test";
import M from "../lib/model.js";
import "../public/texts.js";

const T = globalThis.ILTexts;
const TODAY = "2026-10-20";
const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString();
const lead = (p = {}) => M.sync({ id: "x", date: TODAY, createdAt: at(TODAY, "09:00"), owner: "Angus", name: "Jo Smith", car: "Kluger", phone: "0400 111 222", log: [], ...M.newFields(""), ...p }, TODAY);
const apply = (l, patch) => M.sync({ ...l, ...patch }, TODAY);

test("a call note keeps the chips, the words, when and who; the newest shows as one line", () => {
  let l = lead({ stage: "Chasing", touches: 1 });
  l = apply(l, M.note(l, "", at(TODAY, "10:05"), "Ananth", ["Price", "Timing", "Price", "Made up"]));
  l = apply(l, M.note(l, "wants Saturday", at(TODAY, "11:30"), "Angus", ["Pet hair"]));
  const notes = M.callNotes(l);
  assert.equal(notes.length, 2);
  assert.deepEqual([notes[0].by, notes[0].chips, notes[0].text, notes[0].at], ["Angus", ["Pet hair"], "wants Saturday", at(TODAY, "11:30")]);
  assert.deepEqual(notes[1].chips, ["Price", "Timing"]); // each chip once, only real chips
  assert.equal(M.noteLine(notes[0]), "Pet hair, wants Saturday");
  // A note changes nothing else: the touches carry on.
  assert.deepEqual([l.stage, l.touches], ["Chasing", 1]);
  // Things the app logs by itself, and empty notes, aren't call notes.
  const booked = apply(l, M.book(l, { date: "2026-10-25" }, at(TODAY, "12:00"), "Angus"));
  const blank = apply(booked, M.note(booked, "  ", at(TODAY, "12:01"), "Angus", []));
  assert.equal(M.callNotes(blank).length, 2);
});

test("chip counts for Numbers: times used and how many leads, most used first", () => {
  const a = apply(lead({ id: "a" }), { log: [{ at: at(TODAY), by: "Angus", type: "note", note: "", chips: ["Price", "Pet hair"] }, { at: at(TODAY, "11:00"), by: "Angus", type: "note", note: "", chips: ["Price"] }] });
  const b = apply(lead({ id: "b" }), { log: [{ at: at("2026-09-01"), by: "Ananth", type: "note", note: "x", chips: ["Price", "Smell"] }] });
  const fake = apply(lead({ id: "c", junk: true }), { log: [{ at: at(TODAY), type: "note", chips: ["Smell"] }] });
  const all = M.chipCounts([a, b, fake]);
  assert.deepEqual(all.slice(0, 3).map((c) => [c.chip, c.times, c.leads]), [["Price", 3, 2], ["Pet hair", 1, 1], ["Smell", 1, 1]]);
  assert.equal(all.length, M.NOTE_CHIPS.length);
  // Only notes from this month.
  const month = M.chipCounts([a, b], (n) => M.canberraDate(n.at) >= "2026-10-01");
  assert.deepEqual(month.slice(0, 2).map((c) => [c.chip, c.times]), [["Price", 2], ["Pet hair", 1]]);
  assert.equal(month.find((c) => c.chip === "Smell").times, 0);
  assert.equal(M.NOTE_CHIPS.length, 12);
});

test("booking asks for the day, time, address and price; a range keeps its low end as the price", () => {
  const l = lead({ stage: "Chasing", touches: 2 });
  const b = apply(l, M.book(l, { date: "2026-10-25", time: "09:30", address: " 12 Example St, Gungahlin ", price: "250-300" }, at(TODAY), "Angus"));
  assert.deepEqual([b.stage, b.jobDate, b.jobTime, b.address, b.revenue, b.priceRange], ["Booked", "2026-10-25", "09:30", "12 Example St, Gungahlin", 250, "250–300"]);
  const one = apply(l, M.book(l, { date: "2026-10-25", price: "$280" }, at(TODAY), "Angus"));
  assert.deepEqual([one.revenue, one.priceRange], [280, ""]);
  assert.deepEqual(M.parsePrice("$300 to $250"), { price: 250, range: "250–300" });
  assert.deepEqual(M.parsePrice(""), { price: null, range: "" });
  assert.deepEqual([M.timeLabel("09:30"), M.timeLabel("14:05"), M.timeLabel("")], ["9:30am", "2:05pm", ""]);
});

test("today's jobs: booked for today, in time order, with no time last", () => {
  const job = (id, jobTime, o = {}) => lead({ id, name: id, stage: "Booked", jobDate: TODAY, jobTime, ...o });
  const L = [job("late", "14:00"), job("none", ""), job("early", "08:30"), job("theirs", "09:00", { owner: "Ananth" }), job("tomorrow", "07:00", { jobDate: "2026-10-21" }),
    job("done", "07:30", { completedAt: at(TODAY, "10:00") }), job("fake", "07:00", { junk: true }), lead({ id: "chasing", stage: "Chasing", jobDate: TODAY })];
  assert.deepEqual(M.todaysJobs(L, TODAY, { who: "Angus" }).map((l) => l.id), ["done", "early", "late", "none"]);
  assert.deepEqual(M.todaysJobs(L, TODAY, { all: true }).map((l) => l.id), ["done", "early", "theirs", "late", "none"]);
});

test("deposit: the link is kept on the lead; once paid it shows paid and moves to Booked", () => {
  const l = lead({ stage: "Chasing", touches: 2, nextFollowUp: TODAY });
  const linked = apply(l, M.depositLink(l, { id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1", expiresAt: at("2026-10-21") }, at(TODAY), "Angus", { date: "2026-10-25", time: "09:00" }));
  assert.deepEqual([linked.depositSessionId, linked.depositDate, linked.depositTime, linked.stage], ["cs_test_1", "2026-10-25", "09:00", "Chasing"]);
  const paid = apply(linked, M.depositPaid(linked, { at: at(TODAY, "10:30"), sessionId: "cs_test_1", amount: 50, date: "2026-10-25", time: "09:00" }, TODAY));
  assert.deepEqual([paid.depositPaid, paid.depositAmount, paid.stage, paid.status, paid.jobDate, paid.jobTime, paid.nextFollowUp], ["Yes", 50, "Booked", "Booked", "2026-10-25", "09:00", ""]);
  assert.equal(paid.log[paid.log.length - 1].outcome, "Deposit paid");
  assert.equal(M.callNotes(paid).length, 0); // the app's own entries aren't call notes
  // A booking keeps its own day and time.
  const booked = lead({ stage: "Booked", jobDate: "2026-10-26", jobTime: "13:00" });
  const p2 = apply(booked, M.depositPaid(booked, { at: at(TODAY), sessionId: "cs_test_2", date: "2026-10-25", time: "09:00" }, TODAY));
  assert.deepEqual([p2.stage, p2.jobDate, p2.jobTime, p2.depositAmount], ["Booked", "2026-10-26", "13:00", 50]);
});

test("on my way: logged with the time and who sent it", () => {
  const l = lead({ stage: "Booked", jobDate: TODAY });
  const s = apply(l, M.onMyWay(l, at(TODAY, "08:40"), "Ananth"));
  assert.deepEqual([s.onMyWayAt, s.onMyWayBy, s.stage], [at(TODAY, "08:40"), "Ananth", "Booked"]);
  assert.equal(s.log[s.log.length - 1].outcome, "On my way");
});

test("the deposit and on-my-way texts: the agreed words, filled in, no emojis, and editable", () => {
  const l = lead();
  assert.equal(T.fill("deposit", l, { day: "Saturday 25 Oct", time: "9:00am", link: "https://checkout.stripe.com/x" }),
    "Hey Jo, to lock in Saturday 25 Oct at 9:00am for the Kluger, here's the $50 deposit link: https://checkout.stripe.com/x. It comes off the final price and is fully refundable with 24 hours' notice.");
  assert.equal(T.fill("deposit", l), "Hey Jo, to lock in [day] at [time] for the Kluger, here's the $50 deposit link: [link]. It comes off the final price and is fully refundable with 24 hours' notice.");
  assert.equal(T.fill("onmyway", l), "Hey Jo, it's Ananth from Imperium Detailing. On our way now, see you soon!");
  assert.equal(T.fill("onmyway", { ...l, owner: "Angus" }), "Hey Jo, it's Ananth from Imperium Detailing. On our way now, see you soon!"); // always Ananth
  for (const key of Object.keys(T.TEMPLATES)) assert.doesNotMatch(T.TEMPLATES[key], /\p{Extended_Pictographic}/u, key);
  assert.ok(T.EDITABLE.includes("deposit") && T.EDITABLE.includes("onmyway"));
  assert.equal(T.fill("onmyway", l, { templates: { onmyway: "Hi [name], leaving now." } }), "Hi Jo, leaving now.");
  // Touch 1's "[day] or [day]" is still left for you.
  assert.match(T.fill("touch1", l), /\[day\] or \[day\]/);
});
