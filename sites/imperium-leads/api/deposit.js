import { json, readJson } from "../lib/http.js";
import M from "../lib/model.js";
import { createDeposit, getDeposit, isTestKey, stripeKey } from "../lib/stripe.js";
import { adminClient, readDoc } from "../lib/supabase.js";
import { isTeam } from "../lib/team.js";

/*
  The $50 deposit, for the team only (the phone sends its sign-in).

  POST /api/deposit {leadId, date, time, name, car, previous} — makes a short Stripe Payment Link
  for the lead, with its name, car and job day on it, and turns off `previous` (the lead's last
  unpaid link). Answers {id, url, expiresAt, test}.
  GET  /api/deposit?id=plink_… (or cs_…) — whether that link has been paid: {paid, checkoutId, amount, ...}.

  Nothing is saved here: the phone keeps the link on the lead, and /api/stripe-webhook marks it
  paid. The key comes from STRIPE_SECRET_KEY in Vercel's settings.
*/

const clip = (v, n = 120) => String(v ?? "").trim().slice(0, n);

export async function POST(request) {
  if (!(await isTeam(request))) return json({ error: "Sign in first" }, 401);
  if (!stripeKey()) return json({ error: "not_set_up" }, 503);
  let body;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "Send JSON" }, 400);
  }
  const leadId = clip(body.leadId);
  if (!leadId) return json({ error: "Which lead?" }, 400);
  // The lead as saved, else what the phone sent (a lead tried out on a preview isn't saved).
  const lead = (await readDoc(adminClient(), "leads", leadId).catch(() => null)) || {};
  const date = M.isDay(body.date) ? body.date : M.isDay(lead.jobDate) ? lead.jobDate : "";
  const time = /^\d{1,2}:\d{2}$/.test(String(body.time || "")) ? body.time : lead.jobTime || "";
  try {
    const previous = /^plink_[A-Za-z0-9]+$/.test(String(body.previous || "")) ? body.previous : "";
    const s = await createDeposit({ leadId, name: lead.name || clip(body.name), car: lead.car || clip(body.car), date, time, previous, returnTo: new URL(request.url).origin });
    return json({ ...s, test: isTestKey(stripeKey()) });
  } catch (e) {
    return json({ error: e.message || "Stripe said no" }, 502);
  }
}

export async function GET(request) {
  if (!(await isTeam(request))) return json({ error: "Sign in first" }, 401);
  if (!stripeKey()) return json({ error: "not_set_up" }, 503);
  try {
    return json(await getDeposit(new URL(request.url).searchParams.get("id")));
  } catch (e) {
    return json({ error: e.message || "Stripe said no" }, e.code === "bad_id" ? 400 : 502);
  }
}
