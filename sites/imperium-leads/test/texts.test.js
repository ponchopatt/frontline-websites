import assert from "node:assert/strict";
import { test } from "node:test";
import M from "../lib/model.js";
import "../public/texts.js";

const T = globalThis.ILTexts;
const TODAY = "2026-10-12";
const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString();
const jo = (p = {}) => ({ name: "Jo Smith", car: "Kluger", service: "Full detail", owner: "Angus", stage: "New", touches: 0, log: [], ...p });

test("every text is the agreed wording, filled in and signed by the owner", () => {
  const l = jo();
  assert.equal(T.fill("first", l), "Hi Jo, Angus from Imperium Detailing. Got your request for the Kluger. I'll text your price shortly.");
  assert.equal(T.fill("missed", l), "Hi Jo, Angus from Imperium Detailing. Just tried to call about the full detail for your Kluger. What suburb are you in? I'll send your price straight back.");
  assert.equal(T.fill("day1", l), "Hi Jo, Angus here from Imperium. Still keen on getting the Kluger done? I've got a couple of spots this week and next. Just reply and I'll lock one in.");
  assert.equal(T.fill("day3", l), "Hi Jo, quick one. Full detail on the Kluger is from $225 at your place. If the timing's off, tell me when suits and I'll pencil you in.");
  assert.equal(T.fill("day7", l), "Hi Jo, Angus from Imperium Detailing. No stress if the timing's off. If you still want the Kluger done, just reply here and I'll sort it.");
  assert.equal(T.fill("checkin", l), "Hi Jo, Angus from Imperium Detailing. Just checking in. If the Kluger is due for a clean, reply here and I'll sort a time.");
  assert.equal(T.fill("quote", jo({ service: "Interior" }), { price: 140, hours: 2, days: ["Tue", "Thu"] }), "Hi Jo, for the Kluger an interior detail is $140, at your place. Takes about 2 hours. I've got Tue or Thu free. Which suits?");
  assert.equal(T.fill("quote", l, { price: 225 }), "Hi Jo, for the Kluger a full detail is $225, at your place. Takes about [hours] hours. I've got [day] or [day] free. Which suits?");
  assert.equal(T.fill("after", l), "Hi Jo, Angus from Imperium Detailing. Hope the Kluger is looking good! Here's the link for payment: [link]. Any questions, just message me.");
  assert.equal(T.fill("review", l, { reviewLink: "https://g.page/r/x/review" }), "Thanks Jo, payment received. If you've got a minute, a Google review would mean a lot to us: https://g.page/r/x/review");
  assert.equal(T.fill("first", jo({ owner: "", name: "", car: "" }), { owner: "Ananth" }), "Hi there, Ananth from Imperium Detailing. Got your request for the car. I'll text your price shortly.");
});

test("prices come only from the price sheet or the quote typed in; no price means 'I'll confirm the price'", () => {
  assert.deepEqual(T.PRICES, { "Full detail": 225, Exterior: 110, Interior: 140, Correction: 397, Ceramic: 997, "Maintenance plan": null, "Pre-sale": null });
  assert.match(T.fill("day3", jo({ service: "Ceramic" })), /Ceramic coating on the Kluger is from \$997 at your place/);
  assert.match(T.fill("day3", jo({ service: "Correction" })), /Paint correction on the Kluger is from \$397/);
  for (const service of ["Maintenance plan", "Pre-sale", "Not sure"]) {
    const t = T.fill("day3", jo({ service }));
    assert.match(t, /I'll confirm the price/, service);
    assert.doesNotMatch(t, /\$/, service);
  }
  assert.match(T.fill("day3", jo({ stage: "Quoted", quoted: 260 })), /from \$260/); // their quote, not the sheet
  // Every text for every service and step: any dollar figure is on the sheet, or is their quote.
  const allowed = new Set(Object.values(T.PRICES).filter(Boolean).map(String));
  for (const service of Object.keys(T.PRICES).concat("Not sure")) {
    for (const key of Object.keys(T.TEMPLATES)) {
      if (key === "day3NoPrice") continue;
      const t = T.fill(key, jo({ service }));
      for (const m of t.matchAll(/\$(\d[\d,.]*)/g)) assert.ok(allowed.has(m[1].replace(/,/g, "")), `${service} ${key}: $${m[1]}`);
      assert.doesNotMatch(t, /discount|% off|special/i);
    }
  }
});

test("the Text button picks the right words for where the lead is up to", () => {
  const w = (p) => T.which(jo(p), TODAY);
  assert.equal(w({}), "first");
  assert.equal(w({ stage: "Chasing", touches: 1, log: [{ at: at(TODAY), type: "call", pickedUp: "No" }] }), "missed");
  assert.equal(w({ stage: "Chasing", touches: 1, log: [{ at: at("2026-10-11"), type: "call", pickedUp: "No" }] }), "day1");
  assert.equal(w({ stage: "Chasing", touches: 2 }), "day3");
  assert.equal(w({ stage: "Chasing", touches: 3 }), "day7");
  assert.equal(w({ stage: "Chasing", touches: 1, score: "Browsing" }), "day3");
  assert.equal(w({ stage: "Quoted", touches: 0, quotedOn: TODAY }), "quote");
  assert.deepEqual([0, 1, 2].map((touches) => w({ stage: "Quoted", touches, quotedOn: "2026-10-01" })), ["day1", "day3", "day7"]);
  assert.equal(w({ stage: "Waiting" }), "checkin");
  assert.equal(w({ stage: "Booked", jobDate: "2026-10-11" }), "after");
  assert.equal(w({ stage: "Booked", jobDate: "2026-10-11", paid: "Yes" }), "review");
  // The same person enquiring again starts from the first text.
  assert.equal(w({ stage: "Chasing", touches: 2, againAt: at(TODAY, "09:00"), log: [{ at: at("2026-10-05"), type: "text" }] }), "first");
});

test("Text opens the messages app with the words filled in", () => {
  assert.equal(T.smsHref("0400 111 222", "Hi Jo & co?"), "sms:0400111222?&body=Hi%20Jo%20%26%20co%3F");
  assert.equal(T.smsHref("+61 400 111 222", ""), "sms:+61400111222");
  const m = T.message(jo(), { today: TODAY, owner: "Angus" });
  assert.deepEqual([m.key, m.label], ["first", "First text"]);
});
