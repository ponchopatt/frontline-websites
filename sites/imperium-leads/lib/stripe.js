import { createHmac, timingSafeEqual } from "node:crypto";
import M from "./model.js";

/*
  The $50 deposit, through a Stripe Payment Link, with plain fetch (no Stripe library). A
  Payment Link is short (https://book.stripe.com/…), can be paid once, and stays open until it's
  paid or a new link for the same lead turns it off. If Stripe won't make one, a Checkout link
  (much longer, open for 24 hours) is made instead.

  The secret key only ever comes from STRIPE_SECRET_KEY in Vercel's settings, and the webhook's
  signing secret from STRIPE_WEBHOOK_SECRET. A test key (sk_test_…) only takes test cards.
*/

const API = "https://api.stripe.com/v1";
export const DEPOSIT_CENTS = M.DEPOSIT * 100;
// Every link this app makes is marked with this, so the webhook leaves anything else on the
// Stripe account alone.
export const APP = "imperium-leads";

export const stripeKey = () => process.env.STRIPE_SECRET_KEY || "";
export const isTestKey = (key) => /^(sk|rk)_test_/.test(key || "");
// A deposit link's id: a Payment Link (plink_…), or a Checkout Session (cs_…) from before.
export const isLinkId = (id) => /^(cs_(test|live)_[A-Za-z0-9]+|plink_[A-Za-z0-9]+)$/.test(String(id || ""));
// The one $50 price every deposit link uses (so the product list holds one Deposit, not one per lead).
const PRICE_KEY = "imperium_leads_deposit_50";

/** Stripe's form encoding: { a: { b: 1 }, c: [{ d: 2 }] } → a[b]=1&c[0][d]=2. Empty values are left out. */
export function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === "") continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function call(method, path, body) {
  const key = stripeKey();
  if (!key) throw Object.assign(new Error("STRIPE_SECRET_KEY isn't set"), { code: "not_set_up" });
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: "Bearer " + key, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: body ? form(body).toString() : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data.error && data.error.message) || "Stripe said no"), { code: "stripe", status: res.status });
  return data;
}

/** "Jo Smith, Kluger, Sat 25 Oct 9:00am" (the day and time when they're known). */
export function describe({ name, car, date, time }) {
  const day = M.isDay(date) ? new Date(date + "T12:00:00Z").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "") : "";
  const when = [day, M.timeLabel(time)].filter(Boolean).join(" ");
  return [String(name || "").trim() || "Customer", String(car || "").trim(), when || "day to be confirmed"].filter(Boolean).join(", ").slice(0, 300);
}

async function depositPrice() {
  const find = async () => {
    const found = await call("GET", "/prices?active=true&limit=1&lookup_keys%5B%5D=" + PRICE_KEY);
    return found.data && found.data[0] ? found.data[0].id : "";
  };
  const id = await find();
  if (id) return id;
  try {
    const p = await call("POST", "/prices", { currency: "aud", unit_amount: DEPOSIT_CENTS, lookup_key: PRICE_KEY, product_data: { name: "Deposit, Imperium Detailing" } });
    return p.id;
  } catch (e) {
    // The other phone made it at the same moment.
    const again = await find();
    if (again) return again;
    throw e;
  }
}

/**
 * A short link for the $50 deposit (AUD), with the lead's name, car and job day on the payment
 * and on the page. `previous` is the lead's last unpaid link, which is turned off.
 * Returns { id, url, expiresAt } (expiresAt is "" for a Payment Link: it doesn't run out).
 */
export async function createDeposit({ leadId, name, car, date, time, returnTo, previous }) {
  const description = describe({ name, car, date, time });
  let link;
  try {
    link = await call("POST", "/payment_links", {
      line_items: [{ price: await depositPrice(), quantity: 1 }],
      submit_type: "book",
      metadata: { leadId, app: APP, jobDate: M.isDay(date) ? date : "", jobTime: time || "" },
      payment_intent_data: { description: "Deposit: " + description, metadata: { leadId, app: APP } },
      custom_text: { submit: { message: description + ". The $" + M.DEPOSIT + " comes off the final price and is fully refundable with 24 hours' notice." } },
      after_completion: { type: "redirect", redirect: { url: returnTo + "/deposit.html?paid=1" } },
      restrictions: { completed_sessions: { limit: 1 } },
      inactive_message: "This deposit link has been used or replaced. Message Imperium Detailing for a new one.",
    });
  } catch (e) {
    if (e.code === "not_set_up") throw e;
    return createCheckout({ leadId, description, date, time, returnTo });
  }
  if (previous && /^plink_/.test(previous) && previous !== link.id) {
    await call("POST", "/payment_links/" + previous, { active: "false" }).catch(() => {});
  }
  return { id: link.id, url: link.url, expiresAt: "" };
}

