import assert from "node:assert/strict";
import { test } from "node:test";
import M from "../lib/model.js";

// Canberra after daylight saving starts (4 Oct 2026): +11:00.
const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString();
const H = M.hours();
const lead = (p = {}) => M.sync({ id: p.id || "x", date: "2026-10-12", createdAt: at("2026-10-12", "09:00"), owner: "Angus", name: "Jo", phone: "0400 111 222", status: "New", nextFollowUp: "2026-10-12", log: [], ...M.newFields(p.timeline || ""), ...p }, "2026-10-12");
const apply = (l, patch) => M.sync({ ...l, ...patch }, "2026-10-12");
const texted = (l, d, hm = "10:00", by = "Angus") => apply(l, M.touch(l, { at: at(d, hm), by, type: "text", outcome: "Texted" }));
const noAnswer = (l, d, hm = "10:00") => apply(l, M.touch(l, { at: at(d, hm), by: "Angus", type: "call", pickedUp: "No", outcome: "No answer" }));

test("full schedule: day 0, 1, 3 and 7 from the first touch, then Waiting", () => {
  let l = lead({ timeline: "asap" });
  l = texted(l, "2026-10-12");
  assert.deepEqual([l.stage, l.status, l.touches, l.nextFollowUp, l.chaseFrom], ["Chasing", "Contacted", 1, "2026-10-13", "2026-10-12"]); // Texted on a new lead: tomorrow
  assert.equal(M.progress(l, "2026-10-12"), "1 of 4");
  l = texted(l, "2026-10-13");
  assert.deepEqual([l.touches, l.nextFollowUp], [2, "2026-10-15"]);
  l = texted(l, "2026-10-15");
  assert.deepEqual([l.touches, l.nextFollowUp], [3, "2026-10-19"]);
  l = texted(l, "2026-10-19");
  assert.deepEqual([l.stage, l.touches, l.nextFollowUp], ["Waiting", 4, "2026-11-18"]); // check-in in 30 days
  assert.equal(l.status, "Contacted"); // the old field still reads right
});

test("a missed day doesn't pile up: the gaps still count from the first touch, never the same day twice", () => {
  let l = texted(lead(), "2026-10-12");
  l = texted(l, "2026-10-16"); // day 1's text sent four days late
  assert.deepEqual([l.touches, l.nextFollowUp], [2, "2026-10-17"]); // day 3 has passed: due the next day
  l = texted(l, "2026-10-17");
  assert.equal(l.nextFollowUp, "2026-10-19"); // day 7 from the first touch
});

test("a call and a text on the same day are one touch", () => {
  let l = noAnswer(lead(), "2026-10-12", "09:01");
  l = texted(l, "2026-10-12", "09:03");
  assert.deepEqual([l.touches, l.nextFollowUp, l.log.length], [1, "2026-10-13", 2]);
  l = texted(l, "2026-10-13", "08:00");
  l = noAnswer(l, "2026-10-13", "18:00");
  assert.deepEqual([l.touches, l.nextFollowUp], [2, "2026-10-15"]);
  assert.equal(M.touchDays(l.log), 2);
  // 11:30pm and 00:30am are different Canberra days.
  assert.equal(M.touchDays([{ at: at("2026-10-12", "23:30") }, { at: at("2026-10-13", "00:30") }]), 2);
  // A note is never a touch.
  assert.equal(M.touchDays([{ at: at("2026-10-12"), type: "note" }]), 0);
});

test("just browsing: day 0 and day 3 only, then Waiting", () => {
  let l = lead({ timeline: "just_browsing" });
  assert.deepEqual([l.score, l.schedule], ["Browsing", "browsing"]);
  l = texted(l, "2026-10-12");
  assert.deepEqual([l.touches, l.nextFollowUp, M.progress(l, "2026-10-12")], [1, "2026-10-15", "1 of 2"]);
  l = texted(l, "2026-10-15");
  assert.deepEqual([l.stage, l.nextFollowUp], ["Waiting", "2026-11-14"]);
});

