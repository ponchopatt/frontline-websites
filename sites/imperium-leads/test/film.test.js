import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The server runs on a local file instead of Supabase.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "film-"));
process.env.FILM_LOCAL_STORE = path.join(dir, "store.json");
delete process.env.CRON_SECRET;

const { Film, C, filmStore } = await import("../lib/film-store.js");
const { POST, GET, setPushSenderForTests, remindersToSend, sendReminders } = await import("../api/film.js");

const NOW = "2026-11-04T10:00:00.000Z"; // Wed 4 Nov, 9pm in Canberra
const idea = (o) => ({ ...Film.newIdea({ title: "Idea", ...o }, { id: o.id || o.title, now: o.now || NOW }), ...o });

/* ------------------------------------------------------------ the model */

test("links: Instagram and TikTok come out plain", () => {
  assert.equal(Film.normaliseUrl("look https://www.instagram.com/reel/ABC123/?igsh=xyz"), "https://www.instagram.com/reel/ABC123/");
  assert.equal(Film.normaliseUrl("https://www.tiktok.com/@a/video/123?lang=en"), "https://www.tiktok.com/@a/video/123");
  assert.equal(Film.normaliseUrl("not a link"), null);
  assert.equal(Film.platformOf("https://vm.tiktok.com/x"), "tiktok");
});

test("days and times are Canberra's", () => {
  assert.equal(Film.dayIn(new Date(NOW)), "2026-11-04");
  assert.equal(Film.localNow(new Date("2026-11-04T20:30:00Z")), "2026-11-05T07:30");
  assert.equal(Film.minutesBetween("2026-11-05T17:10", "2026-11-05T18:00"), 50);
  assert.equal(Film.timeLabel("2026-11-05T18:00"), "6pm");
  assert.equal(Film.timeLabel("2026-11-05T09:30"), "9:30am");
  assert.equal(Film.dayLabel("2026-11-05", "2026-11-04"), "Tomorrow");
  assert.equal(Film.cleanTime("2026-11-05T25:00"), null);
  assert.equal(Film.cleanTime("2026-11-05 18:00"), "2026-11-05T18:00");
});

test("an idea moves Ideas -> Filmed -> Edited -> Scheduled -> Posted, and back", () => {
  const a = Film.newIdea({ title: " Mat slap ", who: "ananth", when: "2026-11-05" }, { id: "a", now: NOW, by: "Brake" });
  assert.deepEqual([a.title, a.who, a.when, a.stage], ["Mat slap", "Ananth", "2026-11-05", "tofilm"]);
  assert.equal(Film.newIdea({ title: "x", who: "Pat" }, {}).who, null); // only Ananth and Brake
  assert.throws(() => Film.newIdea({ title: "" }, {}), /needs a title/);

  const o = (extra) => ({ by: "Ananth", now: "2026-11-05T01:00:00Z", today: "2026-11-05", ...extra });
  const filmed = Film.move(a, 1, o());
  assert.equal(filmed.stage, "filmed");
  // who and when were for filming, so they're cleared, and Undo puts them back.
  assert.deepEqual([filmed.who, filmed.when, filmed.stageAt], [null, null, "2026-11-05T01:00:00Z"]);
  const undone = Film.move(filmed, -1, o());
  assert.deepEqual([undone.stage, undone.who, undone.when], ["tofilm", "Ananth", "2026-11-05"]);

  const edited = Film.move(filmed, 1, o());
  assert.equal(edited.stage, "edited");
  assert.throws(() => Film.move(edited, 1, o()), /Pick when it goes up/);
  const sched = Film.move(edited, 1, o({ postAt: "2026-11-06T18:00" }));
  assert.deepEqual([sched.stage, sched.postAt, sched.when], ["scheduled", "2026-11-06T18:00", "2026-11-06"]);
  const posted = Film.move(sched, 1, o({ today: "2026-11-06" }));
  assert.deepEqual([posted.stage, posted.postedDay], ["posted", "2026-11-06"]);
  assert.equal(Film.move(posted, 1, o()), null);
  // Back from Scheduled to Edited drops the time.
  assert.equal(Film.move(sched, -1, o()).postAt, null);
  assert.equal(posted.history.length, 4);
});

