import assert from "node:assert/strict";
import { test } from "node:test";
import M from "../lib/model.js";
import "../public/jobs.js";

const J = globalThis.ILJobs;
const TODAY = "2026-10-20";
const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString();
const lead = (p = {}) => M.sync({ id: "x", date: TODAY, createdAt: at(TODAY, "09:00"), owner: "Angus", name: "Jo Smith", car: "Mazda CX-5", phone: "0400 111 222", log: [], ...M.newFields(""), ...p }, TODAY);

test("settings: the defaults fill any gap; bad lengths and blank names are ignored", () => {
  const d = J.settings();
  assert.deepEqual(d.crew, ["Lucas", "Nick", "AJ", "Ananth", "Angus"]);
  assert.deepEqual(d.kits, ["Kit 1", "Kit 2"]);
  assert.deepEqual([d.lengths["Full Detail"], d.lengths.Interior, d.lengths.Exterior, d.lengths["Maintenance Plan"], d.lengths["Paint Correction"], d.lengths["Ceramic Coating"]], [3.5, 2, 1.5, 2.5, "allday", "allday"]);
  const s = J.settings({ crew: [" Lucas ", "", "Lucas", "Sam"], kits: [], lengths: { Interior: "2.5", Exterior: -1, "Full Detail": "allday" }, addOns: [{ name: "Pet hair", price: "40" }, { name: " " }, { name: "Travel", price: "" }] });
  assert.deepEqual(s.crew, ["Lucas", "Sam"]);
  assert.deepEqual(s.kits, ["Kit 1", "Kit 2"]);
  assert.deepEqual([s.lengths.Interior, s.lengths.Exterior, s.lengths["Full Detail"]], [2.5, 1.5, "allday"]);
  assert.deepEqual(s.addOns, [{ name: "Pet hair", price: 40 }, { name: "Travel", price: null }]);
});

test("times: the end comes from the service's length; labels read like the calendar", () => {
  assert.equal(J.endFor("09:00", "Full Detail"), "12:30");
  assert.equal(J.endFor("09:00", "Interior", { lengths: { Interior: 3 } }), "12:00");
  assert.equal(J.endFor("09:00", "Ceramic Coating"), ""); // all day
  assert.equal(J.endFor("", "Interior"), "");
  assert.deepEqual(J.lengthOf("Paint Correction"), { allDay: true, minutes: 0 });
  assert.equal(J.timeLabel({ start: "09:00", end: "12:00" }), "9:00am - 12:00pm");
  assert.equal(J.timeLabel({ allDay: true, start: "09:00" }), "All-day");
  assert.equal(J.timeLabel({ start: "09:00" }), "Start 9:00am");
  assert.equal(J.timeLabel({}), "No time set");
});

test("price: one number or a range, with the add-ons on top; the final price wins once done", () => {
  assert.deepEqual(J.priceOf({ price: "280-350" }), { low: 280, high: 350, text: "$280–350" });
  assert.deepEqual(J.priceOf({ price: "280", addOns: [{ name: "Mat stain removal", price: 55 }, { name: "Travel fee", price: null }] }), { low: 335, high: 335, text: "$335" });
  assert.deepEqual(J.priceOf({ price: "" }), { low: null, high: null, text: "" });
  assert.equal(J.total({ price: "280-350", finalPrice: 320 }), 320);
  assert.equal(J.total({ price: "280-350" }), 280);
});

