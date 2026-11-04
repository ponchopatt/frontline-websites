/*
  Imperium Film List: the plain rules (no page, no database), shared by the page, the server
  (lib/film-store.js) and the tests. The page loads it as window.FilmModel.

  One kind of document, an idea:
    { title, notes, caption, link, who, when, postAt, stage, stageAt, history, postedDay,
      createdAt, createdBy, updatedAt }
  It moves through STAGES, one tick at a time: Ideas -> Filmed -> Edited -> Scheduled -> Posted.
    who     who does the next step (blank = Pat, the owner)
    when    the day the next step is due by ("2026-11-06"), or blank
    postAt  the Canberra time it goes up ("2026-11-06T18:00"), set when it's scheduled
    stageAt when it got to the stage it's in, so the app can nag about it
*/
(function (root) {
  "use strict";

  var STAGES = [
    { id: "tofilm", label: "Ideas", next: "Filmed it", step: "Film", by: "Film by", empty: "Write down an idea above. Tick it once it's filmed." },
    { id: "filmed", label: "Filmed", next: "Edited", step: "Edit", by: "Edit by", empty: "Nothing waiting to be edited." },
    { id: "edited", label: "Edited", next: "Schedule it", step: "Schedule", by: "Schedule by", empty: "Nothing waiting to be scheduled." },
    { id: "scheduled", label: "Scheduled", next: "Posted", step: "Post", by: "Post on", empty: "Nothing scheduled yet." },
    { id: "posted", label: "Posted", next: null, step: null, by: null, empty: "Nothing posted yet." },
  ];
  var IDS = STAGES.map(function (s) { return s.id; });
  var CREW = ["Ant", "Lucas", "Nick", "AJ"];
  var OWNER = "Pat";
  var PEOPLE = CREW.concat([OWNER]);
  var TZ = "Australia/Sydney"; // Canberra's time

  function str(v, max) {
    var s = v == null ? "" : String(v).replace(/\r\n?/g, "\n").trim();
    return max && s.length > max ? s.slice(0, max) : s;
  }
  function stage(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return STAGES[i];
    return STAGES[0];
  }
  function stageLabel(id) { return stage(id).label; }

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

  /* ------------------------------------------------------------ days and times */

  // "2026-11-04" for a moment, in Canberra.
  function dayIn(date, tz) {
    var parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz || TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date || new Date());
    var get = function (t) { return parts.filter(function (p) { return p.type === t; })[0].value; };
    return get("year") + "-" + get("month") + "-" + get("day");
  }
  // "2026-11-04T07:30" for a moment, in Canberra.
  function localNow(date, tz) {
    var parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz || TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date || new Date());
    var get = function (t) { return parts.filter(function (p) { return p.type === t; })[0].value; };
    return dayIn(date, tz) + "T" + get("hour") + ":" + get("minute");
  }
  function addDays(day, n) {
    return new Date(Date.parse(day + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  }
  function daysBetween(a, b) {
    return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
  }
  // Minutes from one Canberra time ("…T07:30") to another.
  function minutesBetween(a, b) {
    return Math.round((Date.parse(b + ":00Z") - Date.parse(a + ":00Z")) / 60000);
  }
  function cleanDay(v) {
    var s = str(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z")) ? s : null;
  }
  function cleanTime(v) {
    var m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(str(v));
    return m && cleanDay(m[1]) && +m[2] < 24 && +m[3] < 60 ? m[1] + "T" + m[2] + ":" + m[3] : null;
  }
  function cleanPerson(v) {
    var s = str(v);
    for (var i = 0; i < PEOPLE.length; i++) if (PEOPLE[i].toLowerCase() === s.toLowerCase()) return PEOPLE[i];
    return null;
  }
  // "Today", "Tomorrow", "Yesterday", "Fri 7 Nov".
  function dayLabel(day, today) {
    var d = daysBetween(today, day);
    if (d === 0) return "Today";
    if (d === 1) return "Tomorrow";
    if (d === -1) return "Yesterday";
    return new Date(day + "T00:00:00Z").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  }
  // "6pm", "6:30pm".
  function timeLabel(t) {
    var h = +t.slice(11, 13), m = t.slice(14, 16);
    return (h % 12 || 12) + (m === "00" ? "" : ":" + m) + (h < 12 ? "am" : "pm");
  }

  /* ------------------------------------------------------------ ideas */

  // The fields anyone fills in, checked. The title is the only one that must be there.
  function cleanFields(f) {
    f = f || {};
    var out = { title: str(f.title, 140), notes: str(f.notes, 4000), caption: str(f.caption, 2200), link: f.link ? normaliseUrl(f.link) || "" : "" };
    if ("who" in f) out.who = cleanPerson(f.who);
    if ("when" in f) out.when = cleanDay(f.when);
    if ("postAt" in f) out.postAt = cleanTime(f.postAt);
    return out;
  }
  function newIdea(fields, o) {
    o = o || {};
    var f = cleanFields(fields);
    if (!f.title) throw new Error("An idea needs a title");
    return {
      id: o.id, title: f.title, notes: f.notes, caption: f.caption, link: f.link,
      who: f.who || null, when: f.when || null, postAt: null,
      stage: "tofilm", stageAt: o.now, history: [], postedDay: null, source: o.source || "app",
      createdAt: o.now, createdBy: o.by || null, updatedAt: o.now,
    };
  }
  // The same idea with someone's edits. Its stage and history stay as they are.
  function editIdea(idea, fields, now) {
    var f = cleanFields(Object.assign({}, idea, fields));
    if (!f.title) throw new Error("An idea needs a title");
    var next = Object.assign({}, idea, f, { updatedAt: now });
    if (idea.stage !== "scheduled" && idea.stage !== "posted") next.postAt = idea.postAt || null;
    return next;
  }

  // One stage on (dir 1) or back (dir -1), or null at the end. who and when were for the step
  // just done, so they're cleared; moving into Scheduled needs the time it goes up.
  function move(idea, dir, o) {
    o = o || {};
    var i = IDS.indexOf(idea.stage);
    var j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= IDS.length) return null;
    var to = IDS[j];
    var postAt = idea.postAt || null;
    if (to === "scheduled" && dir > 0) {
      postAt = cleanTime(o.postAt);
      if (!postAt) throw new Error("Pick when it goes up");
    }
    if (j < IDS.indexOf("scheduled")) postAt = null;
    var next = Object.assign({}, idea, {
      stage: to, stageAt: o.now, who: null, when: null, postAt: postAt,
      history: (idea.history || []).concat([{ from: idea.stage, to: to, by: o.by || null, at: o.now }]).slice(-50),
      updatedAt: o.now,
    });
    if (to === "scheduled" && postAt) next.when = postAt.slice(0, 10);
    next.postedDay = to === "posted" ? o.today || null : null;
    // Going back puts the old who and when back, so an Undo really undoes.
    if (dir < 0 && idea.history && idea.history.length) {
      var prev = idea.history[idea.history.length - 1];
      if (prev && prev.to === idea.stage && prev.from === to && prev.who !== undefined) { next.who = prev.who; next.when = prev.when; }
    } else {
      next.history[next.history.length - 1].who = idea.who || null;
      next.history[next.history.length - 1].when = idea.when || null;
    }
    return next;
  }

  /* ------------------------------------------------------------ reminders */

  // What someone has to do today, from every list: due today or late, plus anything filmed or
  // edited that's been sitting a day or more. Blank "who" means it's the owner's.
  function remindersFor(ideas, person, nowLocal) {
    var today = nowLocal.slice(0, 10);
    var out = [];
    (ideas || []).forEach(function (x) {
      var mine = x.who ? x.who === person : person === OWNER;
      if (!mine || x.stage === "posted") return;
      var st = stage(x.stage);
      var sitting = x.stageAt ? daysBetween(dayIn(new Date(x.stageAt)), today) : 0;
      var due = x.when && x.when <= today;
      if (x.stage === "scheduled") {
        if (!x.postAt || x.postAt.slice(0, 10) > today) return;
        var late = x.postAt.slice(0, 10) < today || minutesBetween(x.postAt, nowLocal) > 60;
        out.push({ id: x.id, kind: "post", title: x.title, at: x.postAt, late: late,
          text: (late ? "Post (late): " : "Post at " + timeLabel(x.postAt) + ": ") + x.title });
        return;
      }
      if (x.stage === "tofilm" ? due : due || (!x.when && sitting >= 1)) {
        out.push({ id: x.id, kind: st.step.toLowerCase(), title: x.title, late: !!(x.when && x.when < today), text: st.step + ": " + x.title });
      }
    });
    var order = { post: 0, film: 1, edit: 2, schedule: 3 };
    return out.sort(function (a, b) { return order[a.kind] - order[b.kind] || String(a.at || "").localeCompare(String(b.at || "")) || a.title.localeCompare(b.title); });
  }
  // "Film: Mat slap. Edit: POV wheels. Post at 6pm: Dog hair." Long lists end "and 3 more."
  function digestText(list, max) {
    max = max || 4;
    if (!list.length) return "";
    var shown = list.slice(0, max).map(function (r) { return r.text; });
    return shown.join(". ") + (list.length > max ? ". And " + (list.length - max) + " more." : ".");
  }

  /* ------------------------------------------------------------ import */

  function pick(o, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (o[k] != null && o[k] !== "") return o[k];
      var lower = Object.keys(o).filter(function (x) { return x.toLowerCase() === k.toLowerCase(); })[0];
      if (lower && o[lower] != null && o[lower] !== "") return o[lower];
    }
    return null;
  }
  function ideasFrom(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return null;
    var keys = ["ideas", "film_ideas", "videos", "items", "list", "data"];
    for (var i = 0; i < keys.length; i++) if (Array.isArray(data[keys[i]])) return data[keys[i]];
    var arrays = Object.keys(data).filter(function (k) { return Array.isArray(data[k]); });
    return arrays.length ? data[arrays[0]] : null;
  }
  // A list of ideas from imperium_film_ideas.json (or anything shaped close to it). Hooks, shots,
  // types and the rest go into the notes, so nothing in the file is lost.
  function importIdeas(data, existing, o) {
    var list = ideasFrom(data);
    if (!list) throw new Error("That file has no list of ideas in it");
    var seen = {};
    (existing || []).forEach(function (x) { seen[str(x.title).toLowerCase()] = 1; });
    var out = [], skipped = 0, bad = 0;
    list.forEach(function (raw, n) {
      if (typeof raw === "string") raw = { title: raw };
      if (!raw || typeof raw !== "object") { bad++; return; }
      var title = str(pick(raw, ["title", "name", "idea", "concept", "video"]), 140);
      if (!title) { bad++; return; }
      if (seen[title.toLowerCase()]) { skipped++; return; }
      seen[title.toLowerCase()] = 1;
      var lines = [];
      var add = function (label, v) {
        if (v == null || v === "") return;
        if (Array.isArray(v)) v = v.map(function (s, i) { return (i + 1) + ". " + str(s); }).join("\n");
        lines.push(label ? label + ": " + str(v) : str(v));
      };
      add("Type", pick(raw, ["type", "category", "format", "series"]));
      add("Hook", pick(raw, ["hook", "opening", "hook_idea"]));
      var shots = pick(raw, ["steps", "shots", "shot_list", "shotList", "script", "beats"]);
      if (shots) lines.push("Shots:\n" + (Array.isArray(shots) ? shots.map(function (s, i) { return (i + 1) + ". " + str(s); }).join("\n") : str(shots)));
      add("People", pick(raw, ["people", "people_needed", "peopleNeeded", "crew", "cast"]));
      add("Length", pick(raw, ["length", "duration", "seconds", "time"]));
      var tags = pick(raw, ["tags", "tag", "labels"]);
      add("Tags", Array.isArray(tags) ? tags.join(", ") : tags);
      add("", pick(raw, ["notes", "note", "why", "description"]));
      out.push(newIdea({
        title: title, notes: lines.join("\n"),
        caption: pick(raw, ["caption", "captions", "copy"]),
        link: pick(raw, ["link", "url", "reference", "inspo", "example"]),
      }, { id: o.id(n), now: o.now, by: o.by, source: "import" }));
    });
    return { ideas: out, skipped: skipped, bad: bad };
  }

  function countByStage(ideas) {
    var out = {};
    IDS.forEach(function (id) { out[id] = 0; });
    (ideas || []).forEach(function (x) { if (x.stage in out) out[x.stage]++; });
    return out;
  }

  root.FilmModel = {
    STAGES: STAGES, IDS: IDS, CREW: CREW, OWNER: OWNER, PEOPLE: PEOPLE, TZ: TZ,
    stage: stage, stageLabel: stageLabel, normaliseUrl: normaliseUrl, platformOf: platformOf,
    dayIn: dayIn, localNow: localNow, addDays: addDays, daysBetween: daysBetween, minutesBetween: minutesBetween,
    cleanDay: cleanDay, cleanTime: cleanTime, cleanPerson: cleanPerson, dayLabel: dayLabel, timeLabel: timeLabel,
    cleanFields: cleanFields, newIdea: newIdea, editIdea: editIdea, move: move,
    remindersFor: remindersFor, digestText: digestText, importIdeas: importIdeas, countByStage: countByStage,
  };
})(typeof window !== "undefined" ? window : globalThis);
