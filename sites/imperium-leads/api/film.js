import { createHmac, randomUUID, scryptSync } from "node:crypto";
import { json, sameSecret } from "../lib/http.js";
import { C, Film, filmStore } from "../lib/film-store.js";

/*
  Imperium Film List's one endpoint. POST { action, ... } with "Authorization: Bearer <token>";
  the token comes from action "unlock" with the team PIN (the crew) or the admin PIN (the
  owner). GET ?action=today&key=<reminder key> is the morning reminder for GoHighLevel.

  The PINs and the reminder key are never in the code: they live in docs film_system/pins as
  scrypt hashes (and the key), or in FILM_TEAM_PIN / FILM_ADMIN_PIN / FILM_REMINDER_KEY, which
  win when set. Wrong PINs lock it like the leads app's PIN screen: 5 wrong in a row, 15
  minutes; each 5 after that, twice as long (up to 12 hours).

  Instagram links are stored as links only: nothing about an Instagram reel is ever fetched.
  TikTok's public preview (thumbnail, caption, creator) comes from its oEmbed endpoint.
*/

const TZ = "Australia/Sydney";
const TOKEN_DAYS = 180;
const UA = { "User-Agent": "ImperiumFilmList/1.0 (+https://imperiumdetailing.com.au)" };

const nowIso = () => new Date().toISOString();
const today = () => Film.dayIn(new Date(), TZ);
const fail = (error, status = 400, extra = {}) => json({ error, ...extra }, status);

/* ------------------------------------------------------------ tokens and PINs */

function tokenSecret() {
  if (process.env.FILM_TOKEN_SECRET) return process.env.FILM_TOKEN_SECRET;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("No secret to sign Film List tokens with");
  return createHmac("sha256", key).update("imperium film list tokens").digest("hex");
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return body + "." + createHmac("sha256", tokenSecret()).update(body).digest("base64url");
}
function verify(token) {
  const [body, mac] = String(token || "").split(".");
  if (!body || !mac) return null;
  if (!sameSecret(mac, createHmac("sha256", tokenSecret()).update(body).digest("base64url"))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return p.exp > Date.now() && (p.role === "admin" || p.role === "crew") ? p : null;
  } catch {
    return null;
  }
}
const bearer = (request) => verify((request.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));

export const hashPin = (pin, salt) => scryptSync(String(pin), salt, 32).toString("hex");

async function secrets(store) {
  const doc = (await store.get(C.system, "pins")) || {};
  const env = { team: process.env.FILM_TEAM_PIN, admin: process.env.FILM_ADMIN_PIN, reminderKey: process.env.FILM_REMINDER_KEY };
  const is = (given, which) => {
    if (!given) return false;
    if (env[which]) return sameSecret(String(given), env[which]);
    const h = doc[which];
    return !!(h && h.salt && h.hash) && sameSecret(hashPin(given, h.salt), h.hash);
  };
  return {
    ready: !!((env.team || doc.team) && (env.admin || doc.admin)),
    roleFor: (pin) => (is(pin, "admin") ? "admin" : is(pin, "team") ? "crew" : null),
    reminderKey: env.reminderKey || doc.reminderKey || "",
  };
}

