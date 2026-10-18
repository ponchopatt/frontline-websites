import assert from "node:assert/strict";
import { test } from "node:test";
import M from "../lib/model.js";

// Canberra after daylight saving starts (4 Oct 2026): +11:00.
const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString();
const H = M.hours();
const lead = (p = {}) => M.sync({ id: p.id || "x", date: "2026-10-12", createdAt: at("2026-10-12", "09:00"), owner: "Angus", name: "Jo", phone: "0400 111 222", status: "New", nextFollowUp: "2026-10-12", log: [], ...M.newFields(p.timeline || ""), ...p }, "2026-10-12");
const apply = (l, patch) => M.sync({ ...l, ...patch }, "2026-10-12");
const done = (l, d, hm = "10:00", by = "Angus") => apply(l, M.touch(l, { at: at(d, hm), by, type: "text", outcome: "Texted" }));
const pick = (o, keys) => keys.split(" ").map((k) => o[k]);

test("four touches: straight away, the next day, day 3 and day 7, then Waiting (No reply)", () => {
  let l = lead({ timeline: "asap" });
  assert.equal(M.touchLabel(l, "2026-10-12"), "Touch 1 of 4");
  l = done(l, "2026-10-12");
  assert.deepEqual(pick(l, "stage status touches nextFollowUp chaseFrom"), ["Chasing", "Contacted", 1, "2026-10-13", "2026-10-12"]);
  assert.equal(M.touchLabel(l, "2026-10-12"), "Touch 2 of 4");
  l = done(l, "2026-10-13");
  assert.deepEqual(pick(l, "touches nextFollowUp"), [2, "2026-10-15"]);
  l = done(l, "2026-10-15");
  assert.deepEqual(pick(l, "touches nextFollowUp"), [3, "2026-10-19"]);
  assert.equal(M.touchLabel(l, "2026-10-15"), "Touch 4 of 4");
  l = done(l, "2026-10-19");
  assert.deepEqual(pick(l, "stage waitReason touches nextFollowUp waitedHow"), ["Waiting", "no_reply", 4, "", "touch4"]);
  assert.equal(l.status, "Contacted"); // the old field still reads right
  assert.equal(M.touchLabel(l, "2026-10-19"), "");
  // Just browsing gets the same four.
  let b = done(lead({ timeline: "just_browsing" }), "2026-10-12");
  assert.deepEqual(pick(b, "stage touches nextFollowUp"), ["Chasing", 1, "2026-10-13"]);
});

test("a touch done late keeps the planned gaps, so nobody is texted two days running", () => {
  let l = done(lead(), "2026-10-12");
  l = done(l, "2026-10-16"); // touch 2 sent four days late
  assert.deepEqual(pick(l, "touches nextFollowUp"), [2, "2026-10-18"]); // day 3 has passed: still 2 days' gap
  l = done(l, "2026-10-18");
  assert.equal(l.nextFollowUp, "2026-10-22"); // day 7 has passed too: still 4 days' gap
});

test("✓ Done twice on the same day is logged but counts once", () => {
  let l = done(lead(), "2026-10-12", "09:05");
  l = done(l, "2026-10-12", "15:00");
  assert.deepEqual(pick(l, "touches nextFollowUp"), [1, "2026-10-13"]);
  assert.equal(l.log.length, 2);
});

test("✓ Done on a booking, a done job or a lead waiting only logs it", () => {
  for (const p of [{ stage: "Booked", jobDate: "2026-10-20" }, { stage: "Done", completedAt: at("2026-10-10") }, { stage: "Waiting", waitReason: "lost" }]) {
    const l = lead(p), after = done(l, "2026-10-12");
    assert.deepEqual([after.stage, after.touches, after.log.length], [l.stage, l.touches, 1], p.stage);
  }
});

test("the first reply time is kept from the first touch", () => {
  const l = done(lead({ createdAt: at("2026-10-12", "09:00") }), "2026-10-12", "09:04");
  assert.equal(l.replyMins, 4);
  assert.equal(done(l, "2026-10-13").replyMins, 4);
});

test("Booked: the day and the price; the touches stop", () => {
  const l = done(lead(), "2026-10-12");
  const b = apply(l, M.book(l, { date: "2026-10-20", price: 280 }, at("2026-10-13"), "Angus"));
  assert.deepEqual(pick(b, "stage status booked jobDate revenue nextFollowUp"), ["Booked", "Booked", "Yes", "2026-10-20", 280, ""]);
  assert.equal(b.log[b.log.length - 1].outcome, "Booked");
  // Once the day has passed, it's Done by itself.
  assert.equal(M.stageOf(b, "2026-10-21"), "Done");
});

