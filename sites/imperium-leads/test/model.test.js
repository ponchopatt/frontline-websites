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

test("every old lead maps to one new stage", () => {
  const s = (l) => M.legacyStage(l, TODAY);
  assert.equal(s({ status: "New" }), "New");
  assert.equal(s({ status: "New", log: [{ at: at("2026-10-01") }] }), "Chasing");
  assert.equal(s({ status: "Contacted" }), "Chasing");
  assert.equal(s({ status: "Quoted" }), "Quoted");
  assert.equal(s({ status: "Booked", jobDate: "2026-10-09" }), "Booked");
  assert.equal(s({ status: "Booked", jobDate: TODAY }), "Booked"); // today's job isn't done yet
  assert.equal(s({ status: "Booked", jobDate: "2026-09-30" }), "Done"); // the job date has passed
  assert.equal(s({ status: "Booked", jobDate: "2026-09-30", reviewAsked: "Yes" }), "Review asked");
  assert.equal(s({ status: "Booked", completedAt: at("2026-10-03"), reviewStatus: "not_asked" }), "Done");
  assert.equal(s({ status: "Booked", completedAt: at("2026-10-03"), reviewStatus: "asked_in_person" }), "Done");
  for (const r of ["text_sent", "nudged", "reviewed", "declined"]) assert.equal(s({ status: "Booked", completedAt: at("2026-10-03"), reviewStatus: r }), "Review asked", r);
  assert.equal(s({ kind: "job", status: "Booked", completedAt: at("2026-10-03"), reviewStatus: "skip" }), "Done");
  assert.equal(s({ status: "Lost", jobDate: "2026-09-30" }), "Lost");
  assert.equal(s({}), "New");
});

test("touches stop at the end of the schedule; a lost reason carries across; a tag set by hand stays", () => {
  const f = (l) => plain(M.upgradeFields({ modelVersion: 2, owner: "Angus", ...l }, TODAY));
  const many = ["25", "26", "27", "28", "29", "30"].map((d) => ({ at: at(`2026-09-${d}`), type: "text" }));
  assert.deepEqual([f({ status: "Contacted", log: many }).touches, f({ status: "Contacted", log: many }).stage], [4, "Waiting"]);
  const old = { "Too expensive": "price", Timing: "timing", "Went elsewhere": "went_elsewhere", "No reply": "no_reply", Other: "other", "": "other" };
  for (const [why, reason] of Object.entries(old)) assert.equal(f({ status: "Lost", lostWhy: why }).lostReason, reason, why);
  assert.equal(f({ status: "Quoted", lostWhy: "Timing" }).lostReason, "");
  const browsing = f({ status: "New", notes: "When: Just browsing" });
  assert.deepEqual([browsing.timeline, browsing.score, browsing.schedule, browsing.scoreBy], ["just_browsing", "Browsing", "browsing", "timeline"]);
  const byHand = f({ status: "New", timeline: "just_browsing", score: "Hot", scoreBy: "human" });
  assert.deepEqual([byHand.score, byHand.scoreBy, byHand.schedule], ["Hot", "human", "full"]);
  assert.deepEqual([f({}).doNotText, f({}).junk, f({}).snoozeUntil, f({}).paused, f({}).modelVersion], [false, false, "", false, 3]);
});

test("saving keeps every old field and keeps status in step with the stage", () => {
  const lead = {
    date: "2026-09-20", createdAt: at("2026-09-20"), owner: "Ananth", name: "Jo", phone: "0400", status: "Quoted", quoted: 250,
    nextFollowUp: "2026-10-02", lostWhy: "", notes: "When: ASAP", log: [{ at: at("2026-09-21"), by: "Ananth", type: "text" }],
    paid: "", plan: "Yes", reviewAsked: "", custom: { kept: true },
  };
  const out = plain(M.sync(lead, TODAY));
  for (const k of Object.keys(lead)) assert.deepEqual(out[k], plain(lead)[k], k);
  assert.deepEqual([out.stage, out.booked], ["Quoted", "Pending"]);
  const status = (stage, old) => M.sync({ stage, status: old }, TODAY).status;
  assert.deepEqual(["New", "Chasing", "Quoted", "Booked", "Lost"].map((s) => status(s, "New")), ["New", "Contacted", "Quoted", "Booked", "Lost"]);
  assert.deepEqual([status("Waiting", "Quoted"), status("Waiting", "Contacted"), status("Cold", "New")], ["Quoted", "Contacted", "Contacted"]);
  // A booking moves on once the job date has passed, and doesn't move back.
  assert.equal(M.sync({ stage: "Booked", jobDate: "2026-10-01" }, TODAY).stage, "Done");
  assert.equal(M.sync({ stage: "Done", jobDate: "2026-10-09" }, TODAY).stage, "Done");
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
    { id: "d", name: "D", createdAt: at("2026-09-04"), status: "Booked", owner: "Angus", jobDate: "2026-09-10", modelVersion: 3 },
  ];
  const p = plain(M.plan(leads, TODAY));
  const row = (id) => p.rows.find((r) => r.id === id);
  assert.equal(p.todo, 3);
  assert.deepEqual([row("a").patch.owner, row("b").patch.owner, row("c").patch.owner], ["Ananth", "Angus", "Ananth"]);
  assert.equal(row("b").patch.ownerWas, "");
  assert.equal(row("d"), undefined); // up to date and owned: left alone
  assert.equal(row("b").patch.score, "Hot");
});