test("quoted: day 2, 5 and 9 after the quote, then Waiting (still Quoted underneath)", () => {
  let l = texted(lead(), "2026-10-12");
  l = apply(l, M.answer(l, "quoted", { amount: 397 }, at("2026-10-13"), "Ananth"));
  assert.deepEqual([l.stage, l.status, l.quoted, l.quotedOn, l.nextFollowUp, M.progress(l, "2026-10-13")], ["Quoted", "Quoted", 397, "2026-10-13", "2026-10-15", "0 of 3"]);
  l = texted(l, "2026-10-13", "16:00"); // the quote text, same day: not a chase
  assert.deepEqual([l.touches, l.nextFollowUp], [0, "2026-10-15"]);
  l = texted(l, "2026-10-15");
  assert.deepEqual([l.touches, l.nextFollowUp], [1, "2026-10-18"]);
  l = texted(l, "2026-10-18");
  assert.equal(l.nextFollowUp, "2026-10-22");
  l = texted(l, "2026-10-22");
  assert.deepEqual([l.stage, l.status, l.nextFollowUp], ["Waiting", "Quoted", "2026-11-21"]);
});

test("Waiting: a check-in every 30 days, then back to Waiting", () => {
  let l = lead({ stage: "Waiting", status: "Contacted", nextFollowUp: "2026-11-11" });
  assert.equal(M.place(l, "2026-11-10", new Date(at("2026-11-10")), H), "waiting");
  assert.equal(M.place(l, "2026-11-11", new Date(at("2026-11-11")), H), "due");
  l = texted(l, "2026-11-11");
  assert.deepEqual([l.stage, l.nextFollowUp], ["Waiting", "2026-12-11"]);
  assert.equal(M.place(l, "2026-11-12", new Date(at("2026-11-12")), H), "waiting");
});

test("Answered asks one question, and each answer saves what it needs", () => {
  const base = texted(lead(), "2026-10-12");
  const booked = apply(base, M.answer({ ...base, quoted: 225 }, "booked", { date: "2026-10-20", price: 225 }, at("2026-10-13"), "Angus"));
  assert.deepEqual([booked.stage, booked.status, booked.booked, booked.jobDate, booked.revenue, booked.nextFollowUp], ["Booked", "Booked", "Yes", "2026-10-20", 225, ""]);
  const lost = apply(base, M.answer(base, "lost", { reason: "went_elsewhere" }, at("2026-10-13")));
  assert.deepEqual([lost.stage, lost.status, lost.lostReason, lost.lostWhy, lost.nextFollowUp], ["Lost", "Lost", "went_elsewhere", "Went elsewhere", ""]);
  const later = apply(base, M.answer(base, "notnow", { date: "2026-11-02" }, at("2026-10-13")));
  assert.deepEqual([later.stage, later.snoozeUntil, later.nextFollowUp], ["Chasing", "2026-11-02", "2026-11-02"]);
  for (const l of [booked, lost, later]) assert.deepEqual(l.log.at(-1).pickedUp, "Yes");
  // A new lead that answers and says not now has been talked to: its schedule starts.
  const fresh = apply(lead(), M.answer(lead(), "notnow", { date: "2026-10-30" }, at("2026-10-12", "09:02")));
  assert.deepEqual([fresh.stage, fresh.touches, fresh.nextFollowUp, fresh.replyMins], ["Chasing", 1, "2026-10-30", 2]);
});

test("Not now: off Today until the day, then the schedule carries on with the same gaps", () => {
  let l = texted(texted(lead(), "2026-10-12"), "2026-10-13"); // 2 of 4, next due the 15th
  l = apply(l, M.snooze(l, "2026-10-25"));
  assert.deepEqual([l.snoozeUntil, l.nextFollowUp], ["2026-10-25", "2026-10-25"]);
  assert.equal(M.place(l, "2026-10-15", new Date(at("2026-10-15")), H), "");
  assert.equal(M.place(l, "2026-10-25", new Date(at("2026-10-25")), H), "due");
  l = texted(l, "2026-10-25");
  assert.deepEqual([l.touches, l.nextFollowUp, l.snoozeUntil], [3, "2026-10-29", ""]); // day 3 → day 7 is 4 days on
});

