import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnlockScreen } from "@/components/unlock-screen";
import { getSession } from "@/lib/data";
import { firstName } from "@/lib/names";
import { readUnlockToken } from "@/lib/lock";

export const metadata: Metadata = { title: "Unlock" };

/** The passcode screen, shown when the app is opened. */
export default async function UnlockPage() {
  const viewer = await getSession();
  if (!viewer.passcodeSet) redirect("/");
  const { data } = await viewer.supabase.rpc("lock_state", { p_token: await readUnlockToken() });
  if (data === "open" || data === "none") redirect("/");

  // Asked for a reset, then signed in again in the last 10 minutes: a new passcode can be chosen.
  const { data: canReset } = await viewer.supabase.rpc("can_reset_passcode");

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-sm content-center px-5 py-10">
      <UnlockScreen name={firstName(viewer.profile.displayName)} canReset={canReset === true} />
    </main>
  );
}
