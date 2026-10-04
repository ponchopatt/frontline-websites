/*
  The lead model: stages, call hours, the follow-up schedule, Today's lists and the upgrade of
  older leads. Plain logic only (no page, no database), so the page, the server and the tests
  share it. The page loads it as window.ILModel; the server imports it through lib/model.js.

  A lead's follow-up fields (nothing older is removed; status, nextFollowUp, quoted, log and the
  rest keep their meaning, and status is kept in step with stage):

    stage        New, Chasing, Quoted, Booked, Done, Review asked, or a side bin: Waiting, Lost
    schedule     full (day 0, 1, 3, 7), browsing (day 0, 3) or quoted (day 2, 5, 9 after the quote)
    chaseFrom    the day the schedule counts from (the first touch, or the quote)
    touches      touches done in this run of the schedule (a day with any call or text is one)
    lastTouchOn  the day of the last touch
    quotedOn     the day the quote was given
    nextFollowUp the day it's next due (a Waiting lead's next monthly check-in)
    snoozeUntil  "Not now": off Today until this day
    paused       a note was added, so the schedule waits for you to pick the next step
    timeline     asap, within_1_2_weeks, just_browsing, or "" when we don't know
    score        Hot, Warm or Browsing; scoreBy says who set it (timeline or human)
    lostReason   price, timing, went_elsewhere, no_reply or other (Lost only)
    junk         "Not real": a test or fake lead, kept out of Today and the Numbers
    email, formId           from the form, shown only when the lead is opened
    enquiries, againAt      the same person enquiring again (merged into this lead)
    repeatOf     a new lead from someone who's been a lead before: that lead's id
    modelVersion 3 once a lead has these fields; v3Was keeps what the upgrade changed
*/
(function (root) {
  "use strict";

  var VERSION = 3;
  var STAGES = ["New", "Chasing", "Quoted", "Booked", "Done", "Review asked"];
  var BINS = ["Waiting", "Lost"];
  var ALL_STAGES = STAGES.concat(BINS);
  var BOOKED = ["Booked", "Done", "Review asked"];
  var PEOPLE = ["Angus", "Ananth"];
  var TAGS = ["Hot", "Warm", "Browsing"];
  var TIMELINES = { asap: "ASAP", within_1_2_weeks: "1 to 2 weeks", just_browsing: "Just browsing" };
  var SCORE_OF = { asap: "Hot", within_1_2_weeks: "Warm", just_browsing: "Browsing" };
  var LOST_REASONS = { price: "Price", timing: "Timing", went_elsewhere: "Went elsewhere", no_reply: "No reply", other: "Other" };
  // The old "Why lost?" answers and the new reasons, both ways.
  var OLD_LOST = { "Too expensive": "price", Timing: "timing", "Went elsewhere": "went_elsewhere", "No reply": "no_reply", Other: "other" };
  var LOST_WORDS = { price: "Too expensive", timing: "Timing", went_elsewhere: "Went elsewhere", no_reply: "No reply", other: "Other" };
  // A review text has gone out (or they said no): the last stage.
  var REVIEW_ASKED = ["text_sent", "nudged", "reviewed", "declined"];
  // Follow-up days. full and browsing count from the first touch (day 0); quoted from the quote.
  var STEPS = { full: [0, 1, 3, 7], browsing: [0, 3], quoted: [2, 5, 9] };
  var CHECK_IN_DAYS = 30;
  var HOURS = { start: 8 * 60, end: 19 * 60 };
  var DAY_MS = 864e5;

  /* ------------------------------------------------------------ Canberra time */

  var TZ = "Australia/Sydney"; // Canberra keeps Sydney's clock
  var fmt = null;
  function parts(d) {
    if (!fmt) fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    var o = {};
    fmt.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    if (o.hour === "24") o.hour = "00";
    return o;
  }
  function asDate(v) {
    if (!v) return null;
    var d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  // "2026-10-04" in Canberra, for a Date or an ISO time ("" when there isn't one).
  function canberraDate(v) {
    if (!v) return "";
    var d = asDate(v);
    if (!d) return String(v).slice(0, 10);
    var p = parts(d);
    return p.year + "-" + p.month + "-" + p.day;
  }
  // Minutes past midnight in Canberra (8:00am → 480).
  function canberraMinutes(v) {
    var d = asDate(v);
    if (!d) return 0;
    var p = parts(d);
    return Number(p.hour) * 60 + Number(p.minute);
  }
  function weekday(v) {
    var d = asDate(v);
    return d ? parts(d).weekday : "";
  }
  function isDay(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  }
  function addDays(date, n) {
    var d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) {
    return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / DAY_MS);
  }
  function laterDay(a, b) {
    return !a ? b || "" : !b ? a : a > b ? a : b;
  }
  // The moment it's `minutes` past midnight on `date` in Canberra.
  function canberraAt(date, minutes) {
    var y = +date.slice(0, 4), m = +date.slice(5, 7), d = +date.slice(8, 10);
    var want = Date.UTC(y, m - 1, d, 0, minutes);
    var t = want - 10 * 36e5;
    for (var i = 0; i < 3; i++) {
      var p = parts(new Date(t));
      var local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
      if (local === want) break;
      t += want - local;
    }
    return new Date(t);
  }

  /* ------------------------------------------------------------ call hours */

  function toMinutes(v, fallback) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(v == null ? "" : v).trim());
    if (!m) return fallback;
    var n = +m[1] * 60 + +m[2];
    return n >= 0 && n < 24 * 60 ? n : fallback;
  }
  // The saved call hours ({start:"08:00", end:"19:00"}), with 8:00am to 7:00pm filling any gap.
  function hours(saved) {
    var s = toMinutes(saved && saved.start, HOURS.start), e = toMinutes(saved && saved.end, HOURS.end);
    if (e <= s) return { start: HOURS.start, end: HOURS.end };
    return { start: s, end: e };
  }
  // 480 → "8:00am", 1140 → "7:00pm".
  function clock(n) {
    var h = Math.floor(n / 60), m = n % 60;
    return (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? "am" : "pm");
  }
  function inHours(at, h) {
    var m = canberraMinutes(at);
    return m >= h.start && m < h.end;
  }
  // When the 5-minute reply clock starts for something that arrived `at`: straight away in call
  // hours, else at the next start of call hours.
  function clockStart(at, h) {
    var d = asDate(at);
    if (!d) return null;
    var m = canberraMinutes(d);
    if (m >= h.start && m < h.end) return d;
    var day = canberraDate(d);
    if (m >= h.end) day = addDays(day, 1);
    return canberraAt(day, h.start);
  }

  /* ------------------------------------------------------------ the answers */

  // A timeline answer, however it arrives: the form's keys (asap, within_1_2_weeks,
  // just_browsing) or its words ("Within 1 to 2 weeks").
  function timelineOf(v) {
    var s = String(v == null ? "" : v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!s) return "";
    if (/\bbrows/.test(s) || /\bjust looking\b/.test(s)) return "just_browsing";
    if (/\basap\b|\bas soon as\b/.test(s)) return "asap";
    if (/\b1 (to )?2 weeks?\b|\bwithin 1\b|\bwithin 2 weeks?\b/.test(s)) return "within_1_2_weeks";
    return "";
  }
  // Leads that came in before there was a timeline field have it in their notes: "When: ASAP".
  function timelineFromNotes(notes) {
    var m = /\bWhen:\s*([^·\n]+)/i.exec(String(notes || ""));
    return m ? timelineOf(m[1]) : "";
  }
  function emailFromNotes(notes) {
    var m = /\bEmail:\s*([^\s·]+@[^\s·]+)/i.exec(String(notes || ""));
    return m ? m[1] : "";
  }
  function scoreOf(timeline) {
    return SCORE_OF[timeline] || "";
  }
  // The customer's own words from the notes, without the When:, Email: and form parts.
  function plainNotes(notes) {
    return String(notes || "")
      .split("·")
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s && !/^(When|Email):/i.test(s) && !/^Via .* form$/i.test(s); })
      .join(" · ");
  }

  /* ------------------------------------------------------------ touches */

  function logOf(l) {
    return Array.isArray(l && l.log) ? l.log.filter(function (e) { return e && typeof e === "object"; }) : [];
  }
  // A call or a text (a note isn't a touch).
  function isTouch(e) {
    return !!e && !!e.at && e.type !== "note";
  }
  function touchDayList(log) {
    var days = {};
    (Array.isArray(log) ? log : []).forEach(function (e) {
      if (!isTouch(e)) return;
      var d = canberraDate(e.at);
      if (isDay(d)) days[d] = true;
    });
    return Object.keys(days).sort();
  }
  // Days with a call or text. Calling then texting on the same day is one touch.
  function touchDays(log) {
    return touchDayList(log).length;
  }
  function lastTouch(l) {
    var log = logOf(l);
    for (var i = log.length - 1; i >= 0; i--) if (isTouch(log[i])) return log[i];
    return null;
  }
  // The same person came in again and nobody has called or texted since.
  function againPending(l) {
    if (!l || !l.againAt) return false;
    var t = lastTouch(l);
    return !t || String(t.at) < String(l.againAt);
  }

  /* ------------------------------------------------------------ stages */

  // The stage a lead is at, from the fields older versions of the app kept.
  function legacyStage(l, today) {
    if (l.status === "Lost") return "Lost";
    var finished = !!l.completedAt || l.kind === "job" || (l.status === "Booked" && !!l.jobDate && !!today && l.jobDate < today);
    if (finished) return REVIEW_ASKED.indexOf(l.reviewStatus) !== -1 || l.reviewAsked === "Yes" ? "Review asked" : "Done";
    if (l.status === "Booked") return "Booked";
    if (l.status === "Quoted") return "Quoted";
    if (l.status === "Contacted" || logOf(l).some(isTouch)) return "Chasing";
    return "New";
  }
  // A booking moves on by itself: Done once the job's done, Review asked once the text's gone.
  function bookedStage(l, stored, today) {
    var finished = !!l.completedAt || l.kind === "job" || (!!l.jobDate && !!today && l.jobDate < today);
    var asked = REVIEW_ASKED.indexOf(l.reviewStatus) !== -1 || l.reviewAsked === "Yes";
    var s = finished ? (asked ? "Review asked" : "Done") : "Booked";
    return BOOKED.indexOf(stored) > BOOKED.indexOf(s) ? stored : s;
  }
  function stageOf(l, today) {
    if (!l) return "New";
    var s = l.stage === "Cold" ? "Waiting" : l.stage;
    if (ALL_STAGES.indexOf(s) === -1) s = legacyStage(l, today);
    if (BOOKED.indexOf(s) !== -1) return bookedStage(l, s, today);
    return s;
  }
  // The old status field, kept in step so older screens and exports still read right.
  function statusFor(stage, old) {
    if (stage === "New") return "New";
    if (stage === "Chasing") return "Contacted";
    if (stage === "Quoted") return "Quoted";
    if (stage === "Waiting") return old === "Quoted" ? "Quoted" : "Contacted";
    if (stage === "Lost") return "Lost";
    return "Booked";
  }
  function scheduleFor(l) {
    if (stageOf(l) === "Quoted") return "quoted";
    return l && l.score === "Browsing" ? "browsing" : "full";
  }
  function runLength(schedule) {
    return (STEPS[schedule] || STEPS.full).length;
  }

  /*
    Every save goes through here: stage, status and booked agree, and a booking moves on to Done
    by itself. Missing follow-up fields get their empty values. Nothing else is changed.
  */
  function sync(l, today) {
    var out = {};
    Object.keys(l || {}).forEach(function (k) { out[k] = l[k]; });
    var stage = stageOf(out, today);
    out.stage = stage;
    out.status = statusFor(stage, out.status);
    out.booked = out.status === "Booked" ? "Yes" : out.status === "Lost" ? "No" : "Pending";
    if (stage === "Lost" && !LOST_REASONS[out.lostReason]) out.lostReason = OLD_LOST[out.lostWhy] || "other";
    if (typeof out.touches !== "number" || isNaN(out.touches)) out.touches = 0;
    if (!STEPS[out.schedule]) out.schedule = scheduleFor(out);
    ["chaseFrom", "lastTouchOn", "quotedOn", "snoozeUntil", "timeline", "score", "scoreBy", "lostReason", "email", "formId", "againAt", "repeatOf"].forEach(function (k) {
      if (out[k] == null) out[k] = "";
    });
    ["paused", "doNotText", "junk"].forEach(function (k) { out[k] = !!out[k]; });
    if (!Array.isArray(out.log)) out.log = [];
    if (!Array.isArray(out.enquiries)) out.enquiries = [];
    return out;
  }

  // The follow-up fields a brand-new lead starts with.
  function newFields(timeline) {
    var score = scoreOf(timeline);
    return {
      stage: "New", schedule: score === "Browsing" ? "browsing" : "full", chaseFrom: "", touches: 0, lastTouchOn: "", quotedOn: "",
      snoozeUntil: "", paused: false, timeline: timeline || "", score: score, scoreBy: score ? "timeline" : "", lostReason: "",
      doNotText: false, junk: false, email: "", formId: "", enquiries: [], againAt: "", repeatOf: "", modelVersion: VERSION,
    };
  }

  /* ------------------------------------------------------------ the schedule */

  // The day the next touch is due once `done` touches of the run are in, the last on `last`.
  // Counted from the run's start; never sooner than the day after the last touch.
  function dueAfter(schedule, from, done, last) {
    var steps = STEPS[schedule] || STEPS.full;
    var at = from && done < steps.length ? addDays(from, steps[done]) : "";
    return laterDay(at, last ? addDays(last, 1) : "");
  }
  function minutesSince(fromIso, toIso) {
    var a = asDate(fromIso), b = asDate(toIso);
    return a && b ? Math.max(0, Math.round((b - a) / 6e4)) : null;
  }
  function firstReply(l, at) {
    return l.replyMins == null && !logOf(l).some(isTouch) && stageOf(l) === "New" ? minutesSince(l.createdAt, at) : undefined;
  }
  function assign(target, more) {
    Object.keys(more).forEach(function (k) { target[k] = more[k]; });
    return target;
  }
  function merged(a, b) {
    return assign(assign({}, a), b);
  }

  /*
    Texted, No answer or a call: the fields to save. entry is the log entry ({at, by, type, ...}).
    A New lead starts its schedule today. The next due day is set from the schedule; after the
    last touch the lead waits, with a check-in every 30 days. A second touch on the same day
    doesn't count again.
  */
  function touch(l, entry) {
    var T = canberraDate(entry.at);
    var stage = stageOf(l);
    var p = { log: logOf(l).concat([entry]), lastContact: entry.at, paused: false };
    var reply = firstReply(l, entry.at);
    if (reply !== undefined) p.replyMins = reply;
    if (BOOKED.indexOf(stage) !== -1 || stage === "Lost") return p;
    if (stage === "Waiting") return assign(p, { nextFollowUp: addDays(T, CHECK_IN_DAYS), snoozeUntil: "", lastTouchOn: T });
    var schedule = stage === "Quoted" ? "quoted" : scheduleFor(l);
    var starting = stage === "New";
    var from = starting ? T : l.chaseFrom || l.quotedOn || T;
    var done = starting ? 1 : (Number(l.touches) || 0) + (l.lastTouchOn === T ? 0 : 1);
    assign(p, { stage: starting ? "Chasing" : stage, schedule: schedule, chaseFrom: from, touches: done, lastTouchOn: T, snoozeUntil: "" });
    if (done >= runLength(schedule)) return assign(p, { stage: "Waiting", nextFollowUp: addDays(T, CHECK_IN_DAYS) });
    p.nextFollowUp = dueAfter(schedule, from, done, T);
    return p;
  }

  /*
    "Not now": off Today until `date`. A lead being chased picks up its schedule from that day,
    with the same gaps between touches as before.
  */
  function snooze(l, date) {
    var stage = stageOf(l);
    var p = { snoozeUntil: date, nextFollowUp: date, paused: false };
    if (stage === "Chasing" || stage === "Quoted") {
      var schedule = stage === "Quoted" ? "quoted" : scheduleFor(l);
      var steps = STEPS[schedule], done = Number(l.touches) || 0;
      if (done < steps.length) p.chaseFrom = addDays(date, -steps[done]);
    }
    return p;
  }

  /*
    Answered: one question. choice is quoted ({amount}), booked ({date, price}), notnow ({date})
    or lost ({reason}). The call is logged and the lead moves on; the old schedule stops.
  */
  var OUTCOMES = { quoted: "Quote given", booked: "Booked", notnow: "Not now", lost: "Lost" };
  function answer(l, choice, data, at, by) {
    data = data || {};
    var T = canberraDate(at);
    var entry = { at: at, by: by || "", type: "call", pickedUp: "Yes", outcome: OUTCOMES[choice] || "Answered", note: "" };
    var p = { log: logOf(l).concat([entry]), lastContact: at, paused: false, snoozeUntil: "" };
    var reply = firstReply(l, at);
    if (reply !== undefined) p.replyMins = reply;
    if (choice === "quoted") {
      return assign(p, { stage: "Quoted", status: "Quoted", quoted: data.amount == null ? l.quoted == null ? null : l.quoted : data.amount,
        quotedOn: T, schedule: "quoted", chaseFrom: T, touches: 0, lastTouchOn: T, nextFollowUp: addDays(T, STEPS.quoted[0]) });
    }
    if (choice === "booked") {
      return assign(p, { stage: "Booked", status: "Booked", jobDate: data.date || "", revenue: data.price == null ? null : data.price, nextFollowUp: "" });
    }
    if (choice === "lost") {
      var reason = LOST_REASONS[data.reason] ? data.reason : "other";
      return assign(p, { stage: "Lost", status: "Lost", lostReason: reason, lostWhy: LOST_WORDS[reason], nextFollowUp: "" });
    }
    // Not now: a new lead has been talked to, so its schedule starts today, then waits.
    if (stageOf(l) === "New") assign(p, { stage: "Chasing", schedule: scheduleFor(l), chaseFrom: T, touches: 1, lastTouchOn: T });
    return assign(p, snooze(merged(l, p), data.date || addDays(T, 1)));
  }

  // A note pauses a schedule that's running: the lead comes back the next day it's due (at the
  // soonest tomorrow) marked Paused, so you pick what's next.
  function note(l, text, at, by) {
    var T = canberraDate(at);
    var p = { log: logOf(l).concat([{ at: at, by: by || "", type: "note", note: String(text || "").trim() }]) };
    var stage = stageOf(l);
    if (stage === "Chasing" || stage === "Quoted") {
      p.paused = true;
      p.pausedAt = at;
      p.nextFollowUp = laterDay(l.nextFollowUp, addDays(T, 1));
    }
    return p;
  }

  // A stage picked by hand in Open (to fix something): the schedule starts again from today.
  function setStage(l, stage, today) {
    var p = { stage: stage, paused: false, snoozeUntil: "" };
    if (stage === "New") assign(p, { chaseFrom: "", touches: 0, nextFollowUp: today });
    else if (stage === "Chasing") assign(p, { schedule: scheduleFor(merged(l, { stage: "Chasing" })), chaseFrom: today, touches: 1, lastTouchOn: today, nextFollowUp: addDays(today, 1) });
    else if (stage === "Quoted") assign(p, { schedule: "quoted", quotedOn: today, chaseFrom: today, touches: 0, lastTouchOn: today, nextFollowUp: addDays(today, STEPS.quoted[0]) });
    else if (stage === "Waiting") p.nextFollowUp = addDays(today, CHECK_IN_DAYS);
    else p.nextFollowUp = "";
    if (stage === "Lost" && !LOST_REASONS[l.lostReason]) assign(p, { lostReason: "other", lostWhy: LOST_WORDS.other });
    return p;
  }

  // A tag changed by hand. A lead being chased moves to that tag's schedule straight away.
  function retag(l, tag, today) {
    var p = { score: TAGS.indexOf(tag) !== -1 ? tag : "", scoreBy: "human" };
    var stage = stageOf(l, today);
    var next = merged(l, p);
    if (stage === "New") p.schedule = scheduleFor(next);
    if (stage !== "Chasing") return p;
    var schedule = scheduleFor(next), done = Number(l.touches) || 0;
    p.schedule = schedule;
    if (done >= runLength(schedule)) return assign(p, { stage: "Waiting", nextFollowUp: addDays(today, CHECK_IN_DAYS) });
    if (!(l.snoozeUntil && l.snoozeUntil > today)) p.nextFollowUp = dueAfter(schedule, l.chaseFrom || today, done, l.lastTouchOn || "");
    return p;
  }
  function nextTag(tag) {
    return TAGS[(TAGS.indexOf(tag) + 1) % TAGS.length];
  }

  // "2 of 4" (or "" when the lead isn't being chased).
  function progress(l, today) {
    var stage = stageOf(l, today);
    if (stage !== "Chasing" && stage !== "Quoted") return "";
    var schedule = stage === "Quoted" ? "quoted" : scheduleFor(l);
    return Math.min(Number(l.touches) || 0, runLength(schedule)) + " of " + runLength(schedule);
  }

  /* ------------------------------------------------------------ reply times */

  function arrivedAt(l) {
    return againPending(l) ? l.againAt : l.createdAt;
  }
  // Came in out of call hours (and nobody has called or texted since).
  function isOvernight(l, h) {
    var at = asDate(arrivedAt(l));
    return !!at && !inHours(at, h);
  }
  // Minutes to the first reply, counted from the start of the reply clock. replyMins is saved
  // counting from when the lead came in; a lead that came in out of call hours counts from the
  // next start of call hours instead.
  function replyMinutes(l, h) {
    if (!l || l.replyMins == null || l.replyMins === "" || isNaN(Number(l.replyMins))) return null;
    var raw = Number(l.replyMins), made = asDate(l.createdAt), c = clockStart(l.createdAt, h);
    if (!made || !c) return raw;
    return Math.max(0, Math.round(raw - (c - made) / 6e4));
  }

  /* ------------------------------------------------------------ Today */

  // Which part of Today a lead belongs in, or "" when it isn't on Today.
  // "later" is a lead that came in out of hours, before call hours start.
  function place(l, today, now, h) {
    if (!l || l.junk) return "";
    if (l.snoozeUntil && l.snoozeUntil > today) return "";
    var stage = stageOf(l, today);
    if (stage === "New" || againPending(l)) {
      var c = clockStart(arrivedAt(l), h);
      if (c && c > now) return "later";
      return isOvernight(l, h) ? "callFirst" : "fresh";
    }
    if (stage !== "Chasing" && stage !== "Quoted" && stage !== "Waiting") return "";
    var due = !l.nextFollowUp || l.nextFollowUp <= today;
    if (stage === "Waiting") return due ? "due" : "waiting";
    if (!due) return "";
    return l.score === "Hot" || stage === "Quoted" ? "hot" : "due";
  }
  // When it fell due: the reply clock for a new lead, else the start of call hours on its day.
  function dueAt(l, today, now, h) {
    var stage = stageOf(l, today);
    if (stage === "New" || againPending(l)) return clockStart(arrivedAt(l), h);
    return isDay(l.nextFollowUp) ? canberraAt(l.nextFollowUp, h.start) : now;
  }
  // Nobody has touched it for 24 hours past when it fell due: it shows on both lists.
  function stale(l, today, now, h) {
    var at = dueAt(l, today, now, h);
    return !!at && now - at >= DAY_MS;
  }
  // Quoted first, then Hot, Warm, Browsing; the oldest first within each.
  function rank(l, today) {
    if (stageOf(l, today) === "Quoted") return 0;
    var i = TAGS.indexOf(l.score);
    return i === -1 ? 4 : i + 1;
  }
  function byRank(today) {
    return function (a, b) {
      return rank(a, today) - rank(b, today) || String(a.createdAt || a.date || "").localeCompare(String(b.createdAt || b.date || "")) || String(a.id).localeCompare(String(b.id));
    };
  }
  /*
    Today's lists: { callFirst, fresh, hot, due, waiting, later, left }. o is { now, hours, who, all }.
    Without `all`, only `who`'s leads, plus leads with no owner and anyone's left 24 hours past due.
  */
  function todayLists(leads, o) {
    var now = o.now || new Date(), h = o.hours || hours(), today = canberraDate(now);
    var out = { callFirst: [], fresh: [], hot: [], due: [], waiting: [], later: 0 };
    (leads || []).forEach(function (l) {
      try {
        var k = place(l, today, now, h);
        if (!k) return;
        if (k === "later") { out.later++; return; }
        if (!o.all && o.who && l.owner && l.owner !== o.who && !stale(l, today, now, h)) return;
        out[k].push(l);
      } catch (e) { /* a lead that can't be read is left off Today, never the app */ }
    });
    ["callFirst", "fresh", "hot", "due", "waiting"].forEach(function (k) { out[k].sort(byRank(today)); });
    out.left = out.callFirst.length + out.fresh.length + out.hot.length + out.due.length;
    return out;
  }
  // The day the quote was given, for leads quoted before quotedOn was kept.
  function quoteDay(l) {
    if (isDay(l.quotedOn)) return l.quotedOn;
    var log = logOf(l);
    for (var i = log.length - 1; i >= 0; i--) if (log[i].outcome === "Quote given") return canberraDate(log[i].at);
    return "";
  }
  // Friday from 5:00pm: how things stand. Counts only; it moves nothing.
  function fridayWrap(leads, o) {
    var now = o.now || new Date();
    if (weekday(now) !== "Fri" || canberraMinutes(now) < 17 * 60) return null;
    var today = canberraDate(now), all = todayLists(leads, { now: now, hours: o.hours, all: true });
    var live = (leads || []).filter(function (l) { return l && !l.junk; });
    var quiet = live.filter(function (l) {
      var s = stageOf(l, today), q = quoteDay(l);
      return (s === "Quoted" || (s === "Waiting" && l.status === "Quoted")) && q && daysBetween(q, today) >= 14 && !(lastTouch(l) && lastTouch(l).pickedUp === "Yes" && canberraDate(lastTouch(l).at) > q);
    }).length;
    return {
      callFirst: all.callFirst.length, fresh: all.fresh.length, hot: all.hot.length, due: all.due.length, waiting: all.waiting.length,
      quotedQuiet: quiet, stillNew: live.filter(function (l) { return stageOf(l, today) === "New"; }).length,
    };
  }

  /* ------------------------------------------------------------ the same person again */

  function phoneKey(phone) {
    var d = String(phone == null ? "" : phone).replace(/\D/g, "");
    if (d.indexOf("61") === 0 && d.length === 11) d = "0" + d.slice(2);
    return d;
  }
  function isOpen(l, today) {
    var s = stageOf(l, today);
    return s === "New" || s === "Chasing" || s === "Quoted" || s === "Waiting";
  }
  /*
    A new enquiry from a phone number that's already a lead. Returns { merge: lead } when it
    should go on that lead (it's still open, or came in within 30 days), { repeatOf: id } when
    it's someone from longer ago (a new lead marked Repeat), or {} when the number is new.
  */
  function matchPhone(leads, phone, today) {
    var key = phoneKey(phone);
    if (key.length < 6) return {};
    var same = (leads || []).filter(function (l) { return l && phoneKey(l.phone) === key; })
      .sort(function (a, b) { return String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")); });
    if (!same.length) return {};
    var hit = same.filter(function (l) {
      var d = l.date || canberraDate(l.createdAt);
      return isOpen(l, today) || (isDay(d) && daysBetween(d, today) <= 30);
    })[0];
    return hit ? { merge: hit } : { repeatOf: same[0].id };
  }
  /*
    The fields to save when `fresh` (a lead as built for saving) is merged into `l`: the enquiry
    is added to its list, empty fields are filled, and the lead comes back to New on Today. A
    lead that was Waiting or Lost starts its schedule again.
  */
  function mergeEnquiry(l, fresh, at) {
    var p = {
      enquiries: (Array.isArray(l.enquiries) ? l.enquiries : []).concat([{
        at: at, source: fresh.source || "", ad: fresh.ad || "", service: fresh.service || "", car: fresh.car || "", notes: fresh.notes || "",
      }]),
      againAt: at, snoozeUntil: "", paused: false,
    };
    ["name", "car", "suburb", "email", "formId", "timeline"].forEach(function (k) { if (!l[k] && fresh[k]) p[k] = fresh[k]; });
    if ((!l.service || l.service === "Not sure") && fresh.service && fresh.service !== "Not sure") p.service = fresh.service;
    if (!l.score && fresh.score) { p.score = fresh.score; p.scoreBy = fresh.scoreBy; }
    var stage = stageOf(l);
    if (stage === "Waiting" || stage === "Lost") {
      assign(p, { stage: "New", schedule: scheduleFor(merged(l, p)), chaseFrom: "", touches: 0, lastTouchOn: "", nextFollowUp: canberraDate(at) });
    } else if (stage !== "New" && BOOKED.indexOf(stage) === -1) {
      p.nextFollowUp = canberraDate(at);
    }
    return p;
  }

  /* ------------------------------------------------------------ the upgrade (older leads) */

  function hasOwner(l) {
    return PEOPLE.indexOf(l.owner) !== -1;
  }
  function needsUpgrade(l) {
    return (Number(l.modelVersion) || 0) < VERSION || !hasOwner(l);
  }
  // Who a lead with no owner goes to: whoever logged it last, else the two of you in turn.
  function lastLoggedBy(l) {
    var log = logOf(l);
    for (var i = log.length - 1; i >= 0; i--) if (PEOPLE.indexOf(log[i].by) !== -1) return log[i].by;
    return "";
  }
  /*
    The follow-up fields for a lead saved by an older version of the app: its stage from what it
    has, and its place in the schedule from its touches. A lead past its last touch goes to
    Waiting, with its first check-in 30 days from today (no catch-up texts). A lead already due is
    due today, not earlier, so nothing starts the day late. A future chase date someone picked is kept.
  */
  function upgradeFields(l, today) {
    var stage = l.stage === "Cold" ? "Waiting" : (Number(l.modelVersion) || 0) >= 2 && ALL_STAGES.indexOf(l.stage) !== -1 ? l.stage : legacyStage(l, today);
    if (BOOKED.indexOf(stage) !== -1) stage = bookedStage(l, stage, today);
    var timeline = l.timeline || timelineFromNotes(l.notes);
    var score = l.score || scoreOf(timeline);
    var days = touchDayList(l.log), last = days[days.length - 1] || "";
    var picked = isDay(l.nextFollowUp) && l.nextFollowUp > today ? l.nextFollowUp : "";
    var f = {
      stage: stage, timeline: timeline, score: score, scoreBy: l.scoreBy || (score ? "timeline" : ""),
      schedule: score === "Browsing" ? "browsing" : "full", chaseFrom: "", touches: 0, lastTouchOn: last, quotedOn: isDay(l.quotedOn) ? l.quotedOn : "",
      snoozeUntil: isDay(l.snoozeUntil) && l.snoozeUntil > today ? l.snoozeUntil : "", paused: false,
      lostReason: stage === "Lost" ? (LOST_REASONS[l.lostReason] ? l.lostReason : OLD_LOST[l.lostWhy] || "other") : l.lostReason || "",
      doNotText: !!l.doNotText, junk: !!l.junk, email: l.email || emailFromNotes(l.notes), formId: l.formId || "",
      enquiries: Array.isArray(l.enquiries) ? l.enquiries : [], againAt: l.againAt || "", repeatOf: l.repeatOf || "", modelVersion: VERSION,
    };
    var wait = function () { f.stage = "Waiting"; f.nextFollowUp = laterDay(picked, addDays(today, CHECK_IN_DAYS)); };
    if (stage === "Chasing") {
      var steps = STEPS[f.schedule];
      var from = days[0] || canberraDate(l.lastContact) || (isDay(l.date) ? l.date : today);
      var done = Math.min(Math.max(days.filter(function (d) { return d >= from; }).length, 1), steps.length);
      f.chaseFrom = from; f.touches = done; f.lastTouchOn = last || from;
      if (done >= steps.length || (!picked && today > addDays(from, steps[steps.length - 1]))) wait();
      else if (picked) { f.nextFollowUp = picked; f.chaseFrom = addDays(picked, -steps[done]); }
      else f.nextFollowUp = laterDay(dueAfter(f.schedule, from, done, f.lastTouchOn), today);
    } else if (stage === "Quoted") {
      var q = quoteDay(l) || canberraDate(l.lastContact) || (isDay(l.date) ? l.date : today);
      var after = Math.min(days.filter(function (d) { return d > q; }).length, STEPS.quoted.length);
      f.schedule = "quoted"; f.quotedOn = q; f.chaseFrom = q; f.touches = after; f.lastTouchOn = laterDay(q, last);
      if (after >= STEPS.quoted.length || (!picked && today > addDays(q, STEPS.quoted[STEPS.quoted.length - 1]))) wait();
      else if (picked) { f.nextFollowUp = picked; f.chaseFrom = addDays(picked, -STEPS.quoted[after]); }
      else f.nextFollowUp = laterDay(dueAfter("quoted", q, after, f.lastTouchOn), today);
    } else if (stage === "Waiting") {
      f.touches = Math.min(days.length, STEPS.full.length);
      f.nextFollowUp = picked || addDays(today, CHECK_IN_DAYS);
    }
    return f;
  }
  /*
    What the upgrade does to each lead that needs it: { rows: [{ id, name, from, to, patch }], todo }.
    The patch only adds fields, except nextFollowUp and the Phase 1 fields, whose earlier values
    are kept in v3Was. A lead that can't be read is left as it is.
  */
  function plan(leads, today) {
    var oldest = (leads || []).filter(function (l) { return l && typeof l === "object"; }).slice()
      .sort(function (a, b) { return String(a.createdAt || a.date || "").localeCompare(String(b.createdAt || b.date || "")); });
    var turn = 0, rows = [];
    oldest.forEach(function (l) {
      try {
        if (!needsUpgrade(l)) return;
        var patch = {};
        if ((Number(l.modelVersion) || 0) < VERSION) {
          patch = upgradeFields(l, today);
          var was = {};
          ["stage", "nextFollowUp", "touches", "schedule"].forEach(function (k) {
            if (k in patch && patch[k] !== l[k]) was[k] = l[k] == null ? "" : l[k];
          });
          if (Object.keys(was).length) patch.v3Was = was;
        }
        if (!hasOwner(l)) {
          var owner = lastLoggedBy(l) || PEOPLE[turn++ % 2];
          patch.owner = owner;
          patch.ownerWas = l.owner || "";
        }
        rows.push({ id: l.id, name: l.name || "No name", from: l.status || "New", to: patch.stage || stageOf(l, today), patch: patch });
      } catch (e) { /* left as it is */ }
    });
    return { rows: rows, todo: rows.length };
  }

  var api = {
    VERSION: VERSION, STAGES: STAGES, BINS: BINS, ALL_STAGES: ALL_STAGES, PEOPLE: PEOPLE, TAGS: TAGS, TIMELINES: TIMELINES,
    LOST_REASONS: LOST_REASONS, LOST_WORDS: LOST_WORDS, OLD_LOST: OLD_LOST, STEPS: STEPS, CHECK_IN_DAYS: CHECK_IN_DAYS, HOURS: HOURS,
    canberraDate: canberraDate, canberraMinutes: canberraMinutes, canberraAt: canberraAt, weekday: weekday, addDays: addDays, daysBetween: daysBetween,
    hours: hours, clock: clock, inHours: inHours, clockStart: clockStart,
    timelineOf: timelineOf, timelineFromNotes: timelineFromNotes, emailFromNotes: emailFromNotes, scoreOf: scoreOf, plainNotes: plainNotes,
    isTouch: isTouch, touchDays: touchDays, touchDayList: touchDayList, lastTouch: lastTouch, againPending: againPending,
    legacyStage: legacyStage, stageOf: stageOf, statusFor: statusFor, scheduleFor: scheduleFor, runLength: runLength,
    sync: sync, newFields: newFields, dueAfter: dueAfter, touch: touch, snooze: snooze, answer: answer, note: note,
    setStage: setStage, retag: retag, nextTag: nextTag, progress: progress,
    arrivedAt: arrivedAt, isOvernight: isOvernight, replyMinutes: replyMinutes,
    place: place, stale: stale, rank: rank, todayLists: todayLists, quoteDay: quoteDay, fridayWrap: fridayWrap,
    phoneKey: phoneKey, isOpen: isOpen, matchPhone: matchPhone, mergeEnquiry: mergeEnquiry,
    needsUpgrade: needsUpgrade, upgradeFields: upgradeFields, plan: plan,
  };
  root.ILModel = api;
})(typeof window !== "undefined" ? window : globalThis);
