import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanPhone, findLead, parseWhen, planBooking, readBooking, statusOf } from "../lib/ghl.js";
import J from "../lib/jobs.js";
import M from "../lib/model.js";

const NOW = new Date("2026-10-21T10:00:00+11:00");
const TODAY = "2026-10-21";
const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString();
const lead = (p = {}) => M.sync({ id: "x", date: "2026-10-18", createdAt: at("2026-10-18", "09:00"), owner: "Angus", name: "Jo Smith", car: "Kluger", phone: "0400 111 222", email: "", log: [], ...M.newFields(""), stage: "Chasing", touches: 1, ...p }, TODAY);
// What a GHL workflow's Webhook action sends for an appointment (made-up person).
const payload = (o = {}, cal = {}) => ({
  contact_id: "c_1", first_name: "Jo", last_name: "Smith", full_name: "Jo Smith", email: "Jo@Example.com", phone: "+61 400 111 222",
  address1: "12 Example St", city: "Gungahlin", state: "ACT", postal_code: "2912", full_address: "12 Example St, Gungahlin ACT 2912",
  calendar: { calendarName: "Full Detail", title: "Full Detail - Jo Smith", appointmentId: "appt_1", startTime: "2026-10-24T09:00:00", endTime: "2026-10-24T12:30:00", selectedTimezone: "Australia/Sydney", appoinmentStatus: "confirmed", notes: "Dog hair in the back", ...cal },
  ...o,
});
const byId = (writes, c) => writes.filter((w) => w.collection === c);

test("phone numbers are written +61; statuses and times are read the way GHL sends them", () => {
  assert.deepEqual(["0400 111 222", "+61 400 111 222", "61400111222", "400111222", "(02) 6123 4567", "", "+1 415 555 0100"].map(cleanPhone),
    ["+61400111222", "+61400111222", "+61400111222", "+61400111222", "+61261234567", "", "+14155550100"]);
  assert.deepEqual(["confirmed", "booked", "new", "", "cancelled", "Canceled", "invalid", "noshow", "no_show", "No-Show", "showed"].map((s) => statusOf(s)),
    ["booked", "booked", "booked", "booked", "cancelled", "cancelled", "cancelled", "noshow", "noshow", "noshow", "showed"]);
  assert.equal(statusOf("confirmed", "AppointmentDelete"), "cancelled");
  const iso = (v, tz) => parseWhen(v, tz).toISOString();
  assert.equal(iso("2026-10-24T09:00:00", "Australia/Sydney"), "2026-10-23T22:00:00.000Z"); // daylight saving, +11
  assert.equal(iso("2026-06-24T09:00:00"), "2026-06-23T23:00:00.000Z"); // winter, +10
  assert.equal(iso("2026-10-24T09:00:00+11:00"), "2026-10-23T22:00:00.000Z");
  assert.equal(iso("2026-10-24T09:00:00", "Australia/Brisbane"), "2026-10-23T23:00:00.000Z");
  assert.equal(iso("October 24, 2026 9:00 AM", "Australia/Sydney"), "2026-10-23T22:00:00.000Z");
  assert.equal(iso("1792792800"), "2026-10-23T22:00:00.000Z");
  assert.equal(parseWhen("", "Australia/Sydney"), null);
});

