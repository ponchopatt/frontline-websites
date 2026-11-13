import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The server runs on a local file instead of Supabase.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "film-ads-"));
process.env.FILM_LOCAL_STORE = path.join(dir, "store.json");

const { Film, C, filmStore } = await import("../lib/film-store.js");
const { AD, findAd, validTick, tickId } = await import("../lib/film-ads.js");
const { POST } = await import("../api/film.js");

const call = async (body) => {
  const res = await POST(new Request("http://x/api/film", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

test("the shoot file loads, and every ad has what the screens need", () => {
  assert.equal(AD.ads.length, 11);
  for (const ad of AD.ads) {
    assert.ok(ad.id && ad.number && ad.title && ad.priority, ad.id);
    assert.ok(["must", "if-time", "separate-day"].includes(ad.priority), ad.id);
    assert.ok(ad.hook || (ad.variants || []).length, ad.id + " has a hook");
  }
  assert.equal(findAd("ad2").variants.length, 6);
  assert.equal(findAd("nope"), null);
});

test("ad ideas: title, the hook in the notes, the caption, the series", () => {
  const f = Film.adIdeaFields(findAd("ad3"));
  assert.equal(f.title, "Ad 3: The race: can Ananth finish the ad before Lucas foams the car?");
  assert.equal(f.notes, findAd("ad3").hook);
  assert.equal(f.caption, "Ananth vs Lucas. Loser gets foamed 😭 #canberra #cardetailing #imperiumdetailing");
  assert.equal(f.series, "Ad shoot: 15 Nov");
  assert.equal(Film.adIdeaFields(findAd("ad1")).caption, "");
  // The bike ad has no hook of its own: each version's hook.
  assert.match(Film.adIdeaFields(findAd("ad2")).notes, /^B4: Rider pulls up[\s\S]*\nB1: Dirty bike, then foam hits\.$/);
  const idea = Film.newIdea(f, { id: "x", now: "2026-11-14T00:00:00Z", adId: "ad3" });
  assert.equal(idea.adId, "ad3");
  assert.equal(Film.editIdea(idea, { title: "Renamed" }, "n").adId, "ad3"); // edits keep the link
  assert.equal("adId" in Film.newIdea({ title: "Plain" }, { id: "y", now: "n" }), false);
});

test("offers: ended after their date, not yet before a start date", () => {
  const s = (runs, today) => Film.offerStatus(runs, today, 2026).state;
  assert.equal(s("Until 30 Nov", "2026-11-30"), "on");
  assert.equal(s("Until 30 Nov", "2026-12-01"), "ended");
  assert.equal(s("Orders close 20 Dec", "2026-12-20"), "on");
  assert.equal(s("Orders close 20 Dec", "2026-12-21"), "ended");
  assert.equal(s("From 1 Dec", "2026-11-30"), "soon");
  assert.equal(s("From 1 Dec", "2026-12-01"), "on");
  assert.equal(s("Always", "2027-06-01"), "on");
  assert.equal(s("Only once it's actually set up", "2026-11-14"), "on");
});

test("ticks: only things in the shoot file can be ticked", () => {
  assert.equal(validTick("kit", "2 phones + tripod"), true);
  assert.equal(validTick("kit", "A jetpack"), false);
  assert.equal(validTick("extra", AD.extraBroll[0]), true);
  assert.equal(validTick("ad8:broll", "The same car clean"), true);
  assert.equal(validTick("ad8:broll", "Something else"), false);
  assert.equal(validTick("ad1:other", "Hand slamming the bottle"), true);
  assert.equal(validTick("ad2:variant", "B4"), true);
  assert.equal(validTick("ad2:variant", "B9"), false);
  assert.equal(validTick("ad1:checked", "checked"), true);
  assert.equal(validTick("ad6:checked", "checked"), false); // ad 6 has nothing to check
  assert.equal(validTick("ad99:broll", "x"), false);
  assert.equal(validTick("nope", "x"), false);
  assert.equal(tickId("kit", "a"), tickId("kit", "a"));
  assert.notEqual(tickId("kit", "a"), tickId("extra", "a"));
});

test("the endpoint: seed the series, tick, sync, the checked gate, and nothing else touched", async () => {
  const store = filmStore();
  // An idea that was already there must come through untouched.
  const before = (await call({ action: "saveIdea", who: "Ananth", fields: { title: "Mat slap", series: "Does it foam?" } })).body.idea;

  // The series, in shoot order. A second seed adds nothing.
  const seed = await call({ action: "adSeed", who: "Brake" });
  assert.equal(seed.body.added, 11);
  const ideas = (await call({ action: "list" })).body.ideas.filter((x) => x.adId);
  const order = ideas.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((x) => x.adId);
  assert.deepEqual(order, [...AD.ads].sort((a, b) => a.shootOrder - b.shootOrder).map((a) => a.id));
  assert.ok(ideas.every((x) => x.series === "Ad shoot: 15 Nov" && x.stage === "tofilm"));
  assert.equal((await call({ action: "adSeed" })).body.added, 0);

  // Ticks: on, seen by the other phone in list, off again.
  assert.equal((await call({ action: "tick", who: "Brake", scope: "kit", item: "2 phones + tripod" })).status, 200);
  assert.equal((await call({ action: "tick", scope: "kit", item: "A jetpack" })).status, 400);
  await call({ action: "tick", who: "Ananth", scope: "ad8:broll", item: "The same car clean" });
  await call({ action: "tick", who: "Ananth", scope: "ad2:variant", item: "B4" });
  let ticks = (await call({ action: "list", who: "Brake" })).body.ticks;
  assert.deepEqual(ticks.map((t) => t.scope + "|" + t.item).sort(), ["ad2:variant|B4", "ad8:broll|The same car clean", "kit|2 phones + tripod"]);
  assert.equal(ticks.find((t) => t.scope === "kit").by, "Brake");
  await call({ action: "tick", scope: "ad8:broll", item: "The same car clean", on: false });
  ticks = (await call({ action: "list" })).body.ticks;
  assert.equal(ticks.length, 2);

  // Reset the kit list; only kit and extra can be reset.
  await call({ action: "tick", scope: "kit", item: "Headphones" });
  assert.equal((await call({ action: "tickReset", scope: "kit" })).body.cleared, 2);
  assert.equal((await call({ action: "tickReset", scope: "ad1:broll" })).status, 400);
  assert.deepEqual((await call({ action: "list" })).body.ticks.map((t) => t.scope), ["ad2:variant"]);

  // The ad card's tick is the idea's tick: one stage, two places.
  const filmed = await call({ action: "adMove", who: "Ananth", adId: "ad1", dir: 1 });
  assert.equal(filmed.body.idea.stage, "filmed");
  const ad1Idea = (await call({ action: "list" })).body.ideas.find((x) => x.adId === "ad1");
  assert.equal(ad1Idea.stage, "filmed");
  assert.equal((await call({ action: "move", id: ad1Idea.id, dir: 1 })).body.idea.stage, "edited"); // from the Ideas list

  // Scheduled needs "I've checked these", from the ad card and from the Ideas list.
  const blocked = await call({ action: "adMove", adId: "ad1", dir: 1, postAt: "2026-11-17T09:00" });
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error, /checked these/);
  assert.equal((await call({ action: "move", id: ad1Idea.id, dir: 1, postAt: "2026-11-17T09:00" })).status, 409);
  await call({ action: "tick", who: "Ananth", scope: "ad1:checked", item: "checked" });
  const sched = await call({ action: "adMove", adId: "ad1", dir: 1, postAt: "2026-11-17T09:00" });
  assert.deepEqual([sched.status, sched.body.idea.stage, sched.body.idea.postAt], [200, "scheduled", "2026-11-17T09:00"]);
  // Ad 6 has nothing to check, so nothing stops it.
  for (let i = 0; i < 2; i++) await call({ action: "adMove", adId: "ad6", dir: 1 });
  assert.equal((await call({ action: "adMove", adId: "ad6", dir: 1, postAt: "2026-11-20T18:00" })).body.idea.stage, "scheduled");

  // An ad whose idea was deleted gets a new one on its next tick.
  const ad9 = (await call({ action: "list" })).body.ideas.find((x) => x.adId === "ad9");
  await call({ action: "deleteIdea", id: ad9.id });
  const again = await call({ action: "adMove", adId: "ad9", dir: 1 });
  assert.deepEqual([again.body.idea.stage, again.body.idea.title], ["filmed", "Ad 9: Headlight restoration 50/50"]);
  assert.equal((await call({ action: "adMove", adId: "ad99", dir: 1 })).status, 404);

  // The idea that was there before is exactly as it was.
  const after = (await call({ action: "list" })).body.ideas.find((x) => x.id === before.id);
  assert.deepEqual(after, before);
  // And everything is in the ticks collection, not on the ideas.
  assert.ok((await store.all(C.ticks)).every((t) => t.scope && t.item));
});
