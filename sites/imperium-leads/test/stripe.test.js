import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import M from "../lib/model.js";
import { createDeposit, depositUpdate, describe, form, getDeposit, isTestKey, verifySignature } from "../lib/stripe.js";

const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString();

// A pretend Stripe: records each call and answers with `reply` (or reply(call) → [status, body]).
function fakeStripe(reply) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const c = { url, method: init.method, auth: init.headers && init.headers.Authorization, body: init.body ? new URLSearchParams(init.body) : null };
    calls.push(c);
    const [status, body] = typeof reply === "function" ? reply(c) : [200, reply];
    return { ok: status < 300, status, json: async () => body };
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
const API = "https://api.stripe.com/v1";

test("the deposit link is a short Payment Link: $50 AUD, the lead's name, car and job day on it, paid once", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  const s = fakeStripe((c) => {
    if (c.url.startsWith(API + "/prices?")) return [200, { data: [{ id: "price_deposit" }] }];
    if (c.url === API + "/payment_links") return [200, { id: "plink_new", url: "https://book.stripe.com/test_cN25nr0iZ7bUa7meUY" }];
    return [200, {}];
  });
  try {
    const out = await createDeposit({ leadId: "lead-1", name: "Jo Smith", car: "Kluger", date: "2026-10-24", time: "09:30", returnTo: "https://example.vercel.app", previous: "plink_old" });
    assert.deepEqual(out, { id: "plink_new", url: "https://book.stripe.com/test_cN25nr0iZ7bUa7meUY", expiresAt: "" });
    assert.equal(s.calls[0].url, API + "/prices?active=true&limit=1&lookup_keys%5B%5D=imperium_leads_deposit_50");
    const c = s.calls[1], b = c.body;
    assert.equal(c.url, API + "/payment_links");
    assert.equal(c.auth, "Bearer sk_test_example");
    assert.equal(b.get("line_items[0][price]"), "price_deposit");
    assert.equal(b.get("line_items[0][quantity]"), "1");
    assert.equal(b.get("submit_type"), "book");
    assert.equal(b.get("payment_intent_data[description]"), "Deposit: Jo Smith, Kluger, Sat 24 Oct 9:30am");
    assert.match(b.get("custom_text[submit][message]"), /^Jo Smith, Kluger, Sat 24 Oct 9:30am\. The \$50 comes off the final price/);
    assert.equal(b.get("metadata[leadId]"), "lead-1");
    assert.equal(b.get("metadata[app]"), "imperium-leads");
    assert.equal(b.get("metadata[jobDate]"), "2026-10-24");
    assert.equal(b.get("restrictions[completed_sessions][limit]"), "1");
    assert.equal(b.get("after_completion[redirect][url]"), "https://example.vercel.app/deposit.html?paid=1");
    // The lead's last unpaid link is turned off.
    assert.equal(s.calls[2].url, API + "/payment_links/plink_old");
    assert.equal(s.calls[2].body.get("active"), "false");
  } finally {
    s.restore();
  }
  assert.equal(describe({ name: "Jo", car: "" }), "Jo, day to be confirmed");
  assert.deepEqual([isTestKey("sk_test_1"), isTestKey("sk_live_1"), isTestKey("")], [true, false, false]);
  assert.equal(form({ a: { b: 1, c: "" }, d: [{ e: "x" }] }).toString(), "a%5Bb%5D=1&d%5B0%5D%5Be%5D=x");
});

test("the $50 price is made once and shared; if a Payment Link can't be made, a Checkout link is", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  const s = fakeStripe((c) => {
    if (c.url.startsWith(API + "/prices?")) return [200, { data: [] }];
    if (c.url === API + "/prices") return [200, { id: "price_made" }];
    if (c.url === API + "/payment_links") return [400, { error: { message: "Not allowed here" } }];
    if (c.url === API + "/checkout/sessions") return [200, { id: "cs_test_abc", url: "https://checkout.stripe.com/c/pay/cs_test_abc", expires_at: 1792200000 }];
    return [200, {}];
  });
  try {
    const out = await createDeposit({ leadId: "lead-1", name: "Jo", car: "Kluger", date: "2026-10-24", returnTo: "https://x.app" });
    const made = s.calls.find((c) => c.url === API + "/prices");
    assert.deepEqual([made.body.get("lookup_key"), made.body.get("unit_amount"), made.body.get("currency"), made.body.get("product_data[name]")], ["imperium_leads_deposit_50", "5000", "aud", "Deposit, Imperium Detailing"]);
    assert.equal(out.id, "cs_test_abc"); // the longer link, so a deposit can still be sent
    const cs = s.calls.find((c) => c.url === API + "/checkout/sessions").body;
    assert.deepEqual([cs.get("line_items[0][price_data][unit_amount]"), cs.get("line_items[0][price_data][currency]"), cs.get("metadata[leadId]")], ["5000", "aud", "lead-1"]);
  } finally {
    s.restore();
  }
});

