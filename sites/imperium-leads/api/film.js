import { createHash, randomUUID } from "node:crypto";
import webpush from "web-push";
import { json, sameSecret } from "../lib/http.js";
import { C, Film, filmStore } from "../lib/film-store.js";

/*
  Imperium Film List's one endpoint. No PIN: anyone with the link can use it (Pat's choice).

  POST { action, who, ... }
    list, saveIdea, deleteIdea, move, import    the lists
    inbox                                       the iPhone Shortcut: a shared reel becomes an idea
    pushKey, pushSubscribe, pushUnsubscribe, pushTest    phone reminders
  GET ?action=remind     Vercel runs this every hour (vercel.json): the 7am "today" reminder to each
                         phone, and a "time to post" one before anything scheduled goes up.
                         Each reminder goes once, so calling it again sends nothing new.
  GET ?action=today[&who=Ant]   the same "today" text, for a GoHighLevel text message.

  Phone reminders are standard web push. The keys are made on first use and kept in
  film_system/vapid (never sent to a phone except the public half).
*/

const nowIso = () => new Date().toISOString();
const fail = (error, status = 400, extra = {}) => json({ error, ...extra }, status);

async function readBody(request) {
  const text = await request.text();
  if (text.length > 2_000_000) throw new Error("too big");
  return text ? JSON.parse(text) : {};
}

async function list(store) {
  const ideas = await store.all(C.ideas);
  ideas.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return { ideas, now: Film.localNow(new Date()) };
}

async function saveIdea(store, body, by) {
  const now = nowIso();
  if (body.id) {
    const had = await store.get(C.ideas, body.id);
    if (!had) return fail("That idea's gone", 404);
    const idea = Film.editIdea({ ...had, id: body.id }, body.fields || {}, now);
    await store.put(C.ideas, idea.id, idea);
    return json({ ok: true, idea });
  }
  const idea = Film.newIdea(body.fields || {}, { id: randomUUID(), now, by });
  await store.put(C.ideas, idea.id, idea);
  return json({ ok: true, idea });
}

async function moveIdea(store, body, by) {
  const idea = await store.get(C.ideas, body.id);
  if (!idea) return fail("That idea's gone", 404);
  const now = new Date();
  const next = Film.move({ ...idea, id: body.id }, body.dir, { by, now: now.toISOString(), today: Film.dayIn(now), postAt: body.postAt });
  if (!next) return fail(body.dir < 0 ? "It's at the start already" : "It's posted already", 409, { idea });
  await store.put(C.ideas, next.id, next);
  return json({ ok: true, idea: next });
}

// The iPhone Shortcut shares a reel straight in: it becomes an idea with the link on it.
async function fromShortcut(store, body, by) {
  const link = Film.normaliseUrl(body.url);
  if (!link) return fail("That isn't a link. Share the reel's link and try again.");
  const all = await store.all(C.ideas);
  const had = all.find((x) => x.link === link);
  if (had) return json({ ok: true, duplicate: true, idea: had, message: "Already on the list: " + had.title });
  const where = { tiktok: "TikTok", instagram: "Instagram" }[Film.platformOf(link)] || "a link";
  const note = String(body.note || "").trim();
  const idea = Film.newIdea({ title: note || "Idea from " + where, link }, { id: randomUUID(), now: nowIso(), by, source: "shortcut" });
  await store.put(C.ideas, idea.id, idea);
  return json({ ok: true, idea, message: "Added to Ideas" });
}

/* ------------------------------------------------------------ phone reminders */

let sendPush = (sub, payload, options) => webpush.sendNotification(sub, payload, options);
export const setPushSenderForTests = (fn) => { sendPush = fn; };

