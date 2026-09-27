import { createHmac } from "node:crypto";
import { json, readJson, sameSecret } from "../lib/http.js";
import { TEAM_EMAIL, adminClient, publicClient, readDoc, writeDoc } from "../lib/supabase.js";

/*
  POST /api/unlock {pin} — the PIN screen. The right PIN signs the phone in as the one shared
  team login and hands back its session, which the page keeps. The login's real password is
  long and never leaves the server, so the PIN can only be tried here, where wrong tries lock
  it for a while: 5 wrong in a row, 15 minutes; each 5 after that, twice as long (up to 12 hours).
*/

const LOCK = ["_system", "pin"];

function teamPassword() {
  if (process.env.LEADS_USER_PASSWORD) return process.env.LEADS_USER_PASSWORD;
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "").update("imperium-leads team login").digest("hex");
}

async function signIn() {
  const auth = publicClient().auth;
  const password = teamPassword();
  let res = await auth.signInWithPassword({ email: TEAM_EMAIL, password });
  if (!res.error) return res.data.session;

  // First unlock ever, or the password moved on: make sure the team login exists with it.
  const admin = adminClient().auth.admin;
  const made = await admin.createUser({ email: TEAM_EMAIL, password, email_confirm: true });
  if (made.error) {
    const { data: list } = await admin.listUsers({ page: 1, perPage: 1000 });
    const user = list?.users?.find((u) => u.email === TEAM_EMAIL);
    if (!user) throw new Error("Couldn't set up the team login");
    const upd = await admin.updateUserById(user.id, { password, email_confirm: true });
    if (upd.error) throw new Error(upd.error.message);
  }
  res = await auth.signInWithPassword({ email: TEAM_EMAIL, password });
  if (res.error) throw new Error(res.error.message);
  return res.data.session;
}

export async function POST(request) {
  const pin = process.env.LEADS_PIN;
  if (!pin || !/^\d{4}$/.test(pin)) return json({ error: "The PIN isn't set up" }, 500);

  let body;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "Send JSON" }, 400);
  }

  const db = adminClient();
  const lock = (await readDoc(db, ...LOCK)) || { fails: 0, lockedUntil: null };
  const now = Date.now();
  if (lock.lockedUntil && Date.parse(lock.lockedUntil) > now) {
    return json({ error: "locked", minutes: Math.ceil((Date.parse(lock.lockedUntil) - now) / 60000) }, 429);
  }

  if (!sameSecret(String(body.pin ?? ""), pin)) {
    const fails = (lock.fails || 0) + 1;
    const next = { fails, lockedUntil: null, lastFail: new Date(now).toISOString() };
    if (fails % 5 === 0) {
      const minutes = Math.min(12 * 60, 15 * 2 ** (fails / 5 - 1));
      next.lockedUntil = new Date(now + minutes * 60000).toISOString();
      await writeDoc(db, ...LOCK, next);
      return json({ error: "locked", minutes }, 429);
    }
    await writeDoc(db, ...LOCK, next);
    return json({ error: "wrong" }, 401);
  }

  if (lock.fails) await writeDoc(db, ...LOCK, { fails: 0, lockedUntil: null });
  try {
    const session = await signIn();
    return json({ access_token: session.access_token, refresh_token: session.refresh_token });
  } catch {
    return json({ error: "Couldn't sign in" }, 500);
  }
}