/** The older, longer Checkout link (open for 24 hours), for when a Payment Link can't be made. */
async function createCheckout({ leadId, description, date, time, returnTo }) {
  const s = await call("POST", "/checkout/sessions", {
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "aud", unit_amount: DEPOSIT_CENTS, product_data: { name: "Deposit, Imperium Detailing", description } } }],
    payment_intent_data: { description: "Deposit: " + description, metadata: { leadId, app: APP } },
    metadata: { leadId, app: APP, jobDate: M.isDay(date) ? date : "", jobTime: time || "" },
    client_reference_id: leadId,
    success_url: returnTo + "/deposit.html?paid=1",
    cancel_url: returnTo + "/deposit.html",
  });
  return { id: s.id, url: s.url, expiresAt: s.expires_at ? new Date(s.expires_at * 1000).toISOString() : "" };
}

/** A Payment Link, for its metadata (which lead, which day). */
export const getPaymentLink = (id) => call("GET", "/payment_links/" + id);

/**
 * Whether a deposit link has been paid: { paid, checkoutId, status, amount, leadId, jobDate, jobTime }.
 * checkoutId is the payment's Checkout Session.
 */
export async function getDeposit(id) {
  if (!isLinkId(id)) throw Object.assign(new Error("Not a deposit link"), { code: "bad_id" });
  let s;
  if (id.startsWith("plink_")) {
    const list = await call("GET", "/checkout/sessions?limit=10&payment_link=" + id);
    const all = (list && list.data) || [];
    s = all.find((x) => x.payment_status === "paid") || all[0] || { metadata: {} };
  } else {
    s = await call("GET", "/checkout/sessions/" + id);
  }
  const meta = s.metadata || {};
  const paid = s.payment_status === "paid";
  return { paid, checkoutId: paid ? s.id : "", status: s.status || "", amount: (s.amount_total || DEPOSIT_CENTS) / 100, leadId: meta.leadId || s.client_reference_id || "", app: meta.app || "", jobDate: meta.jobDate || "", jobTime: meta.jobTime || "" };
}

/**
 * Checks the Stripe-Signature header: t=<seconds>,v1=<hex HMAC-SHA256 of "t.payload">, signed
 * with the webhook's secret, and no older than 5 minutes.
 */
export function verifySignature(payload, header, secret, now = Date.now(), toleranceSec = 300) {
  if (!payload || !header || !secret) return false;
  let t = "";
  const sigs = [];
  for (const part of String(header).split(",")) {
    const i = part.indexOf("=");
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === "t") t = v;
    else if (k === "v1") sigs.push(v);
  }
  if (!/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > toleranceSec) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex"));
  return sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/**
 * What a webhook event does to the lead it's for. Returns null when it's not a paid deposit from
 * this app, or the lead already has it; else the merged lead (synced) to save.
 */
export function depositUpdate(event, lead, now = new Date()) {
  if (!event || !lead) return null;
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return null;
  const s = (event.data && event.data.object) || {};
  const meta = s.metadata || {};
  if (meta.app !== APP || s.payment_status !== "paid") return null;
  const ids = [s.id, s.payment_link].filter(Boolean);
  if (lead.depositPaid === "Yes" && [lead.depositSessionId, lead.depositCheckoutId].some((x) => x && ids.includes(x))) return null;
  const today = M.canberraDate(now);
  const patch = M.depositPaid(lead, { at: now.toISOString(), sessionId: s.id, linkId: s.payment_link || "", amount: (s.amount_total || DEPOSIT_CENTS) / 100, date: meta.jobDate, time: meta.jobTime }, today);
  return M.sync({ ...lead, ...patch, updatedAt: now.toISOString() }, today);
}
