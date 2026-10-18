import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { buildLead, mapTimeline } from "../lib/lead-map.js";

// The lead model is a plain browser script (public/model.js); run it as the page does.
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL("../public/model.js", import.meta.url), "utf8"), sandbox);
const M = sandbox.window.ILModel;
const plain = (x) => JSON.parse(JSON.stringify(x));
const TODAY = "2026-10-04";
const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString(); // Canberra, daylight saving

test("timeline answers map from the form's keys or its words, the same on the phone and the server", () => {
  const cases = {
    asap: "asap", ASAP: "asap", "As soon as possible": "asap",
    within_1_2_weeks: "within_1_2_weeks", "Within 1 to 2 weeks": "within_1_2_weeks", "1-2 weeks": "within_1_2_weeks",
    just_browsing: "just_browsing", "Just browsing": "just_browsing",
    "": "", "next month": "", undefined: "",
  };
  for (const [input, want] of Object.entries(cases)) {
    const v = input === "undefined" ? undefined : input;
    assert.equal(M.timelineOf(v), want, `phone: ${input}`);
    assert.equal(mapTimeline(v), want, `server: ${input}`);
  }
  assert.equal(M.timelineFromNotes("When: Within 1 to 2 weeks · Email: jo@x.com · Via Facebook form"), "within_1_2_weeks");
  assert.equal(M.timelineFromNotes("Dog hair"), "");
  assert.deepEqual([M.scoreOf("asap"), M.scoreOf("within_1_2_weeks"), M.scoreOf("just_browsing"), M.scoreOf("")], ["Hot", "Warm", "Browsing", ""]);
});

test("every old status maps to one of the five", () => {
  const s = (l) => M.v3Stage(l, TODAY);
  assert.equal(s({ status: "New" }), "New");
  assert.equal(s({ status: "New", log: [{ at: at("2026-10-01") }] }), "Chasing");
  assert.equal(s({ status: "Contacted" }), "Chasing");
  assert.equal(s({ status: "Quoted" }), "Quoted");
  assert.equal(s({ status: "Booked", jobDate: "2026-10-09" }), "Booked");
  assert.equal(s({ status: "Booked", jobDate: TODAY }), "Booked"); // today's job isn't done yet
  assert.equal(s({ status: "Booked", jobDate: "2026-09-30" }), "Done"); // the job date has passed
  assert.equal(s({ status: "Booked", jobDate: "2026-09-30", reviewAsked: "Yes" }), "Review asked");
  for (const r of ["text_sent", "nudged", "reviewed", "declined"]) assert.equal(s({ stage: "Done", completedAt: at("2026-10-03"), reviewStatus: r }), "Review asked", r);
  assert.equal(s({ status: "Lost", jobDate: "2026-09-30" }), "Lost");
  assert.equal(s({ stage: "Cold" }), "Waiting");
  assert.equal(s({}), "New");
  // Read straight away as five stages, before the upgrade has saved anything.
  const five = (l) => M.stageOf(l, TODAY);
  assert.deepEqual(["New", "Chasing", "Quoted", "Booked", "Done", "Review asked", "Waiting", "Lost"].map((stage) => five({ stage, jobDate: "2026-10-09" })),
    ["New", "Chasing", "Chasing", "Booked", "Done", "Done", "Waiting", "Waiting"]);
  assert.equal(M.waitReasonOf({ stage: "Lost" }), "lost");
  assert.equal(M.waitReasonOf({ stage: "Waiting", junk: true }), "not_real");
});

