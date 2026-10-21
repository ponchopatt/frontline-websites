import J from "./jobs.js";
import M from "./model.js";

/*
  GoHighLevel bookings, read and worked out with no database and no network, so the webhook
  (api/ghl-webhook.js), a dry run and the tests all do exactly the same thing.

  planBooking() takes what GHL sent plus the leads and jobs there are, and answers what to write:
  { ok, result, writes: [{ collection, id, op: "create" | "merge", data }], summary }. Jobs are
  written before leads, so a phone never sees a booked lead with no job and makes a second one.
*/

const clip = (v, n = 300) => String(v ?? "").trim().slice(0, n);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const pick = (...vals) => {
  for (const v of vals) if (v != null && typeof v !== "object" && String(v).trim() !== "") return String(v).trim();
  return "";
};

/** An Australian number written +61: "0400 111 222", "61400111222", "400111222" → "+61400111222". */
export function cleanPhone(phone) {
  const raw = String(phone ?? "").trim();
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0061")) d = d.slice(2);
  if (d.startsWith("61") && d.length >= 10) return "+" + d;
  if (d.startsWith("0") && d.length === 10) return "+61" + d.slice(1);
  if (d.length === 9 && /^[2-478]/.test(d)) return "+61" + d;
  return "+" + d; // another country's number, as given
}

/**
  A price in words like an appointment's description: "$280", "$1,200", "$280-350", "350 dollars",
  "quote 320", "Total: $450". "" when there isn't one. A number with no $ or price word (a street
  number, a phone number) is never taken.
*/
export function priceFromText(text) {
  const t = String(text ?? "").replace(/(\d),(\d{3})/g, "$1$2");
  const num = "(\\d{2,5}(?:\\.\\d{1,2})?)", range = "(?:\\s*(?:-|–|to)\\s*\\$?\\s?" + num + ")?";
  const ok = (m) => {
    const a = Math.round(Number(m[1])), b = m[2] ? Math.round(Number(m[2])) : a;
    return a >= 20 && a <= 20000 ? (b > a && b <= 20000 ? a + "-" + b : String(a)) : "";
  };
  // Said outright: "total $450", "quote 320".
  const said = new RegExp("\\b(?:total|price|quote|quoted|cost|charged|value|amount)\\b\\s*(?:is|of|was|:|=)?\\s*\\$?\\s?" + num + range, "i").exec(t);
  if (said && ok(said)) return ok(said);
  // Else the biggest dollar amount (a $50 deposit beside a $330 job is the deposit).
  const all = [...t.matchAll(new RegExp("\\$\\s?" + num + range, "gi"))].map(ok).filter(Boolean);
  if (all.length) return all.sort((x, y) => Number(y.split("-")[0]) - Number(x.split("-")[0]))[0];
  const words = new RegExp(num + "\\s*(?:dollars|aud|bucks)\\b", "i").exec(t);
  return words ? ok(words) : "";
}

/** booked | cancelled | showed | noshow, from GHL's appointment status (or the event's type). */
export function statusOf(raw, type) {
  const s = String(raw ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (/delete/i.test(String(type ?? ""))) return "cancelled";
  if (/cancel|invalid|deleted|rejected/.test(s)) return "cancelled";
  if (/noshow/.test(s)) return "noshow";
  if (/showed|completed|attended/.test(s)) return "showed";
  return "booked"; // new, booked, confirmed, rescheduled, or nothing said
}

// How far `tz` is ahead of UTC at that moment, in minutes.
function zoneOffset(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - date.getTime()) / 6e4;
}
function validZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
/**
  A Date from GHL's time: an ISO time with its offset ("2026-10-24T09:00:00+11:00"), a time
  with none, which is the calendar's own clock (`tz`, else Canberra's), words like "October 24,
  2026 9:00 AM", or seconds / milliseconds since 1970. null when it can't be read.
*/
export function parseWhen(value, tz) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (/^\d{10,13}$/.test(s)) return new Date(s.length === 10 ? +s * 1000 : +s);
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  let wall = null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) wall = [+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)];
  else {
    const d = new Date(s.replace(/\s+at\s+/i, " ").replace(/(\d)(am|pm)\b/i, "$1 $2") + " UTC");
    if (isNaN(d)) return null;
    wall = [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()];
  }
  const zone = tz && validZone(tz) ? tz : "Australia/Sydney";
  const guess = Date.UTC(...wall);
  let t = guess - zoneOffset(new Date(guess), zone) * 6e4;
  t = guess - zoneOffset(new Date(t), zone) * 6e4;
  return new Date(t);
}