test("a workflow webhook is read: the person, the appointment, its calendar, times and status", () => {
  const b = readBooking(payload({ customData: { Vehicle: "Mazda CX-5" } }));
  assert.deepEqual([b.apptId, b.contactId, b.name, b.phone, b.email, b.address, b.suburb, b.car, b.calendar, b.status, b.notes],
    ["appt_1", "c_1", "Jo Smith", "+61400111222", "jo@example.com", "12 Example St, Gungahlin ACT 2912", "Gungahlin", "Mazda CX-5", "Full Detail", "booked", "Dog hair in the back"]);
  assert.equal(b.start.toISOString(), "2026-10-23T22:00:00.000Z");
  // An API event, with the appointment on its own.
  const e = readBooking({ type: "AppointmentUpdate", appointment: { id: "appt_9", title: "Interior", startTime: "2026-10-25T13:00:00+11:00", appointmentStatus: "noshow" } });
  assert.deepEqual([e.apptId, e.title, e.status], ["appt_9", "Interior", "noshow"]);
  // No appointment ID: the calendar's id goes with the contact, so two people never share a job.
  assert.equal(readBooking({ contact_id: "c_1", calendar: { id: "cal_1", startTime: "2026-10-24T09:00:00" } }).apptId, "cal_1-c_1");
  assert.equal(readBooking({ contact_id: "c_2", calendar: { id: "cal_1", startTime: "2026-10-24T09:00:00" } }).apptId, "cal_1-c_2");
  assert.equal(readBooking({ phone: "0400 111 222", startTime: "2026-10-24T09:00:00" }).apptId, "contact-0400111222");
  assert.equal(readBooking({ calendar: { id: "cal_1" } }).apptId, ""); // nobody to go with it
});

test("a new person: a new lead (GHL booking, Booked) and its job, the job written first", () => {
  const p = planBooking(payload(), { leads: [lead({ id: "other", phone: "0499 999 999" })], jobs: [{ id: "j", number: 1010 }], now: NOW, turn: "Ananth" });
  assert.equal(p.ok, true);
  assert.deepEqual(p.writes.map((w) => w.op + " " + w.collection + "/" + w.id), ["create jobs/ghl-appt_1", "create leads/ghl-appt_1"]);
  const job = p.writes[0].data, l = p.writes[1].data;
  assert.deepEqual([job.number, job.leadId, job.service, job.date, job.start, job.end, job.status, job.source, job.ghlAppointmentId, job.checkService, job.notes],
    [1011, "ghl-appt_1", "Full Detail", "2026-10-24", "09:00", "12:30", "Scheduled", "ghl", "appt_1", false, "Dog hair in the back"]);
  assert.deepEqual([l.source, l.stage, l.status, l.jobDate, l.jobTime, l.name, l.phone, l.email, l.address, l.suburb, l.service, l.owner, l.replyMins],
    ["GHL booking", "Booked", "Booked", "2026-10-24", "09:00", "Jo Smith", "+61400111222", "jo@example.com", "12 Example St, Gungahlin ACT 2912", "Gungahlin", "Full detail", "Ananth", null]);
  assert.equal(l.log[l.log.length - 1].outcome, "GHL booking");
  assert.match(p.result, /New lead Jo Smith: job 1011, Sat 24 Oct 9:00am/);
  assert.deepEqual([p.summary.newLead, p.summary.owner], [true, "Ananth"]);
});

test("a calendar name that doesn't say the service: Other, flagged Check service", () => {
  const p = planBooking(payload({}, { calendarName: "Imperium Bookings", title: "Booking" }), { now: NOW });
  const job = p.writes[0].data;
  assert.deepEqual([job.service, job.checkService, job.end], ["Other", true, "12:30"]); // GHL's own end time
  assert.match(p.result, /Check service/);
  // From the title when the calendar's name doesn't say.
  assert.equal(planBooking(payload({}, { calendarName: "Bookings", title: "Ceramic coating" }), { now: NOW }).writes[0].data.service, "Ceramic Coating");
});

