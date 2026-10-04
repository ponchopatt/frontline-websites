import { json, readJson, sameSecret } from "../lib/http.js";
import { buildLead, phoneKey } from "../lib/lead-map.js";
import M from "../lib/model.js";
import { adminClient, readCollection, readDoc, writeDoc } from "../lib/supabase.js";

/*
  POST /api/lead — a new enquiry from a website form, Make.com or anything else.

  Make.com (and any server) sends the shared secret in an "x-lead-secret" header. The website's
  forms post straight from the visitor's browser, where a secret can't be kept, so those are let
  in by where they come from instead (the site's own address).

  A phone number that's already a lead goes on that lead when it's still open or came in within
  the last 30 days (it shows as new again on Today). Someone from longer ago gets a new lead,
  marked as a repeat of the old one.

  Each new lead gets an owner: the one the source names ("owner": "Angus" or "Ananth"), else
  Angus and Ananth in turn.
*/

const TURN = ["_system", "owner-turn"];
const PEOPLE = ["Angus", "Ananth"];

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

  // The same person again?
  if (key) {
    let rows;
    try {
      rows = await readCollection(db, "leads");
    } catch {
      return json({ ok: false, error: "Couldn't check for a duplicate" }, 500, headers);
    }
    const match = M.matchPhone(rows.map((r) => ({ id: r.id, ...r.data })), lead.phone, lead.date);
    if (match.merge) {
      const old = rows.find((r) => r.id === match.merge.id).data;
      const merged = M.sync({ ...old, ...M.mergeEnquiry(match.merge, lead, lead.createdAt), updatedAt: lead.createdAt }, lead.date);
      try {
        await writeDoc(db, "leads", match.merge.id, merged);
      } catch {
        return json({ ok: false, error: "Couldn't save the lead" }, 500, headers);
      }
      return json({ ok: true, duplicate: true, merged: true, id: match.merge.id }, 200, headers);
    }
    if (match.repeatOf) lead.repeatOf = match.repeatOf;
  }

  // Nobody named: whoever's turn it is.
  const byTurn = !lead.owner;
  if (byTurn) {
    const turn = await readDoc(db, ...TURN).catch(() => null);
    lead.owner = PEOPLE.includes(turn && turn.next) ? turn.next : PEOPLE[0];
  }

  // The id carries the phone and day, so two posts at the same moment still make one lead.
  const id = key ? `in-${lead.date}-${key}` : crypto.randomUUID();
  const { data: inserted, error } = await db
    .from("docs")
    .upsert({ collection: "leads", id, data: lead, updated_at: new Date().toISOString() }, { onConflict: "collection,id", ignoreDuplicates: true })
    .select("id");
  if (error) return json({ ok: false, error: "Couldn't save the lead" }, 500, headers);
  // Pass the turn on only when a lead was really added (and never let it stop the lead).
  if (byTurn && inserted.length) await writeDoc(db, ...TURN, { next: PEOPLE[(PEOPLE.indexOf(lead.owner) + 1) % 2] }).catch(() => {});
  return json({ ok: true, duplicate: inserted.length === 0, id }, 200, headers);
}
