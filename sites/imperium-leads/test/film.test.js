import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The server runs on a local file instead of Supabase.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "film-"));
process.env.FILM_LOCAL_STORE = path.join(dir, "store.json");

const { Film } = await import("../lib/film-store.js");
const { POST, GET } = await import("../api/film.js");

const T = "2026-11-04"; // a Wednesday
const idea = (o) => Film.newIdea({ title: "Idea", ...o }, { id: o.id || o.title, now: "2026-11-01T00:00:00Z" });

/* ------------------------------------------------------------ the rules */

test("links: Instagram and TikTok come back in one plain form", () => {
  assert.equal(Film.normaliseUrl("https://www.instagram.com/reel/DAbc123/?igsh=xyz"), "https://www.instagram.com/reel/DAbc123/");
  assert.equal(Film.normaliseUrl("instagram.com/reels/DAbc123"), "https://www.instagram.com/reel/DAbc123/");
  assert.equal(Film.normaliseUrl("Look at this https://www.instagram.com/p/XYZ/ so good"), "https://www.instagram.com/p/XYZ/");
  assert.equal(Film.normaliseUrl("https://www.tiktok.com/@imperium/video/7312345678901234567?is_from_webapp=1&sender_device=pc"), "https://www.tiktok.com/@imperium/video/7312345678901234567");
  assert.equal(Film.normaliseUrl("https://tiktok.com/@a.b/video/1/"), "https://www.tiktok.com/@a.b/video/1");
  assert.equal(Film.normaliseUrl("not a link"), null);
  assert.equal(Film.platformOf("https://www.instagram.com/reel/A/"), "instagram");
  assert.equal(Film.platformOf("https://vm.tiktok.com/ZM123/"), "tiktok");
  assert.equal(Film.platformOf("https://youtube.com/shorts/1"), "other");
  assert.equal(Film.isShortTikTok("https://vm.tiktok.com/ZM123/"), true);
  assert.equal(Film.isShortTikTok("https://www.tiktok.com/t/ZT9abc/"), true);
  assert.equal(Film.tiktokHandle("https://www.tiktok.com/@imperium.detailing/video/1"), "@imperium.detailing");
});

test("an Instagram reel keeps no data about the reel, a TikTok keeps its preview", () => {
  const ig = Film.newInspo({ id: "a", url: "https://www.instagram.com/reel/A/", meta: { thumb: "https://x/y.jpg", title: "t" }, now: "n" });
  assert.equal(ig.meta, null);
  const tt = Film.newInspo({ id: "b", url: "https://www.tiktok.com/@a/video/1", meta: { thumbnail_url: "https://p16/t.jpg", title: "Satisfying wheel", author_name: "Someone", html: "<iframe>" }, now: "n" });
  assert.deepEqual(tt.meta, { thumb: "https://p16/t.jpg", title: "Satisfying wheel", author: "Someone" });
});

test("ideas: fields are cleaned, a title is a must", () => {
  const x = Film.newIdea({ title: " Mat slap ", type: "satisfying", tags: "trend, Trend, #skit", steps: "1. Wide shot\n- Slap\n\nAfter", people: "2", length: "15s", assignee: "ant", due: "2026-11-04" }, { id: "1", now: "n" });
  assert.equal(x.title, "Mat slap");
  assert.equal(x.type, "Satisfying");
  assert.deepEqual(x.tags, ["trend", "skit"]);
  assert.deepEqual(x.steps, ["Wide shot", "Slap", "After"]);
  assert.equal(x.people, 2);
  assert.equal(x.assignee, "Ant");
  assert.equal(x.stage, "tofilm");
  assert.throws(() => Film.newIdea({ title: "  " }, { id: "2", now: "n" }), /needs a title/);
  assert.equal(Film.matchType("POV"), "POV Detail");
  assert.equal(Film.matchType("asked and answered"), "");
  assert.equal(Film.matchType("Asked & Answered"), "Asked & Answered");
});

test("stages: one step on or back, posted remembers the day, the ends stop", () => {
  let x = idea({ title: "A" });
  assert.equal(Film.nextLabel(x), "Filmed");
  x = Film.move(x, 1, "Ant", "t1", T);
  assert.equal(x.stage, "filmed");
  assert.deepEqual(x.history[0], { from: "tofilm", to: "filmed", by: "Ant", at: "t1" });
  x = Film.move(Film.move(x, 1, "Pat", "t2", T), 1, "Pat", "t3", T);
  assert.equal(x.stage, "posted");
  assert.equal(x.postedDay, T);
  assert.equal(Film.move(x, 1, "Pat", "t4", T), null);
  const back = Film.move(x, -1, "Pat", "t5", T);
  assert.equal(back.stage, "edited");
  assert.equal(back.postedDay, null);
  assert.equal(Film.move(idea({ title: "B" }), -1, "Pat", "t", T), null);
});