test("someone already here: found by phone (any way it's written), then by email; booked, with the job", () => {
  const jo = lead({ id: "jo", phone: "0400111222", quoted: 320 });
  const p = planBooking(payload(), { leads: [jo], jobs: [], now: NOW });
  assert.deepEqual(p.writes.map((w) => w.op + " " + w.collection + "/" + w.id), ["create jobs/ghl-appt_1", "merge leads/jo"]);
  const lp = p.writes[1].data;
  assert.deepEqual([lp.stage, lp.jobDate, lp.jobTime, lp.email, lp.revenue], ["Booked", "2026-10-24", "09:00", "jo@example.com", 320]);
  assert.equal(p.writes[0].data.leadId, "jo");
  assert.equal(p.writes[0].data.price, "320");
  assert.equal("name" in lp || "phone" in lp, false); // what's on the lead is kept
  assert.equal(p.summary.matchedBy, "phone");
  const byEmail = planBooking(payload({ phone: "" }), { leads: [lead({ id: "em", phone: "", email: "jo@example.com" })], now: NOW });
  assert.equal(byEmail.writes[1].id, "em");
  assert.equal(byEmail.summary.matchedBy, "email");
  // Their job is done: a new lead, marked as a repeat, so the old job's takings stay put.
  const done = lead({ id: "old", phone: "0400111222", stage: "Done", jobDate: "2026-09-01", revenue: 280 });
  const rep = planBooking(payload(), { leads: [done], now: NOW });
  assert.deepEqual([rep.writes[1].op, rep.writes[1].data.repeatOf], ["create", "old"]);
  assert.deepEqual(findLead([done], "+61400111222", "", TODAY), { repeatOf: "old", by: "phone" });
});

test("already booked here with a job: that job takes GHL's appointment and time, no second job", () => {
  const jo = lead({ id: "jo", stage: "Booked", jobDate: "2026-10-23", jobTime: "13:00", revenue: 300 });
  const mine = { id: "lead-jo", leadId: "jo", number: 1004, status: "Scheduled", service: "Full Detail", date: "2026-10-23", start: "13:00", end: "16:30", crew: ["Lucas"], createdAt: at("2026-10-19") };
  const p = planBooking(payload(), { leads: [jo], jobs: [mine], now: NOW });
  assert.deepEqual(p.writes.map((w) => w.op + " " + w.collection + "/" + w.id), ["merge jobs/lead-jo", "merge leads/jo"]);
  assert.deepEqual([p.writes[0].data.ghlAppointmentId, p.writes[0].data.date, p.writes[0].data.start, "crew" in p.writes[0].data], ["appt_1", "2026-10-24", "09:00", false]);
  assert.deepEqual([p.writes[1].data.jobDate, p.writes[1].data.jobTime], ["2026-10-24", "09:00"]);
});

// The job and lead as they'd be after a first booking.
function booked() {
  const first = planBooking(payload(), { leads: [], jobs: [], now: NOW });
  const job = { id: first.writes[0].id, ...first.writes[0].data };
  const l = { id: first.writes[1].id, ...first.writes[1].data };
  return { job, l, opts: { leads: [l], jobs: [job], now: new Date(NOW.getTime() + 36e5) } };
}

test("the same booking twice changes nothing", () => {
  const { opts } = booked();
  const again = planBooking(payload(), opts);
  assert.deepEqual([again.ok, again.writes.length], [true, 0]);
  assert.match(again.result, /No change: job 1001/);
});

test("a new time moves the job and the lead's day; cancelled cancels it; no-show flags it; showed leaves it", () => {
  const { opts } = booked();
  const moved = planBooking(payload({}, { startTime: "2026-10-25T13:00:00", endTime: "2026-10-25T16:30:00" }), opts);
  assert.deepEqual(byId(moved.writes, "jobs")[0].data.date, "2026-10-25");
  assert.deepEqual([byId(moved.writes, "jobs")[0].data.start, byId(moved.writes, "jobs")[0].data.end], ["13:00", "16:30"]);
  const lp = byId(moved.writes, "leads")[0].data;
  assert.deepEqual([lp.jobDate, lp.jobTime, lp.log[lp.log.length - 1].outcome], ["2026-10-25", "13:00", "GHL: moved"]);
  assert.match(moved.result, /Moved job 1001 to Sun 25 Oct 1:00pm/);

  const cancelled = planBooking(payload({}, { appoinmentStatus: "cancelled" }), opts);
  assert.deepEqual(cancelled.writes.map((w) => w.collection + ":" + (w.collection === "jobs" ? w.data.status : w.data.stage)), ["jobs:Cancelled", "leads:Chasing"]);
  assert.match(cancelled.result, /Cancelled job 1001; the lead is back in Chasing/);

  const noshow = planBooking(payload({}, { appoinmentStatus: "noshow" }), opts);
  assert.deepEqual([noshow.writes[0].data.ghlFlag, "status" in noshow.writes[0].data, noshow.writes[1].data.log.at(-1).outcome], ["No-show", false, "GHL: no-show"]);

  const showed = planBooking(payload({}, { appoinmentStatus: "showed" }), opts);
  assert.deepEqual([showed.ok, showed.writes.length], [true, 0]);

  // Booked again after a cancel: the job is back on, the lead Booked again.
  const { job, l } = booked();
  const back = planBooking(payload(), { leads: [{ ...l, stage: "Chasing" }], jobs: [{ ...job, status: "Cancelled" }], now: NOW });
  assert.deepEqual([back.writes[0].data.status, back.writes[1].data.stage], ["Scheduled", "Booked"]);
});