/**
  What GHL sent, wherever it put it: a workflow's Webhook action (contact fields at the top and
  a `calendar` object), a custom webhook (`customData`), or an API event (`appointment`).
*/
export function readBooking(body) {
  const b = obj(body), c = obj(b.calendar), a = obj(b.appointment), cd = obj(b.customData || b.custom_data), ct = obj(b.contact);
  const first = pick(b.first_name, b.firstName, ct.firstName, ct.first_name, cd.first_name, cd.firstName);
  const last = pick(b.last_name, b.lastName, ct.lastName, ct.last_name, cd.last_name, cd.lastName);
  const street = [pick(b.address1, ct.address1, cd.address1), pick(b.city, ct.city), pick(b.state, ct.state), pick(b.postal_code, b.postalCode, ct.postalCode)].filter(Boolean).join(", ");
  // The contact's own form answers, from any field named for them: the car, the service they
  // want ("What Service"), and how soon ("How Soon?").
  const field = (re, ...first) => {
    let v = pick(...first);
    for (const src of [cd, b]) for (const [k, x] of Object.entries(src)) if (!v && re.test(k)) v = pick(x);
    return v;
  };
  const car = field(/vehicle|^car$|make.*model/i, cd.vehicle, cd.car, b.vehicle, b.car);
  // Which ad they came from: GHL keeps the ad's name in utm content.
  const real = (v) => (v && !/^(none|null|undefined)$/i.test(String(v).trim()) ? String(v).trim() : "");
  const src = [obj(ct.lastAttributionSource), obj(ct.attributionSource), obj(b.lastAttributionSource), obj(b.attributionSource)];
  const ad = src.map((x) => real(x.utmContent || x.utm_content || x.adName)).find(Boolean) || "";
  const paid = src.some((x) => /facebook|instagram|meta|paid/i.test([x.source, x.adSource, x.sessionSource, x.medium].join(" ")));
  const tz = pick(c.selectedTimezone, c.timezone, a.timezone, cd.timezone, b.timezone);
  const contactId = clip(pick(b.contact_id, b.contactId, a.contactId, ct.id, cd.contact_id), 120);
  const start = pick(c.startTime, c.start_time, a.startTime, a.start_time, b.startTime, b.start_time, cd.startTime, cd.start_time, cd.start);
  // GHL's own appointment ID. Without one: the calendar's "id" with the contact (so two people never
  // share a job), else the contact on its own, so the same booking still never comes in twice.
  let apptId = pick(c.appointmentId, c.appointment_id, a.id, a.appointmentId, b.appointmentId, b.appointment_id, cd.appointmentId, cd.appointment_id);
  const who = contactId || pick(b.phone, ct.phone, cd.phone).replace(/\D/g, "") || pick(b.email, ct.email, cd.email).toLowerCase();
  if (!apptId && pick(c.id) && who) apptId = pick(c.id) + "-" + who;
  if (!apptId && start && who) apptId = "contact-" + who;
  return {
    apptId: clip(apptId, 120),
    contactId,
    name: clip(pick(b.full_name, b.fullName, b.name, ct.name, ct.fullName, cd.full_name, cd.name, [first, last].filter(Boolean).join(" ")), 120),
    phone: cleanPhone(pick(b.phone, ct.phone, cd.phone, b.contact_phone)),
    email: clip(pick(b.email, ct.email, cd.email), 200).toLowerCase(),
    address: clip(pick(b.full_address, street, c.address, a.address, cd.address), 300),
    suburb: clip(pick(b.city, ct.city, cd.suburb, cd.city, b.Suburb, b.suburb), 120),
    car: clip(car, 200),
    serviceAnswer: clip(field(/service/i, cd.service, b.service), 120),
    howSoon: clip(field(/how soon/i, cd.when, b.when), 120),
    ad: clip(ad, 120),
    fromAds: paid || !!ad,
    calendar: clip(pick(c.calendarName, c.calendar_name, c.name, b.calendarName, b.calendar_name, cd.calendarName, cd.calendar_name, cd.calendar), 200),
    title: clip(pick(c.title, a.title, b.appointment_title, b.title, cd.title), 200),
    start: parseWhen(start, tz),
    end: parseWhen(pick(c.endTime, c.end_time, a.endTime, a.end_time, b.endTime, b.end_time, cd.endTime, cd.end_time, cd.end), tz),
    rawStatus: clip(pick(c.appoinmentStatus, c.appointmentStatus, c.appointment_status, c.status, a.appointmentStatus, a.status, b.appointmentStatus, b.appointment_status, cd.appointmentStatus, cd.appointment_status, cd.status, b.status), 60),
    status: statusOf(pick(c.appoinmentStatus, c.appointmentStatus, c.appointment_status, c.status, a.appointmentStatus, a.status, b.appointmentStatus, b.appointment_status, cd.appointmentStatus, cd.appointment_status, cd.status, b.status), b.type),
    notes: clip(pick(c.notes, a.notes, cd.notes, b.notes), 2000),
    // What the job was worth: from its description, its title, else a value sent with it.
    price: priceFromText(pick(c.notes, a.notes, cd.notes, b.notes)) || priceFromText(pick(c.title, a.title, b.title, cd.title)) ||
      (Number(pick(cd.price, cd.value, b.monetaryValue, b.opportunityValue, cd.monetaryValue)) > 0 ? String(Math.round(Number(pick(cd.price, cd.value, b.monetaryValue, b.opportunityValue, cd.monetaryValue)))) : ""),
  };
}