test("reminders: what each person has to do today", () => {
  const now = "2026-11-05T07:30";
  const ideas = [
    idea({ id: "1", title: "Due today", who: "Ananth", when: "2026-11-05" }),
    idea({ id: "2", title: "Late", who: "Ananth", when: "2026-11-03" }),
    idea({ id: "3", title: "Later", who: "Ananth", when: "2026-11-09" }),
    idea({ id: "4", title: "No date", who: "Ananth" }),
    idea({ id: "5", title: "Anyone's to film", when: "2026-11-05" }),
    idea({ id: "6", title: "Needs editing", stage: "filmed", stageAt: "2026-11-03T22:00:00Z" }), // filmed yesterday
    idea({ id: "7", title: "Just filmed", stage: "filmed", stageAt: "2026-11-04T20:00:00Z" }), // this morning
    idea({ id: "8", title: "Needs scheduling", stage: "edited", stageAt: "2026-11-01T00:00:00Z" }),
    idea({ id: "9", title: "Goes up tonight", stage: "scheduled", postAt: "2026-11-05T18:00" }),
    idea({ id: "10", title: "Missed", stage: "scheduled", postAt: "2026-11-04T18:00" }),
    idea({ id: "11", title: "Next week", stage: "scheduled", postAt: "2026-11-12T18:00" }),
    idea({ id: "12", title: "Done", stage: "posted" }),
  ];
  // Nobody picked means it's for both of them. Late first, then the day's posts, then filming,
  // editing, scheduling.
  const shared = ["Post (late): Missed", "Post at 6pm: Goes up tonight"];
  const ananth = Film.remindersFor(ideas, "Ananth", now);
  assert.deepEqual(ananth.map((r) => r.text), [...shared, "Film: Anyone's to film", "Film: Due today", "Film: Late", "Edit: Needs editing", "Schedule: Needs scheduling"]);
  assert.equal(ananth.find((r) => r.title === "Late").late, true);
  const brake = Film.remindersFor(ideas, "Brake", now);
  assert.deepEqual(brake.map((r) => r.text), [...shared, "Film: Anyone's to film", "Edit: Needs editing", "Schedule: Needs scheduling"]);
  assert.equal(Film.digestText(brake, 2), "Post (late): Missed. Post at 6pm: Goes up tonight. And 3 more.");
  assert.deepEqual(Film.remindersFor(ideas, "Nobody", now), []);
});

test("import: a loose list of ideas lands in Ideas with everything in the notes", () => {
  const r = Film.importIdeas({ ideas: [
    { title: "Mat slap", type: "Satisfying", hook: "This mat", shots: ["Wide", "Slap"], people_needed: 2, caption: "Ecosystem 💀", link: "https://www.tiktok.com/@a/video/1?x=1", tags: "trend, skit" },
    { name: "Mat slap" }, { nope: 1 }, "Just a title",
  ] }, [{ title: "Already here" }], { id: (n) => "i" + n, now: NOW, by: "Brake" });
  assert.deepEqual([r.ideas.length, r.skipped, r.bad], [2, 1, 1]);
  const [a, b] = r.ideas;
  assert.equal(a.stage, "tofilm");
  assert.equal(a.notes, "Type: Satisfying\nPeople: 2\nHook: This mat\nSteps:\n1. Wide\n2. Slap");
  assert.deepEqual(a.tags, ["trend", "skit"]);
  assert.deepEqual(b.tags, []);
  // In the file's order, a millisecond apart.
  assert.ok(a.createdAt < b.createdAt);
  assert.equal(a.caption, "Ecosystem 💀");
  assert.equal(a.link, "https://www.tiktok.com/@a/video/1");
  assert.equal(b.title, "Just a title");
  assert.throws(() => Film.importIdeas({ nope: 1 }, [], { id: () => "x", now: "n" }), /no list of ideas/);
});

