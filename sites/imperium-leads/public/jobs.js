/*
  Jobs and events: the calendar's plain logic (no page, no database), shared by the page and the
  tests. The page loads it as window.ILJobs, after model.js.

  A job is the booked work for a lead. The customer (name, phone, address, suburb, car) stays on
  the lead and is read from there, never copied. A job's own fields (collection "jobs"):

    number       1001, 1002, … counting up
    leadId       the lead it's for (every job has one: "+ Add" makes a lead for a new customer)
    service      Full Detail, Interior, Exterior, Paint Correction, Ceramic Coating,
                 Maintenance Plan or Other
    addOns       [{ name, price }], e.g. Mat stain removal $55
    price        as typed: "280" or a range "280-350"; finalPrice once it's completed
    date, start, end    "2026-10-24", "09:00", "12:30"; allDay instead of times
    crew         names from Settings; kit: a kit or van from Settings
    status       Scheduled, In Progress, Completed or Cancelled
    notes, createdAt, createdBy, updatedAt

  The lead keeps its booking fields (jobDate, jobTime, revenue, priceRange) in step with its job,
  so Today, the Board and the Numbers work as they always have.

  An event isn't a job (collection "events"): type meeting, timeoff or other; title, date, start,
  end or allDay, who (names), notes.
*/
(function (root) {
  "use strict";
  var M = root.ILModel;

  var SERVICES = ["Full Detail", "Interior", "Exterior", "Paint Correction", "Ceramic Coating", "Maintenance Plan", "Other"];
  // A lead's service as a job's, and back.
  var FROM_LEAD = { "Full detail": "Full Detail", Interior: "Interior", Exterior: "Exterior", Correction: "Paint Correction", Ceramic: "Ceramic Coating", "Maintenance plan": "Maintenance Plan" };
  var TO_LEAD = {};
  Object.keys(FROM_LEAD).forEach(function (k) { TO_LEAD[FROM_LEAD[k]] = k; });
  var STATUSES = ["Scheduled", "In Progress", "Completed", "Cancelled"];
  var EVENT_TYPES = { meeting: "Team Meeting", timeoff: "Time Off", other: "Other" };
  var FIRST_NUMBER = 1001;
  // Settings (settings/calendar) fill in from these when they're not set.
  var DEFAULTS = {
    crew: ["Lucas", "Nick", "AJ", "Ananth", "Angus"],
    kits: ["Kit 1", "Kit 2"],
    // Hours, or "allday".
    lengths: { "Full Detail": 3.5, Interior: 2, Exterior: 1.5, "Maintenance Plan": 2.5, "Paint Correction": "allday", "Ceramic Coating": "allday", Other: 2 },
    addOns: [{ name: "Mat stain removal", price: 55 }, { name: "Travel fee", price: null }],
  };

  function clean(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (s) { s = String(s == null ? "" : s).trim(); if (s && out.indexOf(s) === -1) out.push(s); });
    return out;
  }
  // The saved calendar settings, with the defaults filling any gap.
  function settings(saved) {
    saved = saved || {};
    var lengths = {};
    SERVICES.forEach(function (s) {
      var v = saved.lengths && saved.lengths[s];
      lengths[s] = v === "allday" ? "allday" : Number(v) > 0 && Number(v) <= 14 ? Number(v) : DEFAULTS.lengths[s];
    });
    var addOns = Array.isArray(saved.addOns) ? saved.addOns.filter(function (a) { return a && String(a.name || "").trim(); }).map(function (a) {
      return { name: String(a.name).trim(), price: a.price === "" || a.price == null || isNaN(Number(a.price)) ? null : Number(a.price) };
    }) : DEFAULTS.addOns.slice();
    return { crew: clean(saved.crew).length ? clean(saved.crew) : DEFAULTS.crew.slice(), kits: clean(saved.kits).length ? clean(saved.kits) : DEFAULTS.kits.slice(), lengths: lengths, addOns: addOns };
  }
  function serviceFromLead(s) {
    return FROM_LEAD[s] || "Other";
  }
  function serviceToLead(s) {
    return TO_LEAD[s] || "Not sure";
  }
  // A service from words like a booking calendar's name ("Ceramic Coating - 1 day", "Interior
  // Detail"); null when the words don't say.
  function serviceFromText(text) {
    var t = String(text || "").toLowerCase();
    if (!t.trim()) return null;
    if (/ceramic|coating/.test(t)) return "Ceramic Coating";
    if (/correction|polish|swirl|paint\s*enhance/.test(t)) return "Paint Correction";
    if (/maintenance|maint\b|monthly|fortnightly/.test(t)) return "Maintenance Plan";
    if (/full|complete|in\s*(&|and|\+)\s*out|inside\s*(&|and|\+)\s*out/.test(t) || (/interior|inside/.test(t) && /exterior|outside/.test(t))) return "Full Detail";
    if (/interior|inside/.test(t)) return "Interior";
    if (/exterior|outside|wash/.test(t)) return "Exterior";
    return null;
  }

  /* ------------------------------------------------------------ times */

  function toMin(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ""));
    return m ? +m[1] * 60 + +m[2] : null;
  }
  function hm(n) {
    n = Math.max(0, Math.min(24 * 60 - 1, Math.round(n)));
    return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
  }
  // How long a service takes by default: { allDay } or { minutes }.
  function lengthOf(service, cfg) {
    var v = settings(cfg).lengths[service] != null ? settings(cfg).lengths[service] : 2;
    return v === "allday" ? { allDay: true, minutes: 0 } : { allDay: false, minutes: Math.round(v * 60) };
  }
  // The end time for a start, from the service's default length ("" for an all-day service).
  function endFor(start, service, cfg) {
    var s = toMin(start), len = lengthOf(service, cfg);
    return s == null || len.allDay ? "" : hm(s + len.minutes);
  }
  // "9:00am - 12:30pm", "All-day", "Start 9:00am", or "No time set".
  function timeLabel(x) {
    if (!x) return "";
    if (x.allDay) return "All-day";
    var s = toMin(x.start), e = toMin(x.end);
    if (s != null && e != null && e > s) return M.clock(s) + " - " + M.clock(e);
    if (s != null) return "Start " + M.clock(s);
    return "No time set";
  }
  // Minutes from midnight for sorting: all-day first, no time last.
  function sortKey(x) {
    if (x.allDay) return -1;
    var s = toMin(x.start);
    return s == null ? 9999 : s;
  }

  /* ------------------------------------------------------------ money */

  function addOnTotal(job) {
    return (Array.isArray(job && job.addOns) ? job.addOns : []).reduce(function (a, x) { var n = Number(x && x.price); return a + (isFinite(n) && n > 0 ? n : 0); }, 0);
  }
  // { low, high, text }: the price (a range is fine) with the add-ons on top. low is null with no price.
  function priceOf(job) {
    var p = M.parsePrice(job && job.price), add = addOnTotal(job);
    if (p.price == null) return { low: add || null, high: add || null, text: add ? "$" + add : "" };
    var hi = p.range ? Number(p.range.split("–")[1]) : p.price;
    var low = p.price + add, high = hi + add;
    return { low: low, high: high, text: high > low ? "$" + low + "–" + high : "$" + low };
  }
  // What the job is worth: the final price once completed, else the low end of the price.
  function total(job) {
    if (job && job.finalPrice != null && job.finalPrice !== "" && isFinite(Number(job.finalPrice))) return Number(job.finalPrice);
    return priceOf(job).low;
  }
  /*
    The money from the jobs, by job day: { booked, collected, owed, upcoming, items, noPrice }.
    keep(day) says which days count, keepLead(lead) whose jobs. Each job counts at total(), with
    state "paid", "owed" or "upcoming" (in .items with its lead). A lead's own job is paid when
    the lead is ticked Paid, owed once it's done and isn't, else still to come. An older job of the
    same lead (done before they booked again) counts as paid. Cancelled and deleted jobs, and the
    jobs of deleted or not-real leads, don't count. Jobs with no price are in .noPrice.
  */
  function money(jobs, leads, today, keep, keepLead) {
    var byId = {}, live = (jobs || []).filter(function (j) { return j && !j.deleted && j.status !== "Cancelled"; });
    var out = { booked: 0, collected: 0, owed: 0, upcoming: 0, items: [], noPrice: [] };
    (leads || []).forEach(function (l) { if (l && l.id) byId[l.id] = l; });
    var cur = {};
    Object.keys(byId).forEach(function (id) { cur[id] = null; });
    live.forEach(function (j) {
      var c = cur[j.leadId];
      if (c === undefined) return;
      if (!c || String(j.createdAt || "") > String(c.createdAt || "") || (String(j.createdAt || "") === String(c.createdAt || "") && String(j.id) > String(c.id))) cur[j.leadId] = j;
    });
    live.forEach(function (j) {
      var l = byId[j.leadId];
      if (!l || l.deleted || l.junk || !M.isDay(j.date) || (keep && !keep(j.date)) || (keepLead && !keepLead(l))) return;
      var v = total(j);
      if (!(v > 0)) { out.noPrice.push({ job: j, lead: l }); return; }
      var state = cur[l.id] === j
        ? (l.paid === "Yes" ? "paid" : M.owesMoney(l, today) ? "owed" : "upcoming")
        : (j.status === "Completed" || (!!today && j.date < today) ? "paid" : "upcoming");
      out.booked += v;
      out[state === "paid" ? "collected" : state] += v;
      out.items.push({ job: j, lead: l, value: v, state: state });
    });
    return out;
  }

  /* ------------------------------------------------------------ jobs */

  function nextNumber(jobs) {
    var max = FIRST_NUMBER - 1;
    (jobs || []).forEach(function (j) { var n = Number(j && j.number); if (isFinite(n) && n > max) max = n; });
    return max + 1;
  }
  // "Full Detail - Mazda CX-5" (the car from the lead).
  function title(job, lead) {
    var car = String((lead && lead.car) || "").trim();
    return (job && job.service ? job.service : "Job") + (car ? " - " + car : "");
  }
  function blank(o) {
    var j = {
      number: null, leadId: "", service: "Full Detail", addOns: [], price: "", finalPrice: null,
      date: "", start: "", end: "", allDay: false, crew: [], kit: "", notes: "", status: "Scheduled",
      createdAt: "", createdBy: "", updatedAt: "",
    };
    Object.keys(o || {}).forEach(function (k) { j[k] = o[k]; });
    return j;
  }
  // The job a booked (or done) lead gets: its day, time and price, its service's default length.
  function fromLead(lead, number, cfg, at, by, today) {
    var service = serviceFromLead(lead.service), start = /^\d{1,2}:\d{2}$/.test(String(lead.jobTime || "")) ? lead.jobTime : "";
    var len = lengthOf(service, cfg), done = M.stageOf(lead, today) === "Done";
    return blank({
      number: number, leadId: lead.id, service: service,
      price: lead.priceRange ? lead.priceRange.replace("–", "-") : lead.revenue != null && lead.revenue !== "" ? String(lead.revenue) : lead.quoted != null && lead.quoted !== "" ? String(lead.quoted) : "",
      finalPrice: done && lead.revenue != null && lead.revenue !== "" ? Number(lead.revenue) : null,
      date: M.isDay(lead.jobDate) ? lead.jobDate : "", start: start, end: start ? endFor(start, service, cfg) : "",
      allDay: !start && len.allDay, status: done ? "Completed" : "Scheduled", createdAt: at, createdBy: by || "", updatedAt: at,
    });
  }
  // A lead's job now: its newest one (a lead booked again after its job was done has two).
  function currentJob(jobs, leadId) {
    var best = null;
    (jobs || []).forEach(function (j) {
      if (!j || j.leadId !== leadId) return;
      if (!best || String(j.createdAt || "") > String(best.createdAt || "") || (String(j.createdAt || "") === String(best.createdAt || "") && String(j.id) > String(best.id))) best = j;
    });
    return best;
  }
  // The id of the job made for a booked lead: the same on both phones, so they never make two.
  // A lead booked again after its job was done gets one for that day.
  function leadJobId(leadId, again, date) {
    return "lead-" + leadId + (again ? "-" + (date || "again") : "");
  }
  /*
    The jobs to make for booked leads that have none: [{ id, job }], numbered on from the jobs there
    are, by job day then when the lead came in. A booked lead whose job is done (and is booked for
    another day) gets a new one; one whose job was cancelled is left (it was cancelled on purpose,
    and booking it again brings that job back). `withDone` also makes jobs for done leads with a job
    day (the first time, so the calendar has the history).
  */
  function toMake(leads, jobs, cfg, today, at, withDone) {
    var want = [];
    (leads || []).forEach(function (l) {
      if (!l || l.junk) return;
      var s = M.stageOf(l, today), cur = currentJob(jobs, l.id);
      if (s === "Booked" && !cur) want.push({ l: l, again: false });
      else if (s === "Booked" && cur.status === "Completed" && M.isDay(l.jobDate) && l.jobDate !== cur.date) want.push({ l: l, again: true });
      else if (withDone && s === "Done" && !cur && M.isDay(l.jobDate)) want.push({ l: l, again: false });
    });
    want.sort(function (a, b) {
      return String(a.l.jobDate || "9999").localeCompare(String(b.l.jobDate || "9999")) || String(a.l.createdAt || "").localeCompare(String(b.l.createdAt || "")) || String(a.l.id).localeCompare(String(b.l.id));
    });
    var n = nextNumber(jobs);
    return want.map(function (w) { return { id: leadJobId(w.l.id, w.again, w.l.jobDate), job: fromLead(w.l, n++, cfg, at, "", today) }; });
  }
  /*
    Two jobs with the same number (made on both phones at once): the later one gets the next free
    number. Returns [{ id, number }]. Worked out the same way on either phone, so they agree.
  */
  function renumber(list) {
    var seen = {}, out = [], max = nextNumber(list.map(function (x) { return x.job; })) - 1;
    list.slice().sort(function (a, b) {
      return String(a.job.createdAt || "").localeCompare(String(b.job.createdAt || "")) || String(a.id).localeCompare(String(b.id));
    }).forEach(function (x) {
      var n = Number(x.job.number);
      if (!isFinite(n) || seen[n]) { max += 1; out.push({ id: x.id, number: max }); seen[max] = true; }
      else seen[n] = true;
    });
    return out;
  }
  /*
    The lead's booking fields from its job, so everything that reads the lead stays right: only
    the fields that differ. A completed job's final price becomes the lead's price.
  */
  function leadPatch(job, lead) {
    var p = {}, pr = priceOf(job), want = {
      jobDate: job.date || "", jobTime: job.allDay ? "" : job.start || "",
      revenue: job.status === "Completed" && job.finalPrice != null && job.finalPrice !== "" ? Number(job.finalPrice) : pr.low,
      priceRange: job.status !== "Completed" && pr.high > pr.low ? pr.low + "–" + pr.high : "",
    };
    if (want.revenue == null) delete want.revenue;
    Object.keys(want).forEach(function (k) {
      var had = lead[k] == null ? "" : lead[k];
      if (String(had) !== String(want[k])) p[k] = want[k];
    });
    return p;
  }
  // The job's fields from its lead, after the booking was changed on the lead (day, time, price).
  function jobPatch(lead, job, cfg) {
    var p = {};
    if ((lead.jobDate || "") !== (job.date || "")) p.date = lead.jobDate || "";
    var t = /^\d{1,2}:\d{2}$/.test(String(lead.jobTime || "")) ? lead.jobTime : "";
    if (t && t !== job.start) {
      // Moved: it keeps its own length, or the service's when it had none.
      var s0 = toMin(job.start), e0 = toMin(job.end);
      p.start = t; p.end = s0 != null && e0 != null && e0 > s0 ? hm(toMin(t) + e0 - s0) : endFor(t, job.service, cfg); p.allDay = false;
    }
    var price = lead.priceRange ? lead.priceRange.replace("–", "-") : lead.revenue != null && lead.revenue !== "" ? String(lead.revenue) : "";
    if (price && M.parsePrice(price).price !== M.parsePrice(job.price).price - 0 && !addOnTotal(job)) p.price = price;
    return p;
  }

  /* ------------------------------------------------------------ the calendar */

  // The Sunday that starts the week a day is in (the strip runs Sunday to Saturday).
  function sundayOf(date) {
    var dow = new Date(date + "T12:00:00Z").getUTCDay();
    return M.addDays(date, -dow);
  }
  function weekDays(date) {
    var s = sundayOf(date), out = [];
    for (var i = 0; i < 7; i++) out.push(M.addDays(s, i));
    return out;
  }
  /*
    The Agenda: [{ day, items }] for the days from `from` on (`days` of them) that have something,
    each day's items in time order (all-day first). items are { kind: "job"|"event", x }.
    o.service keeps only jobs of that service (events too when there's no service filter).
  */
  function agenda(jobs, events, from, days, o) {
    o = o || {};
    var to = M.addDays(from, days - 1), by = {};
    var add = function (kind, x) {
      if (!x || !M.isDay(x.date) || x.date < from || x.date > to) return;
      (by[x.date] = by[x.date] || []).push({ kind: kind, x: x });
    };
    (jobs || []).forEach(function (j) { if (!o.service || j.service === o.service) if (!o.keep || o.keep(j)) add("job", j); });
    if (!o.service) (events || []).forEach(function (e) { if (!o.keepEvent || o.keepEvent(e)) add("event", e); });
    return Object.keys(by).sort().map(function (d) {
      return { day: d, items: by[d].sort(function (a, b) { return sortKey(a.x) - sortKey(b.x) || (a.x.number || 0) - (b.x.number || 0); }) };
    });
  }
  // Which days have a job (for the dots under the strip): { "2026-10-24": true }.
  function busyDays(jobs, o) {
    o = o || {};
    var out = {};
    (jobs || []).forEach(function (j) { if (j && M.isDay(j.date) && j.status !== "Cancelled" && (!o.service || j.service === o.service)) out[j.date] = true; });
    return out;
  }
  // "AJ", "L" — what goes in a crew member's round avatar.
  function initials(name) {
    var s = String(name || "").trim();
    if (!s) return "?";
    if (/^[A-Z]{2,3}$/.test(s)) return s;
    var w = s.split(/\s+/);
    return (w[0][0] + (w[1] ? w[1][0] : "")).toUpperCase();
  }
  // Search: job number, customer, phone, car, suburb, service.
  function matches(job, lead, q) {
    q = String(q || "").toLowerCase().trim();
    if (!q) return true;
    var hay = [job.number, job.service, job.notes, lead && lead.name, lead && lead.phone, lead && lead.car, lead && lead.suburb, lead && lead.address].join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  /* ------------------------------------------------------------ week, day and month */

  // The rows of the week view and the columns of the day view: the kits, then the crew.
  function resources(cfg) {
    var c = settings(cfg);
    return c.kits.concat(c.crew);
  }
  // Is this job (or event) on that person's or kit's row? "" is the row for no one yet.
  function onRow(x, name) {
    var crew = (x && (x.crew || x.who)) || [];
    if (name === "") return !crew.length && !(x && x.kit);
    return crew.indexOf(name) !== -1 || (!!x && x.kit === name);
  }
  // [start, end] in minutes for a job or event, or null when it has no time. All day is the whole
  // day; a start with no end runs for the service's default length.
  function span(x, cfg) {
    if (!x || !M.isDay(x.date)) return null;
    if (x.allDay) return [0, 24 * 60];
    var s = toMin(x.start), e = toMin(x.end);
    if (s == null) return null;
    if (e == null || e <= s) {
      var len = x.service ? lengthOf(x.service, cfg) : { allDay: false, minutes: 60 };
      e = len.allDay ? 24 * 60 : s + len.minutes;
    }
    return [s, e];
  }
  /*
    Clashes: one person or kit on two jobs at once (or on a job while on time off). Cancelled jobs
    don't count. Returns { jobId: [{ id, who, kind }] } for each job in a clash, kind "job" or
    "timeoff" (the event's id).
  */
  function clashes(jobs, events, cfg) {
    var out = {}, live = (jobs || []).filter(function (j) { return j && j.status !== "Cancelled" && span(j, cfg); });
    var add = function (id, other, who, kind) {
      var list = (out[id] = out[id] || []);
      if (!list.some(function (c) { return c.id === other && c.who === who; })) list.push({ id: other, who: who, kind: kind });
    };
    var names = function (x) { return ((x.crew || []).concat(x.kit ? [x.kit] : [])); };
    for (var i = 0; i < live.length; i++) {
      var a = live[i], sa = span(a, cfg);
      for (var k = i + 1; k < live.length; k++) {
        var b = live[k];
        if (b.date !== a.date) continue;
        var sb = span(b, cfg);
        if (!(sa[0] < sb[1] && sb[0] < sa[1])) continue;
        names(a).forEach(function (n) { if (names(b).indexOf(n) !== -1) { add(a.id, b.id, n, "job"); add(b.id, a.id, n, "job"); } });
      }
      (events || []).forEach(function (e) {
        if (!e || e.deleted || e.type !== "timeoff" || e.date !== a.date) return;
        var se = span(e, cfg);
        if (!se || !(sa[0] < se[1] && se[0] < sa[1])) return;
        (e.who || []).forEach(function (n) { if (names(a).indexOf(n) !== -1) add(a.id, e.id, n, "timeoff"); });
      });
    }
    return out;
  }
  // Side by side where they overlap: each item gets { lane, lanes } (items are [{ s, e, ... }]).
  function lanes(items) {
    var sorted = items.slice().sort(function (a, b) { return a.s - b.s || b.e - a.e; }), group = [], end = -1;
    var close = function () { var n = 0; group.forEach(function (x) { n = Math.max(n, x.lane + 1); }); group.forEach(function (x) { x.lanes = n; }); group = []; };
    sorted.forEach(function (x) {
      if (group.length && x.s >= end) close();
      var used = group.filter(function (g) { return g.e > x.s; }).map(function (g) { return g.lane; }), lane = 0;
      while (used.indexOf(lane) !== -1) lane++;
      x.lane = lane; group.push(x); end = Math.max(end, x.e);
    });
    close();
    return sorted;
  }
  // The days of a month's grid: whole weeks, Sunday first, from the week the 1st is in.
  function monthDays(date) {
    var first = String(date).slice(0, 7) + "-01", start = sundayOf(first), out = [];
    var next = M.addDays(first, 32).slice(0, 7);
    for (var i = 0; i < 42; i++) {
      var d = M.addDays(start, i);
      if (i % 7 === 0 && i >= 28 && d.slice(0, 7) >= next) break;
      out.push(d);
    }
    return out;
  }
  /*
    Moving a job: a new start (it keeps its length), and from one row or column to another ("" is
    no one yet). Onto a kit sets the kit; onto a person swaps them in for the one it came from.
    `kits` says which names are kits. Returns the fields to save.
  */
  function moveTo(job, start, from, to, kits) {
    var p = {}, s0 = toMin(job.start), e0 = toMin(job.end), s = toMin(start);
    if (s != null) {
      var len = s0 != null && e0 != null && e0 > s0 ? e0 - s0 : 60;
      p.start = hm(s); p.end = hm(Math.min(24 * 60 - 1, s + len)); p.allDay = false;
    }
    if (from === to) return p;
    var isKit = function (n) { return (kits || []).indexOf(n) !== -1; }, crew = (job.crew || []).slice();
    if (isKit(to)) p.kit = to;
    else if (isKit(from)) { if (to) { if (crew.indexOf(to) === -1) crew.push(to); p.crew = crew; } else p.kit = ""; }
    else {
      crew = crew.filter(function (n) { return n !== from; });
      if (to && crew.indexOf(to) === -1) crew.push(to);
      p.crew = crew;
    }
    return p;
  }

  root.ILJobs = {
    SERVICES: SERVICES, STATUSES: STATUSES, EVENT_TYPES: EVENT_TYPES, DEFAULTS: DEFAULTS, FIRST_NUMBER: FIRST_NUMBER,
    settings: settings, serviceFromLead: serviceFromLead, serviceToLead: serviceToLead, serviceFromText: serviceFromText,
    toMin: toMin, hm: hm, lengthOf: lengthOf, endFor: endFor, timeLabel: timeLabel, sortKey: sortKey,
    addOnTotal: addOnTotal, priceOf: priceOf, total: total, money: money,
    nextNumber: nextNumber, title: title, blank: blank, fromLead: fromLead, currentJob: currentJob, leadJobId: leadJobId, toMake: toMake, renumber: renumber,
    leadPatch: leadPatch, jobPatch: jobPatch,
    sundayOf: sundayOf, weekDays: weekDays, agenda: agenda, busyDays: busyDays, initials: initials, matches: matches,
    resources: resources, onRow: onRow, span: span, clashes: clashes, lanes: lanes, monthDays: monthDays, moveTo: moveTo,
  };
})(typeof window !== "undefined" ? window : globalThis);
