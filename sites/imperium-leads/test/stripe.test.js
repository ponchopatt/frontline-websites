import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import M from "../lib/model.js";
import { createDeposit, depositUpdate, describe, form, getDeposit, isTestKey, verifySignature } from "../lib/stripe.js";

const at = (d, hm = "10:00") => new Date(`${d}T${hm}:00+11:00`).toISOString();

// A pretend Stripe: records each call and answers with `reply`.
function fakeStripe(reply) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method, auth: init.headers && init.headers.Authorization, body: init.body ? new URLSearchParams(init.body) : null });
    return { ok: true, json: async () => reply };
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

test("the deposit link: $50 AUD, the lead's name, car and job day in the description, the key from the setting", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  const s = fakeStripe({ id: "cs_test_abc", url: "https://checkout.stripe.com/c/pay/cs_test_abc", expires_at: 1792200000 });
  try {
    const out = await createDeposit({ leadId: "lead-1", name: "Jo Smith", car: "Kluger", date: "2026-10-24", time: "09:30", returnTo: "https://example.vercel.app" });
    assert.deepEqual(out, { id: "cs_test_abc", url: "https://checkout.stripe.com/c/pay/cs_test_abc", expiresAt: new Date(1792200000 * 1000).toISOString() });
    const c = s.calls[0], b = c.body;
    assert.equal(c.url, "https://api.stripe.com/v1/checkout/sessions");
    assert.equal(c.method, "POST");
    assert.equal(c.auth, "Bearer sk_test_example");
    assert.equal(b.get("mode"), "payment");
    assert.equal(b.get("line_items[0][price_data][currency]"), "aud");
    assert.equal(b.get("line_items[0][price_data][unit_amount]"), "5000");
    assert.equal(b.get("line_items[0][quantity]"), "1");
    assert.equal(b.get("line_items[0][price_data][product_data][description]"), "Jo Smith, Kluger, Sat 24 Oct 9:30am");
    assert.equal(b.get("metadata[leadId]"), "lead-1");
    assert.equal(b.get("metadata[app]"), "imperium-leads");
    assert.equal(b.get("metadata[jobDate]"), "2026-10-24");
    assert.equal(b.get("client_reference_id"), "lead-1");
    assert.equal(b.get("success_url"), "https://example.vercel.app/deposit.html?paid=1");
  } finally {
    s.restore();
  }
  assert.equal(describe({ name: "Jo", car: "" }), "Jo, day to be confirmed");
  assert.deepEqual([isTestKey("sk_test_1"), isTestKey("sk_live_1"), isTestKey("")], [true, false, false]);
  assert.equal(form({ a: { b: 1, c: "" }, d: [{ e: "x" }] }).toString(), "a%5Bb%5D=1&d%5B0%5D%5Be%5D=x");
});

test("checking a link: paid or not; only real link ids are asked for", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  const s = fakeStripe({ id: "cs_test_abc", payment_status: "paid", status: "complete", amount_total: 5000, metadata: { leadId: "lead-1", app: "imperium-leads", jobDate: "2026-10-24", jobTime: "09:30" } });
  try {
    const d = await getDeposit("cs_test_abc");
    assert.deepEqual([d.paid, d.amount, d.leadId, d.jobDate], [true, 50, "lead-1", "2026-10-24"]);
    assert.equal(s.calls[0].url, "https://api.stripe.com/v1/checkout/sessions/cs_test_abc");
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
});