async function vapid(store) {
  let keys = await store.get(C.system, "vapid");
  if (!keys || !keys.publicKey || !keys.privateKey) {
    await store.put(C.system, "vapid", { ...webpush.generateVAPIDKeys(), at: nowIso() });
    keys = await store.get(C.system, "vapid"); // read back, so two first calls agree
  }
  return keys;
}
const subId = (endpoint) => createHash("sha256").update(String(endpoint)).digest("hex").slice(0, 40);
function cleanSub(sub) {
  if (!sub || typeof sub !== "object") return null;
  const endpoint = String(sub.endpoint || "");
  const keys = sub.keys || {};
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !keys.p256dh || !keys.auth) return null;
  return { endpoint, keys: { p256dh: String(keys.p256dh).slice(0, 200), auth: String(keys.auth).slice(0, 100) } };
}
async function push(store, keys, row, message) {
  const payload = JSON.stringify({ title: message.title, body: message.body, tag: message.tag, url: "/film/" });
  const options = { TTL: 6 * 3600, urgency: "normal", vapidDetails: { subject: "https://imperiumdetailing.com.au", publicKey: keys.publicKey, privateKey: keys.privateKey } };
  try {
    await sendPush(row.sub, payload, options);
    return true;
  } catch (e) {
    // The phone turned reminders off, or the app was deleted: forget it.
    if (e && (e.statusCode === 404 || e.statusCode === 410)) await store.del(C.push, row.id);
    return false;
  }
}

// What to send now. The morning one goes once a day from 7am; a "time to post" one goes once,
// in the hour before something scheduled goes up.
export function remindersToSend(ideas, people, nowLocal, sentKeys) {
  const day = nowLocal.slice(0, 10);
  const hour = +nowLocal.slice(11, 13);
  const out = [];
  if (hour >= 7 && hour < 21) {
    for (const person of people) {
      const key = `today:${person}:${day}`;
      if (sentKeys.has(key)) continue;
      const list = Film.remindersFor(ideas, person, nowLocal);
      if (!list.length) continue;
      out.push({ key, to: person, title: list.length === 1 ? "1 thing to do today" : `${list.length} things to do today`, body: Film.digestText(list), tag: "today" });
    }
  }
  for (const x of ideas) {
    if (x.stage !== "scheduled" || !x.postAt) continue;
    const mins = Film.minutesBetween(nowLocal, x.postAt);
    const key = `post:${x.id}:${x.postAt}`;
    if (mins > 70 || mins < -30 || sentKeys.has(key)) continue;
    const to = x.who || Film.OWNER;
    if (!people.includes(to)) continue;
    out.push({ key, to, title: "Time to post", body: `${x.title} goes up at ${Film.timeLabel(x.postAt)}.`, tag: "post-" + x.id });
  }
  return out;
}

export async function sendReminders(store, now) {
  const subs = await store.all(C.push);
  if (!subs.length) return { ok: true, sent: 0, note: "No phones have reminders on yet" };
  const nowLocal = Film.localNow(now);
  const [ideas, log, keys] = await Promise.all([store.all(C.ideas), store.get(C.system, "pushlog"), vapid(store)]);
  // Keep two days of what was sent, so a reminder near midnight isn't sent twice.
  const yesterday = Film.addDays(nowLocal.slice(0, 10), -1);
  const dayOf = (k) => (k.match(/\d{4}-\d{2}-\d{2}/g) || []).pop() || "";
  const kept = ((log && log.keys) || []).filter((k) => dayOf(k) >= yesterday);
  const sentKeys = new Set(kept);
  const people = [...new Set(subs.map((s) => s.who).filter(Boolean))];
  const messages = remindersToSend(ideas, people, nowLocal, sentKeys);
  let sent = 0;
  for (const m of messages) {
    for (const row of subs.filter((s) => s.who === m.to)) if (await push(store, keys, row, m)) sent++;
    sentKeys.add(m.key);
  }
  await store.put(C.system, "pushlog", { keys: [...sentKeys], at: now.toISOString() });
  return { ok: true, sent, reminders: messages.map((m) => ({ to: m.to, title: m.title, body: m.body })) };
}