// The day, start and end in Canberra ("" when GHL gave no time).
function when(bk, service, cfg) {
  if (!bk.start) return { date: "", start: "", end: "" };
  const date = M.canberraDate(bk.start), start = J.hm(M.canberraMinutes(bk.start));
  const end = bk.end && M.canberraDate(bk.end) === date && bk.end > bk.start ? J.hm(M.canberraMinutes(bk.end)) : J.endFor(start, service, cfg) || "";
  return { date, start, end };
}

const OPEN = ["Scheduled", "In Progress"];
// A job's GHL appointments: one, or more when one job was booked as two (a two-day job).
const hasAppt = (j, id) => !!j && !!id && (j.ghlAppointmentId === id || (Array.isArray(j.ghlAppointmentIds) && j.ghlAppointmentIds.includes(id)));
// "Jo  Smith", "jo smith" and "Jo-Smith" are one name.
const nameOf = (s) => String(s ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
// The same person by name: the same first and last name; or the same first name when that's all
// there is here and the lead here has no phone or email to say otherwise.
const sameName = (l, name) => {
  const a = nameOf(l && l.name), b = nameOf(name);
  if (!a || a !== b) return false;
  return a.includes(" ") || (M.phoneKey(l.phone).length < 8 && !String(l.email || "").trim());
};
const daysApart = (a, b) => (M.isDay(a) && M.isDay(b) ? Math.abs(M.daysBetween(a, b)) : 99);
const safeId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
const entry = (at, outcome, note = "") => ({ at, by: "GHL", type: "note", outcome, note });
const changed = (patch, old) => Object.fromEntries(Object.entries(patch).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(old[k])));
const dayWords = (date, start) => {
  if (!date) return "no day yet";
  const d = new Date(date + "T12:00:00Z"), f = (o) => d.toLocaleDateString("en-AU", { ...o, timeZone: "UTC" });
  return f({ weekday: "short" }) + " " + d.getUTCDate() + " " + f({ month: "short" }) + (start ? " " + M.clock(J.toMin(start)) : "");
};

/**
  The lead a booking belongs to: by its GHL contact, then phone, then email, then the same full
  name booked within 3 days. A lead still open, booked, or from the
  last 30 days is used; someone whose job is done (or from longer ago) gets a new lead marked as a
  repeat of the old one, so the old job and its takings stay as they were.
*/
export function findLead(leads, phone, email, today, contactId, name, date) {
  const real = (leads || []).filter((l) => l && !l.junk && !l.deleted);
  if (contactId) {
    const same = real.filter((l) => l.ghlContactId === contactId && M.stageOf(l, today) !== "Done");
    same.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    if (same.length) return { lead: same[0], by: "GHL contact" };
  }
  const key = M.phoneKey(phone);
  const byPhone = key.length >= 8 ? real.filter((l) => M.phoneKey(l.phone) === key) : [];
  const byEmail = email ? real.filter((l) => String(l.email || "").trim().toLowerCase() === email) : [];
  for (const same of [byPhone, byEmail]) {
    if (!same.length) continue;
    same.sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
    const by = same === byPhone ? "phone" : "email";
    const dayOf = (l) => l.date || M.canberraDate(l.createdAt);
    const hit = same.find((l) => M.stageOf(l, today) === "Booked") ||
      same.find((l) => M.isOpen(l, today) || (M.stageOf(l, today) !== "Done" && M.isDay(dayOf(l)) && M.daysBetween(dayOf(l), today) <= 30));
    return hit ? { lead: hit, by } : { repeatOf: same[0].id, by };
  }
  // A different number or email, but the same name (see sameName) booked within 3 days: the same
  // booking (often typed in here first, from a call).
  if (nameOf(name) && M.isDay(date)) {
    // Booked here (its day may have just passed without being marked done).
    const near = real.filter((l) => sameName(l, name) && (M.stageOf(l, today) === "Booked" || (!l.completedAt && M.stageOf(l, today) === "Done")) && daysApart(l.jobDate, date) <= 3)
      .sort((a, b) => daysApart(a.jobDate, date) - daysApart(b.jobDate, date))[0];
    if (near) return { lead: near, by: "name and day" };
  }
  return {};
}