test("nothing to go on: no appointment ID, or a cancel for a booking that isn't here", () => {
  const none = planBooking({ full_name: "Jo", phone: "0400111222" }, { now: NOW });
  assert.deepEqual([none.ok, none.writes.length], [false, 0]);
  const stray = planBooking(payload({}, { appoinmentStatus: "cancelled" }), { now: NOW });
  assert.deepEqual([stray.ok, stray.writes.length], [true, 0]);
  assert.match(stray.result, /Ignored/);
});

test("the job number counts on from the jobs there are", () => {
  assert.equal(planBooking(payload(), { jobs: [{ id: "a", number: 1001 }, { id: "b", number: 1007 }], now: NOW }).writes[0].data.number, 1008);
  assert.equal(J.nextNumber([]), 1001);
});

// The contact's form answers and where they came from, as GHL sends them (made-up person).
const withAnswers = (o = {}, cal = {}) => payload({
  "What Service": "Exterior only", "Type Of Vehicle": "Hatch/Sedan", "How Soon?": "Within 1-2 Weeks", Suburb: "",
  contact: { attributionSource: { utmContent: "None", source: "facebook" }, lastAttributionSource: { utmContent: "Raptor Ad", utm_campaign: "Winter Detailing Ads", source: "facebook", sessionSource: "Paid Social" } },
  ...o,
}, { calendarName: "Detailing Bookings", title: "Booking", ...cal });

test("GHL fills in what it knows: the service they asked for, the car, how soon, which ad", () => {
  const b = readBooking(withAnswers());
  assert.deepEqual([b.serviceAnswer, b.car, b.howSoon, b.ad, b.fromAds], ["Exterior only", "Hatch/Sedan", "Within 1-2 Weeks", "Raptor Ad", true]);
  const p = planBooking(withAnswers(), { now: NOW });
  const job = p.writes[0].data, l = p.writes[1].data;
  // The calendar's name doesn't say, so the form's answer gives the service: no Check service.
  assert.deepEqual([job.service, job.checkService], ["Exterior", false]);
  assert.deepEqual([l.service, l.car, l.timeline, l.ad, l.fromAd, l.source], ["Exterior", "Hatch/Sedan", "within_1_2_weeks", "Raptor Ad", "ad", "GHL booking"]);
  assert.doesNotMatch(p.result, /Check service/);
  // Nothing that says the service anywhere: Other, Check service.
  const none = planBooking(withAnswers({ "What Service": "" }), { now: NOW });
  assert.deepEqual([none.writes[0].data.service, none.writes[0].data.checkService], ["Other", true]);
});

test("a lead already here keeps what it has; only the gaps are filled", () => {
  const jo = lead({ id: "jo", phone: "0400111222", service: "Not sure", car: "Kluger", ad: "", fromAd: "" });
  const p = planBooking(withAnswers(), { leads: [jo], now: NOW });
  const lp = p.writes[1].data;
  assert.deepEqual([lp.service, "car" in lp, lp.ad, lp.fromAd, lp.timeline], ["Exterior", false, "Raptor Ad", "ad", "within_1_2_weeks"]);
  const known = lead({ id: "k", phone: "0400111222", service: "Ceramic", ad: "Vw Ad", fromAd: "ad", timeline: "asap" });
  const kp = planBooking(withAnswers(), { leads: [known], now: NOW }).writes[1].data;
  assert.deepEqual(["service" in kp, "ad" in kp, "timeline" in kp], [false, false, false]);
});

