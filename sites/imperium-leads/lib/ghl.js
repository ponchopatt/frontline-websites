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
  // The car, from any field named for it.
  let car = pick(cd.vehicle, cd.car, b.vehicle, b.car);
  if (!car) for (const src of [cd, b]) for (const [k, v] of Object.entries(src)) if (!car && /vehicle|^car$|make.*model/i.test(k)) car = pick(v);
  const tz = pick(c.selectedTimezone, c.timezone, a.timezone, cd.timezone, b.timezone);
  return {
    apptId: clip(pick(c.appointmentId, c.appointment_id, a.id, a.appointmentId, b.appointmentId, b.appointment_id, cd.appointmentId, cd.appointment_id, cd.appointment_id), 120),
    contactId: clip(pick(b.contact_id, b.contactId, a.contactId, ct.id, cd.contact_id), 120),
    name: clip(pick(b.full_name, b.fullName, b.name, ct.name, ct.fullName, cd.full_name, cd.name, [first, last].filter(Boolean).join(" ")), 120),
    phone: cleanPhone(pick(b.phone, ct.phone, cd.phone, b.contact_phone)),
    email: clip(pick(b.email, ct.email, cd.email), 200).toLowerCase(),
    address: clip(pick(b.full_address, street, c.address, a.address, cd.address), 300),
    suburb: clip(pick(b.city, ct.city, cd.suburb, cd.city), 120),
    car: clip(car, 200),
    calendar: clip(pick(c.calendarName, c.calendar_name, c.name, b.calendarName, b.calendar_name, cd.calendarName, cd.calendar_name, cd.calendar), 200),
    title: clip(pick(c.title, a.title, b.appointment_title, b.title, cd.title), 200),
    start: parseWhen(pick(c.startTime, c.start_time, a.startTime, a.start_time, b.startTime, b.start_time, cd.startTime, cd.start_time, cd.start), tz),
    end: parseWhen(pick(c.endTime, c.end_time, a.endTime, a.end_time, b.endTime, b.end_time, cd.endTime, cd.end_time, cd.end), tz),
    rawStatus: clip(pick(c.appoinmentStatus, c.appointmentStatus, c.appointment_status, c.status, a.appointmentStatus, a.status, b.appointmentStatus, b.appointment_status, cd.appointmentStatus, cd.appointment_status, cd.status, b.status), 60),
    status: statusOf(pick(c.appoinmentStatus, c.appointmentStatus, c.appointment_status, c.status, a.appointmentStatus, a.status, b.appointmentStatus, b.appointment_status, cd.appointmentStatus, cd.appointment_status, cd.status, b.status), b.type),
    notes: clip(pick(c.notes, a.notes, cd.notes, b.notes), 2000),
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
const safeId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
const entry = (at, outcome, note = "") => ({ at, by: "GHL", type: "note", outcome, note });
const changed = (patch, old) => Object.fromEntries(Object.entries(patch).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(old[k])));
const dayWords = (date, start) => {
  if (!date) return "no day yet";
  const d = new Date(date + "T12:00:00Z"), f = (o) => d.toLocaleDateString("en-AU", { ...o, timeZone: "UTC" });
  return f({ weekday: "short" }) + " " + d.getUTCDate() + " " + f({ month: "short" }) + (start ? " " + M.clock(J.toMin(start)) : "");
};

/**
  The lead a booking belongs to: by phone, then by email. A lead still open, booked, or from the
  last 30 days is used; someone whose job is done (or from longer ago) gets a new lead marked as a
  repeat of the old one, so the old job and its takings stay as they were.
*/
export function findLead(leads, phone, email, today) {
  const real = (leads || []).filter((l) => l && !l.junk);
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
  return {};
}