test("a note pauses the schedule: back the next day it's due, at the soonest tomorrow", () => {
  let l = texted(lead(), "2026-10-12"); // due the 13th
  l = apply(l, M.note(l, "Said call after payday", at("2026-10-12", "15:00"), "Angus"));
  assert.deepEqual([l.paused, l.nextFollowUp, l.touches], [true, "2026-10-13", 1]);
  l = texted(l, "2026-10-13");
  assert.deepEqual([l.paused, l.touches, l.nextFollowUp], [false, 2, "2026-10-15"]);
  const fresh = apply(lead(), M.note(lead(), "Rang the shop", at("2026-10-12")));
  assert.equal(fresh.paused, false); // nothing running to pause yet
});

test("call hours: 8:00am to 7:00pm by default, and a setting", () => {
  assert.deepEqual(M.hours(), { start: 480, end: 1140 });
  assert.deepEqual(M.hours({ start: "07:30", end: "20:00" }), { start: 450, end: 1200 });
  assert.deepEqual(M.hours({ start: "nonsense", end: "06:00" }), { start: 480, end: 1140 });
  assert.equal(M.clock(480), "8:00am");
  assert.equal(M.clock(1140), "7:00pm");
  assert.equal(M.inHours(at("2026-10-12", "18:59"), H), true);
  assert.equal(M.inHours(at("2026-10-12", "19:00"), H), false);
  assert.equal(M.inHours(at("2026-10-12", "07:59"), H), false);
});

test("a lead at 9:30pm: no call until 8:00am, the moon, and its 5-minute clock starts at 8:00am", () => {
  const l = lead({ createdAt: at("2026-10-12", "21:30"), date: "2026-10-12" });
  assert.equal(M.isOvernight(l, H), true);
  assert.equal(M.clockStart(l.createdAt, H).toISOString(), at("2026-10-13", "08:00"));
  assert.equal(M.place(l, "2026-10-12", new Date(at("2026-10-12", "21:31")), H), "later");
  assert.equal(M.place(l, "2026-10-13", new Date(at("2026-10-13", "07:59")), H), "later");
  assert.equal(M.place(l, "2026-10-13", new Date(at("2026-10-13", "08:00")), H), "callFirst");
  // Called at 8:04am: 4 minutes on the adjusted clock (634 since it came in).
  const called = apply(l, M.touch(l, { at: at("2026-10-13", "08:04"), by: "Angus", type: "call", pickedUp: "No" }));
  assert.equal(called.replyMins, 634);
  assert.equal(M.replyMinutes(called, H), 4);
  // Before call hours the same morning: the clock starts at 8:00am that day.
  assert.equal(M.clockStart(at("2026-10-13", "05:10"), H).toISOString(), at("2026-10-13", "08:00"));
  // In call hours: straight away.
  const day = lead({ createdAt: at("2026-10-12", "11:00") });
  assert.equal(M.isOvernight(day, H), false);
  assert.equal(M.place(day, "2026-10-12", new Date(at("2026-10-12", "11:01")), H), "fresh");
  assert.equal(M.replyMinutes({ ...day, replyMins: 7 }, H), 7);
  // Winter time too (+10:00): 8:00am is 22:00 UTC the day before.
  assert.equal(M.clockStart("2026-06-10T11:30:00Z", H).toISOString(), "2026-06-10T22:00:00.000Z");
});