test("a booked lead's job: linked by id, numbered from 1001, its day, time, price and service", () => {
  const l = lead({ id: "a", stage: "Booked", service: "Full detail", jobDate: "2026-10-24", jobTime: "09:00", revenue: 280, priceRange: "280–350" });
  const j = J.fromLead(l, 1001, null, at(TODAY), "Angus", TODAY);
  assert.deepEqual([j.number, j.leadId, j.service, j.date, j.start, j.end, j.allDay, j.price, j.status, j.finalPrice], [1001, "a", "Full Detail", "2026-10-24", "09:00", "12:30", false, "280-350", "Scheduled", null]);
  assert.equal(J.title(j, l), "Full Detail - Mazda CX-5");
  assert.equal("name" in j || "phone" in j || "car" in j, false); // the customer stays on the lead
  // Ceramic with no time: all day. A done lead: completed, its price final.
  const c = J.fromLead(lead({ id: "c", stage: "Booked", service: "Ceramic", jobDate: "2026-10-25" }), 1002, null, at(TODAY), "", TODAY);
  assert.deepEqual([c.service, c.allDay, c.start], ["Ceramic Coating", true, ""]);
  const d = J.fromLead(lead({ id: "d", stage: "Done", service: "Interior", jobDate: "2026-10-01", revenue: 190 }), 1003, null, at(TODAY), "", TODAY);
  assert.deepEqual([d.status, d.finalPrice, d.service], ["Completed", 190, "Interior"]);
  assert.equal(J.serviceFromLead("Not sure"), "Other");
  assert.equal(J.serviceToLead("Paint Correction"), "Correction");
});

test("jobs to make: booked leads with no job yet, by job day, numbered on; done ones only the first time", () => {
  const L = [
    lead({ id: "late", stage: "Booked", jobDate: "2026-10-28" }),
    lead({ id: "early", stage: "Booked", jobDate: "2026-10-22" }),
    lead({ id: "has", stage: "Booked", jobDate: "2026-10-23" }),
    lead({ id: "past", stage: "Done", jobDate: "2026-10-01" }),
    lead({ id: "chasing", stage: "Chasing" }),
    lead({ id: "fake", stage: "Booked", jobDate: "2026-10-22", junk: true }),
  ];
  const jobs = [{ number: 1004, leadId: "has" }];
  assert.deepEqual(J.toMake(L, jobs, null, TODAY, at(TODAY), false).map((x) => [x.id, x.job.number]), [["lead-early", 1005], ["lead-late", 1006]]);
  assert.deepEqual(J.toMake(L, [], null, TODAY, at(TODAY), true).map((x) => [x.id, x.job.number]), [["lead-past", 1001], ["lead-early", 1002], ["lead-has", 1003], ["lead-late", 1004]]);
  assert.equal(J.nextNumber([]), 1001);
});

test("two jobs with one number (two phones at once): the later one moves to the next free number", () => {
  const list = [
    { id: "b", job: { number: 1002, createdAt: at(TODAY, "10:01") } },
    { id: "a", job: { number: 1002, createdAt: at(TODAY, "10:00") } },
    { id: "c", job: { number: 1001, createdAt: at(TODAY, "09:00") } },
  ];
  assert.deepEqual(J.renumber(list), [{ id: "b", number: 1003 }]);
  assert.deepEqual(J.renumber(list.slice(1)), []);
});

test("the lead keeps its booking in step with the job, and the job with the lead", () => {
  const l = lead({ id: "a", stage: "Booked", service: "Full detail", jobDate: "2026-10-24", jobTime: "09:00", revenue: 280 });
  const j = J.fromLead(l, 1001, null, at(TODAY), "", TODAY);
  assert.deepEqual(J.leadPatch(j, l), {}); // nothing to change
  assert.deepEqual(J.leadPatch({ ...j, date: "2026-10-25", start: "13:00", price: "300-350" }, l), { jobDate: "2026-10-25", jobTime: "13:00", revenue: 300, priceRange: "300–350" });
  assert.deepEqual(J.leadPatch({ ...j, status: "Completed", finalPrice: 330 }, l), { revenue: 330 });
  assert.deepEqual(J.leadPatch({ ...j, allDay: true }, l), { jobTime: "" });
  // Moved on the lead: the job follows.
  assert.deepEqual(J.jobPatch({ ...l, jobDate: "2026-10-26", jobTime: "10:00", revenue: 300 }, j), { date: "2026-10-26", start: "10:00", end: "13:30", allDay: false, price: "300" });
  assert.deepEqual(J.jobPatch(l, j), {});
  // Its own length goes with it when moved (a 4-hour job stays 4 hours).
  assert.deepEqual(J.jobPatch({ ...l, jobTime: "08:00" }, { ...j, end: "13:00" }), { start: "08:00", end: "12:00", allDay: false });
});