test("checking a link: paid or not; only real link ids are asked for", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  const paidSession = { id: "cs_test_abc", payment_status: "paid", status: "complete", amount_total: 5000, payment_link: "plink_new", metadata: { leadId: "lead-1", app: "imperium-leads", jobDate: "2026-10-24", jobTime: "09:30" } };
  const s = fakeStripe((c) => c.url.includes("payment_link=") ? [200, { data: [{ id: "cs_test_open", payment_status: "unpaid", metadata: {} }, paidSession] }] : [200, paidSession]);
  try {
    const d = await getDeposit("plink_new");
    assert.deepEqual([d.paid, d.checkoutId, d.amount, d.leadId, d.jobDate], [true, "cs_test_abc", 50, "lead-1", "2026-10-24"]);
    assert.equal(s.calls[0].url, API + "/checkout/sessions?limit=10&payment_link=plink_new");
    const old = await getDeposit("cs_test_abc"); // a long link from before still works
    assert.deepEqual([old.paid, s.calls[1].url], [true, API + "/checkout/sessions/cs_test_abc"]);
    await assert.rejects(getDeposit("../customers"), /Not a deposit link/);
  } finally {
    s.restore();
  }
  delete process.env.STRIPE_SECRET_KEY;
  await assert.rejects(createDeposit({ leadId: "x", returnTo: "https://x" }), /STRIPE_SECRET_KEY/);
});

test("the webhook only believes Stripe: the signature must match the secret and be recent", () => {
  const secret = "whsec_example", payload = JSON.stringify({ type: "checkout.session.completed" }), now = 1792200000 * 1000;
  const sign = (t, body = payload, key = secret) => createHmac("sha256", key).update(`${t}.${body}`).digest("hex");
  const t = String(now / 1000);
  assert.equal(verifySignature(payload, `t=${t},v1=${sign(t)}`, secret, now), true);
  assert.equal(verifySignature(payload, `t=${t},v1=deadbeef,v1=${sign(t)}`, secret, now), true); // one of several
  assert.equal(verifySignature(payload, `t=${t},v1=${sign(t, payload, "whsec_other")}`, secret, now), false);
  assert.equal(verifySignature(payload + " ", `t=${t},v1=${sign(t)}`, secret, now), false); // changed body
  assert.equal(verifySignature(payload, `t=${t},v1=${sign(t)}`, secret, now + 10 * 60 * 1000), false); // too old
  assert.equal(verifySignature(payload, "", secret, now), false);
  assert.equal(verifySignature(payload, `t=${t},v1=${sign(t)}`, "", now), false);
});

test("a paid deposit marks the lead paid and moves it to Booked, once; anything else is left alone", () => {
  const lead = M.sync({ name: "Jo", stage: "Chasing", touches: 2, nextFollowUp: "2026-10-20", log: [], ...M.newFields(""), modelVersion: 4, stage: "Chasing" }, "2026-10-20");
  const event = (o = {}) => ({ type: "checkout.session.completed", data: { object: { id: "cs_test_abc", payment_status: "paid", amount_total: 5000, metadata: { leadId: "lead-1", app: "imperium-leads", jobDate: "2026-10-24", jobTime: "09:30" }, ...o } } });
  const now = new Date(at("2026-10-20", "11:00"));
  const out = depositUpdate(event(), lead, now);
  assert.deepEqual([out.depositPaid, out.depositAmount, out.depositSessionId, out.stage, out.status, out.jobDate, out.jobTime], ["Yes", 50, "cs_test_abc", "Booked", "Booked", "2026-10-24", "09:30"]);
  assert.equal(depositUpdate(event(), out, now), null); // the same payment again: nothing to do
  assert.equal(depositUpdate(event({ payment_status: "unpaid" }), lead, now), null);
  assert.equal(depositUpdate(event({ metadata: { leadId: "lead-1", app: "something-else" } }), lead, now), null);
  assert.equal(depositUpdate({ ...event(), type: "payment_intent.created" }, lead, now), null);
  assert.equal(depositUpdate(event(), null, now), null);
  // From a Payment Link: the lead keeps the link's id, and the same payment again changes nothing.
  const linked = { ...lead, depositSessionId: "plink_new" };
  const viaLink = depositUpdate(event({ payment_link: "plink_new" }), linked, now);
  assert.deepEqual([viaLink.depositPaid, viaLink.depositSessionId, viaLink.depositCheckoutId, viaLink.stage], ["Yes", "plink_new", "cs_test_abc", "Booked"]);
  assert.equal(depositUpdate(event({ payment_link: "plink_new" }), viaLink, now), null);
});
