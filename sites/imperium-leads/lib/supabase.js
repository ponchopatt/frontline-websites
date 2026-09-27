import { createClient } from "@supabase/supabase-js";

export const TEAM_EMAIL = "team@imperiumdetailing.com.au";

const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** The server's own client: reads and writes past the team-only rule. Never sent to a browser. */
export function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  return createClient(url, key, options);
}

/** A client with the public key, for signing the team in. */
export function publicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set.");
  return createClient(url, key, options);
}

/** Every document in a collection, a page at a time. */
export async function readCollection(db, collection) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("docs").select("id,data").eq("collection", collection).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

export async function readDoc(db, collection, id) {
  const { data, error } = await db.from("docs").select("data").eq("collection", collection).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? data.data : null;
}

export async function writeDoc(db, collection, id, data) {
  const { error } = await db.from("docs").upsert({ collection, id, data, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