test("the agenda: days with something on, in time order, all-day first; the service filter keeps only those jobs", () => {
  const jobs = [
    { number: 1002, date: "2026-10-22", start: "13:00", service: "Interior" },
    { number: 1001, date: "2026-10-22", start: "09:00", service: "Ceramic Coating" },
    { number: 1003, date: "2026-10-22", allDay: true, service: "Paint Correction" },
    { number: 1004, date: "2026-10-30", start: "09:00", service: "Interior" },
    { number: 1005, date: "2026-10-19", start: "09:00", service: "Interior" },
  ];
  const events = [{ type: "meeting", title: "Team meeting", date: "2026-10-23", start: "07:30" }];
  const a = J.agenda(jobs, events, "2026-10-20", 7);
  assert.deepEqual(a.map((d) => [d.day, d.items.map((i) => i.x.number || i.x.title)]), [["2026-10-22", [1003, 1001, 1002]], ["2026-10-23", ["Team meeting"]]]);
  const f = J.agenda(jobs, events, "2026-10-20", 30, { service: "Interior" });
  assert.deepEqual(f.map((d) => [d.day, d.items.map((i) => i.x.number)]), [["2026-10-22", [1002]], ["2026-10-30", [1004]]]);
  assert.deepEqual(J.busyDays([...jobs, { date: "2026-10-24", status: "Cancelled" }]), { "2026-10-22": true, "2026-10-30": true, "2026-10-19": true });
  assert.deepEqual(J.weekDays("2026-10-21"), ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]);
});

test("avatars and search", () => {
  assert.deepEqual(["AJ", "Lucas", "Ananth Kumar", "", "nick"].map(J.initials), ["AJ", "L", "AK", "?", "N"]);
  const job = { number: 1007, service: "Interior" };
  const l = { name: "Jo Smith", phone: "0400 111 222", car: "Kluger", suburb: "Gungahlin" };
  assert.equal(J.matches(job, l, "1007"), true);
  assert.equal(J.matches(job, l, "gungahlin"), true);
  assert.equal(J.matches(job, l, "ceramic"), false);
});

test("a lead booked again after its job was done gets a second job; a cancelled one isn't remade", () => {
  const again = lead({ id: "r", stage: "Booked", jobDate: "2026-11-02" });
  const done = { id: "lead-r", leadId: "r", number: 1001, status: "Completed", date: "2026-10-01", createdAt: at("2026-09-20") };
  assert.deepEqual(J.toMake([again], [done], null, TODAY, at(TODAY), false).map((x) => [x.id, x.job.number, x.job.date]), [["lead-r-2026-11-02", 1002, "2026-11-02"]]);
  // Its newest job is the one that counts.
  const second = { id: "lead-r-2026-11-02", leadId: "r", number: 1002, status: "Scheduled", date: "2026-11-02", createdAt: at(TODAY) };
  assert.equal(J.currentJob([done, second], "r").id, "lead-r-2026-11-02");
  assert.deepEqual(J.toMake([again], [done, second], null, TODAY, at(TODAY), false), []);
  const cancelled = { ...done, status: "Cancelled", date: "2026-11-02" };
  assert.deepEqual(J.toMake([again], [cancelled], null, TODAY, at(TODAY), false), []);
  assert.equal(J.currentJob([done], "nobody"), null);
});