// The role a PIN opens, "wrong", or { locked: minutes }. Every wrong try counts.
async function tryPin(store, pin) {
  const lock = (await store.get(C.system, "lock")) || { fails: 0, lockedUntil: null };
  const now = Date.now();
  if (lock.lockedUntil && Date.parse(lock.lockedUntil) > now) return { locked: Math.ceil((Date.parse(lock.lockedUntil) - now) / 60000) };
  const s = await secrets(store);
  if (!s.ready) return { notReady: true };
  const role = s.roleFor(String(pin ?? ""));
  if (!role) {
    const fails = (lock.fails || 0) + 1;
    const next = { fails, lockedUntil: null, lastFail: new Date(now).toISOString() };
    if (fails % 5 === 0) {
      const minutes = Math.min(12 * 60, 15 * 2 ** (fails / 5 - 1));
      next.lockedUntil = new Date(now + minutes * 60000).toISOString();
      await store.put(C.system, "lock", next);
      return { locked: minutes };
    }
    await store.put(C.system, "lock", next);
    return { wrong: true };
  }
  if (lock.fails) await store.put(C.system, "lock", { fails: 0, lockedUntil: null });
  return { role };
}
const pinError = (r) =>
  r.locked ? fail("locked", 429, { minutes: r.locked }) : r.notReady ? fail("Film List isn't set up yet", 503) : fail("wrong", 401);

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
    if (action === "unlock") {
      const r = await tryPin(store, body.pin);
      if (!r.role) return pinError(r);
      return json({ ok: true, role: r.role, token: sign({ role: r.role, exp: Date.now() + TOKEN_DAYS * 86400000 }) });
    }

    // The iPhone Shortcut sends the admin PIN in a header instead of a token.
    let auth = bearer(request);
    if (!auth && action === "inbox" && (request.headers.get("x-film-pin") || body.pin)) {
      const r = await tryPin(store, request.headers.get("x-film-pin") || body.pin);
      if (r.role !== "admin") return r.role ? fail("That needs the owner's PIN", 403) : pinError(r);
      auth = { role: "admin" };
    }
    if (!auth) return fail("Unlock first", 401);
    const admin = auth.role === "admin";
    const who = Film.cleanPerson(body.who) || (admin ? Film.OWNER : null);
    const ownerOnly = () => fail("Only the owner can do that", 403);

    switch (action) {
      case "list":
        return json({ ok: true, role: auth.role, ...(await list(store)) });
      case "inbox":
        return admin ? await saveInspo(store, body, who) : ownerOnly();
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
        if (!admin) return ownerOnly();
        await store.del(C.inspo, String(body.id || ""));
        return json({ ok: true });
      case "saveIdea":
        return admin ? await saveIdea(store, body, who) : ownerOnly();
      case "deleteIdea":
        return admin ? await deleteIdea(store, String(body.id || "")) : ownerOnly();
      case "move":
        // await, so a failure lands in the catch below.
        return await moveIdea(store, body, who);
      case "setViews": {
        if (!admin) return ownerOnly();
        const idea = await store.get(C.ideas, body.id);
        if (!idea) return fail("That idea's gone", 404);
        const n = body.views === "" || body.views == null ? null : Math.round(Number(body.views));
        if (n != null && !(n >= 0 && n < 1e10)) return fail("Views is a number");
        const next = { ...idea, id: body.id, views: n, updatedAt: nowIso() };
        await store.put(C.ideas, next.id, next);
        return json({ ok: true, idea: next });
      }
      case "import": {
        if (!admin) return ownerOnly();
        const existing = await store.all(C.ideas);
        const r = Film.importIdeas(body.data, existing, { id: () => randomUUID(), now: nowIso(), by: Film.OWNER });
        if (r.ideas.length) await store.putMany(C.ideas, r.ideas);
        return json({ ok: true, added: r.ideas.length, skipped: r.skipped, bad: r.bad });
      }
      case "settings": {
        if (!admin) return ownerOnly();
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
  GET ?action=today&key=<reminder key>[&who=Ant][&format=json]
  For a GoHighLevel workflow each morning: each person's videos for today as a short text,
  "Ant, 2 videos today: Mat slap, POV wheels." format=json adds one entry per person.
*/
export async function GET(request) {
  const url = new URL(request.url);
  const store = filmStore();
  const s = await secrets(store);
  if (url.searchParams.get("action") === "ping") return json({ ok: true, ready: s.ready });
  if (url.searchParams.get("action") !== "today") return fail("Unknown action");
  if (!s.reminderKey || !sameSecret(url.searchParams.get("key") || "", s.reminderKey)) return fail("Wrong key", 401);
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
