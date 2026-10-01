import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

// The page's checklist and review logic are plain browser scripts; run them as the page does.
process.env.TZ = "Australia/Sydney";
const sandbox = { window: {} };
for (const f of ["../public/reviews.js", "../public/jobs.js"]) vm.runInNewContext(readFileSync(new URL(f, import.meta.url), "utf8"), sandbox);
const J = sandbox.window.ILJobs;
const R = sandbox.window.ILReviews;
const plain = (x) => JSON.parse(JSON.stringify(x));
const seed = () => JSON.parse(readFileSync(new URL("../seed/sops.json", import.meta.url), "utf8"));
const NOW = "2026-10-01T09:00:00.000Z";

const build = (service, s = seed()) => J.buildChecklist({ id: "L1", service, name: "Jo Smith", car: "Raptor", jobDate: "2026-10-01" }, s.templates, s.settings ? { ...s.settings, services: s.services } : s, NOW);
const set = () => { const s = seed(); return { ...s.settings, services: s.services }; };
const itemsOf = (snap, key) => snap.templates.find((t) => t.key === key).sections.flatMap((s) => s.items);
const stepTitles = (snap, key) => itemsOf(snap, key).filter((i) => i.type === "step").map((i) => i.title || i.detail);

test("the seed is the Appendix word for word", () => {
  assert.equal(J.markdown(seed().templates), readFileSync(new URL("./fixtures/sop-appendix.md", import.meta.url), "utf8"));
});

test("each service gets its templates in order, without repeats", () => {
  const keys = (service) => plain(build(service).job.templateKeys);
  assert.deepEqual(keys("Exterior"), ["every_job", "exterior", "handover", "signoff"]);
  assert.deepEqual(keys("Interior"), ["every_job", "interior", "handover", "signoff"]);
  assert.deepEqual(keys("Full detail"), ["every_job", "exterior", "interior", "handover", "signoff"]);
  assert.deepEqual(keys("Correction"), ["every_job", "exterior", "correction", "handover", "signoff"]);
  assert.deepEqual(keys("Ceramic"), ["every_job", "exterior", "correction", "ceramic", "handover", "signoff"]);
  // More than one service: combined, no repeats, in the templates' order.
  const both = J.buildChecklist({ id: "L2", services: ["Interior", "Correction"] }, seed().templates, set(), NOW);
  assert.deepEqual(plain(both.job.templateKeys), ["every_job", "exterior", "interior", "correction", "handover", "signoff"]);
});

test("correction and ceramic jobs stop the exterior steps after the rinse", () => {
  for (const service of ["Correction", "Ceramic"]) {
    const ext = stepTitles(build(service).snapshot, "exterior");
    assert.equal(ext.length, 7, service);
    assert.deepEqual(ext.slice(-2), ["Clay.", "Rinse"], service);
    assert.ok(!ext.includes("Ceramic sealant."), service);
  }
  assert.equal(stepTitles(build("Exterior").snapshot, "exterior").length, 14);
  assert.equal(stepTitles(build("Full detail").snapshot, "exterior").length, 14);
  // The exterior clips stay on the list.
  assert.equal(itemsOf(build("Ceramic").snapshot, "exterior").filter((i) => i.type === "clip").length, 11);
  // The rule lives in the data, not the screen.
  assert.equal(seed().services.Ceramic.stopAfter.exterior, "ext-steps-7");
});

test("sign-off shows only what applies to the service", () => {
  const sign = (service) => itemsOf(build(service).snapshot, "signoff").map((i) => i.detail);
  const ext = sign("Exterior");
  assert.ok(ext.includes("Tape all removed") && !ext.includes("No strong smell"));
  assert.ok(!ext.some((d) => /\((correction and coating|coating)( jobs)?\)$/.test(d)), ext.join("; "));
  assert.equal(ext.length, 7); // Outside 5, Job 2
  const int = sign("Interior");
  assert.ok(int.includes("No strong smell") && !int.includes("Tape all removed"));
  const full = sign("Full detail");
  assert.ok(full.includes("No strong smell") && full.includes("Tape all removed"));
  const cor = sign("Correction");
  assert.ok(cor.includes("LED check done on every panel (correction and coating jobs)") && cor.includes("Paint readings and stages written down (correction and coating)"));
  assert.ok(!cor.includes("Warranty record done (coating)") && !cor.includes("No strong smell"));
  assert.ok(sign("Ceramic").includes("Warranty record done (coating)"));
  assert.equal(sign("Interior").length, 7); // Inside 5, Job 2
  assert.equal(sign("Full detail").length, 12); // Outside 5, Inside 5, Job 2
  assert.equal(sign("Correction").length, 9); // Outside 6, Job 3
  assert.equal(sign("Ceramic").length, 10); // Outside 6, Job 4
  assert.equal(plain(build("Ceramic").job.signoffs).length, sign("Ceramic").length);
});