/** The lead a booking makes for someone new, as the app's Add tab would have saved it. */
function newLead(bk, service, now, owner) {
  const date = M.canberraDate(now);
  return {
    ...M.newFields(M.timelineOf(bk.howSoon)),
    date, createdAt: now.toISOString(), owner, name: bk.name, phone: bk.phone, email: bk.email, suburb: bk.suburb, car: bk.car,
    source: "GHL booking", ad: bk.ad, fromAd: bk.ad ? "ad" : "", referredBy: "", address: bk.address, jobTime: "", access: "",
    service: J.serviceToLead(service), status: "New", nextFollowUp: date, lastContact: "", replyMins: null, quoted: null,
    jobDate: "", revenue: null, paid: "", plan: "", upsellOffered: "", upsellTaken: "", reviewAsked: "", reviewLeft: "",
    objection: "", lostWhy: "", nextDue: "", log: [], booked: "Pending", notes: bk.notes ? "From GHL: " + bk.notes : "",
    completedAt: null, reviewStatus: null, reviewAskedAt: null, reviewTextSentAt: null, reviewNudgedAt: null, reviewLeftAt: null, reviewNotes: "",
    ghlContactId: bk.contactId,
  };
}

/**
  What to do with one GHL request. `leads` and `jobs` are [{ id, ...data }]; `turn` is whose turn a
  new lead is ("Angus" or "Ananth"). Nothing is written here.
*/
export function planBooking(body, { leads = [], jobs = [], cfg = null, now = new Date(), turn = "Angus", keepDates = false } = {}) {
  const bk = readBooking(body), at = now.toISOString(), today = M.canberraDate(now);
  const out = (ok, result, writes = [], extra = {}) => ({ ok, result, writes, summary: { appointmentId: bk.apptId, name: bk.name, status: bk.status, ...extra } });
  if (!bk.apptId) return out(false, "No appointment ID in what GHL sent, so nothing was changed.");
  const job = jobs.find((j) => hasAppt(j, bk.apptId));

  // ---- An appointment we have: moved, cancelled, no-show or showed.
  if (job && job.deleted) return out(true, "Job " + job.number + " was deleted in the app, so it was left.", [], { jobId: job.id, number: job.number });
  if (job) {
    const lead = leads.find((l) => l.id === job.leadId) || null;
    const isCur = lead && (J.currentJob(jobs, lead.id) || {}).id === job.id;
    const jobW = (patch) => ({ collection: "jobs", id: job.id, op: "merge", data: { ...patch, updatedAt: at } });
    const leadW = (patch) => {
      const merged = M.sync({ ...lead, ...patch, updatedAt: at }, today), p = changed(merged, lead);
      delete p.id;
      return { collection: "leads", id: lead.id, op: "merge", data: p };
    };
    const base = { jobId: job.id, number: job.number, leadId: job.leadId };
    if (bk.status === "showed") return out(true, "Showed: job " + job.number + " left as it is.", [], base);
    if (bk.status === "cancelled") {
      if (job.status === "Cancelled") return out(true, "Already cancelled: job " + job.number + ".", [], base);
      if (job.status === "Completed") return out(true, "Job " + job.number + " is already completed, so it was left.", [], base);
      const w = [jobW({ status: "Cancelled", ghlStatus: bk.rawStatus || "cancelled" })];
      if (isCur && M.stageOf(lead, today) === "Booked") w.push(leadW({ ...M.setStage(lead, "Chasing", today), log: (lead.log || []).concat([entry(at, "GHL: appointment cancelled")]) }));
      return out(true, "Cancelled job " + job.number + (w.length > 1 ? "; the lead is back in Chasing" : "") + ".", w, base);
    }
    if (bk.status === "noshow") {
      if (job.ghlFlag === "No-show") return out(true, "Already flagged no-show: job " + job.number + ".", [], base);
      const w = [jobW({ ghlFlag: "No-show", ghlStatus: bk.rawStatus || "noshow" })];
      if (lead) w.push(leadW({ log: (lead.log || []).concat([entry(at, "GHL: no-show")]) }));
      return out(true, "Flagged job " + job.number + " as a no-show.", w, base);
    }
    // Booked or confirmed again: a new time moves the job (and the lead's day and time).
    const t = when(bk, job.service, cfg), patch = {};
    if (bk.start && (t.date !== job.date || t.start !== job.start || t.end !== job.end)) Object.assign(patch, { date: t.date, start: t.start, end: t.end, allDay: false });
    if (job.status === "Cancelled") patch.status = "Scheduled";
    if (bk.rawStatus && bk.rawStatus !== job.ghlStatus) patch.ghlStatus = bk.rawStatus;
    const sv = J.serviceFromText(bk.calendar) || J.serviceFromText(bk.title) || J.serviceFromText(bk.serviceAnswer);
    if (sv && job.checkService) Object.assign(patch, { service: sv, checkService: false });
    if (bk.calendar && bk.calendar !== job.ghlCalendar) patch.ghlCalendar = bk.calendar;
    if (bk.price && !String(job.price || "").trim()) patch.price = bk.price;
    if (!Object.keys(patch).length) return out(true, "No change: job " + job.number + ".", [], base);
    const w = [jobW(patch)];
    if (isCur) {
      const j2 = { ...job, ...patch };
      let lp = M.stageOf(lead, today) !== "Booked" ? M.book(lead, { date: j2.date, time: j2.start }, at, "GHL") : {};
      lp = { ...lp, ...J.leadPatch(j2, { ...lead, ...lp }) };
      if (patch.date || patch.start) lp.log = (lp.log || lead.log || []).concat([entry(at, "GHL: moved", dayWords(j2.date, j2.start))]);
      if (Object.keys(lp).length) w.push(leadW(lp));
    }
    const moved = patch.date != null || patch.start != null;
    return out(true, (patch.status ? "Booked again: job " : moved ? "Moved job " : "Updated job ") + job.number + (moved ? " to " + dayWords(patch.date, patch.start) : "") + ".", w, base);
  }

  // ---- A booking we don't have yet.
  if (bk.status !== "booked") return out(true, "Ignored: " + (bk.rawStatus || bk.status) + " for a booking that isn't here.");
  if (!bk.phone && !bk.email && !bk.name) return out(false, "No name, phone or email in what GHL sent, so nothing was changed.");
  const mapped = J.serviceFromText(bk.calendar) || J.serviceFromText(bk.title) || J.serviceFromText(bk.serviceAnswer);
  const service = mapped || "Other", t = when(bk, service, cfg);
  const found = findLead(leads, bk.phone, bk.email, today, bk.contactId, bk.name, t.date);
  const ghl = { source: "ghl", ghlAppointmentId: bk.apptId, ghlContactId: bk.contactId, ghlCalendar: bk.calendar, ghlStatus: bk.rawStatus || "booked", ghlNotes: bk.notes };
  const writes = [];
  let lead = found.lead || null, jobId, number, jobData, differs = "";
  const cur = lead ? J.currentJob(jobs, lead.id) : null;
  if (cur && OPEN.includes(cur.status || "Scheduled") && !cur.ghlAppointmentId) {
    // Already booked here: that job takes the GHL booking's time.
    jobId = cur.id; number = cur.number;
    jobData = { ...ghl, date: t.date, start: t.start, end: t.end, allDay: !t.start && cur.allDay, ...(mapped && mapped !== cur.service ? { service: mapped } : {}), updatedAt: at };
    if (!t.date || (keepDates && M.isDay(cur.date))) { delete jobData.date; delete jobData.start; delete jobData.end; delete jobData.allDay; }
    if (keepDates && cur.date !== t.date) differs = "here it's " + dayWords(cur.date, cur.start) + ", GHL says " + dayWords(t.date, t.start);
    writes.push({ collection: "jobs", id: jobId, op: "merge", data: jobData });
    jobData = { ...cur, ...jobData };
  } else {
    jobId = "ghl-" + safeId(bk.apptId); number = J.nextNumber(jobs);
    const price = (lead ? (lead.priceRange ? lead.priceRange.replace("–", "-") : lead.revenue != null && lead.revenue !== "" ? String(lead.revenue) : lead.quoted != null && lead.quoted !== "" ? String(lead.quoted) : "") : "") || bk.price;
    jobData = J.blank({ number, leadId: lead ? lead.id : "ghl-" + safeId(bk.apptId), service, price, date: t.date, start: t.start, end: t.end, allDay: !t.start && J.lengthOf(service, cfg).allDay && !!t.date,
      notes: bk.notes, createdAt: at, createdBy: "GHL", updatedAt: at, checkService: !mapped, ...ghl });
    writes.push({ collection: "jobs", id: jobId, op: "create", data: jobData });
  }
  const note = [bk.calendar || bk.title, dayWords(t.date, t.start)].filter(Boolean).join(", ");
  if (lead) {
    let lp = M.stageOf(lead, today) !== "Booked" ? M.book(lead, { date: t.date, time: t.start, ...(lead.address ? {} : { address: bk.address }) }, at, "GHL")
      : differs ? {} : { jobDate: t.date || lead.jobDate, jobTime: t.start || lead.jobTime || "" };
    for (const k of ["email", "address", "suburb", "car", "name"]) if (bk[k] && !String(lead[k] || "").trim()) lp[k] = bk[k];
    if (mapped && (!lead.service || lead.service === "Not sure")) lp.service = J.serviceToLead(mapped);
    if (bk.ad && !lead.ad && !lead.fromAd) Object.assign(lp, { ad: bk.ad, fromAd: "ad" });
    const tl = M.timelineOf(bk.howSoon);
    if (tl && !lead.timeline) lp.timeline = tl;
    if (!lead.ghlContactId && bk.contactId) lp.ghlContactId = bk.contactId;
    lp = { ...lp, ...J.leadPatch(jobData, { ...lead, ...lp }) };
    lp.log = (lp.log || lead.log || []).concat([entry(at, "GHL booking", note)]);
    const merged = M.sync({ ...lead, ...lp, updatedAt: at }, today), p = changed(merged, lead);
    delete p.id;
    writes.push({ collection: "leads", id: lead.id, op: "merge", data: p });
    return out(true, (differs ? "Linked to " + (lead.name || "the lead") + "'s booking (found by " + found.by + "): job " + number + "; " + differs : "Booked " + (lead.name || "the lead") + " (found by " + found.by + "): job " + number + ", " + dayWords(t.date, t.start)) + (mapped ? "" : ". Check service") + ".", writes, { jobId, number, leadId: lead.id, matchedBy: found.by, differs });
  }
  const doc = newLead(bk, service, now, turn);
  if (found.repeatOf) doc.repeatOf = found.repeatOf;
  Object.assign(doc, M.book(doc, { date: t.date, time: t.start, address: bk.address }, at, "GHL"));
  doc.replyMins = null; // they booked themselves: no reply time to count
  Object.assign(doc, J.leadPatch(jobData, doc));
  doc.log = (doc.log || []).concat([entry(at, "GHL booking", note)]);
  writes.push({ collection: "leads", id: jobData.leadId, op: "create", data: M.sync(doc, today) });
  return out(true, "New lead " + (bk.name || bk.phone || bk.email) + (found.repeatOf ? " (a repeat customer)" : "") + ": job " + number + ", " + dayWords(t.date, t.start) + (mapped ? "" : ". Check service") + ".", writes, { jobId, number, leadId: jobData.leadId, newLead: true, owner: turn });
}