test("tags: cleaned, kept through edits, counted for the filter", () => {
  assert.deepEqual(Film.splitTags(" Does it foam? , trend, does it foam?,, "), ["Does it foam?", "trend"]);
  const x = Film.newIdea({ title: "A", tags: ["Does it foam?"] }, { id: "a", now: NOW });
  assert.deepEqual(Film.editIdea(x, { title: "B" }, NOW).tags, ["Does it foam?"]); // an edit without tags keeps them
  assert.deepEqual(Film.editIdea(x, { tags: "" }, NOW).tags, []);
  assert.equal(Film.hasTag(x, "does it FOAM?"), true);
  assert.deepEqual(Film.tagsIn([x, { tags: ["trend"] }, { tags: ["Does it foam?"] }, {}]), [{ tag: "Does it foam?", count: 2 }, { tag: "trend", count: 1 }]);
});

test("the Does it foam? series file: 12 episodes, in order, exactly as asked", () => {
  const file = JSON.parse(fs.readFileSync(new URL("../film/does-it-foam.json", import.meta.url), "utf8"));
  const r = Film.importIdeas(file, [], { id: (n) => "ep" + (n + 1), now: NOW, by: "Ananth" });
  assert.deepEqual([r.ideas.length, r.skipped, r.bad], [12, 0, 0]);
  const order = r.ideas.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((x) => x.title);
  assert.deepEqual(order, r.ideas.map((x) => x.title));
  assert.equal(order[0], "Does it foam? Ep 1: Shampoo and conditioner");
  assert.equal(order[6], "Does it foam? Ep 7: Coke");
  assert.equal(order[9], "Does it foam? Ep 10: Kids' bubble mixture");
  assert.equal(order[11], "Does it foam? Ep 12: Our own snow foam");
  for (const [i, x] of r.ideas.entries()) {
    assert.equal(x.stage, "tofilm");
    assert.equal(x.who, null);
    assert.equal(x.when, null);
    assert.deepEqual(x.tags, ["Does it foam?"]);
    assert.match(x.title, new RegExp("^Does it foam\\? Ep " + (i + 1) + ": "));
    assert.match(x.caption, new RegExp("^Does it foam\\? Ep " + (i + 1) + ": "));
    assert.match(x.notes, /^Type: Satisfying\nLength: 15s\nPeople: 1\nHook: Hold up .+\. Text: DOES IT FOAM\?\nSteps:\n1\. Hold the product up to camera\n2\. Pour it into the foam cannon\n3\. Spray it on a TEST PANEL only, never a customer car\n4\. Show the result: thick, runny or nothing\n5\. Give it a score out of 10 and say: "Comment what we should try next"\n6\. Rinse the foam cannon properly after$/);
  }
  assert.equal(r.ideas[0].caption, "Does it foam? Ep 1: shampoo and conditioner😭");
  assert.equal(r.ideas[6].caption, "Does it foam? Ep 7: Coke💀");
  assert.equal(r.ideas[11].caption, "Does it foam? Ep 12: the real one");
  assert.match(r.ideas[11].notes, /Hook: Hold up our own snow foam\./);
  // Importing it again adds nothing.
  assert.equal(Film.importIdeas(file, r.ideas, { id: () => "x", now: NOW }).ideas.length, 0);
});

/* ------------------------------------------------------------ the endpoint */