test("the GHL contact is matched first, even with a new phone number", () => {
  const jo = lead({ id: "jo", phone: "0499 999 999", ghlContactId: "c_1" });
  const p = planBooking(payload(), { leads: [jo, lead({ id: "other", phone: "0400111222" })], now: NOW });
  assert.deepEqual([p.writes[1].id, p.summary.matchedBy], ["jo", "GHL contact"]);
});

test("the price comes from the description: a stated total, else the biggest dollar amount", async () => {
  const { priceFromText } = await import("../lib/ghl.js");
  const cases = { "$280": "280", "Full detail $1,200": "1200", "$280-350": "280-350", "quote 320": "320", "Total: $450.00": "450", "Deposit $50. Total $380": "380",
    "Paid $50 deposit, rest $330 on the day": "330", "350 dollars": "350", "12 Example St 2912": "", "call 0400 111 222": "", "Interior $5": "" };
  for (const [t, want] of Object.entries(cases)) assert.equal(priceFromText(t), want, t);
  // A booking with its price in the description: the job and the new lead have it.
  const p = planBooking(payload({}, { notes: "Full detail, quoted $320" }), { now: NOW });
  assert.deepEqual([p.writes[0].data.price, p.writes[1].data.revenue], ["320", 320]);
});

test("a second booking for someone already booked: the new job has its own price, not the first job's", () => {
  const jo = lead({ id: "jo", stage: "Booked", jobDate: "2026-10-23", jobTime: "09:00", revenue: 650 });
  const first = { id: "ghl-appt_0", leadId: "jo", number: 1146, status: "Scheduled", service: "Other", price: "650", date: "2026-10-23", start: "09:00", end: "12:00", ghlAppointmentId: "appt_0", createdAt: at("2026-10-21") };
  const p = planBooking(payload({}, { appointmentId: "appt_2", startTime: "2026-11-06T09:00:00", endTime: "2026-11-06T12:00:00", notes: "$700-1000" }), { leads: [jo], jobs: [first], now: NOW });
  const job = byId(p.writes, "jobs")[0], lp = byId(p.writes, "leads")[0];
  assert.deepEqual([job.op, job.id, job.data.price], ["create", "ghl-appt_2", "700-1000"]);
  assert.deepEqual([lp.data.jobDate, lp.data.revenue, lp.data.priceRange], ["2026-11-06", 700, "700–1000"]);
  // No price in the notes: the lead's price, as before.
  const q = planBooking(payload({}, { appointmentId: "appt_3", startTime: "2026-11-06T09:00:00", notes: "" }), { leads: [jo], jobs: [first], now: NOW });
  assert.equal(byId(q.writes, "jobs")[0].data.price, "650");
});

