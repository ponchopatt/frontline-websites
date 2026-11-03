/*
  Imperium Film List: the plain rules (no page, no database), shared by the page, the server
  (lib/film.js) and the tests. The page loads it as window.FilmModel.

  Two kinds of document:
    inspo  a saved reel: { url, platform, note, meta, createdAt, createdBy, ideaIds }
           meta is TikTok's own preview ({ thumb, title, author }) or null. Instagram reels are
           a link only: nothing about them is ever fetched or stored.
    idea   something to film: { title, type, tags, hook, steps, caption, people, length, link,
           platform, inspoId, assignee, due, stage, history, views, postedDay, source,
           createdAt, createdBy, updatedAt }
  An idea's stage is one of IDEA_STAGES. "Inspo" is the stage before them: the inbox itself.
*/
(function (root) {
  "use strict";

  var TYPES = [
    "POV Detail", "Come Detail With Us", "Reactions", "Day in the Life", "Funny Moments",
    "Trend Flip", "Asked & Answered", "Team Talks", "Teach Detailers", "Teach Customers",
    "Satisfying", "Tag a Bro", "Membership",
  ];
  var STAGES = [
    { id: "inspo", label: "Inspo" },
    { id: "tofilm", label: "To film" },
    { id: "filmed", label: "Filmed" },
    { id: "edited", label: "Edited" },
    { id: "posted", label: "Posted" },
  ];
  var IDEA_STAGES = ["tofilm", "filmed", "edited", "posted"];
  var CREW = ["Ant", "Lucas", "Nick", "AJ"];
  var OWNER = "Pat";
  var PEOPLE = CREW.concat([OWNER]);
  var DEFAULT_TARGET = 14;

  function str(v, max) {
    var s = v == null ? "" : String(v).replace(/\r\n?/g, "\n").trim();
    return max && s.length > max ? s.slice(0, max) : s;
  }
  function stageLabel(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return STAGES[i].label;
    return id;
  }

  /* ------------------------------------------------------------ links */

  // "https://www.instagram.com/reel/ABC/?igsh=…" -> its plain form. null if it isn't a web link.
  function normaliseUrl(input) {
    var s = str(input);
    var m = /https?:\/\/[^\s<>"']+/i.exec(s);
    if (m) s = m[0];
    else if (/^(www\.|vm\.|vt\.)?(instagram|tiktok)\.com\//i.test(s)) s = "https://" + s;
    else return null;
    var u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    var host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "instagram.com" || host.slice(-14) === ".instagram.com") {
      var ig = /^\/(?:[\w.]+\/)?(reel|reels|p|tv)\/([\w-]+)/.exec(u.pathname);
      if (ig) return "https://www.instagram.com/" + (ig[1] === "reels" ? "reel" : ig[1]) + "/" + ig[2] + "/";
      return "https://www.instagram.com" + u.pathname;
    }
    if (host === "tiktok.com" || host.slice(-11) === ".tiktok.com") {
      return "https://" + (host === "tiktok.com" ? "www.tiktok.com" : u.hostname.toLowerCase()) + u.pathname.replace(/\/+$/, "");
    }
    return u.origin + u.pathname + u.search;
  }
  function platformOf(url) {
    var u;
    try { u = new URL(url); } catch (e) { return null; }
    var host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "instagram.com" || host.slice(-14) === ".instagram.com") return "instagram";
    if (host === "tiktok.com" || host.slice(-11) === ".tiktok.com") return "tiktok";
    return "other";
  }
  // vm.tiktok.com/…, vt.tiktok.com/… and tiktok.com/t/… are short links TikTok redirects.
  function isShortTikTok(url) {
    return /^https:\/\/(vm|vt)\.tiktok\.com\//i.test(url) || /^https:\/\/www\.tiktok\.com\/t\//i.test(url);
  }
  // "@imperiumdetailing" from a full TikTok link, "" otherwise.
  function tiktokHandle(url) {
    var m = /tiktok\.com\/(@[\w.]+)/i.exec(url || "");
    return m ? m[1] : "";
  }
  // TikTok's own preview, kept short. Anything else is dropped.
  function cleanMeta(meta) {
    if (!meta || typeof meta !== "object") return null;
    var thumb = str(meta.thumb || meta.thumbnail_url, 2000);
    var out = { thumb: /^https:\/\//i.test(thumb) ? thumb : "", title: str(meta.title, 600), author: str(meta.author || meta.author_name, 120) };
    return out.thumb || out.title || out.author ? out : null;
  }

  /* ------------------------------------------------------------ text fields */

  // One step per line, without the "1." or "-" people type in front.
  function splitLines(v) {
    var list = Array.isArray(v) ? v : str(v).split("\n");
    return list.map(function (x) { return str(x, 300).replace(/^(\d+[.)]|[-*•])\s*/, ""); }).filter(Boolean).slice(0, 30);
  }
  function splitTags(v) {
    var list = Array.isArray(v) ? v : str(v).split(/[,\n#]/);
    var seen = {}, out = [];
    list.forEach(function (t) {
      var s = str(t, 40).replace(/\s+/g, " ");
      var k = s.toLowerCase();
      if (s && !seen[k]) { seen[k] = 1; out.push(s); }
    });
    return out.slice(0, 12);
  }
  // "pov detail", "POV" or "POV Detail" -> "POV Detail". "" if it's not one of ours.
  function matchType(v) {
    var k = str(v).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!k) return "";
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].toLowerCase().replace(/[^a-z0-9]/g, "") === k) return TYPES[i];
    for (i = 0; i < TYPES.length; i++) if (TYPES[i].toLowerCase().replace(/[^a-z0-9]/g, "").indexOf(k) === 0) return TYPES[i];
    return "";
  }
  function cleanPeople(v) {
    var n = parseInt(v, 10);
    return isFinite(n) && n >= 1 && n <= 10 ? n : null;
  }
  // "15-20s", 18, "20 sec" -> the first number, for sorting. null if there's none.
  function lengthSeconds(v) {
    var m = /\d+/.exec(str(v));
    return m ? +m[0] : null;
  }
  function cleanDay(v) {
    var s = str(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  function cleanPerson(v) {
    var s = str(v);
    for (var i = 0; i < PEOPLE.length; i++) if (PEOPLE[i].toLowerCase() === s.toLowerCase()) return PEOPLE[i];
    return null;
  }

  // The fields the owner fills in, checked. title is the only one that must be there.
  function cleanFields(f) {
    f = f || {};
    var out = {
      title: str(f.title, 120),
      type: matchType(f.type),
      tags: splitTags(f.tags),
      hook: str(f.hook, 500),
      steps: splitLines(f.steps),
      caption: str(f.caption, 2200),
      people: cleanPeople(f.people),
      length: str(f.length, 30),
      link: f.link ? normaliseUrl(f.link) || "" : "",
    };
    out.platform = out.link ? platformOf(out.link) : null;
    if ("assignee" in f) out.assignee = cleanPerson(f.assignee);
    if ("due" in f) out.due = cleanDay(f.due);
    return out;
  }

  function newIdea(fields, o) {
    o = o || {};
    var f = cleanFields(fields);
    if (!f.title) throw new Error("An idea needs a title");
    var idea = {
      id: o.id, title: f.title, type: f.type, tags: f.tags, hook: f.hook, steps: f.steps,
      caption: f.caption, people: f.people, length: f.length, link: f.link, platform: f.platform,
      inspoId: o.inspoId || null, assignee: f.assignee || null, due: f.due || null,
      stage: "tofilm", history: [], views: null, postedDay: null, source: o.source || "manual",
      createdAt: o.now, createdBy: o.by || null, updatedAt: o.now,
    };
    return idea;
  }
  // The same idea with the owner's edits. Its stage, history and views stay as they are.
  function editIdea(idea, fields, now) {
    var f = cleanFields(Object.assign({}, idea, fields));
    if (!f.title) throw new Error("An idea needs a title");
    return Object.assign({}, idea, f, { updatedAt: now });
  }

  function newInspo(o) {
    var url = normaliseUrl(o.url);
    if (!url) throw new Error("That isn't a link");
    var platform = platformOf(url);
    return {
      id: o.id, url: url, platform: platform, note: str(o.note, 500),
      // Instagram: the link only, never anything about the reel.
      meta: platform === "tiktok" ? cleanMeta(o.meta) : null,
      createdAt: o.now, createdBy: o.by || null, ideaIds: [],
    };
  }

  /* ------------------------------------------------------------ stages */

  // The idea one stage on (dir 1) or back (dir -1), or null when it's at the end already.
  // today is the day it happens ("2026-11-04"), kept on a posted idea for the weekly count.
  function move(idea, dir, by, now, today) {
    var i = IDEA_STAGES.indexOf(idea.stage);
    var j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= IDEA_STAGES.length) return null;
    var to = IDEA_STAGES[j];
    var next = Object.assign({}, idea, {
      stage: to,
      history: (idea.history || []).concat([{ from: idea.stage, to: to, by: by || null, at: now }]).slice(-50),
      updatedAt: now,
    });
    if (to === "posted") next.postedDay = today || null;
    else if (idea.stage === "posted") next.postedDay = null;
    return next;
  }
  function nextLabel(idea) {
    var i = IDEA_STAGES.indexOf(idea.stage);
    return i >= 0 && i < IDEA_STAGES.length - 1 ? stageLabel(IDEA_STAGES[i + 1]) : null;
  }

  /* ------------------------------------------------------------ today */

  // "Biggest first": the shoots that need the most people, then the longest, then the most
  // steps, so the big setups are done while everyone's there.
  function biggestFirst(a, b) {
    return (b.people || 1) - (a.people || 1) ||
      (lengthSeconds(b.length) || 0) - (lengthSeconds(a.length) || 0) ||
      (b.steps || []).length - (a.steps || []).length ||
      String(a.due || "").localeCompare(String(b.due || "")) ||
      String(a.title).localeCompare(String(b.title));
  }
  // What someone films today: their "To film" ideas due today or before.
  function todayFor(ideas, person, today) {
    return (ideas || []).filter(function (x) {
      return x.stage === "tofilm" && x.assignee === person && x.due && x.due <= today;
    }).sort(biggestFirst);
  }
  // Theirs that are due later, or have no date yet, soonest first.
  function upcomingFor(ideas, person, today) {
    return (ideas || []).filter(function (x) {
      return x.stage === "tofilm" && x.assignee === person && (!x.due || x.due > today);
    }).sort(function (a, b) {
      return (a.due ? 0 : 1) - (b.due ? 0 : 1) || String(a.due || "").localeCompare(String(b.due || "")) || biggestFirst(a, b);
    });
  }
  function daysBetween(a, b) {
    return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
  }
  // "Due today", "1 day late", "Due Fri 7 Nov".
  function dueLabel(due, today) {
    if (!due) return "No date";
    var d = daysBetween(due, today);
    if (d === 0) return "Due today";
    if (d > 0) return d + (d === 1 ? " day late" : " days late");
    if (d === -1) return "Due tomorrow";
    var dt = new Date(due + "T00:00:00Z");
    return "Due " + dt.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  }

  // "Ant, 2 videos today: Mat slap, POV wheels." One line for each person with something due,
  // or just theirs when who is given.
  function reminderText(ideas, today, who) {
    var people = who ? [cleanPerson(who)].filter(Boolean) : PEOPLE;
    var lines = [];
    people.forEach(function (p) {
      var list = todayFor(ideas, p, today);
      if (list.length) lines.push(p + ", " + list.length + (list.length === 1 ? " video" : " videos") + " today: " + list.map(function (x) { return x.title; }).join(", ") + ".");
      else if (who) lines.push(p + ", nothing to film today.");
    });
    return lines.length ? lines.join("\n") : "No videos due today.";
  }

  /* ------------------------------------------------------------ the numbers */

  // Monday to Sunday around today.
  function weekOf(today) {
    var d = new Date(today + "T00:00:00Z");
    var back = (d.getUTCDay() + 6) % 7;
    var mon = new Date(d.getTime() - back * 86400000);
    var sun = new Date(mon.getTime() + 6 * 86400000);
    return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
  }
  function postedThisWeek(ideas, today) {
    var w = weekOf(today);
    return (ideas || []).filter(function (x) { return x.stage === "posted" && x.postedDay && x.postedDay >= w.from && x.postedDay <= w.to; }).length;
  }
  // For each type with posted videos: how many, how many with views, and their average views.
  function statsByType(ideas) {
    var by = {};
    (ideas || []).forEach(function (x) {
      if (x.stage !== "posted") return;
      var t = x.type || "No type";
      var s = by[t] || (by[t] = { type: t, posted: 0, withViews: 0, total: 0, avgViews: null });
      s.posted++;
      if (typeof x.views === "number" && x.views >= 0) { s.withViews++; s.total += x.views; }
    });
    return Object.keys(by).map(function (k) {
      var s = by[k];
      s.avgViews = s.withViews ? Math.round(s.total / s.withViews) : null;
      return s;
    }).sort(function (a, b) { return (b.avgViews == null ? -1 : b.avgViews) - (a.avgViews == null ? -1 : a.avgViews) || b.posted - a.posted; });
  }
  function countByStage(ideas, inspo) {
    var out = { inspo: (inspo || []).length };
    IDEA_STAGES.forEach(function (s) { out[s] = 0; });
    (ideas || []).forEach(function (x) { if (out[x.stage] != null) out[x.stage]++; });
    return out;
  }

  /* ------------------------------------------------------------ import */

  // The starting ideas, from imperium_film_ideas.json: an array of ideas, or { ideas: [...] },
  // or any object holding one. Field names are matched loosely (title/name/idea, steps/shots,
  // people/people_needed, length/duration…). All land in "To film", unassigned. An idea whose
  // title is already on the list is skipped.
  function ideasFrom(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      if (Array.isArray(data.ideas)) return data.ideas;
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) if (Array.isArray(data[keys[i]])) return data[keys[i]];
    }
    return null;
  }
  function pick(o, names) {
    for (var i = 0; i < names.length; i++) if (o[names[i]] != null && o[names[i]] !== "") return o[names[i]];
    return null;
  }
  function importIdeas(data, existing, o) {
    var list = ideasFrom(data);
    if (!list) throw new Error("That file has no list of ideas in it");
    var seen = {};
    (existing || []).forEach(function (x) { seen[str(x.title).toLowerCase()] = 1; });
    var out = [], skipped = 0, bad = 0;
    list.forEach(function (raw, n) {
      if (typeof raw === "string") raw = { title: raw };
      if (!raw || typeof raw !== "object") { bad++; return; }
      var title = str(pick(raw, ["title", "name", "idea", "concept", "video"]), 120);
      if (!title) { bad++; return; }
      if (seen[title.toLowerCase()]) { skipped++; return; }
      seen[title.toLowerCase()] = 1;
      var tags = splitTags(pick(raw, ["tags", "tag", "labels"]) || []);
      var typeRaw = pick(raw, ["type", "category", "format", "series"]);
      var type = matchType(typeRaw);
      // A type that isn't one of ours is kept as a tag rather than lost.
      if (typeRaw && !type) tags = splitTags(tags.concat([str(typeRaw, 40)]));
      var notes = str(pick(raw, ["notes", "note", "why"]), 500);
      var steps = splitLines(pick(raw, ["steps", "shots", "shot_list", "shotList", "shot list", "script", "beats"]) || []);
      if (notes) steps = steps.concat(["Note: " + notes]).slice(0, 30);
      out.push(newIdea({
        title: title, type: type, tags: tags,
        hook: pick(raw, ["hook", "opening", "hook_idea"]),
        steps: steps,
        caption: pick(raw, ["caption", "captions", "copy"]),
        people: pick(raw, ["people", "people_needed", "peopleNeeded", "crew", "cast"]),
        length: pick(raw, ["length", "duration", "seconds", "time"]),
        link: pick(raw, ["link", "url", "reference", "inspo", "example"]),
      }, { id: o.id(n), now: o.now, by: o.by, source: "import" }));
    });
    return { ideas: out, skipped: skipped, bad: bad };
  }

  /* ------------------------------------------------------------ days */

  // "2026-11-04" in Canberra (or the zone given), whatever the computer's clock zone is.
  function dayIn(date, tz) {
    var parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz || "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date || new Date());
    var get = function (t) { return parts.filter(function (p) { return p.type === t; })[0].value; };
    return get("year") + "-" + get("month") + "-" + get("day");
  }
  function addDays(day, n) {
    return new Date(Date.parse(day + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  }

  var api = {
    TYPES: TYPES, STAGES: STAGES, IDEA_STAGES: IDEA_STAGES, CREW: CREW, OWNER: OWNER, PEOPLE: PEOPLE, DEFAULT_TARGET: DEFAULT_TARGET,
    stageLabel: stageLabel, normaliseUrl: normaliseUrl, platformOf: platformOf, isShortTikTok: isShortTikTok, tiktokHandle: tiktokHandle, cleanMeta: cleanMeta,
    splitLines: splitLines, splitTags: splitTags, matchType: matchType, lengthSeconds: lengthSeconds, cleanPerson: cleanPerson, cleanDay: cleanDay,
    cleanFields: cleanFields, newIdea: newIdea, editIdea: editIdea, newInspo: newInspo,
    move: move, nextLabel: nextLabel, todayFor: todayFor, upcomingFor: upcomingFor, dueLabel: dueLabel, reminderText: reminderText,
    weekOf: weekOf, postedThisWeek: postedThisWeek, statsByType: statsByType, countByStage: countByStage,
    importIdeas: importIdeas, dayIn: dayIn, addDays: addDays, daysBetween: daysBetween,
  };
  root.FilmModel = api;
})(typeof window !== "undefined" ? window : globalThis);