const call = async (body) => {
  const res = await POST(new Request("http://x/api/film", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
const get = async (q, headers = {}) => {
  const res = await GET(new Request("http://x/api/film?" + q, { headers }));
  return { status: res.status, text: await res.text() };
};

test("the endpoint: write ideas, tick them through, import, and the Shortcut", async () => {
  assert.equal((await call({ action: "list" })).status, 200);
  const made = await call({ action: "saveIdea", who: "Brake", fields: { title: "Mat slap", who: "Ananth", when: Film.dayIn(new Date()) } });
  assert.equal(made.status, 200);
  const id = made.body.idea.id;
  assert.equal(made.body.idea.createdBy, "Brake");
  assert.equal((await call({ action: "saveIdea", fields: { title: "" } })).status, 400);

  const f = await call({ action: "move", id, dir: 1, who: "Ananth" });
  assert.equal(f.body.idea.stage, "filmed");
  assert.equal(f.body.idea.history[0].by, "Ananth");
  assert.equal((await call({ action: "move", id, dir: 1 })).body.idea.stage, "edited");
  const noTime = await call({ action: "move", id, dir: 1 });
  assert.equal(noTime.status, 400);
  assert.match(noTime.body.error, /Pick when/);
  const s = await call({ action: "move", id, dir: 1, postAt: "2026-11-06T18:00" });
  assert.equal(s.body.idea.stage, "scheduled");
  // Edits keep the stage; the post time can be changed.
  const e = await call({ action: "saveIdea", id, fields: { title: "Mat slap 2", postAt: "2026-11-06T19:30", notes: "Low angle" } });
  assert.deepEqual([e.body.idea.title, e.body.idea.stage, e.body.idea.postAt, e.body.idea.notes], ["Mat slap 2", "scheduled", "2026-11-06T19:30", "Low angle"]);
  assert.equal((await call({ action: "move", id, dir: 1 })).body.idea.stage, "posted");
  assert.equal((await call({ action: "move", id, dir: 1 })).status, 409);

  // The iPhone Shortcut: a shared reel becomes an idea, once.
  const sc = await call({ action: "inbox", url: "https://www.instagram.com/reel/XyZ/?igsh=1", note: "Dog hair speedrun" });
  assert.deepEqual([sc.body.message, sc.body.idea.title, sc.body.idea.link], ["Added to Ideas", "Dog hair speedrun", "https://www.instagram.com/reel/XyZ/"]);
  assert.equal((await call({ action: "inbox", url: "https://www.instagram.com/reel/XyZ/" })).body.duplicate, true);
  assert.equal((await call({ action: "inbox", url: "https://www.tiktok.com/@a/video/9" })).body.idea.title, "Idea from TikTok");
  assert.equal((await call({ action: "inbox", url: "nope" })).status, 400);

  const imp = await call({ action: "import", data: [{ title: "Imported one" }, { title: "Dog hair speedrun" }] });
  assert.deepEqual([imp.body.added, imp.body.skipped], [1, 1]);
  assert.equal((await call({ action: "deleteIdea", id })).status, 200);
  assert.equal((await call({ action: "list" })).body.ideas.length, 3);
  assert.equal((await call({ action: "nope" })).status, 400);
});

test("phone reminders: sign up, the morning one once a day, and one before it goes up", async () => {
  const sent = [];
  let fail410 = false;
  setPushSenderForTests(async (sub, payload, options) => {
    if (fail410 && sub.endpoint.endsWith("/gone")) { const e = new Error("gone"); e.statusCode = 410; throw e; }
    sent.push({ to: sub.endpoint, ...JSON.parse(payload), ttl: options.TTL, key: options.vapidDetails.publicKey });
  });
  const key = (await call({ action: "pushKey" })).body.key;
  assert.match(key, /^[A-Za-z0-9_-]{80,}$/);
  assert.equal((await call({ action: "pushKey" })).body.key, key); // the same keys every time
  const sub = (end) => ({ endpoint: "https://push.example/" + end, keys: { p256dh: "BPub", auth: "auth1" } });
  assert.equal((await call({ action: "pushSubscribe", who: "Nobody", sub: sub("x") })).status, 400);
  assert.equal((await call({ action: "pushSubscribe", who: "Ananth", sub: { endpoint: "http://bad" } })).status, 400);
  assert.equal((await call({ action: "pushSubscribe", who: "Ananth", sub: sub("ananth") })).status, 200);
  assert.equal((await call({ action: "pushSubscribe", who: "Brake", sub: sub("brake") })).status, 200);
  assert.equal((await call({ action: "pushSubscribe", who: "Brake", sub: sub("gone") })).status, 200);

  const t = await call({ action: "pushTest", endpoint: "https://push.example/ananth" });
  assert.equal(t.status, 200);
  assert.equal(sent.pop().title, "Reminders are on");

  // What would go at 7:50am, given these ideas.
  const ideas = [
    idea({ id: "a", title: "Wheels", who: "Ananth", when: "2026-11-05" }),
    idea({ id: "b", title: "Needs editing", stage: "filmed", stageAt: "2026-11-03T00:00:00Z" }),
    idea({ id: "c", title: "Tonight", stage: "scheduled", postAt: "2026-11-05T18:00" }),
    idea({ id: "d", title: "Soon", stage: "scheduled", postAt: "2026-11-05T08:30" }),
  ];
  const morning = remindersToSend(ideas, ["Ananth", "Brake"], "2026-11-05T07:50", new Set());
  assert.deepEqual(morning.map((m) => [m.to, m.title, m.body]), [
    ["Ananth", "4 things to do today", "Post at 8:30am: Soon. Post at 6pm: Tonight. Film: Wheels. Edit: Needs editing."],
    ["Brake", "3 things to do today", "Post at 8:30am: Soon. Post at 6pm: Tonight. Edit: Needs editing."],
    ["Ananth", "Time to post", "Soon goes up at 8:30am."],
    ["Brake", "Time to post", "Soon goes up at 8:30am."],
  ]);
  // Before 7am: no morning one, but 6:50 is too early for 8:30 too. Already sent: not again.
  assert.equal(remindersToSend(ideas, ["Ananth"], "2026-11-05T06:50", new Set()).length, 0);
  assert.deepEqual(remindersToSend(ideas, ["Ananth"], "2026-11-05T07:50", new Set(["today:Ananth:2026-11-05"])).map((m) => m.title), ["Time to post"]);
  // At 5:50pm, the one for 6pm.
  assert.deepEqual(remindersToSend(ideas, ["Brake"], "2026-11-05T17:50", new Set(["today:Brake:2026-11-05", "post:d:2026-11-05T08:30:Brake"])).map((m) => m.body), ["Tonight goes up at 6pm."]);

  // The real run at 7:50am, twice: the second sends nothing new. A phone that's gone is forgotten.
  const store = filmStore();
  for (const x of ideas) await store.put(C.ideas, x.id, x);
  fail410 = true;
  const at = new Date("2026-11-04T20:50:00Z");
  const first = await sendReminders(store, at);
  assert.deepEqual(first.reminders.map((m) => [m.to, m.title]), [["Ananth", "4 things to do today"], ["Brake", "3 things to do today"], ["Ananth", "Time to post"], ["Brake", "Time to post"]]);
  assert.equal(first.sent, 4); // each phone twice; Brake's old phone is gone
  assert.deepEqual(sent.slice(-4).map((m) => [m.to.split("/").pop(), m.title]), [["ananth", "4 things to do today"], ["brake", "3 things to do today"], ["ananth", "Time to post"], ["brake", "Time to post"]]);
  assert.equal(sent[sent.length - 1].ttl, 6 * 3600);
  assert.equal(sent[sent.length - 1].key, key);
  assert.deepEqual((await sendReminders(store, at)).reminders, []);
  const subs = await store.all(C.push);
  assert.deepEqual(subs.map((r) => r.sub.endpoint.split("/").pop()).sort(), ["ananth", "brake"]);
  // Vercel's run has no ?action, but says who it is.
  assert.equal((await get("", { "user-agent": "vercel-cron/1.0" })).status, 200);
  // With CRON_SECRET set, only Vercel gets in.
  process.env.CRON_SECRET = "s3cret";
  assert.equal((await get("action=remind")).status, 401);
  assert.equal((await get("action=remind", { authorization: "Bearer s3cret" })).status, 200);
  delete process.env.CRON_SECRET;

  // The text version for GoHighLevel.
  assert.match((await get("action=today")).text, /^Ananth: .*\nBrake: /);
  assert.equal((await call({ action: "pushUnsubscribe", endpoint: "https://push.example/ananth" })).status, 200);
  assert.equal((await call({ action: "pushTest", endpoint: "https://push.example/ananth" })).status, 404);
});
