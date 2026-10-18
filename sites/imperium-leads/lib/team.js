import { TEAM_EMAIL, adminClient } from "./supabase.js";

/** True when the request carries the team's sign-in (the phone's Supabase session, as a Bearer token). */
export async function isTeam(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  try {
    const { data, error } = await adminClient().auth.getUser(token);
    return !error && !!data && !!data.user && data.user.email === TEAM_EMAIL;
  } catch {
    return false;
  }
}
