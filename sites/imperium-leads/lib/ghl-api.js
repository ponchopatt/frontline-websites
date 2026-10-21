/*
  GoHighLevel's API (v2, services.leadconnectorhq.com), read only, with the private integration
  token in GHL_API_TOKEN. Used to bring in the past appointments. A little over 8 calls a second
  at most, under GHL's limit of 100 in 10 seconds.
*/

const BASE = "https://services.leadconnectorhq.com";
let next = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Each call starts 120ms after the one before, however many are waiting.
async function slow() {
  const now = Date.now(), at = Math.max(now, next);
  next = at + 120;
  if (at > now) await wait(at - now);
}

export async function ghlGet(path, params, { token, version = "2021-07-28", fetchFn = globalThis.fetch } = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params || {})) if (v != null && v !== "") url.searchParams.set(k, String(v));
  for (let tries = 0; ; tries++) {
    await slow();
    const res = await fetchFn(url.toString(), { headers: { Authorization: "Bearer " + token, Version: version, Accept: "application/json" } });
    if (res.status === 429 && tries < 3) { await wait(1500 * (tries + 1)); continue; }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error("GHL " + res.status + " on " + path + ": " + (body.message || body.error || "no reason given"));
      e.status = res.status;
      throw e;
    }
    return body;
  }
}

export const calendars = async (locationId, o) => (await ghlGet("/calendars/", { locationId }, { ...o, version: "2021-04-15" })).calendars || [];
export const contact = async (id, o) => (await ghlGet("/contacts/" + encodeURIComponent(id), {}, o)).contact || null;
export const customFields = async (locationId, o) => (await ghlGet("/locations/" + encodeURIComponent(locationId) + "/customFields", {}, o)).customFields || [];
export async function opportunities(locationId, contactId, o) {
  return (await ghlGet("/opportunities/search", { location_id: locationId, contact_id: contactId }, o)).opportunities || [];
}

/** Every appointment in a calendar between two days, a stretch at a time (90 days, else 30). */
export async function events(locationId, calendarId, from, to, o, days = 90) {
  const out = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t < Date.parse(to + "T23:59:59Z"); t += days * 864e5) {
    const end = Math.min(t + days * 864e5, Date.parse(to + "T23:59:59Z"));
    try {
      out.push(...((await ghlGet("/calendars/events", { locationId, calendarId, startTime: t, endTime: end }, { ...o, version: "2021-04-15" })).events || []));
    } catch (e) {
      if (days > 30 && e.status && e.status < 500 && e.status !== 401 && e.status !== 403) {
        out.push(...(await events(locationId, calendarId, new Date(t).toISOString().slice(0, 10), new Date(end).toISOString().slice(0, 10), o, 30)));
      } else throw e;
    }
  }
  return out;
}

/**
  What the webhook would have been sent for this appointment, so the same rules read it: the
  contact at the top (its custom fields by name), the appointment under `calendar`.
*/
export function bodyFor(ev, ct, calendarName, fieldNames, value) {
  const c = ct || {};
  const body = {
    contact_id: c.id || ev.contactId || "",
    first_name: c.firstName || "", last_name: c.lastName || "", full_name: c.name || c.contactName || [c.firstName, c.lastName].filter(Boolean).join(" "),
    email: c.email || "", phone: c.phone || "", address1: c.address1 || "", city: c.city || "", state: c.state || "", postal_code: c.postalCode || "",
    contact: { attributionSource: c.attributionSource || {}, lastAttributionSource: c.lastAttributionSource || {} },
    calendar: {
      appointmentId: ev.id, calendarName: calendarName || "", title: ev.title || "", startTime: ev.startTime, endTime: ev.endTime,
      appoinmentStatus: ev.appointmentStatus || ev.status || "", notes: ev.notes || ev.description || "", address: ev.address || "",
    },
  };
  for (const f of c.customFields || c.customField || []) {
    const name = fieldNames[f.id] || f.name || f.key;
    const v = Array.isArray(f.value) ? f.value.join(", ") : f.value ?? f.field_value;
    if (name && v != null && typeof v !== "object") body[name] = String(v);
  }
  if (value) body.monetaryValue = value;
  return body;
}