test("a stage picked by hand: Waiting needs a reason, and Not real is junk", () => {
  const l = done(lead(), "2026-10-12");
  const lost = apply(l, M.setStage(l, "Waiting", "2026-10-13", "lost", at("2026-10-13")));
  assert.deepEqual(pick(lost, "stage waitReason status booked lostReason junk"), ["Waiting", "lost", "Lost", "No", "other", false]);
  const fake = apply(l, M.setStage(l, "Waiting", "2026-10-13", "not_real"));
  assert.deepEqual(pick(fake, "stage waitReason junk"), ["Waiting", "not_real", true]);
  // Back to Chasing: the touches carry on (or start again after a lead's had all four), due today.
  const back = apply(fake, M.setStage(fake, "Chasing", "2026-10-14"));
  assert.deepEqual(pick(back, "stage waitReason junk touches nextFollowUp"), ["Chasing", "", false, 1, "2026-10-14"]);
  const mid = apply(done(l, "2026-10-13"), M.setStage(done(l, "2026-10-13"), "Chasing", "2026-10-14"));
  assert.deepEqual(pick(mid, "touches chaseFrom nextFollowUp"), [2, "2026-10-12", "2026-10-14"]);
  const fresh = apply(l, M.setStage(l, "New", "2026-10-14"));
  assert.deepEqual(pick(fresh, "stage touches chaseFrom"), ["New", 0, ""]);
  // A tag only moves it on Today.
  assert.deepEqual(M.retag(l, "Hot"), { score: "Hot", scoreBy: "human" });
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

test("the reply timer: green under 5 minutes, orange 5 to 15, red over 15", () => {
  const l = lead({ createdAt: at("2026-10-12", "11:00") });
  const lvl = (hm) => M.replyTimer(l, new Date(at("2026-10-12", hm)), H);
  assert.deepEqual([lvl("11:00").level, lvl("11:04").level, lvl("11:05").level, lvl("11:15").level, lvl("11:16").level], ["green", "green", "orange", "orange", "red"]);
  assert.equal(lvl("11:16").mins, 16);
});

test("a lead at 9:30pm (or 6am, weekends too): the timer doesn't start until 8:00am", () => {
  const l = lead({ createdAt: at("2026-10-17", "21:30"), date: "2026-10-17" }); // a Saturday
  assert.equal(M.isOvernight(l, H), true);
  const night = M.replyTimer(l, new Date(at("2026-10-17", "23:00")), H);
  assert.equal(night.level, "wait");
  assert.equal(night.startsAt.toISOString(), at("2026-10-18", "08:00"));
  assert.deepEqual(M.replyTimer(l, new Date(at("2026-10-18", "08:03")), H), { mins: 3, level: "green" });
  assert.equal(M.clockStart(at("2026-10-13", "05:10"), H).toISOString(), at("2026-10-13", "08:00"));
  // Not on Today overnight; counted as "later".
  const L = M.todayList([l], { now: new Date(at("2026-10-17", "23:00")), hours: H, all: true });
  assert.deepEqual([L.show.length, L.later], [0, 1]);
  const morning = M.todayList([l], { now: new Date(at("2026-10-18", "08:00")), hours: H, all: true });
  assert.equal(morning.show.length, 1);
  // Replied at 8:04am: 4 minutes on the adjusted clock (634 since it came in).
  const replied = apply(l, M.touch(l, { at: at("2026-10-18", "08:04"), by: "Angus", type: "text" }));
  assert.equal(replied.replyMins, 634);
  assert.equal(M.replyMinutes(replied, H), 4);
  // Winter time too (+10:00): 8:00am is 22:00 UTC the day before.
  assert.equal(M.clockStart("2026-06-10T11:30:00Z", H).toISOString(), "2026-06-10T22:00:00.000Z");
});

const TODAY = "2026-10-20";
const NOW = new Date(at(TODAY, "10:00"));
const SINCE = "2026-10-15";
const chasing = (id, o = {}) => lead({ id, stage: "Chasing", touches: 1, chaseFrom: "2026-10-19", lastTouchOn: "2026-10-19", nextFollowUp: TODAY, date: "2026-10-19", createdAt: at("2026-10-19", "09:00"), ...o });

test("Today: only touches due today or overdue; new leads first, then Hot, then Warm, then the rest, oldest first", () => {
  const L = [
    chasing("warm-old", { score: "Warm", createdAt: at("2026-10-16") }),
    chasing("rest", {}),
    chasing("hot-new", { score: "Hot", createdAt: at("2026-10-19", "12:00") }),
    chasing("hot-old", { score: "Hot", createdAt: at("2026-10-18") }),
    chasing("browsing", { score: "Browsing", createdAt: at("2026-10-17") }),
    chasing("yesterday", { nextFollowUp: "2026-10-19" }), // overdue a day: still on
    chasing("tomorrow", { nextFollowUp: "2026-10-21" }), // not due
    lead({ id: "new-2", createdAt: at(TODAY, "09:30"), date: TODAY }),
    lead({ id: "new-1", createdAt: at(TODAY, "08:30"), date: TODAY }),
    lead({ id: "booked", stage: "Booked", jobDate: "2026-10-22" }),
    lead({ id: "waiting", stage: "Waiting" }),
    chasing("fake", { junk: true }),
  ];
  const T = M.todayList(L, { now: NOW, hours: H, all: true, since: SINCE });
  assert.deepEqual(T.show.map((l) => l.id), ["new-1", "new-2", "hot-old", "hot-new", "warm-old", "browsing", "rest", "yesterday"]);
  assert.equal(T.extra.length, 0);
});

test("Today shows at most 10; the rest roll to tomorrow", () => {
  const L = Array.from({ length: 13 }, (_, i) => chasing("c" + i, { createdAt: at("2026-10-19", `09:${String(10 + i)}`) }));
  const T = M.todayList(L, { now: NOW, hours: H, all: true, since: SINCE });
  assert.deepEqual([T.show.length, T.extra.length], [10, 3]);
  assert.deepEqual(T.extra.map((l) => l.id), ["c10", "c11", "c12"]); // the newest wait
  const rolled = L.map((l) => (T.extra.includes(l) ? apply(l, M.rollPatch(TODAY)) : l));
  assert.deepEqual(M.rollPatch(TODAY), { nextFollowUp: "2026-10-21", rolledOn: TODAY });
  const again = M.todayList(rolled, { now: NOW, hours: H, all: true, since: SINCE });
  assert.deepEqual([again.show.length, again.extra.length, again.rolled], [10, 0, 3]);
  // Tomorrow they're due, not overdue, so they're never moved to Waiting for it.
  const next = M.todayList(rolled.filter((l) => l.rolledOn), { now: new Date(at("2026-10-21")), hours: H, all: true, since: SINCE });
  assert.equal(next.show.length, 3);
});

test("a touch 2 days overdue moves the lead to Waiting by itself; leads already that late at go-live are the backlog", () => {
  const twoDays = chasing("late", { nextFollowUp: "2026-10-18" });
  const oneDay = chasing("ok", { nextFollowUp: "2026-10-19" });
  const oldNew = lead({ id: "old-new", createdAt: at("2026-10-17", "10:00"), date: "2026-10-17" });
  const backlog = chasing("backlog", { nextFollowUp: "2026-10-10", date: "2026-10-01", createdAt: at("2026-10-01") });
  assert.deepEqual([twoDays, oneDay, oldNew, backlog].map((l) => M.shouldAutoWait(l, TODAY, H, SINCE)), [true, false, true, false]);
  assert.deepEqual([twoDays, oneDay, oldNew, backlog].map((l) => M.isBacklog(l, TODAY, H, SINCE)), [false, false, false, true]);
  // Due the day before go-live (one day late then): it's not backlog, so it moves by itself.
  assert.equal(M.shouldAutoWait(chasing("edge", { nextFollowUp: "2026-10-14" }), "2026-10-16", H, SINCE), true);
  assert.equal(M.isBacklog(chasing("edge", { nextFollowUp: "2026-10-13" }), "2026-10-16", H, SINCE), true);
  // Not before the go-live day is known.
  assert.equal(M.shouldAutoWait(twoDays, TODAY, H, ""), false);
  const T = M.todayList([twoDays, oneDay, oldNew, backlog], { now: NOW, hours: H, all: true, since: SINCE });
  assert.deepEqual([T.show.map((l) => l.id), T.backlog], [["ok"], 1]);
  const moved = apply(twoDays, M.autoWaitPatch(at(TODAY)));
  assert.deepEqual(pick(moved, "stage waitReason waitedHow nextFollowUp"), ["Waiting", "no_reply", "auto", ""]);
});

test("Today shows my leads, with a toggle for both", () => {
  const L = [chasing("mine", { owner: "Angus" }), chasing("theirs", { owner: "Ananth" }), chasing("nobody", { owner: "" })];
  assert.deepEqual(M.todayList(L, { now: NOW, hours: H, who: "Angus", since: SINCE }).show.map((l) => l.id), ["mine", "nobody"]);
  assert.equal(M.todayList(L, { now: NOW, hours: H, who: "Angus", all: true, since: SINCE }).show.length, 3);
});

test("the backlog clear: Chasing leads that came in before the day picked, then Waiting (No reply)", () => {
  const L = [
    chasing("a", { date: "2026-10-01", createdAt: at("2026-10-01") }),
    chasing("b", { date: "2026-09-20", createdAt: at("2026-09-20") }),
    chasing("c", { date: "2026-10-12", createdAt: at("2026-10-12") }),
    lead({ id: "n", date: "2026-10-01" }),
    chasing("j", { date: "2026-10-01", junk: true }),
  ];
  assert.deepEqual(M.backlogLeads(L, "2026-10-12", TODAY).map((l) => l.id), ["b", "a"]);
  const moved = apply(L[0], M.backlogPatch(at(TODAY)));
  assert.deepEqual(pick(moved, "stage waitReason waitedHow"), ["Waiting", "no_reply", "backlog"]);
});
