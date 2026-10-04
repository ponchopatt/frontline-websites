import { canberraDate } from "./time.js";

/*
  A form or ad enquiry, as the app's own "Add" tab would have saved it. The field set matches
  imperium-leads.html exactly, so the app treats it like any lead typed in by hand.
*/

const clip = (v, n = 300) => String(v ?? "").trim().slice(0, n);

/** "Meta ad · Brand film" → "Meta ad"; google → "Google"; tiktok → "TikTok"; anything else "Website". */
export function mapSource(source) {
  const s = String(source ?? "").toLowerCase();
  if (/meta|facebook|instagram/.test(s)) return "Meta ad";
  if (s.includes("google")) return "Google";
  if (s.includes("tiktok")) return "TikTok";
  return "Website";
}

/** The ad's name: whatever follows "·" in the source ("Meta ad · Brand film" → "Brand film"). */
export function adName(source) {
  const s = String(source ?? "");
  const i = s.indexOf("·");
  return i === -1 ? "" : clip(s.slice(i + 1), 120);
}

const SERVICES = [
  ["full", "Full detail"],
  ["interior", "Interior"],
  ["exterior", "Exterior"],
  ["correction", "Correction"],
  ["ceramic", "Ceramic"],
  ["maintenance", "Maintenance plan"],
  ["pre-sale", "Pre-sale"],
];

export function mapService(service) {
  const s = String(service ?? "").toLowerCase();
  for (const [word, label] of SERVICES) if (s.includes(word)) return label;
  return "Not sure";
}

/** Digits only, with +61 written the Australian way: "+61 400 000 000" → "0400000000". */
export function phoneKey(phone) {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (d.startsWith("61") && d.length === 11) d = "0" + d.slice(2);
  return d;
}

/*
  The timeline answer, from the form's keys (asap, within_1_2_weeks, just_browsing) or its words.
  The same rule as timelineOf in public/model.js (a test checks they agree).
*/
export function mapTimeline(value) {
  const s = String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!s) return "";
  if (/\bbrows/.test(s) || /\bjust looking\b/.test(s)) return "just_browsing";
  if (/\basap\b|\bas soon as\b/.test(s)) return "asap";
  if (/\b1 (to )?2 weeks?\b|\bwithin 1\b|\bwithin 2 weeks?\b/.test(s)) return "within_1_2_weeks";
  return "";
}

const SCORE = { asap: "Hot", within_1_2_weeks: "Warm", just_browsing: "Browsing" };
const PEOPLE = ["Angus", "Ananth"];

/** "Angus" or "Ananth" when the source names one, else "". */
export function mapOwner(value) {
  const s = String(value ?? "").trim().toLowerCase();
  return PEOPLE.find((p) => p.toLowerCase() === s) || "";
}

export function buildLead(input, now = new Date()) {
  const date = canberraDate(now);
  const notes = [
    input.when ? `When: ${clip(input.when)}` : "",
    input.email ? `Email: ${clip(input.email)}` : "",
    clip(input.notes, 2000),
    input.form ? `Via ${clip(input.form, 60)} form` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const timeline = mapTimeline(input.timeline ?? input.when);
  return {
    date,
    createdAt: now.toISOString(),
    owner: mapOwner(input.owner),
    name: clip(input.name, 120),
    phone: clip(input.phone, 40),
    suburb: clip(input.suburb, 120),
    car: clip(input.vehicle, 200),
    source: mapSource(input.source),
    ad: adName(input.source),
    service: mapService(input.service),
    status: "New",
    nextFollowUp: date,
    lastContact: "",
    replyMins: null,
    quoted: null,
    jobDate: "",
    revenue: null,
    paid: "",
    plan: "",
    upsellOffered: "",
    upsellTaken: "",
    reviewAsked: "",
    reviewLeft: "",
    objection: "",
    lostWhy: "",
    nextDue: "",
    log: [],
    booked: "Pending",
    notes,
    referredBy: "",
    address: "",
    jobTime: "",
    access: "",
    completedAt: null,
    reviewStatus: null,
    reviewAskedAt: null,
    reviewTextSentAt: null,
    reviewNudgedAt: null,
    reviewLeftAt: null,
    reviewNotes: "",
    // The follow-up fields (public/model.js describes them).
    stage: "New",
    touches: 0,
    timeline,
    score: SCORE[timeline] || "",
    scoreBy: SCORE[timeline] ? "timeline" : "",
    schedule: timeline === "just_browsing" ? "browsing" : "full",
    snoozeUntil: "",
    lostReason: "",
    doNotText: false,
    junk: false,
    modelVersion: 2,
  };
}