test("Today: five lists in order, sorted Quoted, Hot, Warm, Browsing, oldest first", () => {
  const now = new Date(at("2026-10-14", "10:00"));
  const L = (id, p) => ({ ...lead({ id, name: id, ...p }), id });
  const leads = [
    L("night", { createdAt: at("2026-10-13", "22:00"), date: "2026-10-13" }),
    L("new-warm", { createdAt: at("2026-10-14", "09:00"), score: "Warm" }),
    L("new-hot", { createdAt: at("2026-10-14", "09:30"), score: "Hot" }),
    L("quoted", { stage: "Quoted", quotedOn: "2026-10-12", nextFollowUp: "2026-10-14", score: "Browsing", createdAt: at("2026-10-01") }),
    L("hot-old", { stage: "Chasing", nextFollowUp: "2026-10-10", score: "Hot", createdAt: at("2026-10-02") }),
    L("hot-new", { stage: "Chasing", nextFollowUp: "2026-10-14", score: "Hot", createdAt: at("2026-10-09") }),
    L("warm", { stage: "Chasing", nextFollowUp: "2026-10-14", score: "Warm", createdAt: at("2026-10-05") }),
    L("browse", { stage: "Chasing", nextFollowUp: "2026-10-13", score: "Browsing", createdAt: at("2026-10-03") }),
    L("checkin", { stage: "Waiting", nextFollowUp: "2026-10-14", score: "Hot", createdAt: at("2026-09-01") }),
    L("later", { stage: "Chasing", nextFollowUp: "2026-10-15", score: "Hot" }),
    L("waiting", { stage: "Waiting", nextFollowUp: "2026-11-01" }),
    L("snoozed", { stage: "Chasing", nextFollowUp: "2026-10-20", snoozeUntil: "2026-10-20" }),
    L("booked", { stage: "Booked", jobDate: "2026-10-20", nextFollowUp: "" }),
    L("lost", { stage: "Lost", nextFollowUp: "" }),
    L("junk", { createdAt: at("2026-10-14", "09:10"), junk: true }),
  ];
  const t = M.todayLists(leads, { now, hours: H, all: true });
  const ids = (k) => t[k].map((l) => l.id);
  assert.deepEqual(ids("callFirst"), ["night"]);
  assert.deepEqual(ids("fresh"), ["new-hot", "new-warm"]);
  assert.deepEqual(ids("hot"), ["quoted", "hot-old", "hot-new"]);
  assert.deepEqual(ids("due"), ["checkin", "warm", "browse"]);
  assert.deepEqual(ids("waiting"), ["waiting"]);
  assert.equal(t.left, 9);
  // As things are logged the list shrinks.
  const after = leads.map((l) => (l.id === "warm" ? texted(l, "2026-10-14") : l));
  assert.equal(M.todayLists(after, { now, hours: H, all: true }).left, 8);
});

test("Today shows my leads, plus anyone's left untouched 24 hours past due", () => {
  const now = new Date(at("2026-10-14", "10:00"));
  const leads = [
    { ...lead({ id: "mine", owner: "Angus", createdAt: at("2026-10-14", "09:00") }), id: "mine" },
    { ...lead({ id: "theirs", owner: "Ananth", createdAt: at("2026-10-14", "09:00") }), id: "theirs" },
    { ...lead({ id: "theirs-stale", owner: "Ananth", createdAt: at("2026-10-13", "09:30") }), id: "theirs-stale" },
    { ...lead({ id: "chase-stale", owner: "Ananth", stage: "Chasing", nextFollowUp: "2026-10-13" }), id: "chase-stale" },
    { ...lead({ id: "chase-today", owner: "Ananth", stage: "Chasing", nextFollowUp: "2026-10-14" }), id: "chase-today" },
  ];
  const mine = M.todayLists(leads, { now, hours: H, who: "Angus" });
  const all = (t) => [...t.callFirst, ...t.fresh, ...t.hot, ...t.due].map((l) => l.id).sort();
  assert.deepEqual(all(mine), ["chase-stale", "mine", "theirs-stale"]);
  assert.deepEqual(all(M.todayLists(leads, { now, hours: H, who: "Angus", all: true })), ["chase-stale", "chase-today", "mine", "theirs", "theirs-stale"]);
});

