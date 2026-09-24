"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, invalid, ok } from "@/lib/action-helpers";
import { getSession, getViewer } from "@/lib/data";
import { clearUnlockToken, isUnlockToken, setUnlockToken } from "@/lib/lock";
import type { ActionResult } from "@/lib/types";

const pinSchema = z.string().regex(/^[0-9]{4}$/, "A passcode is four digits.");

function lockError(error: { hint?: string | null; message?: string }): { ok: false; error: string } {
  if (error.hint === "passcode_wrong") return fail("That isn't your current passcode.");
  if (error.hint === "passcode_format") return fail("A passcode is four digits.");
  if (error.hint === "passcode_reauth") return fail("Sign in again to reset your passcode.");
  return fail("That didn't work. Check your connection and try again.");
}

/** Opens the app with the passcode. Wrong tries are counted; five in a row lock it for a while. */
export async function unlock(input: { pin: string }): Promise<ActionResult> {
  const parsed = z.object({ pin: pinSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("unlock_app", { p_pin: parsed.data.pin });
  if (error || !data) return fail("That didn't work. Check your connection and try again.");
  if (data === "none") return ok();
  if (data === "wrong") return fail("That passcode isn't right.");
  if (data.startsWith("blocked:")) {
    const secs = Number(data.slice(8));
    return fail(`Too many tries. Try again in ${secs >= 60 ? `${Math.ceil(secs / 60)} ${Math.ceil(secs / 60) === 1 ? "minute" : "minutes"}` : `${secs} seconds`}.`);
  }
  if (!isUnlockToken(data)) return fail("That didn't work. Try again.");
  await setUnlockToken(data);
  return ok();
}

/** Sets or changes the passcode. The first one needs nothing; a change needs the current one. */
export async function setPasscode(input: { pin: string; current?: string | null }): Promise<ActionResult> {
  const parsed = z.object({ pin: pinSchema, current: z.string().max(4).nullish() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  // Changing it goes through the lock like anything else; the first one is set before there is one.
  const viewer = await getViewer();
  const { data, error } = await viewer.supabase.rpc("set_passcode", { p_new: parsed.data.pin, p_current: parsed.data.current ?? undefined });
  if (error || !data) return lockError(error ?? {});
  await setUnlockToken(data);
  return ok();
}

/** Forgot it: right after signing in again with the account password, set a new one. */
export async function resetPasscode(input: { pin: string }): Promise<ActionResult> {
  const parsed = z.object({ pin: pinSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("reset_passcode", { p_new: parsed.data.pin });
  if (error || !data) return lockError(error ?? {});
  await setUnlockToken(data);
  return ok();
}

/** Turns the passcode off, with the current one. */
export async function removePasscode(input: { current: string }): Promise<ActionResult> {
  const parsed = z.object({ current: pinSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  const { error } = await viewer.supabase.rpc("remove_passcode", { p_current: parsed.data.current });
  if (error) return lockError(error);
  await clearUnlockToken();
  return ok();
}

/** Locks this browser now. */
export async function lockNow(): Promise<void> {
  await clearUnlockToken();
  redirect("/unlock");
}

/** Signs out so the account password can be used to reset a forgotten passcode. */
export async function forgotPasscode(): Promise<void> {
  const { supabase } = await getSession();
  await supabase.auth.signOut();
  await clearUnlockToken();
  redirect("/login?reset=passcode");
}
