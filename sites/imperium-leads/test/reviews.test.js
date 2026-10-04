import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

// The page's review logic is a plain browser script (public/reviews.js); run it as the page does.
process.env.TZ = "Australia/Sydney";
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL("../public/reviews.js", import.meta.url), "utf8"), sandbox);
const R = sandbox.window.ILReviews;
// Objects made inside the sandbox have its own prototypes; compare them as plain data.
const plain = (x) => JSON.parse(JSON.stringify(x));

const NOW = new Date("2026-09-29T12:00:00+10:00"); // Tue 29 Sep, midday in Canberra
const at = (d) => new Date(`${d}T18:00:00+10:00`).toISOString(); // an evening that day
const jo = { id: "a", name: "Jo Smith", car: "Kluger", status: "Booked", completedAt: at("2026-09-29"), reviewStatus: "not_asked" };

test("the texts are filled with their first name, the car and the settings", () => {
  const s = R.settings({});
  assert.equal(s.reviewLink, "https://g.page/r/CSwRG2iKFelCEAE/review");
  assert.equal(s.senderName, "Angus");
  assert.equal(s.businessName, "Imperium Detailing");
  assert.equal(
    R.text(jo, s),
    "Thanks Jo, payment received. If you've got a minute, a Google review would mean a lot to us: https://g.page/r/CSwRG2iKFelCEAE/review",
  );
  assert.equal(
    R.nudge(jo, { senderName: "Ananth" }),
    "Hey Jo, no stress if you're flat out, just leaving the review link here in case it's handy: https://g.page/r/CSwRG2iKFelCEAE/review\nThanks again, Ananth",
  );
  assert.equal(
    R.reply(jo, s),
    "Thanks Jo, really appreciate you taking the time. Enjoy the Kluger, and give us a shout whenever it needs a freshen up. Angus, Imperium Detailing",
  );
  // Blank settings fall back to the defaults; a missing name or car still reads well.
  assert.equal(R.settings({ senderName: "  ", reviewLink: "" }).senderName, "Angus");
  assert.match(R.text({ name: "", car: "" }, s), /^Thanks there, payment received\./);
});

test("marking a job done starts the flow at not asked, and keeps anything already there", () => {
  const p = R.completePatch({ name: "Jo" }, "2026-09-29T08:00:00.000Z");
  assert.deepEqual(plain(p), {
    completedAt: "2026-09-29T08:00:00.000Z",
    reviewStatus: "not_asked",
    reviewAskedAt: null,
    reviewTextSentAt: null,
    reviewNudgedAt: null,
    reviewLeftAt: null,
    reviewNotes: "",
  });
  const again = R.completePatch({ completedAt: "2026-09-01T00:00:00.000Z", reviewStatus: "text_sent", reviewNotes: "Nice" }, "2026-09-29T08:00:00.000Z");
  assert.equal(again.completedAt, "2026-09-01T00:00:00.000Z");
  assert.equal(again.reviewStatus, "text_sent");
  assert.equal(again.reviewNotes, "Nice");
  assert.equal(R.statusOf({ status: "Booked" }), null); // not done yet: no review status
  assert.equal(R.statusOf({ completedAt: "x" }), "not_asked");
});

test("each step stamps its own time and keeps the Numbers fields in step", () => {
  const t = "2026-09-29T08:00:00.000Z";
  assert.deepEqual(plain(R.patch(jo, "asked_in_person", t)), { reviewStatus: "asked_in_person", reviewAskedAt: t, reviewAsked: "Yes", reviewLeft: "" });
  assert.deepEqual(plain(R.patch(jo, "text_sent", t)), { reviewStatus: "text_sent", reviewTextSentAt: t, reviewAsked: "Yes", reviewLeft: "" });
  assert.deepEqual(plain(R.patch(jo, "nudged", t)), { reviewStatus: "nudged", reviewNudgedAt: t, reviewAsked: "Yes", reviewLeft: "" });
  assert.deepEqual(plain(R.patch(jo, "reviewed", t)), { reviewStatus: "reviewed", reviewLeftAt: t, reviewAsked: "Yes", reviewLeft: "Yes" });
  assert.deepEqual(plain(R.patch(jo, "declined", t)), { reviewStatus: "declined", reviewAsked: "Yes", reviewLeft: "" });
  assert.deepEqual(plain(R.patch(jo, "skip", t)), { reviewStatus: "skip", reviewAsked: "No", reviewLeft: "" });
});