test("today: only theirs, due today or late, biggest shoot first", () => {
  const ideas = [
    idea({ title: "Small", assignee: "Ant", due: T, people: 1, length: "12s" }),
    idea({ title: "Big", assignee: "Ant", due: "2026-11-02", people: 3, length: "20s" }),
    idea({ title: "Later", assignee: "Ant", due: "2026-11-09" }),
    idea({ title: "Lucas's", assignee: "Lucas", due: T }),
    idea({ title: "No date", assignee: "Ant" }),
    { ...idea({ title: "Filmed already", assignee: "Ant", due: T }), stage: "filmed" },
  ];
  assert.deepEqual(Film.todayFor(ideas, "Ant", T).map((x) => x.title), ["Big", "Small"]);
  assert.deepEqual(Film.upcomingFor(ideas, "Ant", T).map((x) => x.title), ["Later", "No date"]);
  assert.equal(Film.dueLabel("2026-11-02", T), "2 days late");
  assert.equal(Film.dueLabel(T, T), "Due today");
  assert.equal(Film.dueLabel("2026-11-05", T), "Due tomorrow");
  assert.equal(Film.reminderText(ideas, T), "Ant, 2 videos today: Big, Small.\nLucas, 1 video today: Lucas's.");
  assert.equal(Film.reminderText(ideas, T, "nick"), "Nick, nothing to film today.");
  assert.equal(Film.reminderText([], T), "No videos due today.");
});

test("numbers: posted this week, and average views by type", () => {
  const p = (o) => ({ ...idea(o), stage: "posted" });
  const ideas = [
    p({ title: "1", type: "POV Detail", postedDay: "2026-11-03" }),
    { ...p({ title: "2", type: "POV Detail" }), postedDay: "2026-11-03", views: 1000 },
    { ...p({ title: "3", type: "POV Detail" }), postedDay: "2026-10-20", views: 3000 },
    { ...p({ title: "4", type: "Reactions" }), postedDay: "2026-11-09", views: 500 },
    idea({ title: "5", type: "Reactions" }),
  ];
  ideas[0].postedDay = "2026-11-03";
  assert.deepEqual(Film.weekOf(T), { from: "2026-11-02", to: "2026-11-08" });
  assert.equal(Film.postedThisWeek(ideas, T), 2);
  const s = Film.statsByType(ideas);
  assert.deepEqual(s.map((r) => [r.type, r.posted, r.avgViews]), [["POV Detail", 3, 2000], ["Reactions", 1, 500]]);
});

test("import: loose field names, all To film and unassigned, no doubles", () => {
  let n = 0;
  const r = Film.importIdeas({ ideas: [
    { name: "Mat slap", category: "Satisfying", shots: ["Wide", "Slap"], people_needed: 2, duration: "15s", caption: "Mat went from 💀 to new", tags: "trend" },
    { title: "Wheel reveal", type: "Big Reveal", hook: "Watch the brake dust go", notes: "Use the GTS" },
    { title: "Already there" },
    { title: "" },
    "Just a title",
  ] }, [{ title: "already THERE" }], { id: () => "id" + n++, now: "now", by: "Pat" });
  assert.equal(r.ideas.length, 3);
  assert.equal(r.skipped, 1);
  assert.equal(r.bad, 1);
  const [a, b, c] = r.ideas;
  assert.equal(a.title, "Mat slap");
  assert.equal(a.type, "Satisfying");
  assert.deepEqual(a.steps, ["Wide", "Slap"]);
  assert.equal(a.people, 2);
  assert.equal(a.stage, "tofilm");
  assert.equal(a.assignee, null);
  assert.equal(a.source, "import");
  assert.equal(b.type, "");
  assert.deepEqual(b.tags, ["Big Reveal"]);
  assert.deepEqual(b.steps, ["Note: Use the GTS"]);
  assert.equal(c.title, "Just a title");
  assert.throws(() => Film.importIdeas({ nope: 1 }, [], { id: () => "x", now: "n" }), /no list of ideas/);
});

/* ------------------------------------------------------------ the endpoint */

