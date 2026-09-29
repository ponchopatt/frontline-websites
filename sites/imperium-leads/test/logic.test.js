import assert from "node:assert/strict";
import { test } from "node:test";
import { adName, buildLead, mapService, mapSource, phoneKey } from "../lib/lead-map.js";
import { chaseList, eveningEmail, morningEmail, toLogList } from "../lib/reminders.js";
import { canberraDate, canberraMinutes, dayName, localDate } from "../lib/time.js";

test("sources map to the app's list, and the ad name comes after the dot", () => {
  assert.equal(mapSource("Meta ad · Brand film"), "Meta ad");
  assert.equal(mapSource("facebook"), "Meta ad");
  assert.equal(mapSource("Instagram story"), "Meta ad");
  assert.equal(mapSource("google / cpc"), "Google");
  assert.equal(mapSource("TikTok · Snow foam"), "TikTok");
  assert.equal(mapSource(""), "Website");
  assert.equal(mapSource("newsletter"), "Website");
  assert.equal(adName("Meta ad · Brand film"), "Brand film");
  assert.equal(adName("Website"), "");
});

test("services map from the website's wording", () => {
  const cases = {
    "Full detail": "Full detail",
    "Interior detail": "Interior",
    "Exterior detail": "Exterior",
    "Paint correction": "Correction",
    "Ceramic coating": "Ceramic",
    "Regular maintenance plan": "Maintenance plan",
    "Pre-sale detail": "Pre-sale",
    "Not sure, recommend something": "Not sure",
    "Fleet": "Not sure",
  };
  for (const [given, want] of Object.entries(cases)) assert.equal(mapService(given), want, given);
});

test("phone numbers compare however they're written", () => {
  assert.equal(phoneKey("0400 123 456"), "0400123456");
  assert.equal(phoneKey("+61 400 123 456"), "0400123456");
  assert.equal(phoneKey(""), "");
});

test("a lead is saved exactly as the app's Add tab saves one", () => {
  // 23:30 UTC on the 26th is 09:30 on the 27th in Canberra.
  const now = new Date("2026-09-26T23:30:00Z");
  const lead = buildLead(
    { name: " Jo ", phone: "0400 123 456", email: "jo@x.com", service: "Ceramic coating", vehicle: "Kluger", suburb: "Gungahlin", when: "ASAP", notes: "Dog hair", source: "Meta ad · Brand film", form: "booking" },
    now,
  );
  assert.deepEqual(lead, {
    date: "2026-09-27",
    createdAt: "2026-09-26T23:30:00.000Z",
    owner: "",
    name: "Jo",
    phone: "0400 123 456",
    suburb: "Gungahlin",
    car: "Kluger",
    source: "Meta ad",
    ad: "Brand film",
    service: "Ceramic",
    status: "New",
    nextFollowUp: "2026-09-27",
    lastContact: "",
    replyMins: null,
    quoted: null,
    jobDate: "",
    revenue: null,
    paid: "",
    plan: "",
    upsellOffered: "",
    upsellTaken: "",
    reviewAsked: "",
    reviewLeft: "",
    objection: "",
    lostWhy: "",
    nextDue: "",
    log: [],
    booked: "Pending",
    notes: "When: ASAP · Email: jo@x.com · Dog hair · Via booking form",
    referredBy: "",
    address: "",
    jobTime: "",
    access: "",
    completedAt: null,
    reviewStatus: null,
    reviewAskedAt: null,
    reviewTextSentAt: null,
    reviewNudgedAt: null,
    reviewLeftAt: null,
    reviewNotes: "",
  });
});

test("Canberra's day and hour, through daylight saving", () => {
  assert.equal(canberraDate(new Date("2026-09-26T14:00:00Z")), "2026-09-27"); // AEST +10
  assert.equal(canberraMinutes(new Date("2026-09-26T21:25:00Z")), 7 * 60 + 25);
  assert.equal(canberraMinutes(new Date("2026-10-05T20:25:00Z")), 7 * 60 + 25); // AEDT +11
  assert.equal(localDate("2026-09-26T15:00:00Z"), "2026-09-27");
  assert.match(dayName("2026-09-25"), /^Fri,? 25 Sept?$/); // written by the same call the app uses
});

const TODAY = "2026-09-27";
const lead = (p) => ({ id: p.name, status: "New", date: "2026-09-20", nextFollowUp: TODAY, log: [], ...p });
const leads = [
  lead({ name: "Old", status: "Contacted", nextFollowUp: "2026-09-24", phone: "0411" }),
  lead({ name: "Fresh", date: TODAY }),
  lead({ name: "Later", status: "Quoted", nextFollowUp: "2026-09-30" }),
  lead({ name: "Done", status: "Contacted", log: [{ at: "2026-09-26T22:00:00Z" }] }), // 08:00 today in Canberra
  lead({ name: "Job", status: "Booked", jobDate: TODAY, service: "Full detail", suburb: "Kambah", revenue: 350 }),
  lead({ name: "Lost", status: "Lost", nextFollowUp: "" }),
  lead({ name: "Walk-up", kind: "job", date: TODAY, status: "Booked", nextFollowUp: "", jobDate: TODAY, revenue: 200 }), // from "Add a job"
];

test("the morning list is the app's: New first, then the longest overdue", () => {
  assert.deepEqual(chaseList(leads, TODAY).map((l) => l.name), ["Fresh", "Old", "Done"]);
  const m = morningEmail(leads, TODAY, "Angus", "https://leads.example");
  assert.equal(m.subject, "Morning: 3 to chase, 1 overdue · 2 jobs today");
  assert.match(m.text, /^Morning, Angus\nSunday 27 September · 3 to chase \(1 overdue\) · 2 jobs today/);
  assert.match(m.text, /Follow up today \(3\)\nNew leads first, then anyone due a chase\. Log each one in the app\.\n- Fresh · car\? · New today\n- Old · car\? · 0411 · Overdue since /);
  assert.match(m.text, /- Job · car\? — Full detail · Kambah · \$350/);
  assert.match(m.text, /Open Imperium Leads: https:\/\/leads.example$/);
  assert.match(m.html, /Morning, Angus/);
});

test("the evening list is leads new or due today that aren't logged yet", () => {
  assert.deepEqual(toLogList(leads, TODAY).map((l) => l.name), ["Old", "Fresh"]);
  const e = eveningEmail(leads, TODAY, "Ananth", "");
  assert.equal(e.subject, "Evening: 2 leads still to log");
  assert.equal(e.count, 2);
  assert.match(e.text, /^Evening, Ananth\nLog every lead you touched today, then close the day\./);
});