/** The lead a booking makes for someone new, as the app's Add tab would have saved it. */
function newLead(bk, service, now, owner) {
  const date = M.canberraDate(now);
  return {
    ...M.newFields(""),
    date, createdAt: now.toISOString(), owner, name: bk.name, phone: bk.phone, email: bk.email, suburb: bk.suburb, car: bk.car,
    source: "GHL booking", ad: "", fromAd: "", referredBy: "", address: bk.address, jobTime: "", access: "",
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
export function planBooking(body, { leads = [], jobs = [], cfg = null, now = new Date(), turn = "Angus" } = {}) {
  const bk = readBooking(body), at = now.toISOString(), today = M.canberraDate(now);
  const out = (ok, result, writes = [], extra = {}) => ({ ok, result, writes, summary: { appointmentId: bk.apptId, name: bk.name, status: bk.status, ...extra } });
  if (!bk.apptId) return out(false, "No appointment ID in what GHL sent, so nothing was changed.");
  const job = jobs.find((j) => j.ghlAppointmentId === bk.apptId);

  // ---- An appointment we have: moved, cancelled, no-show or showed.
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
    const sv = J.serviceFromText(bk.calendar) || J.serviceFromText(bk.title);
    if (sv && job.checkService) Object.assign(patch, { service: sv, checkService: false });
    if (bk.calendar && bk.calendar !== job.ghlCalendar) patch.ghlCalendar = bk.calendar;
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
  const found = findLead(leads, bk.phone, bk.email, today);
  const mapped = J.serviceFromText(bk.calendar) || J.serviceFromText(bk.title);
  const service = mapped || "Other", t = when(bk, service, cfg);
  const ghl = { source: "ghl", ghlAppointmentId: bk.apptId, ghlContactId: bk.contactId, ghlCalendar: bk.calendar, ghlStatus: bk.rawStatus || "booked", ghlNotes: bk.notes };
  const writes = [];
  let lead = found.lead || null, jobId, number, jobData;
  const cur = lead ? J.currentJob(jobs, lead.id) : null;
  if (cur && OPEN.includes(cur.status || "Scheduled") && !cur.ghlAppointmentId) {
    // Already booked here: that job takes the GHL booking's time.
    jobId = cur.id; number = cur.number;
    jobData = { ...ghl, date: t.date, start: t.start, end: t.end, allDay: !t.start && cur.allDay, ...(mapped && mapped !== cur.service ? { service: mapped } : {}), updatedAt: at };
    if (!t.date) { delete jobData.date; delete jobData.start; delete jobData.end; delete jobData.allDay; }
    writes.push({ collection: "jobs", id: jobId, op: "merge", data: jobData });
    jobData = { ...cur, ...jobData };
  } else {
    jobId = "ghl-" + safeId(bk.apptId); number = J.nextNumber(jobs);
    const price = lead ? (lead.priceRange ? lead.priceRange.replace("–", "-") : lead.revenue != null && lead.revenue !== "" ? String(lead.revenue) : lead.quoted != null && lead.quoted !== "" ? String(lead.quoted) : "") : "";
    jobData = J.blank({ number, leadId: lead ? lead.id : "ghl-" + safeId(bk.apptId), service, price, date: t.date, start: t.start, end: t.end, allDay: !t.start && J.lengthOf(service, cfg).allDay && !!t.date,
      notes: bk.notes, createdAt: at, createdBy: "GHL", updatedAt: at, checkService: !mapped, ...ghl });
    writes.push({ collection: "jobs", id: jobId, op: "create", data: jobData });
  }
  const note = [bk.calendar || bk.title, dayWords(t.date, t.start)].filter(Boolean).join(", ");
  if (lead) {
    let lp = M.stageOf(lead, today) !== "Booked" ? M.book(lead, { date: t.date, time: t.start, ...(lead.address ? {} : { address: bk.address }) }, at, "GHL") : { jobDate: t.date || lead.jobDate, jobTime: t.start || lead.jobTime || "" };
    for (const k of ["email", "address", "suburb", "car", "name"]) if (bk[k] && !String(lead[k] || "").trim()) lp[k] = bk[k];
    if (!lead.ghlContactId && bk.contactId) lp.ghlContactId = bk.contactId;
    lp = { ...lp, ...J.leadPatch(jobData, { ...lead, ...lp }) };
    lp.log = (lp.log || lead.log || []).concat([entry(at, "GHL booking", note)]);
    const merged = M.sync({ ...lead, ...lp, updatedAt: at }, today), p = changed(merged, lead);
    delete p.id;
    writes.push({ collection: "leads", id: lead.id, op: "merge", data: p });
    return out(true, "Booked " + (lead.name || "the lead") + " (found by " + found.by + "): job " + number + ", " + dayWords(t.date, t.start) + (mapped ? "" : ". Check service") + ".", writes, { jobId, number, leadId: lead.id, matchedBy: found.by });
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