test("the guide shows the right words and buttons for each step", () => {
  const btns = (st) => plain(st.buttons.map((b) => b.label));
  let st = R.step(jo, {}, NOW);
  assert.equal(st.title, "At handover, walk them round the car, then say this:");
  assert.equal(st.say, R.SCRIPT);
  assert.deepEqual(btns(st), ["Asked in person", "Skip"]);

  // The review text only comes up once they've paid.
  st = R.step({ ...jo, reviewStatus: "asked_in_person" }, {}, NOW);
  assert.equal(st.title, "Tick Paid once the money's in. The review text comes up then.");
  assert.deepEqual([st.say, st.copy, btns(st)], ["", false, []]);
  st = R.step({ ...jo, reviewStatus: "asked_in_person", paid: "Yes" }, {}, NOW);
  assert.equal(st.title, "Paid. Send this text:");
  assert.equal(st.say, R.text(jo, {}));
  assert.equal(st.copy, true);
  assert.deepEqual(btns(st), ["Text sent"]);

  // Two days after the text: wait. Three days after: one nudge.
  st = R.step({ ...jo, reviewStatus: "text_sent", reviewTextSentAt: at("2026-09-27") }, {}, NOW);
  assert.match(st.title, /^Text sent\. No review by Wed,? 30 Sept?\? Send one nudge then\.$/);
  assert.deepEqual(btns(st), ["They reviewed", "Declined"]);
  st = R.step({ ...jo, reviewStatus: "text_sent", reviewTextSentAt: at("2026-09-26") }, {}, NOW);
  assert.equal(st.title, "No review yet? Send one nudge, then leave it:");
  assert.equal(st.say, R.nudge(jo, {}));
  assert.deepEqual(btns(st), ["Nudged", "They reviewed", "Declined"]);

  // Nudged: never a second nudge.
  st = R.step({ ...jo, reviewStatus: "nudged", reviewTextSentAt: at("2026-09-20") }, {}, NOW);
  assert.deepEqual(btns(st), ["They reviewed", "Declined"]);
  assert.equal(st.say, "");

  st = R.step({ ...jo, reviewStatus: "reviewed" }, {}, NOW);
  assert.equal(st.title, "Reply to their review within 24 hours:");
  assert.equal(st.say, R.reply(jo, {}));
  assert.deepEqual(btns(st), []);
});

test("due today: texts for anyone asked in person who has paid, then nudges 3 or more days after the text", () => {
  const leads = [
    { ...jo, id: "asked", name: "Asked Anna", reviewStatus: "asked_in_person", reviewAskedAt: at("2026-09-29"), paid: "Yes" },
    { ...jo, id: "unpaid", name: "Unpaid Uma", reviewStatus: "asked_in_person", reviewAskedAt: at("2026-09-29"), paid: "No" },
    { ...jo, id: "t2", name: "Two Days", reviewStatus: "text_sent", reviewTextSentAt: at("2026-09-27") },
    { ...jo, id: "t3", name: "Three Days", reviewStatus: "text_sent", reviewTextSentAt: at("2026-09-26") },
    { ...jo, id: "t9", name: "Nine Days", reviewStatus: "text_sent", reviewTextSentAt: at("2026-09-20") },
    { ...jo, id: "n", name: "Nudged Ned", reviewStatus: "nudged", reviewTextSentAt: at("2026-09-20") },
    { ...jo, id: "r", name: "Reviewed Rae", reviewStatus: "reviewed" },
    { ...jo, id: "new", name: "Not Asked", reviewStatus: "not_asked" },
  ];
  const d = R.due(leads, {}, NOW);
  assert.deepEqual(plain(d.map((x) => x.lead.id)), ["asked", "t9", "t3"]);
  assert.deepEqual(plain(d.map((x) => x.what)), ["Send the review text", "Send one nudge", "Send one nudge"]);
  assert.equal(d[0].text, R.text(leads[0], {}));
  assert.equal(d[1].text, R.nudge(leads[4], {}));
  assert.equal(d[1].done, "nudged");
});

test("30-day counters count the jobs finished in the last 30 days", () => {
  const leads = [
    { ...jo, id: "1", completedAt: at("2026-09-28"), reviewStatus: "reviewed", reviewTextSentAt: at("2026-09-28") },
    { ...jo, id: "2", completedAt: at("2026-09-20"), reviewStatus: "text_sent", reviewTextSentAt: at("2026-09-20") },
    { ...jo, id: "3", completedAt: at("2026-09-15"), reviewStatus: "asked_in_person" },
    { ...jo, id: "4", completedAt: at("2026-09-10"), reviewStatus: "skip" },
    { ...jo, id: "5", completedAt: at("2026-09-29"), reviewStatus: "not_asked" },
    { ...jo, id: "old", completedAt: at("2026-08-01"), reviewStatus: "reviewed" }, // too old
    { ...jo, id: "open", completedAt: null, reviewStatus: null }, // not done
  ];
  const s = R.stats(leads, NOW, 30);
  assert.deepEqual({ ...s }, { done: 5, asked: 3, texts: 2, reviewed: 1, askRate: 3 / 5, reviewRate: 1 / 5 });
  assert.deepEqual({ ...R.stats([], NOW, 30) }, { done: 0, asked: 0, texts: 0, reviewed: 0, askRate: null, reviewRate: null });
});
