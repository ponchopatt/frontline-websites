/*
  The lead model: five stages, call hours, the four-touch follow-up, Today's list, the numbers and
  the upgrade of older leads. Plain logic only (no page, no database), so the page, the server and
  the tests share it. The page loads it as window.ILModel; the server imports it through lib/model.js.

  Stages: New → Chasing → Booked → Done, and Waiting (with a reason: no reply, lost or not real).

  A lead's fields (nothing older is removed; status and booked are kept in step with stage, so
  older exports still read right):

    stage          New, Chasing, Booked, Done or Waiting
    waitReason     no_reply, lost or not_real (Waiting only). Not real is also junk: true, which
                   keeps a lead off Today and out of every number
    old_status     the status it had before the move to five stages (New, Chasing, Quoted, Booked,
                   Done, Review asked, Waiting, Lost or Not real)
    touches        touches done, 0 to 4: touch 1 straight away, 2 the next day, 3 on day 3, 4 on day 7
    chaseFrom      the day of touch 1
    lastTouchOn    the day of the last touch
    nextFollowUp   the day the next touch is due
    quoted         the quote in dollars, if one was given
    reviewAsked    "Yes" once the review is asked (a tick on Done jobs)
    paid           "Yes" once paid. A Done job that isn't paid owes money (the other tick)
    offeredCeramic, offeredPlan   "Yes" once offered (ticks on Booked and Done jobs)
    planSince      the day the lead went on a maintenance plan
    fromAd         which ad, for leads added from now on: "ad" (the name is in ad), "none" or "referral"
    rolledOn       the day it was rolled to tomorrow because Today was full
    jobDate, jobTime, address, revenue, priceRange   the booking: day, time ("09:30"), where, and
                   the price (a range like "250–300" is kept in priceRange, with its low end in revenue)
    log            calls, texts and notes, each with when (at) and who (by). A call note has
                   type "note", the chips picked (chips) and the words typed (note)
    depositPaid    "Yes" once the $50 Stripe deposit is paid (depositPaidAt, depositAmount, and
                   depositCheckoutId, the payment). depositSessionId (the link's id: plink_…, or cs_…
                   for older links), depositUrl, depositLinkAt, depositDate, depositTime: the last link made
    onMyWayAt, onMyWayBy   when the "On my way" text was sent, and who sent it
    firstContact   how fast the first reply really was, picked by hand: "5" (within 5 min), "30"
                   (5 to 30 min), "30plus" or "nextday" (firstContactAt, firstContactBy: when and
                   who). Calls and texts are often logged in the app later, so this wins over the
                   app's own reply time (replyMins) in the Numbers
    waitedAt, waitedHow   when it went to Waiting, and how: touch4, auto, backlog or hand
    timeline, score, email, formId, enquiries, againAt, repeatOf, lostReason: as before
    modelVersion   4 once a lead has these fields; v4Was keeps what the upgrade changed
*/
(function (root) {
  "use strict";

  var VERSION = 4;
  var STAGES = ["New", "Chasing", "Booked", "Done", "Waiting"];
  var BOOKED = ["Booked", "Done"];
  var PEOPLE = ["Angus", "Ananth"];
  var TAGS = ["Hot", "Warm", "Browsing"];
  var TIMELINES = { asap: "ASAP", within_1_2_weeks: "1 to 2 weeks", just_browsing: "Just browsing" };
  var SCORE_OF = { asap: "Hot", within_1_2_weeks: "Warm", just_browsing: "Browsing" };
  var WAIT_REASONS = { no_reply: "No reply", lost: "Lost", not_real: "Not real" };
  // Why a lost lead was lost (kept on the lead as lostReason, for the Numbers).
  var LOST_REASONS = { price: "Price", timing: "Timing", went_elsewhere: "Went elsewhere", no_reply: "No reply", other: "Other" };
  var OLD_LOST = { "Too expensive": "price", Timing: "timing", "Went elsewhere": "went_elsewhere", "No reply": "no_reply", Other: "other" };
  var LOST_WORDS = { price: "Too expensive", timing: "Timing", went_elsewhere: "Went elsewhere", no_reply: "No reply", other: "Other" };
  // The review steps that mean it's been asked.
  var REVIEW_ASKED = ["asked_in_person", "text_sent", "nudged", "reviewed", "declined"];
  // Touch days, counted from touch 1 (day 0).
  var STEPS = [0, 1, 3, 7];
  var TOUCHES = STEPS.length;
  // A touch this many days overdue moves the lead to Waiting by itself.
  var OVERDUE_DAYS = 2;
  // The most Today shows at once.
  var TODAY_MAX = 10;
  var HOURS = { start: 8 * 60, end: 19 * 60 };
  // Things people often say on a call: quick-tap chips on a note.
  var NOTE_CHIPS = ["Price", "Timing", "Pet hair", "Stains", "Smell", "Scratches / swirls", "Wants ceramic info", "Selling the car",
    "Needs to check with partner", "Work ute", "Garage / no garage", "Water or power issue"];
  var DEPOSIT = 50;
  // First contact, picked by hand on a lead.
  var FIRST_CONTACT = { "5": "Within 5 min", "30": "5–30 min", "30plus": "30 min+", nextday: "Next day" };
  var FIRST_CONTACT_KEYS = ["5", "30", "30plus", "nextday"];
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
  function dayOf(l) {
    return l.date || canberraDate(l.createdAt);
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
  // When the reply clock starts for something that arrived `at`: straight away in call hours,
  // else at the next start of call hours (every day, weekends too).
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

  // The job's day has passed, or it was marked done.
  function isFinished(l, today) {
    return !!l.completedAt || l.kind === "job" || (isDay(l.jobDate) && !!today && l.jobDate < today);
  }
  // The stage a lead had in the app before five stages (version 3), from whatever it has.
  var V3_STAGES = ["New", "Chasing", "Quoted", "Booked", "Done", "Review asked", "Waiting", "Lost"];
  var V3_ASKED = ["text_sent", "nudged", "reviewed", "declined"];
  function v3Stage(l, today) {
    var s = l.stage === "Cold" ? "Waiting" : l.stage;
    if (V3_STAGES.indexOf(s) === -1) {
      if (l.status === "Lost") return "Lost";
      if (l.status === "Booked" || l.kind === "job" || l.completedAt) s = "Booked";
      else if (l.status === "Quoted") return "Quoted";
      else return l.status === "Contacted" || logOf(l).some(isTouch) ? "Chasing" : "New";
    }
    if (s !== "Booked" && s !== "Done" && s !== "Review asked") return s;
    var asked = V3_ASKED.indexOf(l.reviewStatus) !== -1 || l.reviewAsked === "Yes";
    var b = isFinished(l, today) ? (asked ? "Review asked" : "Done") : "Booked";
    var order = ["Booked", "Done", "Review asked"];
    return order.indexOf(s) > order.indexOf(b) ? s : b;
  }
  var FROM_V3 = { New: "New", Chasing: "Chasing", Quoted: "Chasing", Booked: "Booked", Done: "Done", "Review asked": "Done", Waiting: "Waiting", Lost: "Waiting" };
  // A booking moves on to Done by itself once its day has passed.
  function stageOf(l, today) {
    if (!l) return "New";
    var s = STAGES.indexOf(l.stage) !== -1 ? l.stage : FROM_V3[v3Stage(l, today)] || "New";
    if (s === "Booked" && isFinished(l, today)) return "Done";
    return s;
  }
  function waitReasonOf(l) {
    if (l.junk) return "not_real";
    if (WAIT_REASONS[l.waitReason]) return l.waitReason;
    return l.stage === "Lost" || l.status === "Lost" ? "lost" : "no_reply";
  }
  // The old status field, kept in step so older exports still read right.
  function statusFor(stage, reason) {
    if (stage === "New") return "New";
    if (stage === "Booked" || stage === "Done") return "Booked";
    if (stage === "Waiting" && reason === "lost") return "Lost";
    return "Contacted";
  }
  function isBooked(l, today) {
    return BOOKED.indexOf(stageOf(l, today)) !== -1;
  }
  // A Done job that isn't paid (and a job today marked not paid).
  function owesMoney(l, today) {
    if (!l || l.junk || l.paid === "Yes") return false;
    var s = stageOf(l, today);
    return s === "Done" || (s === "Booked" && l.paid === "No" && isDay(l.jobDate) && !!today && l.jobDate <= today);
  }
  // The Review asked tick.
  function reviewAsked(l) {
    if (l.reviewAsked === "Yes") return true;
    return l.reviewAsked !== "No" && REVIEW_ASKED.indexOf(l.reviewStatus) !== -1;
  }

  /*
    Every save goes through here: stage, status and booked agree, and a booking moves on to Done
    by itself. Missing fields get their empty values. Nothing else is changed.
  */
  function sync(l, today) {
    var out = {};
    Object.keys(l || {}).forEach(function (k) { out[k] = l[k]; });
    var stage = stageOf(out, today);
    out.stage = stage;
    if (stage === "Waiting") out.waitReason = waitReasonOf(out);
    out.status = statusFor(stage, out.waitReason);
    out.booked = out.status === "Booked" ? "Yes" : out.status === "Lost" ? "No" : "Pending";
    if (stage === "Waiting" && out.waitReason === "lost" && !LOST_REASONS[out.lostReason]) out.lostReason = OLD_LOST[out.lostWhy] || "other";
    if (typeof out.touches !== "number" || isNaN(out.touches)) out.touches = 0;
    ["waitReason", "old_status", "chaseFrom", "lastTouchOn", "quotedOn", "timeline", "score", "scoreBy", "lostReason", "email", "formId", "againAt", "repeatOf",
      "fromAd", "offeredCeramic", "offeredPlan", "planSince", "rolledOn"].forEach(function (k) {
      if (out[k] == null) out[k] = "";
    });
    ["doNotText", "junk"].forEach(function (k) { out[k] = !!out[k]; });
    if (!Array.isArray(out.log)) out.log = [];
    if (!Array.isArray(out.enquiries)) out.enquiries = [];
    return out;
  }

  // The fields a brand-new lead starts with.
  function newFields(timeline) {
    var score = scoreOf(timeline);
    return {
      stage: "New", waitReason: "", old_status: "", touches: 0, chaseFrom: "", lastTouchOn: "", quotedOn: "",
      timeline: timeline || "", score: score, scoreBy: score ? "timeline" : "", lostReason: "",
      doNotText: false, junk: false, email: "", formId: "", enquiries: [], againAt: "", repeatOf: "",
      fromAd: "", offeredCeramic: "", offeredPlan: "", planSince: "", rolledOn: "", modelVersion: VERSION,
    };
  }

  /* ------------------------------------------------------------ the four touches */

  // The day touch `done + 1` is due, once `done` touches are in, the last on `last`. Counted from
  // touch 1, and never sooner after the last touch than the planned gap: a touch done late still
  // waits 2 days (then 4) before the next, not 1.
  function dueAfter(from, done, last) {
    if (done >= TOUCHES) return "";
    var at = from ? addDays(from, STEPS[done]) : "";
    var gap = done > 0 ? Math.max(1, STEPS[done] - STEPS[done - 1]) : 0;
    return laterDay(at, last ? addDays(last, gap) : "");
  }
  function minutesSince(fromIso, toIso) {
    var a = asDate(fromIso), b = asDate(toIso);
    return a && b ? Math.max(0, Math.round((b - a) / 6e4)) : null;
  }
  // Minutes from when a new lead came in to the first reply (undefined once there's been one).
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
    ✓ Done: this touch was sent. entry is the log entry ({at, by, type, ...}). The first touch
    starts the four; each one sets the day the next is due. After touch 4 with no booking, the
    lead goes to Waiting (No reply). A second touch on the same day is logged but doesn't count
    again. On a Booked, Done or Waiting lead it's only logged.
  */
  function touch(l, entry) {
    var T = canberraDate(entry.at);
    var stage = stageOf(l, T);
    var p = { log: logOf(l).concat([entry]), lastContact: entry.at };
    var reply = firstReply(l, entry.at);
    if (reply !== undefined) p.replyMins = reply;
    if (stage !== "New" && stage !== "Chasing") return p;
    var starting = stage === "New";
    var from = starting ? T : l.chaseFrom || T;
    var done = starting ? 1 : Math.min(TOUCHES, Math.max(1, (Number(l.touches) || 0) + (l.lastTouchOn === T ? 0 : 1)));
    assign(p, { stage: "Chasing", chaseFrom: from, touches: done, lastTouchOn: T, rolledOn: "" });
    if (done >= TOUCHES) return assign(p, { stage: "Waiting", waitReason: "no_reply", nextFollowUp: "", waitedAt: entry.at, waitedHow: "touch4" });
    p.nextFollowUp = dueAfter(from, done, T);
    return p;
  }

  // A price as typed: "250" → { price: 250, range: "" }; "250-300", "$250 to $300" →
  // { price: 250, range: "250–300" } (the low end counts as the price until the job's done).
  function parsePrice(v) {
    if (typeof v === "number") return isFinite(v) ? { price: v, range: "" } : { price: null, range: "" };
    var nums = String(v == null ? "" : v).replace(/,/g, "").match(/\d+(\.\d+)?/g) || [];
    if (!nums.length) return { price: null, range: "" };
    var a = Number(nums[0]), b = nums.length > 1 ? Number(nums[1]) : a;
    if (b === a) return { price: a, range: "" };
    var lo = Math.min(a, b), hi = Math.max(a, b);
    return { price: lo, range: lo + "–" + hi };
  }
  // "09:30" → "9:30am" ("" when it isn't a time).
  function timeLabel(t) {
    var m = toMinutes(t, -1);
    return m < 0 ? "" : clock(m);
  }
  /*
    Booked: the day, and the time, address and price when known (data: { date, time, address,
    price }, price as typed, a range is fine). The touches stop.
  */
  function book(l, data, at, by) {
    data = data || {};
    var pr = data.price == null || data.price === "" ? null : parsePrice(data.price);
    var p = {
      stage: "Booked", waitReason: "", jobDate: data.date || "",
      revenue: pr && pr.price != null ? pr.price : (l.revenue == null ? null : l.revenue),
      nextFollowUp: "", rolledOn: "", log: logOf(l).concat([{ at: at, by: by || "", type: "note", outcome: "Booked", note: "" }]),
    };
    if (pr && pr.price != null) p.priceRange = pr.range;
    if (data.time != null) p.jobTime = String(data.time);
    if (data.address != null) p.address = String(data.address).trim();
    if (l.completedAt) p.completedAt = null;
    if (l.junk) p.junk = false;
    var reply = firstReply(l, at);
    if (reply !== undefined) p.replyMins = reply;
    return p;
  }

  // A call note: the chips picked and the words typed, kept in the history with when and who.
  // It changes nothing else.
  function note(l, text, at, by, chips) {
    var picked = [];
    (Array.isArray(chips) ? chips : []).forEach(function (c) { if (NOTE_CHIPS.indexOf(c) !== -1 && picked.indexOf(c) === -1) picked.push(c); });
    return { log: logOf(l).concat([{ at: at, by: by || "", type: "note", note: String(text || "").trim(), chips: picked }]) };
  }
  // The call notes on a lead, newest first: [{ at, by, chips, text }]. Things the app logs by
  // itself (Booked, Deposit paid) and empty notes are left out.
  function callNotes(l) {
    return logOf(l).filter(function (e) {
      return e.type === "note" && !e.outcome && (String(e.note || "").trim() || (Array.isArray(e.chips) && e.chips.length));
    }).map(function (e) {
      return { at: e.at, by: e.by || "", chips: Array.isArray(e.chips) ? e.chips.slice() : [], text: String(e.note || "").trim() };
    }).sort(function (a, b) { return String(b.at || "").localeCompare(String(a.at || "")); });
  }
  // One short line for a note: "Pet hair, wants Saturday".
  function noteLine(n) {
    return n ? n.chips.concat(n.text ? [n.text] : []).join(", ") : "";
  }
  // How often each chip was picked, most first: [{ chip, times, leads }]. keep(note, lead) says
  // which notes count (a period, a person). Leads marked not real are left out.
  function chipCounts(leads, keep) {
    var o = {};
    NOTE_CHIPS.forEach(function (c) { o[c] = { chip: c, times: 0, leads: 0 }; });
    (leads || []).forEach(function (l) {
      if (!l || l.junk) return;
      var seen = {};
      callNotes(l).forEach(function (n) {
        if (keep && !keep(n, l)) return;
        n.chips.forEach(function (c) {
          if (!o[c]) return;
          o[c].times++;
          if (!seen[c]) { seen[c] = true; o[c].leads++; }
        });
      });
    });
    return NOTE_CHIPS.map(function (c) { return o[c]; }).sort(function (a, b) { return b.times - a.times || NOTE_CHIPS.indexOf(a.chip) - NOTE_CHIPS.indexOf(b.chip); });
  }

  /*
    A stage picked by hand in the … menu. Booked goes through book() (it needs a day); Done is
    marked done by the page (reviews.js). Waiting needs a reason: no_reply, lost or not_real.
  */
  function setStage(l, stage, today, reason, at) {
    var p = { stage: stage, rolledOn: "" };
    if (stage !== "Waiting") {
      p.waitReason = "";
      if (l.junk) p.junk = false;
    }
    if (stage === "New") assign(p, { touches: 0, chaseFrom: "", lastTouchOn: "", nextFollowUp: "" });
    else if (stage === "Chasing") {
      var t = Number(l.touches) || 0, mid = stageOf(l, today) === "Chasing" && t >= 1 && t < TOUCHES;
      assign(p, { touches: mid ? t : 1, chaseFrom: mid && l.chaseFrom ? l.chaseFrom : today, nextFollowUp: today });
    } else if (stage === "Waiting") {
      var r = WAIT_REASONS[reason] ? reason : "no_reply";
      assign(p, { waitReason: r, junk: r === "not_real", nextFollowUp: "", waitedAt: at || "", waitedHow: "hand" });
      if (r === "lost" && !LOST_REASONS[l.lostReason]) assign(p, { lostReason: "other", lostWhy: LOST_WORDS.other });
    } else p.nextFollowUp = "";
    return p;
  }

  // A tag picked by hand. It only changes where the lead sits on Today.
  function retag(l, tag) {
    return { score: TAGS.indexOf(tag) !== -1 ? tag : "", scoreBy: "human" };
  }

  // "Touch 2 of 4" for the next touch, or "" when the lead isn't being chased.
  function touchLabel(l, today) {
    var stage = stageOf(l, today);
    if (stage === "New") return "Touch 1 of " + TOUCHES;
    if (stage !== "Chasing") return "";
    return "Touch " + Math.min((Number(l.touches) || 0) + 1, TOUCHES) + " of " + TOUCHES;
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
  // First contact picked (or changed) by hand; an unknown key clears it.
  function setFirstContact(key, at, by) {
    if (!FIRST_CONTACT[key]) return { firstContact: "", firstContactAt: "", firstContactBy: "" };
    return { firstContact: key, firstContactAt: at, firstContactBy: by || "" };
  }
  /*
    How fast the first reply was: { bucket, mins, manual }, bucket one of "5", "30", "30plus",
    "nextday". The First contact picked by hand when there is one; else worked out from the app's
    own reply time (from 8:00am for a lead in overnight; next day when the reply came on a later
    day than the clock started). null when neither is known.
  */
  function replySpeed(l, h) {
    if (!l) return null;
    if (FIRST_CONTACT[l.firstContact]) return { bucket: l.firstContact, mins: null, manual: true };
    h = h || hours();
    var m = replyMinutes(l, h);
    if (m == null) return null;
    var c = clockStart(l.createdAt, h), at = c ? new Date(c.getTime() + m * 6e4) : null;
    var bucket = m <= 5 ? "5" : m <= 30 ? "30" : at && canberraDate(at) > canberraDate(c) ? "nextday" : "30plus";
    return { bucket: bucket, mins: m, manual: false };
  }
  // Replied within 5 minutes (the "Replied ≤5 min" number).
  function repliedFast(l, h) {
    var sp = replySpeed(l, h);
    return !!sp && sp.bucket === "5";
  }

  /*
    The timer on a new lead: { mins, level } with level green (under 5 minutes), orange (5 to 15)
    or red (over 15), counted from when its clock started. A lead in overnight has level "wait"
    and startsAt (8:00am) until then.
  */
  function replyTimer(l, now, h) {
    var c = clockStart(arrivedAt(l), h);
    if (!c) return null;
    if (c > now) return { mins: 0, level: "wait", startsAt: c };
    var m = Math.floor((now - c) / 6e4);
    return { mins: m, level: m < 5 ? "green" : m <= 15 ? "orange" : "red" };
  }

  /* ------------------------------------------------------------ Today */

  function isFresh(l, stage) {
    return stage === "New" || (stage === "Chasing" && againPending(l));
  }
  // The day a lead's next touch fell due: the day its reply clock started for a new lead, else
  // nextFollowUp. "" when it isn't being chased.
  function dueDay(l, today, h) {
    var stage = stageOf(l, today);
    if (isFresh(l, stage)) {
      var c = clockStart(arrivedAt(l), h || hours());
      return c ? canberraDate(c) : today;
    }
    if (stage === "Chasing") return isDay(l.nextFollowUp) ? l.nextFollowUp : today;
    return "";
  }
  // Already 2 or more days overdue on the day this version went live (`since`): left for the
  // one-time backlog clear in Settings, so it's never moved without the "still keen?" text.
  function isBacklog(l, today, h, since) {
    if (!since || !l || l.junk) return false;
    var stage = stageOf(l, today);
    if (stage !== "Chasing" || againPending(l)) return false;
    var d = dueDay(l, today, h);
    return !!d && daysBetween(d, since) >= OVERDUE_DAYS;
  }
  // A touch 2 or more days overdue: the lead moves to Waiting (No reply) instead of piling up.
  // Not a lead that was already that late when this version went live (see isBacklog).
  function shouldAutoWait(l, today, h, since) {
    if (!since || !l || l.junk) return false;
    var stage = stageOf(l, today);
    if (stage !== "New" && stage !== "Chasing") return false;
    var d = dueDay(l, today, h);
    if (!d || daysBetween(d, today) < OVERDUE_DAYS) return false;
    return daysBetween(d, since) < OVERDUE_DAYS;
  }
  function autoWaitPatch(at) {
    return { stage: "Waiting", waitReason: "no_reply", nextFollowUp: "", waitedAt: at, waitedHow: "auto" };
  }
  // Today was full: this one's touch moves to tomorrow.
  function rollPatch(today) {
    return { nextFollowUp: addDays(today, 1), rolledOn: today };
  }
  // Brand-new first, then Hot, then Warm, then the rest; the oldest first within each.
  function rank(l, today) {
    if (isFresh(l, stageOf(l, today))) return 0;
    var i = TAGS.indexOf(l.score);
    return i === 0 ? 1 : i === 1 ? 2 : 3;
  }
  function byRank(today) {
    return function (a, b) {
      return rank(a, today) - rank(b, today) || String(a.createdAt || a.date || "").localeCompare(String(b.createdAt || b.date || "")) || String(a.id).localeCompare(String(b.id));
    };
  }
  /*
    Today's one list: the leads with a touch due today or overdue, in order, at most 10.
    o is { now, hours, who, all, since, max }. Without `all`, only `who`'s leads (and any with no
    owner). Returns { show, extra, later, backlog, rolled }: extra is the rest of the list (to
    roll to tomorrow), later counts new leads that came in overnight (their clock starts at 8:00am),
    backlog the old overdue leads left for the backlog clear, rolled those already rolled today.
  */
  function todayList(leads, o) {
    o = o || {};
    var now = o.now || new Date(), h = o.hours || hours(), today = canberraDate(now), max = o.max || TODAY_MAX;
    var due = [], later = 0, backlog = 0, rolled = 0;
    (leads || []).forEach(function (l) {
      try {
        if (!l || l.junk) return;
        if (!o.all && o.who && l.owner && l.owner !== o.who) return;
        var stage = stageOf(l, today);
        if (stage !== "New" && stage !== "Chasing") return;
        if (shouldAutoWait(l, today, h, o.since)) return;
        if (isFresh(l, stage)) {
          var c = clockStart(arrivedAt(l), h);
          if (c && c > now) later++;
          else due.push(l);
          return;
        }
        if (isBacklog(l, today, h, o.since)) { backlog++; return; }
        if (l.rolledOn === today && isDay(l.nextFollowUp) && l.nextFollowUp > today) { rolled++; return; }
        if (dueDay(l, today, h) <= today) due.push(l);
      } catch (e) { /* a lead that can't be read is left off Today, never the app */ }
    });
    due.sort(byRank(today));
    return { show: due.slice(0, max), extra: due.slice(max), later: later, backlog: backlog, rolled: rolled };
  }
  // The Chasing leads that came in before `before`, for the one-time backlog clear. Oldest first.
  function backlogLeads(leads, before, today) {
    return (leads || []).filter(function (l) {
      return l && !l.junk && stageOf(l, today) === "Chasing" && isDay(dayOf(l)) && dayOf(l) < before;
    }).sort(function (a, b) { return String(a.createdAt || a.date || "").localeCompare(String(b.createdAt || b.date || "")); });
  }
  function backlogPatch(at) {
    return { stage: "Waiting", waitReason: "no_reply", nextFollowUp: "", rolledOn: "", waitedAt: at, waitedHow: "backlog" };
  }

  // Today's jobs: booked (or done) for today, in time order (no time last). o is { who, all }.
  function todaysJobs(leads, today, o) {
    o = o || {};
    return (leads || []).filter(function (l) {
      return l && !l.junk && l.jobDate === today && isBooked(l, today) && (o.all || !o.who || !l.owner || l.owner === o.who);
    }).sort(function (a, b) {
      var ta = toMinutes(a.jobTime, 9999), tb = toMinutes(b.jobTime, 9999);
      return ta - tb || String(a.name || "").localeCompare(String(b.name || ""));
    });
  }
  // "On my way" was sent: when, and who.
  function onMyWay(l, at, by) {
    return { onMyWayAt: at, onMyWayBy: by || "", log: logOf(l).concat([{ at: at, by: by || "", type: "text", outcome: "On my way", note: "" }]) };
  }
  // A deposit link was made for the lead (s: { id, url, expiresAt }, for: { date, time }).
  function depositLink(l, s, at, by, forDay) {
    forDay = forDay || {};
    return {
      depositSessionId: s.id, depositUrl: s.url, depositExpiresAt: s.expiresAt || "", depositLinkAt: at,
      depositDate: forDay.date || "", depositTime: forDay.time || "",
      log: logOf(l).concat([{ at: at, by: by || "", type: "note", outcome: "Deposit link", note: "" }]),
    };
  }
  /*
    The $50 deposit was paid (d: { at, sessionId, linkId, amount, date, time }; sessionId is the
    payment's Checkout Session, linkId its Payment Link): the lead shows "Deposit
    paid ✓", and one not booked yet moves to Booked, taking the day and time the link was made
    for when it has none of its own.
  */
  function depositPaid(l, d, today) {
    var amount = d.amount == null ? DEPOSIT : d.amount;
    var p = { depositPaid: "Yes", depositPaidAt: d.at, depositAmount: amount, depositSessionId: l.depositSessionId || d.linkId || d.sessionId || "", depositCheckoutId: d.sessionId || "" };
    var stage = stageOf(l, today);
    if (stage !== "Booked" && stage !== "Done") {
      assign(p, { stage: "Booked", waitReason: "", nextFollowUp: "", rolledOn: "" });
      if (l.junk) p.junk = false;
    }
    if (!isDay(l.jobDate) && isDay(d.date)) p.jobDate = d.date;
    if (!l.jobTime && d.time) p.jobTime = d.time;
    p.log = logOf(l).concat([{ at: d.at, by: "Stripe", type: "note", outcome: "Deposit paid", note: "$" + amount + " deposit paid" }]);
    return p;
  }

  /*
    A job someone's about to add by hand that's already here as a booked lead: same phone, or the
    same first name, with a job day within 3 days. Returns that lead, or null. Adding it again
    would count its money twice.
  */
  function sameJob(leads, o) {
    var key = phoneKey(o.phone), first = String(o.name || "").toLowerCase().trim().split(/\s+/)[0];
    return (leads || []).filter(function (l) {
      if (!l || l.junk || !isBooked(l) || !isDay(l.jobDate) || !isDay(o.jobDate)) return false;
      if (Math.abs(daysBetween(l.jobDate, o.jobDate)) > 3) return false;
      var lf = String(l.name || "").toLowerCase().trim().split(/\s+/)[0];
      return (key.length >= 6 && phoneKey(l.phone) === key) || (!!first && first === lf);
    }).sort(function (a, b) { return Math.abs(daysBetween(a.jobDate, o.jobDate)) - Math.abs(daysBetween(b.jobDate, o.jobDate)); })[0] || null;
  }

  /* ------------------------------------------------------------ the numbers */

  // The Monday of the week a day is in (weeks run Monday to Sunday).
  function mondayOf(date) {
    var dow = new Date(date + "T12:00:00Z").getUTCDay();
    return addDays(date, -((dow + 6) % 7));
  }
  /*
    Total ad spend from the weekly form: weeks is [{ weekOf: "2026-10-05", total: 350 }] (an
    older week saved per ad, { byAd: { "Brand film": 120 } }, counts as the sum). keep(weekOf)
    says which weeks count.
  */
  function adSpend(weeks, keep) {
    var total = 0;
    (weeks || []).forEach(function (w) {
      if (!w || !isDay(w.weekOf) || (keep && !keep(w.weekOf))) return;
      var n = Number(w.total);
      if (w.total == null || w.total === "" || !isFinite(n)) {
        n = 0;
        Object.keys(w.byAd || {}).forEach(function (ad) { var v = Number(w.byAd[ad]); if (isFinite(v) && v > 0) n += v; });
      }
      if (n > 0) total += n;
    });
    return total;
  }
  /*
    The money from booked jobs: { booked, collected, toCollect } in dollars. Booked is the price
    of every booked job (done or not); collected is the ones ticked Paid; the rest is still to
    collect.
  */
  function takings(leads, today) {
    var booked = 0, collected = 0;
    (leads || []).forEach(function (l) {
      if (!l || !isBooked(l, today)) return;
      var n = Number(l.revenue);
      if (!isFinite(n) || n <= 0) return;
      booked += n;
      if (l.paid === "Yes") collected += n;
    });
    return { booked: booked, collected: collected, toCollect: booked - collected };
  }
  // A lead from the ads: it came from a Meta ad, or it has an ad's name on it.
  function fromAds(l) {
    return !!l && (l.source === "Meta ad" || !!l.ad);
  }
  /*
    Cost per booked job from ads: the total spend divided by the leads from ads that booked.
    Returns { spend, leads, booked, perBooked } (perBooked null when nothing's booked or spent).
  */
  function costPerBooked(leads, spend, today) {
    var from = (leads || []).filter(fromAds);
    var booked = from.filter(function (l) { return isBooked(l, today); }).length;
    return { spend: spend, leads: from.length, booked: booked, perBooked: booked && spend ? spend / booked : null };
  }
  // Which ad a lead came from, as the By ad table shows it.
  function adLabel(l) {
    if (l.ad && String(l.ad).trim()) return String(l.ad).trim();
    if (l.fromAd === "none") return "Not from an ad";
    if (l.fromAd === "referral") return "Referral / repeat";
    return "Unknown";
  }
  // The By ad table: [{ ad, leads, booked, money, rate }], most leads first, Unknown last.
  function byAd(leads, today) {
    var groups = {};
    (leads || []).forEach(function (l) {
      if (!l || l.junk) return;
      var k = adLabel(l), g = groups[k] || (groups[k] = { ad: k, leads: 0, booked: 0, money: 0, items: [] });
      g.leads++;
      g.items.push(l);
      if (isBooked(l, today)) {
        g.booked++;
        var n = Number(l.revenue);
        if (isFinite(n) && n > 0) g.money += n;
      }
    });
    return Object.keys(groups).map(function (k) { var g = groups[k]; g.rate = g.leads ? g.booked / g.leads : 0; return g; })
      .sort(function (a, b) { return (a.ad === "Unknown") - (b.ad === "Unknown") || b.leads - a.leads || a.ad.localeCompare(b.ad); });
  }

  /*
    This week's money against the weekly goal. Weeks run Monday to Sunday by job date. A booked
    job counts at its price (else its quote): done once its day has come, else still booked.
    Returns { weekOf, done, booked, total, goal, left, daysLeft, pct } (goal, left, pct are null
    with no goal set). values, when given, is the week's jobs as [{ day, value }] (from the
    calendar, so a lead with two jobs counts both) instead of the leads.
  */
  function weekMoney(leads, today, goal, values) {
    var mon = mondayOf(today), sun = addDays(mon, 6), done = 0, booked = 0;
    var add = function (day, v) {
      if (!isDay(day) || day < mon || day > sun || !isFinite(v) || v <= 0) return;
      if (day <= today) done += v; else booked += v;
    };
    if (values) values.forEach(function (x) { if (x) add(x.day, Number(x.value)); });
    else (leads || []).forEach(function (l) {
      if (!l || l.junk || !isBooked(l, today)) return;
      add(l.jobDate, Number(l.revenue != null && l.revenue !== "" ? l.revenue : l.quoted));
    });
    var g = Number(goal) > 0 ? Number(goal) : null, total = done + booked;
    return { weekOf: mon, done: done, booked: booked, total: total, goal: g,
      left: g == null ? null : Math.max(0, g - total), daysLeft: daysBetween(today, sun),
      pct: g == null ? null : Math.min(100, Math.round(total / g * 100)) };
  }
  /*
    This week (Monday to Sunday): the money against the goal, jobs done, ceramics sold, new
    maintenance plans, new leads replied to within 5 minutes, and the upsell ticks on this week's
    jobs. o is { goal, hours, now, values } (values: see weekMoney). Each count keeps its leads (in
    .items) for the run-down. A plan visit for someone already on a plan isn't a new plan.
  */
  function weekStats(leads, today, o) {
    o = o || {};
    var h = o.hours || hours(), now = o.now || new Date();
    var mon = mondayOf(today), sun = addDays(mon, 6);
    var inWeek = function (d) { return isDay(d) && d >= mon && d <= sun; };
    var live = (leads || []).filter(function (l) { return l && !l.junk; });
    var jobs = live.filter(function (l) { return isBooked(l, today) && inWeek(l.jobDate); });
    var done = jobs.filter(function (l) { return stageOf(l, today) === "Done"; });
    var ceramics = jobs.filter(function (l) { return l.service === "Ceramic"; });
    var hadPlan = function (l) {
      var key = phoneKey(l.phone);
      return live.some(function (x) {
        if (x === l || x.service !== "Maintenance plan" || !isBooked(x, today) || !isDay(x.jobDate) || x.jobDate >= l.jobDate) return false;
        return (!!l.repeatOf && x.id === l.repeatOf) || (key.length >= 8 && phoneKey(x.phone) === key);
      });
    };
    var plans = live.filter(function (l) {
      if (l.plan === "Yes" && isDay(l.planSince)) return inWeek(l.planSince);
      return isBooked(l, today) && l.service === "Maintenance plan" && inWeek(l.jobDate) && !hadPlan(l);
    });
    // New leads this week whose clock has run 5 minutes or that have been replied to, and how fast
    // each was (First contact when it's been picked, else the app's own time).
    var fresh = live.filter(function (l) {
      if (l.kind === "job" || !inWeek(dayOf(l))) return false;
      if (replySpeed(l, h)) return true;
      var c = clockStart(l.createdAt, h);
      return !!c && now - c >= 5 * 6e4;
    });
    var fast = fresh.filter(function (l) { return repliedFast(l, h); });
    var byBucket = {};
    FIRST_CONTACT_KEYS.concat("none").forEach(function (k) { byBucket[k] = []; });
    fresh.forEach(function (l) { var sp = replySpeed(l, h); byBucket[sp ? sp.bucket : "none"].push(l); });
    var buckets = FIRST_CONTACT_KEYS.concat("none").map(function (k) {
      return { key: k, label: FIRST_CONTACT[k] || "Not known yet", n: byBucket[k].length, pct: fresh.length ? Math.round(100 * byBucket[k].length / fresh.length) : 0, items: byBucket[k] };
    });
    var ceramicOffered = jobs.filter(function (l) { return l.offeredCeramic === "Yes"; });
    var planOffered = jobs.filter(function (l) { return l.offeredPlan === "Yes"; });
    return {
      weekOf: mon, money: weekMoney(live, today, o.goal, o.values),
      jobsDone: { n: done.length, items: done }, ceramics: { n: ceramics.length, items: ceramics }, plans: { n: plans.length, items: plans },
      replied: { fast: fast.length, of: fresh.length, items: fresh, buckets: buckets },
      upsell: { jobs: jobs.length, items: jobs, ceramic: ceramicOffered.length, plan: planOffered.length },
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
    return s === "New" || s === "Chasing" || s === "Waiting";
  }
  /*
    A new enquiry from a phone number that's already a lead. Returns { merge: lead } when it
    should go on that lead (it's still open, or came in within 30 days and its job isn't done
    yet), { repeatOf: id } otherwise (a new lead marked Repeat: someone from longer ago, or a
    customer whose job is done, so the old job and its takings stay as they were), or {} when
    the number is new.
  */
  function matchPhone(leads, phone, today) {
    var key = phoneKey(phone);
    if (key.length < 6) return {};
    var same = (leads || []).filter(function (l) { return l && !l.junk && phoneKey(l.phone) === key; })
      .sort(function (a, b) { return String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")); });
    if (!same.length) return {};
    var hit = same.filter(function (l) {
      var d = dayOf(l);
      return isOpen(l, today) || (stageOf(l, today) !== "Done" && isDay(d) && daysBetween(d, today) <= 30);
    })[0];
    return hit ? { merge: hit } : { repeatOf: same[0].id };
  }
  /*
    The fields to save when `fresh` (a lead as built for saving) is merged into `l`: the enquiry
    is added to its list, empty fields are filled, and the lead comes back to the top of Today.
    A lead that was Waiting starts its four touches again.
  */
  function mergeEnquiry(l, fresh, at) {
    var p = {
      enquiries: (Array.isArray(l.enquiries) ? l.enquiries : []).concat([{
        at: at, source: fresh.source || "", ad: fresh.ad || "", service: fresh.service || "", car: fresh.car || "", notes: fresh.notes || "",
      }]),
      againAt: at, rolledOn: "",
    };
    ["name", "car", "suburb", "email", "formId", "timeline", "ad", "fromAd"].forEach(function (k) { if (!l[k] && fresh[k]) p[k] = fresh[k]; });
    if ((!l.service || l.service === "Not sure") && fresh.service && fresh.service !== "Not sure") p.service = fresh.service;
    if (!l.score && fresh.score) { p.score = fresh.score; p.scoreBy = fresh.scoreBy; }
    var stage = stageOf(l);
    if (stage === "Waiting") {
      assign(p, { stage: "New", waitReason: "", chaseFrom: "", touches: 0, lastTouchOn: "", nextFollowUp: canberraDate(at) });
    } else if (stage === "Chasing") {
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
    The five-stage fields for a lead saved by an older version of the app. Its old status is kept
    in old_status. Quoted becomes Chasing (the quote stays in quoted, and counted as a touch);
    Review asked becomes Done with the Review asked tick; Lost and Not real become Waiting with
    that reason (Not real stays junk, out of every number); Waiting is Waiting (No reply). Done
    jobs that aren't paid show the Owes money tick from paid, which isn't changed. Only fields are
    added or set: nothing is removed.
  */
  function upgradeFields(l, today) {
    var was = v3Stage(l, today);
    var stage = FROM_V3[was] || "New";
    var f = { old_status: l.old_status || (l.junk ? "Not real" : was), modelVersion: VERSION };
    if (l.junk) { stage = "Waiting"; f.waitReason = "not_real"; }
    else if (stage === "Waiting") f.waitReason = was === "Lost" ? "lost" : WAIT_REASONS[l.waitReason] ? l.waitReason : "no_reply";
    else f.waitReason = "";
    f.stage = stage;
    if (was === "Review asked" && l.reviewAsked !== "Yes") f.reviewAsked = "Yes";
    if (stage === "Waiting" && f.waitReason === "lost" && !LOST_REASONS[l.lostReason]) f.lostReason = OLD_LOST[l.lostWhy] || "other";
    if (stage === "Chasing") {
      var t = (Number(l.touches) || 0) + (was === "Quoted" ? 1 : 0);
      f.touches = Math.min(TOUCHES - 1, Math.max(1, t));
      if (!isDay(l.chaseFrom)) f.chaseFrom = (isDay(l.quotedOn) && l.quotedOn) || touchDayList(l.log)[0] || canberraDate(l.lastContact) || (isDay(l.date) ? l.date : today);
      if (!isDay(l.nextFollowUp)) f.nextFollowUp = today;
    }
    // Leads from before version 3 also get what that version added.
    if (l.timeline == null) f.timeline = timelineFromNotes(l.notes);
    if (l.score == null) { f.score = scoreOf(f.timeline || l.timeline); f.scoreBy = f.score ? "timeline" : ""; }
    if (l.email == null) f.email = emailFromNotes(l.notes);
    ["formId", "againAt", "repeatOf", "fromAd", "offeredCeramic", "offeredPlan", "planSince", "rolledOn", "lastTouchOn", "quotedOn"].forEach(function (k) { if (l[k] == null) f[k] = ""; });
    if (!Array.isArray(l.enquiries)) f.enquiries = [];
    if (typeof l.junk !== "boolean") f.junk = !!l.junk;
    return f;
  }
  /*
    What the upgrade does to each lead that needs it: { rows: [{ id, name, from, to, patch }], todo }.
    The earlier value of every field the patch changes is kept in v4Was. A lead that can't be read
    is left as it is.
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
          Object.keys(patch).forEach(function (k) {
            if (k !== "modelVersion" && k in l && JSON.stringify(patch[k]) !== JSON.stringify(l[k])) was[k] = l[k] == null ? "" : l[k];
          });
          was.modelVersion = l.modelVersion == null ? "" : l.modelVersion;
          patch.v4Was = was;
        }
        if (!hasOwner(l)) {
          var owner = lastLoggedBy(l) || PEOPLE[turn++ % 2];
          patch.owner = owner;
          patch.ownerWas = l.owner || "";
        }
        rows.push({ id: l.id, name: l.name || "No name", from: patch.old_status || stageOf(l, today), to: patch.stage || stageOf(l, today), patch: patch });
      } catch (e) { /* left as it is */ }
    });
    return { rows: rows, todo: rows.length };
  }

  /*
    Going cold, for the Board: a lead being worked that nobody has kept up with. New counts from
    when it came in (1 day orange, 2 red); Chasing from the day its touch fell due (1 day past
    orange, 2 red, when it moves to Waiting by itself). Returns { level: "warm" | "cold", days, since } or null.
  */
  function coldness(l, today) {
    if (!l || l.junk) return null;
    var stage = stageOf(l, today), from;
    if (stage === "New") from = isDay(canberraDate(l.createdAt)) ? canberraDate(l.createdAt) : l.date;
    else if (stage === "Chasing") from = isDay(l.nextFollowUp) ? l.nextFollowUp : "";
    else return null;
    if (!isDay(from)) return null;
    var days = daysBetween(from, today);
    if (days < 1) return null;
    return { level: days >= 2 ? "cold" : "warm", days: days, since: stage === "New" ? "in" : "due" };
  }
  /*
    What a lead is worth on the board: the booked price once booked, else the quote, else the
    price sheet's "from" price for its service as an estimate. Returns { amount, est } or null.
  */
  function dealValue(l, today, sheetPrice) {
    var stage = stageOf(l, today), n = function (v) { return v === "" || v == null || isNaN(Number(v)) ? null : Number(v); };
    if (BOOKED.indexOf(stage) !== -1 && n(l.revenue) != null) return { amount: n(l.revenue), est: false };
    if (n(l.quoted) != null) return { amount: n(l.quoted), est: false };
    return typeof sheetPrice === "number" ? { amount: sheetPrice, est: true } : null;
  }

  var api = {
    VERSION: VERSION, STAGES: STAGES, PEOPLE: PEOPLE, TAGS: TAGS, TIMELINES: TIMELINES, WAIT_REASONS: WAIT_REASONS,
    LOST_REASONS: LOST_REASONS, LOST_WORDS: LOST_WORDS, OLD_LOST: OLD_LOST, STEPS: STEPS, TOUCHES: TOUCHES, OVERDUE_DAYS: OVERDUE_DAYS,
    TODAY_MAX: TODAY_MAX, HOURS: HOURS, NOTE_CHIPS: NOTE_CHIPS, DEPOSIT: DEPOSIT, FIRST_CONTACT: FIRST_CONTACT, FIRST_CONTACT_KEYS: FIRST_CONTACT_KEYS,
    canberraDate: canberraDate, canberraMinutes: canberraMinutes, canberraAt: canberraAt, weekday: weekday, addDays: addDays, daysBetween: daysBetween, isDay: isDay,
    hours: hours, clock: clock, inHours: inHours, clockStart: clockStart,
    timelineOf: timelineOf, timelineFromNotes: timelineFromNotes, emailFromNotes: emailFromNotes, scoreOf: scoreOf, plainNotes: plainNotes,
    isTouch: isTouch, touchDays: touchDays, touchDayList: touchDayList, lastTouch: lastTouch, againPending: againPending,
    v3Stage: v3Stage, stageOf: stageOf, waitReasonOf: waitReasonOf, statusFor: statusFor, isBooked: isBooked, owesMoney: owesMoney, reviewAsked: reviewAsked,
    sync: sync, newFields: newFields, dueAfter: dueAfter, touch: touch, book: book, parsePrice: parsePrice, timeLabel: timeLabel,
    note: note, callNotes: callNotes, noteLine: noteLine, chipCounts: chipCounts, setStage: setStage, retag: retag, touchLabel: touchLabel,
    todaysJobs: todaysJobs, onMyWay: onMyWay, depositLink: depositLink, depositPaid: depositPaid,
    arrivedAt: arrivedAt, isOvernight: isOvernight, replyMinutes: replyMinutes, replyTimer: replyTimer,
    setFirstContact: setFirstContact, replySpeed: replySpeed, repliedFast: repliedFast,
    dueDay: dueDay, isBacklog: isBacklog, shouldAutoWait: shouldAutoWait, autoWaitPatch: autoWaitPatch, rollPatch: rollPatch,
    rank: rank, todayList: todayList, backlogLeads: backlogLeads, backlogPatch: backlogPatch, sameJob: sameJob,
    mondayOf: mondayOf, adSpend: adSpend, takings: takings, fromAds: fromAds, costPerBooked: costPerBooked, adLabel: adLabel, byAd: byAd,
    weekMoney: weekMoney, weekStats: weekStats,
    phoneKey: phoneKey, isOpen: isOpen, matchPhone: matchPhone, mergeEnquiry: mergeEnquiry,
    needsUpgrade: needsUpgrade, upgradeFields: upgradeFields, plan: plan,
    coldness: coldness, dealValue: dealValue,
  };
  root.ILModel = api;
})(typeof window !== "undefined" ? window : globalThis);