test("the upgrade: old status kept in old_status, and each one moved as agreed", () => {
  const f = (l) => plain(M.upgradeFields({ modelVersion: 3, owner: "Angus", date: "2026-09-20", createdAt: at("2026-09-20"), log: [], ...l }, TODAY));
  // Quoted → Chasing, the quote kept, and the quote counted as a touch.
  const q = f({ stage: "Quoted", status: "Quoted", quoted: 450, quotedOn: "2026-10-01", touches: 1, nextFollowUp: "2026-10-06" });
  assert.deepEqual([q.stage, q.old_status, q.touches, q.chaseFrom, q.waitReason, q.nextFollowUp], ["Chasing", "Quoted", 2, "2026-10-01", "", undefined]);
  // Chasing stays Chasing, its touches and due day kept.
  const c = f({ stage: "Chasing", status: "Contacted", touches: 2, chaseFrom: "2026-09-28", nextFollowUp: "2026-10-01" });
  assert.deepEqual([c.stage, c.old_status, c.touches, c.chaseFrom, c.nextFollowUp], ["Chasing", "Chasing", 2, undefined, undefined]);
  // Review asked → Done, with the Review asked tick.
  const r = f({ stage: "Review asked", status: "Booked", completedAt: at("2026-09-25"), reviewStatus: "text_sent" });
  assert.deepEqual([r.stage, r.old_status, r.reviewAsked], ["Done", "Review asked", "Yes"]);
  // Done, not paid: Done, and paid isn't touched (that's the Owes money tick).
  const d = f({ stage: "Done", status: "Booked", jobDate: "2026-09-25", paid: "No" });
  assert.deepEqual([d.stage, d.old_status, "paid" in d], ["Done", "Done", false]);
  assert.equal(M.owesMoney({ ...d, paid: "No", jobDate: "2026-09-25" }, TODAY), true);
  // Lost, Waiting and Not real → Waiting with a reason; Not real stays junk.
  const lost = f({ stage: "Lost", status: "Lost", lostWhy: "Too expensive" });
  assert.deepEqual([lost.stage, lost.waitReason, lost.old_status, lost.lostReason], ["Waiting", "lost", "Lost", "price"]);
  assert.deepEqual(pick(f({ stage: "Waiting", status: "Contacted", touches: 4 }), "stage waitReason old_status"), ["Waiting", "no_reply", "Waiting"]);
  const fake = f({ stage: "Chasing", status: "Contacted", junk: true });
  assert.deepEqual([fake.stage, fake.waitReason, fake.old_status, "junk" in fake], ["Waiting", "not_real", "Not real", false]);
  // Booked stays Booked; New stays New.
  assert.deepEqual(pick(f({ stage: "Booked", status: "Booked", jobDate: "2026-10-09" }), "stage old_status"), ["Booked", "Booked"]);
  assert.deepEqual(pick(f({ stage: "New", status: "New" }), "stage old_status"), ["New", "New"]);
  assert.equal(f({}).modelVersion, 4);
});

test("saving keeps every old field and keeps status in step with the stage", () => {
  const lead = {
    date: "2026-09-20", createdAt: at("2026-09-20"), owner: "Ananth", name: "Jo", phone: "0400", status: "Contacted", stage: "Chasing", quoted: 250,
    nextFollowUp: "2026-10-02", lostWhy: "", notes: "When: ASAP", log: [{ at: at("2026-09-21"), by: "Ananth", type: "text" }],
    paid: "", plan: "Yes", reviewAsked: "", custom: { kept: true }, old_status: "Quoted",
  };
  const out = plain(M.sync(lead, TODAY));
  for (const k of Object.keys(lead)) assert.deepEqual(out[k], plain(lead)[k], k);
  assert.deepEqual([out.stage, out.booked], ["Chasing", "Pending"]);
  const status = (stage, waitReason) => M.sync({ stage, waitReason }, TODAY).status;
  assert.deepEqual(["New", "Chasing", "Booked", "Done"].map((s) => status(s)), ["New", "Contacted", "Booked", "Booked"]);
  assert.deepEqual([status("Waiting", "no_reply"), status("Waiting", "lost"), status("Waiting", "not_real")], ["Contacted", "Lost", "Contacted"]);
  // A booking moves on once the job date has passed, and doesn't move back.
  assert.equal(M.sync({ stage: "Booked", jobDate: "2026-10-01" }, TODAY).stage, "Done");
  assert.equal(M.sync({ stage: "Done", jobDate: "2026-10-09" }, TODAY).stage, "Done");
  // A lead marked not real is Waiting (Not real) on its next save.
  assert.equal(M.sync({ stage: "Waiting", junk: true }, TODAY).waitReason, "not_real");
});

test("the Done ticks: Review asked and Owes money", () => {
  assert.equal(M.reviewAsked({ reviewAsked: "Yes" }), true);
  assert.equal(M.reviewAsked({ reviewStatus: "asked_in_person" }), true);
  assert.equal(M.reviewAsked({ reviewStatus: "text_sent", reviewAsked: "No" }), false); // unticked by hand
  assert.equal(M.reviewAsked({ reviewStatus: "not_asked" }), false);
  const job = { stage: "Done", completedAt: at("2026-10-01"), jobDate: "2026-10-01" };
  assert.deepEqual([M.owesMoney({ ...job, paid: "" }, TODAY), M.owesMoney({ ...job, paid: "No" }, TODAY), M.owesMoney({ ...job, paid: "Yes" }, TODAY)], [true, true, false]);
  assert.equal(M.owesMoney({ ...job, junk: true }, TODAY), false);
  assert.equal(M.owesMoney({ stage: "Booked", jobDate: "2026-10-09" }, TODAY), false); // not done yet
});