test("past appointments: the same day's job takes the appointment; someone new is a done, paid lead", async () => {
  const { planPast, applyWrites } = await import("../lib/ghl.js");
  const past = (o = {}, cal = {}) => payload(o, { startTime: "2026-08-10T09:00:00", endTime: "2026-08-10T12:00:00", appoinmentStatus: "showed", notes: "$300", ...cal });
  // Already here, with a job that day and no price: the job gets the appointment and the price.
  const jo = lead({ id: "jo", phone: "0400111222", stage: "Done", jobDate: "2026-08-10", revenue: null });
  const jj = { id: "lead-jo", leadId: "jo", number: 1001, date: "2026-08-10", status: "Completed", price: "", finalPrice: null, createdAt: at("2026-08-01") };
  const m = planPast(past(), { leads: [jo], jobs: [jj], now: NOW });
  assert.equal(m.kind, "matched");
  assert.deepEqual([m.writes[0].id, m.writes[0].data.ghlAppointmentId, m.writes[0].data.price, m.writes[0].data.finalPrice], ["lead-jo", "appt_1", "300", 300]);
  assert.deepEqual([m.writes[1].data.revenue, "stage" in m.writes[1].data], [300, false]);
  // A price already on the lead (from the End of day form) is kept.
  const kept = planPast(past(), { leads: [{ ...jo, revenue: 280 }], jobs: [jj], now: NOW });
  assert.equal("revenue" in (kept.writes.find((w) => w.collection === "leads") || { data: {} }).data, false); // only the gaps are filled
  assert.equal(kept.writes[0].data.finalPrice, undefined);
  // Someone new: a lead from when GHL first had them, Done and paid, its job Completed.
  const n = planPast(past(), { leads: [], jobs: [{ id: "x", number: 1010 }], now: NOW, created: "2026-07-01T00:00:00Z" });
  assert.equal(n.kind, "new");
  const [job, l] = [n.writes[0].data, n.writes[1].data];
  assert.deepEqual([job.number, job.status, job.finalPrice, job.date, job.start, job.end, job.ghlAppointmentId], [1011, "Completed", 300, "2026-08-10", "09:00", "12:00", "appt_1"]);
  assert.deepEqual([l.stage, l.paid, l.revenue, l.jobDate, l.date, l.source, l.owner, l.importedFrom], ["Done", "Yes", 300, "2026-08-10", "2026-07-01", "GHL booking", "", "ghl"]);
  // Brought in once: the next run finds it already in.
  const state = { leads: [], jobs: [] };
  applyWrites(state, n.writes);
  assert.equal(planPast(past(), { ...state, now: NOW }).kind, "already");
  // A repeat customer from before: a new lead, marked as a repeat.
  const old = lead({ id: "old", phone: "0400111222", stage: "Done", jobDate: "2026-03-01" });
  assert.equal(planPast(past(), { leads: [old], jobs: [], now: NOW }).writes[1].data.repeatOf, "old");
  // Left out: cancelled and no-shows. Still to come: a normal booking.
  assert.equal(planPast(past({}, { appoinmentStatus: "cancelled" }), { now: NOW }).kind, "skipped");
  assert.equal(planPast(past({}, { appoinmentStatus: "noshow" }), { now: NOW }).kind, "skipped");
  assert.equal(planPast(payload(), { now: NOW }).kind, "upcoming");
});

test("deleted in the app: GHL leaves the job alone, and never books a deleted lead again", () => {
  const { job, l, opts } = booked();
  const gone = { ...opts, jobs: [{ ...job, deleted: true, status: "Cancelled" }], leads: [{ ...l, deleted: true, junk: true }] };
  const moved = planBooking(payload({}, { startTime: "2026-10-25T13:00:00" }), gone);
  assert.deepEqual([moved.writes.length, /deleted in the app/.test(moved.result)], [0, true]);
  // A new booking from the same person: a new lead, not the deleted one.
  const again = planBooking(payload({}, { appointmentId: "appt_2" }), gone);
  assert.deepEqual([again.writes[1].op, again.writes[1].id], ["create", "ghl-appt_2"]);
});

