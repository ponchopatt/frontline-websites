"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { lockNow, removePasscode, setPasscode } from "@/app/actions/lock";
import { SectionCard } from "@/components/section-card";

const field =
  "h-12 w-full rounded-xl border border-input bg-transparent px-3 text-center text-[20px] tracking-[0.5em] outline-none focus-visible:border-primary/70";

/** The passcode asked for when the app opens: change it, lock now, or turn it off. */
export function PasscodeForm({ passcodeSet }: { passcodeSet: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setBusy(true);
    try {
      const res = await action();
      if (!res.ok) toast.error(res.error ?? "That didn't save.");
      else {
        toast.success(done);
        setCurrent("");
        setNext("");
        router.refresh();
      }
    } catch {
      toast.error("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard id="passcode" title="Passcode" description={passcodeSet ? "Asked for each time the app is opened." : "Off. Set one to lock the app when it's opened."}>
      <div className="grid gap-3">
        {passcodeSet && (
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            Current passcode
            <input value={current} onChange={(e) => setCurrent(digits(e.target.value))} inputMode="numeric" autoComplete="off" className={field} />
          </label>
        )}
        <label className="grid gap-1.5 text-sm text-muted-foreground">
          {passcodeSet ? "New passcode" : "Passcode"}
          <input value={next} onChange={(e) => setNext(digits(e.target.value))} inputMode="numeric" autoComplete="off" className={field} />
        </label>
        <button
          type="button"
          disabled={busy || next.length !== 4 || (passcodeSet && current.length !== 4)}
          onClick={() => void run(() => setPasscode({ pin: next, current: passcodeSet ? current : null }), passcodeSet ? "Passcode changed." : "Passcode set.")}
          className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-50"
        >
          {passcodeSet ? "Change passcode" : "Set passcode"}
        </button>
        {passcodeSet && (
          <div className="flex items-center justify-between gap-3">
            <form action={lockNow}>
              <button type="submit" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-foreground">
                <Lock className="size-4" aria-hidden />
                Lock now
              </button>
            </form>
            <button
              type="button"
              disabled={busy || current.length !== 4}
              onClick={() => void run(() => removePasscode({ current }), "Passcode turned off.")}
              className="min-h-11 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Turn passcode off
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