test("editing an SOP doesn't change a job that already has its checklist", () => {
  const s = seed();
  const old = build("Exterior", s);
  const before = JSON.stringify(old.snapshot);
  const first = s.templates.find((t) => t.key === "exterior").sections[0].items[0];
  first.title = "Wheels, tyres and arches.";
  first.detail = "New words.";
  s.templates.find((t) => t.key === "exterior").sections[0].items.splice(1, 1);
  assert.equal(JSON.stringify(old.snapshot), before);
  assert.equal(itemsOf(old.snapshot, "exterior")[0].title, "Wheels and tyres.");
  // A new job gets the new words.
  const fresh = build("Exterior", s);
  assert.equal(itemsOf(fresh.snapshot, "exterior")[0].title, "Wheels, tyres and arches.");
  assert.equal(stepTitles(fresh.snapshot, "exterior").length, 13);
});

test("progress counts steps done or skipped; clips and sign-off are counted apart", () => {
  const { job } = build("Exterior");
  const j = plain(job);
  assert.equal(J.progress(j).total, 3 + 1 + 5 + 14 + 7 + 4); // every job, exterior, handover
  j["s:" + j.steps[0]] = { done: true, by: "Angus", at: "1" };
  j["s:" + j.steps[1]] = { skipped: true, reason: "No tap", by: "Angus", at: "2" };
  j["s:" + j.clips[0]] = { done: true, by: "Angus", at: "3" };
  const p = J.progress(j);
  assert.equal(p.done, 2);
  assert.equal(p.skipped, 1);
  assert.equal(p.clipsDone, 1);
  assert.equal(p.clipsTotal, 11);
});

const allDone = (job, by) => {
  const j = plain(job);
  j.steps.forEach((id, n) => (j["s:" + id] = { done: true, by, at: String(n).padStart(3, "0") }));
  return j;
};

test("the person who did most of the job can't sign it off", () => {
  let j = plain(build("Interior").job);
  assert.equal(J.canSignOff(j, "Ananth").reason, "steps");
  j = allDone(build("Interior").job, "Angus");
  j["s:" + j.steps[0]].by = "Ananth";
  assert.equal(J.mainWorker(j), "Angus");
  assert.equal(J.canSignOff(j, "Angus").reason, "same");
  assert.equal(J.canSignOff(j, "Ananth").ok, true);
  assert.equal(J.signOffPatch(j, "Ananth", NOW), null); // sign-off list not ticked yet
  j.signoffs.forEach((id) => (j["s:" + id] = { done: true, by: "Ananth", at: "x" }));
  assert.deepEqual(plain(J.signOffPatch(j, "Ananth", NOW)), { signoff: { by: "Ananth", at: NOW } });
  assert.equal(J.signOffPatch(j, "Angus", NOW), null);
  // A tie goes to whoever ticked last.
  const t = plain(build("Interior").job);
  t["s:" + t.steps[0]] = { done: true, by: "Angus", at: "2026-10-01T01:00:00Z" };
  t["s:" + t.steps[1]] = { done: true, by: "Ananth", at: "2026-10-01T02:00:00Z" };
  assert.equal(J.mainWorker(t), "Ananth");
});

test("a job can't be marked done without sign-off, unless an admin overrides it", () => {
  const lead = { id: "L1", name: "Jo", status: "Booked" };
  const j = plain(build("Exterior").job);
  assert.equal(J.canMarkDone(j), false);
  assert.equal(J.donePatch(lead, j, NOW, R), null);
  assert.throws(() => J.overridePatch("Ananth", "Customer had to leave", set(), NOW), /Only Angus/);
  assert.throws(() => J.overridePatch("Angus", "   ", set(), NOW), /Write why/);
  const o = J.overridePatch("Angus", "Customer had to leave", set(), NOW);
  assert.deepEqual(plain(o), { override: { by: "Angus", reason: "Customer had to leave", at: NOW } });
  assert.equal(J.canMarkDone({ ...j, ...plain(o) }), true);
  assert.equal(J.canMarkDone({ ...j, signoff: { by: "Ananth", at: NOW } }), true);
});

