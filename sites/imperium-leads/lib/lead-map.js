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
  return {
    date,
    createdAt: now.toISOString(),
    owner: "",
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
  };
}