test("Friday from 5:00pm: counts only", () => {
  const leads = [
    lead({ id: "a" }),
    { ...lead({ stage: "Waiting", status: "Quoted", quotedOn: "2026-09-28", nextFollowUp: "2026-11-01" }), id: "q" },
    { ...lead({ stage: "Quoted", quotedOn: "2026-10-12", nextFollowUp: "2026-10-14" }), id: "q2" },
  ];
  assert.equal(M.fridayWrap(leads, { now: new Date(at("2026-10-16", "16:59")), hours: H }), null);
  assert.equal(M.fridayWrap(leads, { now: new Date(at("2026-10-15", "18:00")), hours: H }), null); // Thursday
  const w = M.fridayWrap(leads, { now: new Date(at("2026-10-16", "17:00")), hours: H });
  assert.deepEqual(w, { callFirst: 0, fresh: 1, hot: 1, due: 0, waiting: 1, quotedQuiet: 1, stillNew: 1 });
});

test("the upgrade puts every older lead in its place, and past its last touch means Waiting", () => {
  const today = "2026-10-12";
  const old = (p) => ({ modelVersion: 2, owner: "Angus", date: "2026-10-01", createdAt: at("2026-10-01"), name: "X", log: [], ...p });
  const f = (p) => M.upgradeFields(old(p), today);
  const log = (...days) => days.map((d) => ({ at: at(d), by: "Angus", type: "text" }));
  // Texted once yesterday: due today (day 1).
  assert.deepEqual(pick(f({ status: "Contacted", stage: "Chasing", log: log("2026-10-11") }), "stage touches nextFollowUp chaseFrom"), ["Chasing", 1, "2026-10-12", "2026-10-11"]);
  // Texted on the 7th and 8th: day 3 is the 10th, missed, so due today.
  assert.deepEqual(pick(f({ status: "Contacted", stage: "Chasing", log: log("2026-10-07", "2026-10-08") }), "stage touches nextFollowUp"), ["Chasing", 2, "2026-10-12"]);
  // Texted once 10 days ago: past day 7, so Waiting, first check-in 30 days from today.
  assert.deepEqual(pick(f({ status: "Contacted", stage: "Chasing", log: log("2026-10-02") }), "stage nextFollowUp"), ["Waiting", "2026-11-11"]);
  // Four touches: Waiting.
  assert.equal(f({ status: "Contacted", log: log("2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11") }).stage, "Waiting");
  // A chase date someone picked is kept.
  assert.deepEqual(pick(f({ status: "Contacted", stage: "Chasing", nextFollowUp: "2026-10-20", log: log("2026-10-02") }), "stage nextFollowUp"), ["Chasing", "2026-10-20"]);
  // Quoted on the 9th: chases on the 11th, 14th and 18th.
  const q = f({ status: "Quoted", stage: "Quoted", quoted: 300, log: [{ at: at("2026-10-09"), type: "call", outcome: "Quote given" }] });
  assert.deepEqual(pick(q, "stage quotedOn nextFollowUp touches"), ["Quoted", "2026-10-09", "2026-10-12", 0]);
  // Quoted a fortnight ago: Waiting.
  assert.equal(f({ status: "Quoted", stage: "Quoted", log: [{ at: at("2026-09-27"), type: "call", outcome: "Quote given" }] }).stage, "Waiting");
  // New stays New; bookings and lost leads keep their dates.
  assert.equal(f({ status: "New" }).stage, "New");
  assert.equal(f({ status: "Booked", jobDate: "2026-10-20" }).nextFollowUp, undefined);
  assert.deepEqual(pick(f({ status: "Lost", lostWhy: "Too expensive" }), "stage lostReason"), ["Lost", "price"]);
  assert.equal(f({ stage: "Cold", status: "Contacted" }).stage, "Waiting"); // Cold is now called Waiting
  // Email out of the notes, for Open.
  assert.equal(f({ notes: "When: ASAP · Email: jo@x.com · Dog hair" }).email, "jo@x.com");
});