test("a lead from the form and one typed into the Add tab have the same fields", () => {
  const api = buildLead({ name: "Jo", phone: "0400 000 000", when: "asap" }, new Date("2026-10-04T01:00:00Z"));
  const typed = {
    date: TODAY, createdAt: at(TODAY), owner: "Angus", name: "Jo", phone: "0400", source: "Website", ad: "", referredBy: "",
    address: "", jobTime: "", access: "", service: "Full detail", car: "", suburb: "", replyMins: null, quoted: null, status: "New",
    nextFollowUp: TODAY, lastContact: "", log: [], objection: "", lostWhy: "", jobDate: "", revenue: null, paid: "", plan: "",
    upsellOffered: "", upsellTaken: "", reviewAsked: "", reviewLeft: "", nextDue: "", notes: "", completedAt: null, reviewStatus: null,
    reviewAskedAt: null, reviewTextSentAt: null, reviewNudgedAt: null, reviewLeftAt: null, reviewNotes: "", booked: "Pending",
    ...M.newFields("asap"),
  };
  assert.deepEqual(Object.keys(plain(M.sync(typed, TODAY))).sort(), Object.keys(plain(M.sync(api, TODAY))).sort());
  assert.deepEqual(Object.keys(api).sort(), Object.keys(typed).sort());
});

test("the upgrade gives an owner to leads with none: whoever logged them last, else in turn", () => {
  const leads = [
    { id: "a", name: "A", createdAt: at("2026-09-01"), status: "Contacted", owner: "", log: [{ at: at("2026-09-02"), by: "Ananth", type: "text" }] },
    { id: "b", name: "B", createdAt: at("2026-09-02"), status: "New", owner: "", notes: "When: asap" },
    { id: "c", name: "C", createdAt: at("2026-09-03"), status: "New", owner: "" },
    { id: "d", name: "D", createdAt: at("2026-09-04"), status: "Booked", owner: "Angus", jobDate: "2026-09-10", modelVersion: 4 },
  ];
  const p = plain(M.plan(leads, TODAY));
  const row = (id) => p.rows.find((r) => r.id === id);
  assert.equal(p.todo, 3);
  assert.deepEqual([row("a").patch.owner, row("b").patch.owner, row("c").patch.owner], ["Ananth", "Angus", "Ananth"]);
  assert.equal(row("b").patch.ownerWas, "");
  assert.equal(row("d"), undefined); // up to date and owned: left alone
  assert.equal(row("b").patch.score, "Hot");
});

test("the upgrade never removes a lead, keeps what it changed, and runs once", () => {
  const leads = [
    { id: "q", modelVersion: 3, owner: "Angus", status: "Quoted", stage: "Quoted", quoted: 300, touches: 0, nextFollowUp: "2026-10-06", createdAt: at("2026-10-01"), log: [] },
    { id: "r", modelVersion: 3, owner: "Ananth", status: "Booked", stage: "Review asked", reviewAsked: "", completedAt: at("2026-09-30"), createdAt: at("2026-09-28") },
    { id: "bad", createdAt: 42, log: "not a list", nextFollowUp: { odd: true } },
    null,
  ];
  const p = M.plan(leads, TODAY);
  assert.equal(p.todo, 3);
  const row = (id) => p.rows.find((r) => r.id === id);
  assert.deepEqual(plain(row("q").patch.v4Was), { stage: "Quoted", touches: 0, modelVersion: 3 });
  assert.deepEqual(plain(row("r").patch.v4Was), { stage: "Review asked", reviewAsked: "", modelVersion: 3 });
  assert.deepEqual([row("q").from, row("q").to, row("r").from, row("r").to], ["Quoted", "Chasing", "Review asked", "Done"]);
  const after = leads.filter(Boolean).map((l) => ({ ...l, ...(row(l.id) ? row(l.id).patch : {}) }));
  assert.equal(after.length, 3);
  assert.equal(after[0].quoted, 300); // the quote stays
  assert.equal(M.plan(after, TODAY).todo, 0);
  // Anything odd still lands on Today or off it, never an error.
  assert.doesNotThrow(() => M.todayList([...after, null, { junk: false }, { log: 5 }], { now: new Date(at(TODAY)), all: true, since: TODAY }));
});

test("a lead logged while the upgrade runs keeps what was logged", () => {
  const v3 = { id: "x", modelVersion: 3, owner: "Angus", status: "Contacted", stage: "Chasing", touches: 1, chaseFrom: "2026-10-03", lastTouchOn: "2026-10-03", createdAt: at("2026-10-01"), date: "2026-10-01", nextFollowUp: "2026-10-04", log: [{ at: at("2026-10-03"), by: "Angus", type: "text" }] };
  // The page works out a touch from the upgraded lead (and saves the new fields with it).
  const view = { ...v3, ...M.upgradeFields(v3, TODAY) };
  const f = { ...view, ...M.touch(view, { at: at(TODAY), by: "Angus", type: "text" }) };
  assert.deepEqual([f.stage, f.touches, f.lastTouchOn, f.chaseFrom, f.nextFollowUp, f.modelVersion], ["Chasing", 2, TODAY, "2026-10-03", "2026-10-06", 4]);
  assert.equal(M.plan([f], TODAY).todo, 0);
});

function pick(o, keys) {
  return keys.split(" ").map((k) => o[k]);
}