test("marking a job done sets the review status to not asked", () => {
  const lead = { id: "L1", name: "Jo", status: "Booked" };
  const j = { ...plain(build("Exterior").job), signoff: { by: "Ananth", at: NOW } };
  const p = plain(J.donePatch(lead, j, NOW, R));
  assert.equal(p.reviewStatus, "not_asked");
  assert.equal(p.completedAt, NOW);
  assert.equal(R.statusOf({ ...lead, ...p }), "not_asked");
});

test("paint readings: under 80 and a jump over 30 are flagged, and both limits come from settings", () => {
  assert.deepEqual(plain(J.paintFlags({ r: [110, 95, 78, "", 120] }, set())), { low: [2], spread: 42, bigJump: true });
  assert.deepEqual(plain(J.paintFlags({ r: [110, 95, 100, 105, 120] }, set())), { low: [], spread: 25, bigJump: false });
  assert.deepEqual(plain(J.paintFlags({ r: [110, 95, 78] }, { paintMin: 70, paintSpread: 40 })), { low: [], spread: 32, bigJump: false });
});

test("handover: the right pitch for the service, with the car filled in", () => {
  const lead = { id: "L1", car: "Raptor" };
  const full = build("Full detail");
  const s = plain(J.handoverScripts(full.snapshot, full.job, lead));
  assert.deepEqual(s.map((x) => x.key), ["pitch", "referral", "review"]);
  assert.equal(s[0].label, "Ceramic pitch (full detail customers)");
  assert.match(s[0].text, /^So it looks like this now\..*Want me to send you a price for the Raptor\?$/);
  assert.equal(s[1].text, "If a mate books, you get $50 off your next one.");
  assert.equal(s[2].text, "If you've got 30 seconds later, a Google review helps us heaps. I'll text you the link tonight.");
  const cer = build("Ceramic");
  assert.equal(J.handoverScripts(cer.snapshot, cer.job, lead)[0].label, "Maintenance plan pitch (ceramic customers)");
});

test("warranty fills from the lead, annual check a year after the job", () => {
  assert.deepEqual(plain(J.warrantyDefaults({ name: "Jo Smith", car: "Raptor", jobDate: "2026-10-01" })), {
    customer: "Jo Smith", car: "Raptor", rego: "", date: "2026-10-01", package: "", product: "", batch: "", layers: "", photos: "", annualCheck: "2027-10-01",
  });
  assert.equal(J.addYear("2028-02-29"), "2029-02-28");
});

test("dashboard: earlier this week's jobs not signed off, and the 30-day numbers", () => {
  const now = new Date("2026-10-01T12:00:00+10:00"); // Thursday
  const lead = (id, jobDate, extra = {}) => ({ id, status: "Booked", jobDate, ...extra });
  const leads = [lead("mon", "2026-09-28"), lead("signed", "2026-09-29"), lead("added", "2026-09-30", { kind: "job" }), lead("lastweek", "2026-09-25"), lead("today", "2026-10-01"), lead("tomorrow", "2026-10-02")];
  const jobs = { signed: { signoff: { by: "Ananth" } } };
  assert.deepEqual(plain(J.unsigned(jobs, leads, now).map((l) => l.id)), ["mon"]);

  const a = plain(build("Full detail").job), b = plain(build("Ceramic").job);
  a["s:" + a.steps[0]] = { skipped: true, reason: "x" };
  a["s:" + a.steps[1]] = { skipped: true, reason: "y" };
  a["s:" + a.clips[0]] = { done: true };
  a.ceramicPitched = "Yes";
  b["s:" + b.clips[0]] = { done: true };
  b.planPitched = "No";
  const st = plain(J.stats({ a, b }, [lead("a", "2026-09-20"), lead("b", "2026-10-01"), lead("old", "2026-08-01")], now, 30));
  assert.equal(st.jobs, 2);
  assert.equal(st.skippedPerJob, 1);
  assert.equal(st.clipsFilmed, 2);
  assert.equal(st.clipsExpected, a.clips.length + b.clips.length);
  assert.equal(st.ceramicPitchedRate, 1);
  assert.equal(st.planPitchedRate, 0);
});

test("a changed service is noticed so the checklist can be rebuilt", () => {
  const { job } = build("Exterior");
  assert.equal(J.needsRebuild(job, { service: "Exterior" }), false);
  assert.equal(J.needsRebuild(job, { service: "Ceramic" }), true);
});
