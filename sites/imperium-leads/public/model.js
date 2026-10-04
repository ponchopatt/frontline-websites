/*
  The lead model: the stages, the follow-up fields, and the one-off upgrade from the old fields.

  Plain logic only (no page, no database), so the page and the tests share it. The page loads it
  as window.ILModel. The fields it adds to each lead (nothing old is changed or removed):

    stage        New, Chasing, Quoted, Booked, Done, Review asked, or a side bin: Cold, Lost
    touches      follow-up touches done, 0 to 4 (a day with any call or text counts once)
    timeline     asap, within_1_2_weeks, just_browsing, or "" when we don't know
    score        Hot, Warm or Browsing; scoreBy says who set it (timeline, ai or human)
    schedule     full (4 touches) or browsing (touches 1 and 3 only)
    snoozeUntil  a date the lead is hidden until, or ""
    lostReason   price, timing, went_elsewhere, no_reply or other (Lost only)
    doNotText    true when they've asked not to be texted
    junk         true for a test or fake lead ("Not real"): kept out of the lists and the Numbers
    modelVersion 2 once a lead has these fields

  Fields that already did the job stay as they are: nextFollowUp is the next due date, quoted is
  the quote amount, log is the touch log (time, type and who), and owner, paid, plan, upsellTaken
  and reviewLeft are unchanged.
*/
(function (root) {
  "use strict";

  var VERSION = 2;
  var STAGES = ["New", "Chasing", "Quoted", "Booked", "Done", "Review asked"];
  var BINS = ["Cold", "Lost"];
  var PEOPLE = ["Angus", "Ananth"];
  var TIMELINES = { asap: "ASAP", within_1_2_weeks: "Within 1 to 2 weeks", just_browsing: "Just browsing" };
  var SCORE_OF = { asap: "Hot", within_1_2_weeks: "Warm", just_browsing: "Browsing" };
  var LOST_REASONS = { price: "Price", timing: "Timing", went_elsewhere: "Went elsewhere", no_reply: "No reply", other: "Other" };
  // The old "Why lost?" answers, as the new reasons.
  var OLD_LOST = { "Too expensive": "price", Timing: "timing", "Went elsewhere": "went_elsewhere", "No reply": "no_reply", Other: "other" };
  // A review text has gone out (or they said no): the last stage.
  var REVIEW_ASKED = ["text_sent", "nudged", "reviewed", "declined"];

  /* ------------------------------------------------------------ Canberra time */

  var TZ = "Australia/Sydney"; // Canberra keeps Sydney's clock
  var fmt = null;
  function parts(d) {
    if (!fmt) fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    var o = {};
    fmt.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  // "2026-10-04" in Canberra, for a Date or an ISO time ("" when there isn't one).
  function canberraDate(v) {
    if (!v) return "";
    var d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 10);
    var p = parts(d);
    return p.year + "-" + p.month + "-" + p.day;
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
  function scoreOf(timeline) {
    return SCORE_OF[timeline] || "";
  }

  /* ------------------------------------------------------------ from the old fields */

  // Days with a logged call or text. Calling then texting on the same day is one touch.
  function touchDays(log) {
    var days = {};
    (log || []).forEach(function (e) {
      var d = canberraDate(e && e.at);
      if (d) days[d] = true;
    });
    return Object.keys(days).length;
  }

  // The stage a lead is at, from the fields the app has kept so far.
  function legacyStage(l, today) {
    if (l.status === "Lost") return "Lost";
    var finished = !!l.completedAt || l.kind === "job" || (l.status === "Booked" && !!l.jobDate && !!today && l.jobDate < today);
    if (finished) return REVIEW_ASKED.indexOf(l.reviewStatus) !== -1 || l.reviewAsked === "Yes" ? "Review asked" : "Done";
    if (l.status === "Booked") return "Booked";
    if (l.status === "Quoted") return "Quoted";
    if (l.status === "Contacted" || (l.log || []).length) return "Chasing";
    return "New";
  }

  // The new fields, worked out from what's already on the lead. Anything already set is kept.
  function fields(l, today) {
    var timeline = l.timeline || timelineFromNotes(l.notes);
    var score = l.score || scoreOf(timeline);
    var stage = l.stage === "Cold" ? "Cold" : legacyStage(l, today);
    return {
      stage: stage,
      touches: Math.min(4, touchDays(l.log)),
      timeline: timeline,
      score: score,
      scoreBy: l.scoreBy || (score ? "timeline" : ""),
      schedule: timeline === "just_browsing" ? "browsing" : "full",
      snoozeUntil: l.snoozeUntil || "",
      // The screens still set "Why lost?", so that answer leads while they do.
      lostReason: stage === "Lost" ? OLD_LOST[l.lostWhy] || l.lostReason || "other" : l.lostReason || "",
      doNotText: !!l.doNotText,
      junk: !!l.junk,
      modelVersion: VERSION,
    };
  }

  // Kept in step on every save while the screens still set the old status: the new fields
  // follow it. (Owner is left alone; a lead with no owner gets one from the upgrade.)
  function sync(l, today) {
    var out = {};
    Object.keys(l).forEach(function (k) { out[k] = l[k]; });
    var f = fields(l, today);
    Object.keys(f).forEach(function (k) { out[k] = f[k]; });
    return out;
  }

  /* ------------------------------------------------------------ the one-off upgrade */

  function hasOwner(l) {
    return PEOPLE.indexOf(l.owner) !== -1;
  }
  function needsUpgrade(l) {
    return (l.modelVersion || 0) < VERSION || !hasOwner(l);
  }
  // Who a lead with no owner goes to: whoever logged it last, else the two of you in turn.
  function lastLoggedBy(l) {
    var log = l.log || [];
    for (var i = log.length - 1; i >= 0; i--) if (PEOPLE.indexOf(log[i] && log[i].by) !== -1) return log[i].by;
    return "";
  }

  /*
    What the upgrade will do to each lead, without doing it: the page shows this first.
    Returns { rows, moves, owners, timelines, todo } where each row is
    { id, name, car, from, to, owner, ownerFrom, timeline, touches, patch, needed }.
  */
  function plan(leads, today) {
    var oldest = (leads || []).slice().sort(function (a, b) { return String(a.createdAt || a.date || "").localeCompare(String(b.createdAt || b.date || "")); });
    var turn = 0;
    var rows = oldest.map(function (l) {
      var f = fields(l, today);
      var patch = {};
      Object.keys(f).forEach(function (k) { patch[k] = f[k]; });
      var owner = l.owner;
      var ownerFrom = "";
      if (!hasOwner(l)) {
        owner = lastLoggedBy(l);
        ownerFrom = owner ? "logged" : "turn";
        if (!owner) owner = PEOPLE[turn++ % 2];
        patch.owner = owner;
        patch.ownerWas = l.owner || "";
      }
      var from = l.kind === "job" ? "Job added" : l.status || "New";
      if (l.status === "Booked" && f.stage !== "Booked") from += l.completedAt ? ", marked done" : ", job date passed";
      return {
        id: l.id, name: l.name || "No name", car: l.car || "", from: from, to: f.stage, owner: owner, ownerFrom: ownerFrom,
        timeline: f.timeline, touches: f.touches, patch: patch, needed: needsUpgrade(l),
      };
    });
    var moves = {}, owners = { kept: 0, logged: 0, turn: 0 }, timelines = { asap: 0, within_1_2_weeks: 0, just_browsing: 0, none: 0 };
    rows.forEach(function (r) {
      var key = r.from + " → " + r.to;
      moves[key] = (moves[key] || 0) + 1;
      owners[r.ownerFrom || "kept"]++;
      timelines[r.timeline || "none"]++;
    });
    return {
      rows: rows,
      moves: Object.keys(moves).sort().map(function (k) { return { move: k, n: moves[k] }; }),
      owners: owners,
      timelines: timelines,
      todo: rows.filter(function (r) { return r.needed; }).length,
    };
  }

  root.ILModel = {
    VERSION: VERSION,
    STAGES: STAGES,
    BINS: BINS,
    PEOPLE: PEOPLE,
    TIMELINES: TIMELINES,
    LOST_REASONS: LOST_REASONS,
    canberraDate: canberraDate,
    timelineOf: timelineOf,
    timelineFromNotes: timelineFromNotes,
    scoreOf: scoreOf,
    touchDays: touchDays,
    legacyStage: legacyStage,
    fields: fields,
    sync: sync,
    needsUpgrade: needsUpgrade,
    plan: plan,
  };
})(typeof window !== "undefined" ? window : this);