/**
  A past GHL appointment, for bringing in the history. Already here (its appointment ID, or the
  same person with a job that day): that job takes the appointment ID, and the job and lead get the
  price if they have none; nothing else changes. Someone new on that day: a lead, Done and paid
  (it's in the past), with its job Completed. Cancelled and no-shows are left out; one still to
  come is a normal booking. `created` is when GHL first had the contact (the lead's day).
*/
export function planPast(body, { leads = [], jobs = [], cfg = null, now = new Date(), created = "" } = {}) {
  const bk = readBooking(body), today = M.canberraDate(now), at = now.toISOString();
  const out = (kind, result, writes = []) => ({ ok: true, kind, result, writes, summary: { appointmentId: bk.apptId, name: bk.name, price: bk.price } });
  if (!bk.apptId || !bk.start) return out("skipped", "No appointment ID or time.");
  const date = M.canberraDate(bk.start);
  const had = jobs.find((j) => hasAppt(j, bk.apptId));
  if (had) {
    // In already. If a run stopped between a job and its new lead, the lead is made now.
    if (had.deleted || leads.some((l) => l.id === had.leadId) || !String(had.leadId || "").startsWith("ghl-")) return out("already", "Already in.");
    const past = date < today, svc = had.service || "Other", tt = when(bk, svc, cfg), lo = bk.price ? Number(bk.price.split("-")[0]) : null;
    const doc = newLead(bk, svc, created && !isNaN(new Date(created)) && new Date(created) <= bk.start ? new Date(created) : past ? bk.start : now, "");
    if (past) Object.assign(doc, { stage: "Done", status: "Booked", booked: "Yes", jobDate: date, jobTime: tt.start, revenue: lo, priceRange: bk.price.includes("-") ? bk.price.replace("-", "–") : "", paid: "Yes", nextFollowUp: "",
      completedAt: (bk.end && bk.end > bk.start ? bk.end : bk.start).toISOString(), reviewStatus: null, replyMins: null, importedFrom: "ghl" });
    else { Object.assign(doc, M.book(doc, { date: tt.date, time: tt.start, address: bk.address }, at, "GHL")); doc.replyMins = null; }
    doc.log = (doc.log || []).concat([entry(bk.start.toISOString(), "GHL booking", [bk.calendar || bk.title, dayWords(date, tt.start)].filter(Boolean).join(", "))]);
    return out("repaired", "Made the missing lead for job " + had.number + " (" + (bk.name || bk.phone || "?") + ").", [{ collection: "leads", id: had.leadId, op: "create", data: M.sync(doc, today) }]);
  }
  if (date >= today) {
    const p = planBooking(body, { leads, jobs, cfg, now, turn: "", keepDates: true });
    return { ...p, kind: p.writes.length ? "upcoming" : "skipped" };
  }
  if (bk.status === "cancelled" || bk.status === "noshow") return out("skipped", (bk.status === "noshow" ? "No-show" : "Cancelled") + ": left out.");
  const mapped = J.serviceFromText(bk.calendar) || J.serviceFromText(bk.title) || J.serviceFromText(bk.serviceAnswer);
  const service = mapped || "Other", t = when(bk, service, cfg);
  const low = bk.price ? Number(bk.price.split("-")[0]) : null, range = bk.price.includes("-") ? bk.price.replace("-", "–") : "";
  const ghl = { source: "ghl", ghlAppointmentId: bk.apptId, ghlContactId: bk.contactId, ghlCalendar: bk.calendar, ghlStatus: bk.rawStatus || "", ghlNotes: bk.notes };
  const note = [bk.calendar || bk.title, dayWords(t.date, t.start), bk.price ? "$" + bk.price : ""].filter(Boolean).join(", ");
  const key = M.phoneKey(bk.phone);
  const same = leads.filter((l) => l && !l.junk && !l.deleted && ((bk.contactId && l.ghlContactId === bk.contactId) || (key.length >= 8 && M.phoneKey(l.phone) === key) || (bk.email && String(l.email || "").trim().toLowerCase() === bk.email)))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const byName = leads.filter((l) => l && !l.junk && !l.deleted && sameName(l, bk.name) && !same.includes(l));
  const sameDay = same.concat(byName).filter((l) => daysApart(l.jobDate, date) <= 3).sort((a, b) => daysApart(a.jobDate, date) - daysApart(b.jobDate, date))[0];
  if (sameDay) {
    const w = [], cur = jobs.filter((j) => j.leadId === sameDay.id && !j.deleted && daysApart(j.date, date) <= 3).sort((a, b) => daysApart(a.date, date) - daysApart(b.date, date) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
    if (cur) {
      // Already linked to another appointment (one job, two GHL bookings): this one is added to it.
      const p = cur.ghlAppointmentId && cur.ghlAppointmentId !== bk.apptId
        ? { ghlAppointmentIds: [...new Set([cur.ghlAppointmentId, ...(cur.ghlAppointmentIds || []), bk.apptId])], updatedAt: at }
        : { ...ghl, updatedAt: at };
      if (low != null && !String(cur.price || "").trim()) p.price = bk.price;
      if (low != null && cur.status === "Completed" && (cur.finalPrice == null || cur.finalPrice === "") && (sameDay.revenue == null || sameDay.revenue === "")) p.finalPrice = low;
      w.push({ collection: "jobs", id: cur.id, op: "merge", data: p });
    } else {
      const job = J.blank({ number: J.nextNumber(jobs), leadId: sameDay.id, service, price: bk.price, finalPrice: low, date, start: t.start, end: t.end, allDay: !t.start && J.lengthOf(service, cfg).allDay,
        status: M.stageOf(sameDay, today) === "Done" ? "Completed" : "Scheduled", notes: bk.notes, createdAt: at, createdBy: "GHL import", updatedAt: at, checkService: !mapped, ...ghl });
      w.push({ collection: "jobs", id: "ghl-" + safeId(bk.apptId), op: "create", data: job });
    }
    const lp = {};
    if (low != null && (sameDay.revenue == null || sameDay.revenue === "")) Object.assign(lp, { revenue: low, priceRange: range });
    for (const k of ["email", "address", "suburb", "car"]) if (bk[k] && !String(sameDay[k] || "").trim()) lp[k] = bk[k];
    if (mapped && (!sameDay.service || sameDay.service === "Not sure")) lp.service = J.serviceToLead(mapped);
    if (!sameDay.ghlContactId && bk.contactId) lp.ghlContactId = bk.contactId;
    if (Object.keys(lp).length) w.push({ collection: "leads", id: sameDay.id, op: "merge", data: { ...lp, updatedAt: at } });
    const off = sameDay.jobDate !== date ? " (here it's " + dayWords(sameDay.jobDate) + ")" : "";
    return out("matched", "Matched " + (sameDay.name || "a lead") + " on " + dayWords(date) + off + (lp.revenue != null ? ", price $" + bk.price : "") + ".", w);
  }
  // Still open here (New, Chasing or Waiting, no job day) but GHL says the job happened, in the two
  // months after they came in: that lead is Done, with this job.
  const open = same.concat(byName).filter((l) => M.isOpen(l, today) && !M.isDay(l.jobDate) && M.isDay(l.date) && l.date <= date && M.daysBetween(l.date, date) <= 60)[0];
  if (open) {
    const id = "ghl-" + safeId(bk.apptId);
    const job = J.blank({ number: J.nextNumber(jobs), leadId: open.id, service, price: bk.price, finalPrice: low, date, start: t.start, end: t.end, allDay: !t.start && J.lengthOf(service, cfg).allDay,
      status: "Completed", notes: bk.notes, createdAt: at, createdBy: "GHL import", updatedAt: at, checkService: !mapped, ...ghl });
    const lp = { ...M.setStage(open, "Done", today), jobDate: date, jobTime: t.start, completedAt: (bk.end && bk.end > bk.start ? bk.end : bk.start).toISOString(),
      log: (open.log || []).concat([entry(bk.start.toISOString(), "GHL booking (from the past)", note)]), updatedAt: at };
    if (low != null && (open.revenue == null || open.revenue === "")) Object.assign(lp, { revenue: low, priceRange: range });
    if (!open.paid) lp.paid = "Yes";
    for (const k of ["email", "address", "suburb", "car"]) if (bk[k] && !String(open[k] || "").trim()) lp[k] = bk[k];
    if (mapped && (!open.service || open.service === "Not sure")) lp.service = J.serviceToLead(mapped);
    if (!open.ghlContactId && bk.contactId) lp.ghlContactId = bk.contactId;
    return out("done", "Done: " + (open.name || "a lead") + " was " + M.stageOf(open, today) + " here, GHL says the job was " + dayWords(date) + (bk.price ? ", $" + bk.price : "") + ".",
      [{ collection: "jobs", id, op: "create", data: job }, { collection: "leads", id: open.id, op: "merge", data: lp }]);
  }
  // Someone new to the tracker for that job: a lead, Done and paid, and its job, Completed.
  const start = bk.start, joined = created && !isNaN(new Date(created)) && new Date(created) <= start ? new Date(created) : start;
  const id = "ghl-" + safeId(bk.apptId);
  const job = J.blank({ number: J.nextNumber(jobs), leadId: id, service, price: bk.price, finalPrice: low, date, start: t.start, end: t.end, allDay: !t.start && J.lengthOf(service, cfg).allDay,
    status: "Completed", notes: bk.notes, createdAt: at, createdBy: "GHL import", updatedAt: at, checkService: !mapped, ...ghl });
  const doc = newLead(bk, service, joined, "");
  Object.assign(doc, {
    stage: "Done", status: "Booked", booked: "Yes", jobDate: date, jobTime: t.start, revenue: low, priceRange: range, paid: "Yes", nextFollowUp: "",
    completedAt: (bk.end && bk.end > start ? bk.end : start).toISOString(), reviewStatus: null, replyMins: null, importedFrom: "ghl",
    log: [entry(start.toISOString(), "GHL booking (from the past)", note)],
  });
  if (same.length) doc.repeatOf = same[0].id;
  return out("new", "New lead " + (bk.name || bk.phone || bk.email || "?") + ": job " + job.number + ", " + dayWords(date) + (bk.price ? ", $" + bk.price : ", no price") + ".",
    [{ collection: "jobs", id, op: "create", data: job }, { collection: "leads", id, op: "create", data: M.sync(doc, today) }]);
}

/** A plan's writes, applied to the leads and jobs in hand, so the next appointment sees them. */
export function applyWrites(state, writes) {
  for (const w of writes) {
    const list = w.collection === "jobs" ? state.jobs : w.collection === "leads" ? state.leads : null;
    if (!list) continue;
    const had = list.find((x) => x.id === w.id);
    if (had) { if (w.op === "merge") Object.assign(had, w.data); }
    else list.push({ id: w.id, ...w.data });
  }
}
