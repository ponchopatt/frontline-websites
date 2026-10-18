import assert from "node:assert/strict";
import { test } from "node:test";
import M from "../lib/model.js";
import "../public/texts.js";

const T = globalThis.ILTexts;
const TODAY = "2026-10-12";
const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString();
const jo = (p = {}) => ({ name: "Jo Smith", car: "Kluger", service: "Full detail", owner: "Angus", stage: "New", touches: 0, log: [], ...p });

test("the four touches and the backlog text are the agreed words, with name, car and owner filled in and [day] left", () => {
  const l = jo();
  assert.equal(T.fill("touch1", l), "Hey Jo, it's Angus from Imperium Detailing. Got your request for the Kluger. Full details start from $250 and we come to you. I've got [day] or [day] free. Which suits?");
  assert.equal(T.fill("touch2", l), "Hey Jo, just checking you got my message about the Kluger. Happy to sort a price and lock in a time. What day suits?");
  assert.equal(T.fill("touch3", l), "Hey Jo, still keen on getting the Kluger done? I've got spots this week if you want one.");
  assert.equal(T.fill("touch4", l), "Hey Jo, last one from me. If you'd still like the Kluger detailed, just reply and I'll sort a time. If not, no worries at all.");
  assert.equal(T.fill("backlog", l), "Hey Jo, it's Angus from Imperium Detailing. Just checking in on the detail for your Kluger. Still keen? I've got spots this week if you want to lock one in.");
  assert.equal(T.fill("touch1", jo({ owner: "Ananth" })).slice(0, 26), "Hey Jo, it's Ananth from I");
  assert.equal(T.fill("touch2", jo({ name: "", car: "" })), "Hey there, just checking you got my message about the car. Happy to sort a price and lock in a time. What day suits?");
  assert.equal(T.fill("after", l), "Hi Jo, Angus from Imperium Detailing. Hope the Kluger is looking good! Here's the link for payment: [link]. Any questions, just message me.");
  assert.equal(T.fill("review", l, { reviewLink: "https://g.page/r/x/review" }), "Thanks Jo, payment received. If you've got a minute, a Google review would mean a lot to us: https://g.page/r/x/review");
  // No emojis in any of them.
  for (const key of Object.keys(T.TEMPLATES)) assert.doesNotMatch(T.TEMPLATES[key], /\p{Extended_Pictographic}/u, key);
  assert.deepEqual([...T.EDITABLE], ["touch1", "touch2", "touch3", "touch4", "backlog", "deposit", "onmyway"]);
});

test("words saved in Settings are used instead, filled in the same way; blank falls back to the default", () => {
  const templates = { touch2: "Yo [name], still want the [car] done? - [owner]", touch3: "  " };
  assert.equal(T.fill("touch2", jo(), { templates }), "Yo Jo, still want the Kluger done? - Angus");
  assert.equal(T.fill("touch3", jo(), { templates }), T.fill("touch3", jo()));
});

test("the price sheet is unchanged", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(T.PRICES)), { "Full detail": [250, 280, 320], Exterior: [130, 140, 160], Interior: [170, 190, 220], Correction: [497, 597, 697], Ceramic: [997, 1097, 1197], "Maintenance plan": null, "Pre-sale": null });
  assert.deepEqual(["hatch/sedan", "suv/ute", "4x4/8-seater", "Kluger"].map((car) => T.priceFor("Full detail", car)), [250, 280, 320, 250]);
});

test("TEXT picks the words for where the lead is up to", () => {
  const w = (p) => T.which(jo(p), TODAY);
  assert.equal(w({}), "touch1");
  assert.deepEqual([1, 2, 3].map((touches) => w({ stage: "Chasing", touches })), ["touch2", "touch3", "touch4"]);
  assert.equal(w({ stage: "Waiting", waitReason: "no_reply" }), "backlog");
  assert.equal(w({ stage: "Booked", jobDate: "2026-10-20" }), ""); // the job's still to come
  assert.equal(w({ stage: "Booked", jobDate: "2026-10-11" }), "after");
  assert.equal(w({ stage: "Done", completedAt: at("2026-10-11"), paid: "Yes" }), "review");
  // The same person enquiring again starts from touch 1.
  assert.equal(w({ stage: "Chasing", touches: 2, againAt: at(TODAY, "09:00"), log: [{ at: at("2026-10-05"), type: "text" }] }), "touch1");
  // An old Quoted lead, once upgraded: the quote counted as a touch.
  const q = jo({ stage: "Quoted", status: "Quoted", touches: 1, modelVersion: 3 });
  assert.equal(T.which({ ...q, ...M.upgradeFields(q, TODAY) }, TODAY), "touch3");
});

test("TEXT opens the messages app with the words filled in", () => {
  assert.equal(T.smsHref("0400 111 222", "Hi Jo & co?"), "sms:0400111222?&body=Hi%20Jo%20%26%20co%3F");
  assert.equal(T.smsHref("+61 400 111 222", ""), "sms:+61400111222");
  const m = T.message(jo(), { today: TODAY, owner: "Angus" });
  assert.deepEqual([m.key, m.label], ["touch1", "Touch 1 (straight away)"]);
  assert.equal(T.message(jo({ stage: "Booked", jobDate: "2026-10-20" }), { today: TODAY }).text, "");
});