/* ------------------------------------------------------------ the endpoint */

export async function POST(request) {
  let body;
  try {
    body = await readBody(request);
  } catch {
    return fail("Send JSON");
  }
  const store = filmStore();
  const action = String(body.action || "");
  const who = Film.cleanPerson(body.who) || Film.OWNER;
  try {
    switch (action) {
      case "list":
        return json({ ok: true, ...(await list(store)) });
      case "saveIdea":
        return await saveIdea(store, body, who);
      case "deleteIdea":
        await store.del(C.ideas, String(body.id || ""));
        return json({ ok: true });
      case "move":
        return await moveIdea(store, body, who);
      case "inbox":
        return await fromShortcut(store, body, who);
      case "import": {
        const existing = await store.all(C.ideas);
        const r = Film.importIdeas(body.data, existing, { id: () => randomUUID(), now: nowIso(), by: who });
        if (r.ideas.length) await store.putMany(C.ideas, r.ideas);
        return json({ ok: true, added: r.ideas.length, skipped: r.skipped, bad: r.bad });
      }
      case "pushKey":
        return json({ ok: true, key: (await vapid(store)).publicKey });
      case "pushSubscribe": {
        const sub = cleanSub(body.sub);
        if (!sub) return fail("That phone can't take reminders");
        const person = Film.cleanPerson(body.who);
        if (!person) return fail("Pick your name first");
        await store.put(C.push, subId(sub.endpoint), { who: person, sub, at: nowIso() });
        return json({ ok: true });
      }
      case "pushUnsubscribe":
        await store.del(C.push, subId(body.endpoint));
        return json({ ok: true });
      case "pushTest": {
        const row = await store.get(C.push, subId(body.endpoint));
        if (!row) return fail("Reminders aren't on for this phone", 404);
        const list = Film.remindersFor((await store.all(C.ideas)), row.who, Film.localNow(new Date()));
        const ok = await push(store, await vapid(store), { ...row, id: subId(body.endpoint) }, {
          title: "Reminders are on",
          body: list.length ? "Today: " + Film.digestText(list, 3) : `You'll get one each morning at 7, ${row.who}, and one before anything goes up.`,
          tag: "test",
        });
        return ok ? json({ ok: true }) : fail("The phone didn't take it. Turn reminders off and on again.", 502);
      }
      default:
        return fail("Unknown action");
    }
  } catch (e) {
    // The model's own checks ("An idea needs a title") are someone's to fix; anything else is ours.
    const theirs = /needs a title|isn't a link|no list of ideas|Pick when/.test((e && e.message) || "");
    return fail(theirs ? e.message : "Something went wrong on our side", theirs ? 400 : 500);
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const fromCron = /^vercel-cron/i.test(request.headers.get("user-agent") || "");
  const action = url.searchParams.get("action") || (fromCron ? "remind" : "");
  if (action === "ping") return json({ ok: true, ready: true });
  const store = filmStore();
  if (action === "remind") {
    // When CRON_SECRET is set in Vercel, only Vercel's run gets in. Without it, it's still safe:
    // nothing is sent twice.
    const secret = process.env.CRON_SECRET;
    const given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (secret && !sameSecret(given, secret)) return fail("Not allowed", 401);
    return json(await sendReminders(store, new Date()));
  }
  if (action === "today") {
    const ideas = await store.all(C.ideas);
    const nowLocal = Film.localNow(new Date());
    const one = Film.cleanPerson(url.searchParams.get("who"));
    const lines = (one ? [one] : Film.PEOPLE).map((p) => {
      const list = Film.remindersFor(ideas, p, nowLocal);
      return list.length ? `${p}: ${Film.digestText(list)}` : one ? `${p}: nothing to do today.` : "";
    }).filter(Boolean);
    return new Response(lines.join("\n") || "Nothing to do today.", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  return fail("Unknown action");
}
