import { json, sameSecret } from "../lib/http.js";
import { asLeads, eveningEmail, morningEmail } from "../lib/reminders.js";
import { adminClient, readCollection, readDoc, writeDoc } from "../lib/supabase.js";
import { canberraDate, canberraMinutes } from "../lib/time.js";

/*
  GET /api/remind?slot=morning|evening — the 07:25 chase list and the 17:20 "not logged yet"
  list, emailed to Angus and Ananth. Vercel's cron calls it at both summer and winter times
  (its clock is UTC); only the call that lands in the right Canberra hour sends, once a day.

  By hand: add &force=1 to send now, &dry=1 to see the email without sending. Both need the
  cron secret: Authorization: Bearer <CRON_SECRET>.
*/

const WINDOWS = { morning: [7 * 60, 9 * 60], evening: [17 * 60, 19 * 60] };

function appUrl(request) {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return new URL(request.url).origin;
}

async function send(to, email) {
  const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.REMIND_FROM, to: [to], subject: email.subject, text: email.text, html: email.html }),
  });
  if (!res.ok) throw new Error(`Resend said ${res.status}: ${await res.text()}`);
}

export async function GET(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!sameSecret(token, process.env.CRON_SECRET)) return json({ error: "Not allowed" }, 401);

  const url = new URL(request.url);
  const slot = url.searchParams.get("slot");
  if (!WINDOWS[slot]) return json({ error: "slot must be morning or evening" }, 400);
  const force = url.searchParams.get("force") === "1";
  const dry = url.searchParams.get("dry") === "1";

  const now = new Date();
  const today = canberraDate(now);
  const minutes = canberraMinutes(now);
  const [from, to] = WINDOWS[slot];
  if (!force && !dry && (minutes < from || minutes >= to)) return json({ skipped: "not this hour in Canberra", today, minutes });

  const db = adminClient();
  const mark = [`_system`, `remind-${today}-${slot}`];
  if (!force && !dry && (await readDoc(db, ...mark))) return json({ skipped: "already sent today", today });

  const leads = asLeads(await readCollection(db, "leads"));
  const people = [
    ["Angus", process.env.REMIND_ANGUS],
    ["Ananth", process.env.REMIND_ANANTH],
  ].filter(([, email]) => email);
  const link = appUrl(request);
  const emails = people.map(([name, address]) => ({ name, address, email: slot === "morning" ? morningEmail(leads, today, name, link) : eveningEmail(leads, today, name, link) }));

  if (dry) return json({ today, slot, emails: emails.map((e) => ({ to: e.address, ...e.email })) });

  // Evening with nothing left to log: no email.
  const due = emails.filter((e) => slot === "morning" || e.email.count > 0);
  if (due.length && (!process.env.RESEND_API_KEY || !process.env.REMIND_FROM)) return json({ error: "RESEND_API_KEY and REMIND_FROM must be set" }, 500);
  const sent = [];
  for (const e of due) {
    await send(e.address, e.email);
    sent.push(e.name);
  }
  await writeDoc(db, ...mark, { sentAt: now.toISOString(), to: sent });
  return json({ today, slot, sent });
}
