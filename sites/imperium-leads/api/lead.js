import { json, readJson, sameSecret } from "../lib/http.js";
import { buildLead, phoneKey } from "../lib/lead-map.js";
import { adminClient } from "../lib/supabase.js";

/*
  POST /api/lead — a new enquiry from a website form, Make.com or anything else.

  Make.com (and any server) sends the shared secret in an "x-lead-secret" header. The website's
  forms post straight from the visitor's browser, where a secret can't be kept, so those are let
  in by where they come from instead (the site's own address). One lead per phone number a day.
*/

const SITE_ORIGINS = (process.env.LEAD_ORIGINS || "https://imperiumdetailing.com.au,https://www.imperiumdetailing.com.au")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function cors(request) {
  const origin = request.headers.get("origin");
  return origin && SITE_ORIGINS.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

export function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: { ...cors(request), "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "86400" },
  });
}

export async function POST(request) {
  const headers = cors(request);
  const secret = request.headers.get("x-lead-secret") || (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const fromSite = Boolean(headers["Access-Control-Allow-Origin"]);
  if (!sameSecret(secret, process.env.LEAD_SECRET) && !fromSite) return json({ ok: false, error: "Not allowed" }, 401);

  let input;
  try {
    input = await readJson(request);
  } catch {
    return json({ ok: false, error: "Send JSON" }, 400, headers);
  }
  if (!input || typeof input !== "object" || (!String(input.name ?? "").trim() && !String(input.phone ?? "").trim())) {
    return json({ ok: false, error: "A lead needs a name or a phone number" }, 400, headers);
  }

  const lead = buildLead(input);
  const db = adminClient();
  const key = phoneKey(lead.phone);

  // Already in today (typed into the app, or sent by the form and the ad both)?
  if (key) {
    const { data, error } = await db.from("docs").select("id,data").eq("collection", "leads").eq("data->>date", lead.date);
    if (error) return json({ ok: false, error: "Couldn't check for a duplicate" }, 500, headers);
    const same = data.find((r) => phoneKey(r.data.phone) === key);
    if (same) return json({ ok: true, duplicate: true, id: same.id }, 200, headers);
  }

  // The id carries the phone and day, so two posts at the same moment still make one lead.
  const id = key ? `in-${lead.date}-${key}` : crypto.randomUUID();
  const { data: inserted, error } = await db
    .from("docs")
    .upsert({ collection: "leads", id, data: lead, updated_at: new Date().toISOString() }, { onConflict: "collection,id", ignoreDuplicates: true })
    .select("id");
  if (error) return json({ ok: false, error: "Couldn't save the lead" }, 500, headers);
  return json({ ok: true, duplicate: inserted.length === 0, id }, 200, headers);
}