test("history: the same full name with a job within 3 days is that job; an open lead the job happened for is Done", async () => {
  const { planPast } = await import("../lib/ghl.js");
  const past = (o = {}, cal = {}) => payload({ phone: "0411 999 888", email: "", ...o }, { startTime: "2026-10-01T09:00:00", endTime: "2026-10-01T12:00:00", appoinmentStatus: "showed", notes: "$300", ...cal });
  // Typed in here with another number, done the next day: matched, its day kept.
  const jo = lead({ id: "jo", phone: "0400 000 111", stage: "Done", jobDate: "2026-10-02", revenue: null });
  const jj = { id: "lead-jo", leadId: "jo", number: 1001, date: "2026-10-02", status: "Completed", price: "", createdAt: at("2026-09-28") };
  const m = planPast(past(), { leads: [jo], jobs: [jj], now: NOW });
  assert.deepEqual([m.kind, m.writes[0].id, "date" in m.writes[0].data], ["matched", "lead-jo", false]);
  assert.match(m.result, /here it's Fri 2 Oct/);
  // Only a first name, and a different phone here: not matched on the name alone.
  assert.equal(planPast(past({ full_name: "Jo" }), { leads: [{ ...jo, name: "Jo" }], jobs: [jj], now: NOW }).kind, "new");
  // Only a first name both sides, and no phone or email here to say otherwise: matched.
  assert.equal(planPast(past({ full_name: "Jo" }), { leads: [{ ...jo, name: "Jo", phone: "", email: "" }], jobs: [jj], now: NOW }).kind, "matched");
  // Still Chasing here, but GHL says the job was done: that lead is Done with this job.
  const ch = lead({ id: "ch", phone: "0411 999 888", stage: "Chasing", touches: 2, date: "2026-09-28", jobDate: "" });
  const d = planPast(past(), { leads: [ch], jobs: [], now: NOW });
  assert.equal(d.kind, "done");
  const lp = d.writes[1].data;
  assert.deepEqual([d.writes[1].id, lp.stage, lp.jobDate, lp.revenue, lp.paid, d.writes[0].data.leadId, d.writes[0].data.status], ["ch", "Done", "2026-10-01", 300, "Yes", "ch", "Completed"]);
});

test("a GHL booking with a new number but the same full name, booked here within 3 days: linked, not doubled", () => {
  const jo = lead({ id: "jo", phone: "0400 000 111", stage: "Booked", jobDate: "2026-10-25", jobTime: "13:00" });
  const mine = { id: "lead-jo", leadId: "jo", number: 1004, status: "Scheduled", date: "2026-10-25", start: "13:00", end: "16:30", createdAt: at("2026-10-19") };
  const live = planBooking(payload({ phone: "0411 999 888", email: "" }), { leads: [jo], jobs: [mine], now: NOW });
  assert.deepEqual([live.writes[0].id, live.summary.matchedBy, live.writes[0].data.date], ["lead-jo", "name and day", "2026-10-24"]); // a live booking: GHL's time
  const imp = planBooking(payload({ phone: "0411 999 888", email: "" }), { leads: [jo], jobs: [mine], now: NOW, keepDates: true });
  assert.deepEqual(["date" in imp.writes[0].data, imp.writes[0].data.ghlAppointmentId], [false, "appt_1"]); // bringing in the history: linked, not moved
  assert.match(imp.result, /here it's Sun 25 Oct 1:00pm, GHL says Sat 24 Oct 9:00am/);
  // Booked here for a day that's just passed (not marked done yet): still the same booking.
  const late = lead({ id: "lt", name: "Jo", phone: "", email: "", stage: "Booked", jobDate: "2026-10-19" });
  const lj = { ...mine, id: "lead-lt", leadId: "lt", date: "2026-10-19" };
  const lp = planBooking(payload({ full_name: "Jo", phone: "0411 999 888", email: "" }, { startTime: "2026-10-21T09:00:00" }), { leads: [late], jobs: [lj], now: NOW, keepDates: true });
  assert.deepEqual([lp.writes[0].id, lp.summary.matchedBy], ["lead-lt", "name and day"]);
});

test("a run that stopped between a job and its new lead: the next run makes the lead", async () => {
  const { planPast } = await import("../lib/ghl.js");
  const past = payload({}, { startTime: "2026-08-10T09:00:00", endTime: "2026-08-10T12:00:00", appoinmentStatus: "showed", notes: "$300" });
  const orphan = { id: "ghl-appt_1", leadId: "ghl-appt_1", number: 1020, ghlAppointmentId: "appt_1", service: "Full Detail", date: "2026-08-10", status: "Completed" };
  const r = planPast(past, { leads: [], jobs: [orphan], now: NOW });
  assert.equal(r.kind, "repaired");
  assert.deepEqual([r.writes.length, r.writes[0].collection, r.writes[0].id, r.writes[0].op, r.writes[0].data.stage, r.writes[0].data.revenue, r.writes[0].data.paid], [1, "leads", "ghl-appt_1", "create", "Done", 300, "Yes"]);
  // With its lead there, it's simply in already.
  assert.equal(planPast(past, { leads: [{ id: "ghl-appt_1", name: "Jo Smith" }], jobs: [orphan], now: NOW }).kind, "already");
});

test("one job booked as two GHL appointments: both stay linked to it, and either one finds it", async () => {
  const { planPast, applyWrites } = await import("../lib/ghl.js");
  const day = (id, d) => payload({}, { appointmentId: id, startTime: d + "T09:00:00", endTime: d + "T15:00:00", appoinmentStatus: "showed", notes: "" });
  const jo = lead({ id: "jo", phone: "0400111222", stage: "Done", jobDate: "2026-08-10", revenue: 900 });
  const state = { leads: [jo], jobs: [{ id: "lead-jo", leadId: "jo", number: 1001, date: "2026-08-10", status: "Completed", price: "900", createdAt: at("2026-08-01") }] };
  applyWrites(state, planPast(day("a1", "2026-08-10"), { ...state, now: NOW }).writes);
  const second = planPast(day("a2", "2026-08-11"), { ...state, now: NOW });
  assert.equal(second.kind, "matched");
  assert.deepEqual(second.writes[0].data.ghlAppointmentIds, ["a1", "a2"]);
  assert.equal("ghlAppointmentId" in second.writes[0].data, false); // the first stays
  applyWrites(state, second.writes);
  assert.deepEqual([planPast(day("a1", "2026-08-10"), { ...state, now: NOW }).kind, planPast(day("a2", "2026-08-11"), { ...state, now: NOW }).kind], ["already", "already"]);
  // A move on the second appointment finds the job too.
  const moved = planBooking(payload({}, { appointmentId: "a2", startTime: "2026-08-12T09:00:00" }), { ...state, now: NOW });
  assert.equal(moved.summary.jobId, "lead-jo");
});

test("an appointment on a deleted job and a live one goes by the live one", () => {
  const jo = lead({ id: "jo", stage: "Booked", jobDate: "2026-10-28", jobTime: "08:00", revenue: 300 });
  const gone = { id: "ghl-appt_1", leadId: "x2", number: 1151, status: "Cancelled", deleted: true, ghlAppointmentId: "appt_1", date: "2026-10-24", start: "09:00", createdAt: at("2026-10-19") };
  const mine = { id: "lead-jo", leadId: "jo", number: 1056, status: "Scheduled", service: "Full Detail", date: "2026-10-28", start: "08:00", end: "11:30", ghlAppointmentId: "appt_1", ghlStatus: "confirmed", ghlCalendar: "Full Detail", createdAt: at("2026-10-19") };
  const p = planBooking(payload(), { leads: [jo], jobs: [gone, mine], now: NOW });
  assert.match(p.result, /^Moved job 1056/);
  assert.deepEqual([p.writes[0].id, p.writes[0].data.date, p.writes[0].data.start], ["lead-jo", "2026-10-24", "09:00"]);
});

test("GHL's end when the booking is an hour or more; its 30-minute default slot gets the service's length", () => {
  const short = planBooking(payload({}, { calendarName: "Full Detail", startTime: "2026-10-24T15:00:00", endTime: "2026-10-24T15:30:00" }), { now: NOW });
  assert.deepEqual([short.writes[0].data.start, short.writes[0].data.end], ["15:00", "18:30"]); // Full Detail: 3.5 hours
  const own = planBooking(payload({}, { calendarName: "Full Detail", startTime: "2026-10-24T08:00:00", endTime: "2026-10-24T10:30:00" }), { now: NOW });
  assert.deepEqual([own.writes[0].data.start, own.writes[0].data.end], ["08:00", "10:30"]);
});
