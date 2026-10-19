import { json } from "../lib/http.js";
import { depositUpdate, getPaymentLink, verifySignature } from "../lib/stripe.js";
import { adminClient, readDoc, writeDoc } from "../lib/supabase.js";

/*
  POST /api/stripe-webhook — Stripe calls this when a deposit is paid (checkout.session.completed).
  The signature is checked with STRIPE_WEBHOOK_SECRET; then the lead shows "Deposit paid ✓" and
  moves to Booked. Only the live site writes: a preview answers but never changes a lead (the
  phone checks the link itself there, and keeps the result on the phone).
*/

export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: "STRIPE_WEBHOOK_SECRET isn't set" }, 500);
  const payload = await request.text();
  if (!verifySignature(payload, request.headers.get("stripe-signature"), secret)) return json({ error: "Bad signature" }, 400);
  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }
  const s = (event.data && event.data.object) || {};
  // A payment from a Payment Link carries the link's metadata; if it ever doesn't, ask Stripe.
  if (!(s.metadata && s.metadata.leadId) && /^plink_/.test(String(s.payment_link || ""))) {
    const link = await getPaymentLink(s.payment_link).catch(() => null);
    if (link && link.metadata) s.metadata = { ...link.metadata, ...(s.metadata || {}) };
  }
  const leadId = (s.metadata && s.metadata.leadId) || s.client_reference_id;
  if (!leadId) return json({ received: true });
  if (process.env.VERCEL_ENV !== "production") return json({ received: true, preview: true });

  const db = adminClient();
  const old = await readDoc(db, "leads", leadId).catch(() => null);
  const merged = depositUpdate(event, old);
  if (!merged) return json({ received: true });
  // Only what changed, merged in, so a phone saving the same lead at that moment loses nothing.
  const patch = Object.fromEntries(Object.entries(merged).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(old[k])));
  const { error } = await db.rpc("docs_merge", { p_collection: "leads", p_id: leadId, p_patch: patch });
  if (error) {
    try {
      await writeDoc(db, "leads", leadId, merged);
    } catch {
      return json({ error: "Couldn't save" }, 500); // Stripe tries again later
    }
  }
  return json({ received: true, updated: true });
}