test("the upgrade never removes a lead, keeps what it changed, and runs once", () => {
  const today = "2026-10-12";
  const leads = [
    { id: "a", modelVersion: 2, owner: "Angus", status: "Contacted", stage: "Chasing", nextFollowUp: "2026-10-03", createdAt: at("2026-10-01"), log: [{ at: at("2026-10-02"), by: "Angus", type: "text" }] },
    { id: "b", status: "New", createdAt: at("2026-10-02"), owner: "" },
    { id: "c", status: "New", createdAt: at("2026-10-03") },
    { id: "bad", createdAt: 42, log: "not a list", nextFollowUp: { odd: true } },
    null,
  ];
  const p = M.plan(leads, today);
  assert.equal(p.todo, 4);
  const row = (id) => p.rows.find((r) => r.id === id);
  assert.deepEqual(row("a").patch.v3Was, { stage: "Chasing", nextFollowUp: "2026-10-03", schedule: "", touches: "" });
  assert.equal(row("a").patch.stage, "Waiting");
  assert.deepEqual([row("b").patch.owner, row("c").patch.owner], ["Angus", "Ananth"]); // shared out in turn, oldest first
  const after = leads.filter(Boolean).map((l) => ({ ...l, ...(row(l.id) ? row(l.id).patch : {}) }));
  assert.equal(after.length, 4);
  assert.equal(M.plan(after, today).todo, 0);
  // Anything odd still lands somewhere on Today or off it, never an error.
  assert.doesNotThrow(() => M.todayLists([...after, null, { junk: false }, { log: 5 }], { now: new Date(at(today)), hours: H, all: true }));
});

function pick(o, keys) {
  return keys.split(" ").map((k) => o[k]);
}

test("changing a tag never parks a lead in Waiting, so tapping round to the right tag undoes it", () => {
  let l = texted(texted(lead({ timeline: "within_1_2_weeks" }), "2026-10-12"), "2026-10-13"); // Warm, 2 of 4
  const browsing = apply(l, M.retag(l, "Browsing", "2026-10-14"));
  assert.deepEqual([browsing.stage, browsing.schedule, browsing.nextFollowUp], ["Chasing", "browsing", "2026-10-14"]); // one more, then Waiting
  const hot = apply(browsing, M.retag(browsing, "Hot", "2026-10-14"));
  assert.deepEqual([hot.stage, hot.schedule, hot.nextFollowUp], ["Chasing", "full", "2026-10-15"]); // back on day 3
  const done = texted(browsing, "2026-10-14");
  assert.equal(done.stage, "Waiting");
});

test("a lead logged while the upgrade runs keeps what was logged when the upgrade is worked out again", () => {
  const today = "2026-10-04";
  const v2 = { id: "x", modelVersion: 2, owner: "Angus", status: "Contacted", stage: "Chasing", touches: 1, createdAt: at("2026-10-01"), date: "2026-10-01", nextFollowUp: "2026-10-04", log: [{ at: at("2026-10-03"), by: "Angus", type: "text" }] };
  // Texted today before the upgrade reached it: the page works it out from the upgraded lead
  // (and saves the new fields with it), so the schedule counts from the first touch.
  const view = { ...v2, ...M.upgradeFields(v2, today) };
  const f = { ...view, ...M.touch(view, { at: at(today), by: "Angus", type: "text" }) };
  assert.deepEqual([f.stage, f.touches, f.lastTouchOn, f.chaseFrom, f.nextFollowUp, f.modelVersion], ["Chasing", 2, today, "2026-10-03", "2026-10-06", 3]);
  assert.equal(M.plan([f], today).todo, 0); // nothing left for the upgrade to change
  // Not now and Not real set before the upgrade are kept too.
  const snoozed = M.upgradeFields({ ...v2, ...M.snooze(v2, "2026-10-20"), junk: true }, today);
  assert.deepEqual([snoozed.snoozeUntil, snoozed.nextFollowUp, snoozed.junk], ["2026-10-20", "2026-10-20", true]);
});
