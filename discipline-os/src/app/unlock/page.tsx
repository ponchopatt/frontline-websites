import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnlockScreen } from "@/components/unlock-screen";
import { getSession, requestTime } from "@/lib/data";
import { firstName } from "@/lib/names";
import { readUnlockToken } from "@/lib/lock";

export const metadata: Metadata = { title: "Unlock" };

/** The passcode screen, shown when the app is opened. */
export default async function UnlockPage() {
  const viewer = await getSession();
  if (!viewer.passcodeSet) redirect("/");
  const { data } = await viewer.supabase.rpc("lock_state", { p_token: await readUnlockToken() });
  if (data === "open" || data === "none") redirect("/");

  // Signed in with the account password in the last 10 minutes: a forgotten passcode can be replaced.
  const { data: claims } = await viewer.supabase.auth.getClaims();
  const amr = (claims?.claims as { amr?: Array<{ method?: string; timestamp?: number }> } | undefined)?.amr ?? [];
  const signedIn = Math.max(0, ...amr.map((a) => (a.method === "password" ? Number(a.timestamp ?? 0) : 0)));
  const canReset = signedIn > requestTime() / 1000 - 600;

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-sm content-center px-5 py-10">
      <UnlockScreen name={firstName(viewer.profile.displayName)} canReset={canReset} />
    </main>
  );
}