const call = async (body) => {
  const res = await POST(new Request("http://x/api/film", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

test("the endpoint: no PIN, the inbox, ideas, stages, import and the reminder", async (t) => {
  // TikTok's preview comes from its oEmbed endpoint; here it's faked.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://www.tiktok.com/oembed")) return new Response(JSON.stringify({ title: "Mud to mirror", author_name: "detailer", thumbnail_url: "https://p16.tiktokcdn.com/x.jpg" }), { status: 200 });
    throw new Error("no network in tests: " + url);
  };
  t.after(() => { globalThis.fetch = realFetch; });

  // Open to anyone with the link: no PIN, no token.
  assert.equal((await call({ action: "list" })).status, 200);
  assert.equal((await GET(new Request("http://x/api/film?action=ping")).then((r) => r.json())).ready, true);

  // The inbox: Instagram is a link only, TikTok gets its public preview.
  const ig = await call({ action: "inbox", url: "https://www.instagram.com/reel/AbC/?igsh=1", note: "the hook" });
  assert.equal(ig.status, 200);
  assert.equal(ig.body.inspo.url, "https://www.instagram.com/reel/AbC/");
  assert.equal(ig.body.inspo.meta, null);
  const tt = await call({ action: "inbox", url: "https://www.tiktok.com/@a/video/123?lang=en" });
  assert.equal(tt.status, 200);
  assert.deepEqual(tt.body.inspo.meta, { thumb: "https://p16.tiktokcdn.com/x.jpg", title: "Mud to mirror", author: "detailer" });
  assert.equal(tt.body.inspo.createdBy, Film.OWNER);
  assert.equal((await call({ action: "inbox", url: "https://www.tiktok.com/@a/video/123" })).body.duplicate, true);
  assert.equal((await call({ action: "inbox", url: "nope" })).status, 400);

  // Make it ours: the idea gets the reel's link, the reel remembers the idea.
  const made = await call({ action: "saveIdea", inspoId: tt.body.inspo.id, fields: { title: "Mat slap", type: "Satisfying", steps: "Wide\nSlap", assignee: "Ant", due: Film.dayIn(new Date(), "Australia/Sydney") } });
  assert.equal(made.status, 200);
  const id = made.body.idea.id;
  assert.equal(made.body.idea.link, "https://www.tiktok.com/@a/video/123");
  assert.deepEqual(made.body.inspo.ideaIds, [id]);
  assert.equal((await call({ action: "saveIdea", fields: { title: "" } })).status, 400);

  // Ant opens it and films it; Undo moves it back.
  const list = await call({ action: "list" });
  assert.equal(list.body.ideas.length, 1);
  assert.equal(list.body.inspo.length, 2);
  const filmed = await call({ action: "move", id, dir: 1, who: "Ant" });
  assert.equal(filmed.body.idea.stage, "filmed");
  assert.equal(filmed.body.idea.history[0].by, "Ant");
  assert.equal((await call({ action: "move", id, dir: -1, who: "Ant" })).body.idea.stage, "tofilm");

  // The reminder for GoHighLevel: Ant has one today; an old link with a key still works.
  const remind = async (q) => { const res = await GET(new Request("http://x/api/film?" + q)); return { status: res.status, text: await res.text() }; };
  assert.equal((await remind("action=today")).text, "Ant, 1 video today: Mat slap.");
  assert.equal((await remind("action=today&key=old&who=Nick")).text, "Nick, nothing to film today.");
  await call({ action: "move", id, dir: 1, who: "Ant" });
  assert.equal((await remind("action=today")).text, "No videos due today.");

  // Views, the weekly target, import, delete.
  assert.equal((await call({ action: "setViews", id, views: 1234 })).body.idea.views, 1234);
  assert.equal((await call({ action: "settings", weeklyTarget: 10 })).body.settings.weeklyTarget, 10);
  const imp = await call({ action: "import", data: [{ title: "Imported one" }, { title: "Mat slap" }] });
  assert.deepEqual([imp.body.added, imp.body.skipped], [1, 1]);
  assert.equal((await call({ action: "deleteIdea", id })).status, 200);
  const after = await call({ action: "list" });
  assert.equal(after.body.ideas.length, 1);
  assert.deepEqual(after.body.inspo.find((x) => x.platform === "tiktok").ideaIds, []);
  assert.equal(after.body.settings.weeklyTarget, 10);
  assert.equal((await call({ action: "nope" })).status, 400);
});