test("clashes: one person or kit on two jobs at once, or on a job while on time off", () => {
  const job = (id, o) => ({ id, date: "2026-10-22", service: "Interior", status: "Scheduled", crew: [], kit: "", ...o });
  const jobs = [
    job("a", { start: "09:00", end: "12:00", crew: ["Lucas"], kit: "Kit 1" }),
    job("b", { start: "11:00", end: "13:00", crew: ["Lucas", "AJ"] }), // Lucas twice
    job("c", { start: "12:00", end: "14:00", kit: "Kit 1" }), // starts as a ends: fine
    job("d", { allDay: true, crew: ["AJ"] }), // all day: AJ on b too
    job("e", { start: "09:00", end: "12:00", crew: ["Nick"], status: "Cancelled" }),
    job("f", { start: "10:00", crew: ["Nick"] }), // no end: Interior is 2 hours
    job("g", { date: "2026-10-23", start: "09:00", end: "10:00", crew: ["Lucas"] }),
  ];
  const events = [{ id: "off", type: "timeoff", date: "2026-10-22", allDay: true, who: ["Nick"] }, { id: "meet", type: "meeting", date: "2026-10-22", start: "09:00", end: "10:00", who: [] }];
  const c = J.clashes(jobs, events);
  assert.deepEqual(Object.keys(c).sort(), ["a", "b", "d", "f"]);
  assert.deepEqual(c.a, [{ id: "b", who: "Lucas", kind: "job" }]);
  assert.deepEqual(c.b.map((x) => x.id + ":" + x.who).sort(), ["a:Lucas", "d:AJ"]);
  assert.deepEqual(c.f, [{ id: "off", who: "Nick", kind: "timeoff" }]);
  assert.deepEqual(J.span({ date: "2026-10-22", start: "10:00", service: "Interior" }), [600, 720]);
  assert.equal(J.span({ date: "2026-10-22" }), null);
});

test("side by side where they overlap; the month's grid; rows for people and kits", () => {
  const out = J.lanes([{ id: 1, s: 540, e: 720 }, { id: 2, s: 600, e: 660 }, { id: 3, s: 660, e: 780 }, { id: 4, s: 800, e: 860 }]);
  assert.deepEqual(out.map((x) => [x.id, x.lane, x.lanes]), [[1, 0, 2], [2, 1, 2], [3, 1, 2], [4, 0, 1]]);
  const oct = J.monthDays("2026-10-21");
  assert.deepEqual([oct[0], oct.at(-1), oct.length], ["2026-09-27", "2026-10-31", 35]);
  assert.equal(J.monthDays("2026-08-05").length, 42); // 1 Aug is a Saturday
  assert.deepEqual(J.resources(), ["Kit 1", "Kit 2", "Lucas", "Nick", "AJ", "Ananth", "Angus"]);
  assert.deepEqual([J.onRow({ crew: ["AJ"], kit: "Kit 2" }, "Kit 2"), J.onRow({ crew: ["AJ"] }, "AJ"), J.onRow({ crew: [] }, ""), J.onRow({ who: ["Nick"] }, "Nick")], [true, true, true, true]);
});

test("moving a job: it keeps its length; onto a person swaps them in, onto a kit sets the kit", () => {
  const job = { start: "09:00", end: "12:30", crew: ["Lucas", "AJ"], kit: "Kit 1" };
  const kits = ["Kit 1", "Kit 2"];
  assert.deepEqual(J.moveTo(job, "10:15", "Lucas", "Lucas", kits), { start: "10:15", end: "13:45", allDay: false });
  assert.deepEqual(J.moveTo(job, "", "Lucas", "Nick", kits), { crew: ["AJ", "Nick"] });
  assert.deepEqual(J.moveTo(job, "", "Lucas", "", kits), { crew: ["AJ"] });
  assert.deepEqual(J.moveTo(job, "", "Kit 1", "Kit 2", kits), { kit: "Kit 2" });
  assert.deepEqual(J.moveTo({ crew: [], start: "09:00", end: "10:00" }, "", "", "Nick", kits), { crew: ["Nick"] });
  assert.deepEqual(J.moveTo({ start: "", end: "" }, "08:00", "", "", kits), { start: "08:00", end: "09:00", allDay: false });
});
