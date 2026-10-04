import assert from "node:assert/strict";
import { test } from "node:test";
import { adName, buildLead, mapService, mapSource, phoneKey } from "../lib/lead-map.js";
import M from "../lib/model.js";

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
    stage: "New",
    schedule: "full",
    chaseFrom: "",
    touches: 0,
    lastTouchOn: "",
    quotedOn: "",
    snoozeUntil: "",
    paused: false,
    timeline: "asap",
    score: "Hot",
    scoreBy: "timeline",
    lostReason: "",
    doNotText: false,
    junk: false,
    email: "jo@x.com",
    formId: "",
    enquiries: [],
    againAt: "",
    repeatOf: "",
    modelVersion: 3,
  });
});

test("a lead's timeline, score and owner come from the form", () => {
  const at = new Date("2026-10-04T01:00:00Z");
  const b = (input) => buildLead({ name: "Jo", phone: "0400 000 000", ...input }, at);
  assert.equal(b({ when: "within_1_2_weeks" }).score, "Warm");
  assert.equal(b({ when: "Within 1 to 2 weeks" }).timeline, "within_1_2_weeks");
  const browsing = b({ when: "just_browsing" });
  assert.deepEqual([browsing.timeline, browsing.score, browsing.schedule], ["just_browsing", "Browsing", "browsing"]);
  assert.deepEqual([b({}).timeline, b({}).score, b({}).scoreBy], ["", "", ""]);
  assert.equal(b({ timeline: "asap", when: "just_browsing" }).timeline, "asap"); // an explicit timeline wins
  assert.equal(b({ owner: "ananth" }).owner, "Ananth");
  assert.equal(b({ owner: "Bob" }).owner, "");
});

test("Canberra's day and hour, through daylight saving", () => {
  assert.equal(M.canberraDate(new Date("2026-09-26T14:00:00Z")), "2026-09-27"); // AEST +10
  assert.equal(M.canberraMinutes(new Date("2026-09-26T21:25:00Z")), 7 * 60 + 25);
  assert.equal(M.canberraMinutes(new Date("2026-10-05T20:25:00Z")), 7 * 60 + 25); // AEDT +11
  assert.equal(M.canberraDate("2026-09-26T15:00:00Z"), "2026-09-27");
});
