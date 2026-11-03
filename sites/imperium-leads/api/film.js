import { randomUUID } from "node:crypto";
import { json } from "../lib/http.js";
import { C, Film, filmStore } from "../lib/film-store.js";

/*
  Imperium Film List's one endpoint. POST { action, who, ... }. There's no PIN: anyone with
  the link can use it, on purpose (the owner asked for that). Who did what is the name the
  phone picked. GET ?action=today is the morning reminder for GoHighLevel.

  Instagram links are stored as links only: nothing about an Instagram reel is ever fetched.
  TikTok's public preview (thumbnail, caption, creator) comes from its oEmbed endpoint.
*/

const TZ = "Australia/Sydney";
const UA = { "User-Agent": "ImperiumFilmList/1.0 (+https://imperiumdetailing.com.au)" };

const nowIso = () => new Date().toISOString();
const today = () => Film.dayIn(new Date(), TZ);
const fail = (error, status = 400, extra = {}) => json({ error, ...extra }, status);

/* ------------------------------------------------------------ TikTok */

// vm.tiktok.com/… -> the full link it redirects to, when it does.
async function resolveTikTok(url) {
  let u = url;
  for (let i = 0; i < 4 && Film.isShortTikTok(u); i++) {
    try {
      const res = await fetch(u, { redirect: "manual", headers: UA, signal: AbortSignal.timeout(4000) });
      const loc = res.headers.get("location");
      if (!loc) break;
      const next = Film.normaliseUrl(new URL(loc, u).toString());
      if (!next || !/\/video\//.test(next)) break;
      u = next;
    } catch {
      break;
    }
  }
  return u;
}
// TikTok's public preview of a video. null when it can't be had (it isn't needed to save).
async function tiktokMeta(url) {
  try {
    const res = await fetch("https://www.tiktok.com/oembed?url=" + encodeURIComponent(url), { headers: UA, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return Film.cleanMeta(await res.json());
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ actions */

async function readBody(request) {
  const text = await request.text();
  if (text.length > 2_000_000) throw new Error("too big");
  return text ? JSON.parse(text) : {};
}

async function list(store) {
  const [inspo, ideas, settings] = await Promise.all([store.all(C.inspo), store.all(C.ideas), store.get(C.system, "settings")]);
  inspo.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  ideas.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return { inspo, ideas, settings: { weeklyTarget: Film.DEFAULT_TARGET, ...(settings || {}) }, today: today() };
}

async function saveInspo(store, body, by) {
  let url = Film.normaliseUrl(body.url);
  if (!url) return fail("That isn't a link. Copy the reel's link and try again.");
  if (Film.platformOf(url) === "tiktok") url = await resolveTikTok(url);
  const all = await store.all(C.inspo);
  const had = all.find((x) => x.url === url);
  if (had) {
    if (body.note && !had.note) {
      had.note = String(body.note).trim().slice(0, 500);
      await store.put(C.inspo, had.id, had);
    }
    return json({ ok: true, duplicate: true, inspo: had, message: "Already in the inbox" });
  }
  let meta = null;
  if (Film.platformOf(url) === "tiktok") meta = Film.cleanMeta(body.meta) || (await tiktokMeta(url));
  const inspo = Film.newInspo({ id: randomUUID(), url, note: body.note, meta, by, now: nowIso() });
  await store.put(C.inspo, inspo.id, inspo);
  return json({ ok: true, inspo, message: "Saved to the inbox" });
}

async function saveIdea(store, body, by) {
  const now = nowIso();
  if (body.id) {
    const had = await store.get(C.ideas, body.id);
    if (!had) return fail("That idea's gone", 404);
    const idea = Film.editIdea(had, body.fields || {}, now);
    await store.put(C.ideas, idea.id, idea);
    return json({ ok: true, idea });
  }
  let inspo = null;
  const fields = { ...(body.fields || {}) };
  if (body.inspoId) {
    inspo = await store.get(C.inspo, body.inspoId);
    if (!inspo) return fail("That saved reel's gone", 404);
    if (!fields.link) fields.link = inspo.url;
  }
  const idea = Film.newIdea(fields, { id: randomUUID(), now, by, source: inspo ? "inspo" : "manual", inspoId: inspo ? body.inspoId : null });
  await store.put(C.ideas, idea.id, idea);
  if (inspo) {
    inspo.ideaIds = [...new Set([...(inspo.ideaIds || []), idea.id])];
    await store.put(C.inspo, body.inspoId, inspo);
  }
  return json({ ok: true, idea, inspo: inspo ? { ...inspo, id: body.inspoId } : null });
}

async function deleteIdea(store, id) {
  const idea = await store.get(C.ideas, id);
  if (!idea) return json({ ok: true });
  await store.del(C.ideas, id);
  if (idea.inspoId) {
    const inspo = await store.get(C.inspo, idea.inspoId);
    if (inspo) {
      inspo.ideaIds = (inspo.ideaIds || []).filter((x) => x !== id);
      await store.put(C.inspo, idea.inspoId, inspo);
    }
  }
  return json({ ok: true });
}

async function moveIdea(store, body, by) {
  const idea = await store.get(C.ideas, body.id);
  if (!idea) return fail("That idea's gone", 404);
  const next = Film.move({ ...idea, id: body.id }, body.dir, by, nowIso(), today());
  if (!next) return fail(body.dir < 0 ? "It's at the first stage already" : "It's posted already", 409, { idea });
  await store.put(C.ideas, next.id, next);
  return json({ ok: true, idea: next });
}

export async function POST(request) {
  let body;
  try {
    body = await readBody(request);
  } catch {
    return fail("Send JSON");
  }
  const store = filmStore();
  const action = String(body.action || "");

  try {
    const who = Film.cleanPerson(body.who) || Film.OWNER;

    switch (action) {
      case "list":
        return json({ ok: true, ...(await list(store)) });
      case "inbox":
        return await saveInspo(store, body, who);
      case "setMeta": {
        // Any phone that reaches TikTok fills in a missing or stale preview.
        const inspo = await store.get(C.inspo, body.id);
        if (!inspo || inspo.platform !== "tiktok") return fail("Not a TikTok", 404);
        const meta = Film.cleanMeta(body.meta);
        if (!meta) return fail("Nothing to save");
        inspo.meta = meta;
        await store.put(C.inspo, body.id, inspo);
        return json({ ok: true, inspo: { ...inspo, id: body.id } });
      }
      case "deleteInspo":
        await store.del(C.inspo, String(body.id || ""));
        return json({ ok: true });
      case "saveIdea":
        return await saveIdea(store, body, who);
      case "deleteIdea":
        return await deleteIdea(store, String(body.id || ""));
      case "move":
        // await, so a failure lands in the catch below.
        return await moveIdea(store, body, who);
      case "setViews": {
        const idea = await store.get(C.ideas, body.id);
        if (!idea) return fail("That idea's gone", 404);
        const n = body.views === "" || body.views == null ? null : Math.round(Number(body.views));
        if (n != null && !(n >= 0 && n < 1e10)) return fail("Views is a number");
        const next = { ...idea, id: body.id, views: n, updatedAt: nowIso() };
        await store.put(C.ideas, next.id, next);
        return json({ ok: true, idea: next });
      }
      case "import": {
        const existing = await store.all(C.ideas);
        const r = Film.importIdeas(body.data, existing, { id: () => randomUUID(), now: nowIso(), by: Film.OWNER });
        if (r.ideas.length) await store.putMany(C.ideas, r.ideas);
        return json({ ok: true, added: r.ideas.length, skipped: r.skipped, bad: r.bad });
      }
      case "settings": {
        const t = Math.round(Number(body.weeklyTarget));
        if (!(t >= 1 && t <= 100)) return fail("The target is a number from 1 to 100");
        const settings = { ...((await store.get(C.system, "settings")) || {}), weeklyTarget: t };
        await store.put(C.system, "settings", settings);
        return json({ ok: true, settings });
      }
      default:
        return fail("Unknown action");
    }
  } catch (e) {
    // The model's own checks ("An idea needs a title") are the owner's to fix; anything else is ours.
    const theirs = /needs a title|isn't a link|no list of ideas/.test((e && e.message) || "");
    return fail(theirs ? e.message : "Something went wrong on our side", theirs ? 400 : 500);
  }
}

/*
  GET ?action=today[&who=Ant][&format=json]
  For a GoHighLevel workflow each morning: each person's videos for today as a short text,
  "Ant, 2 videos today: Mat slap, POV wheels." format=json adds one entry per person.
  An old link with &key=... still works; the key is just ignored.
*/
export async function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.get("action") === "ping") return json({ ok: true, ready: true });
  if (url.searchParams.get("action") !== "today") return fail("Unknown action");
  const store = filmStore();
  const ideas = await store.all(C.ideas);
  const day = today();
  const who = url.searchParams.get("who");
  const text = Film.reminderText(ideas, day, who);
  if (url.searchParams.get("format") === "json") {
    const people = (who ? [Film.cleanPerson(who)].filter(Boolean) : Film.PEOPLE).map((p) => {
      const list = Film.todayFor(ideas, p, day);
      return { name: p, count: list.length, titles: list.map((x) => x.title), text: Film.reminderText(ideas, day, p) };
    });
    return json({ ok: true, today: day, text, people });
  }
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
