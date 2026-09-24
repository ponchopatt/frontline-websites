"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { forgotPasscode, resetPasscode, unlock } from "@/app/actions/lock";
import { PinPad } from "@/components/pin-pad";

/** Welcome back, and the passcode. After asking for a reset and signing in again, a new one can be chosen. */
export function UnlockScreen({ name, canReset }: { name: string | null; canReset: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"unlock" | "new" | "confirm">("unlock");
  const [first, setFirst] = useState("");
  const [note, setNote] = useState<string | null>(null);

  function show(next: "unlock" | "new" | "confirm", message: string | null = null) {
    setNote(message);
    setMode(next);
  }

  async function tryUnlock(pin: string) {
    const res = await unlock({ pin });
    if (!res.ok) return res.error;
    router.replace("/");
    router.refresh();
    return null;
  }

  async function chooseNew(pin: string) {
    if (mode === "new") {
      setFirst(pin);
      show("confirm");
      return null;
    }
    if (pin !== first) {
      setFirst("");
      show("new", "Those didn't match. Choose it again.");
      return null;
    }
    const res = await resetPasscode({ pin });
    if (!res.ok) return res.error;
    router.replace("/");
    router.refresh();
    return null;
  }

  const heading = mode === "unlock" ? (name ? `Welcome back, ${name}.` : "Welcome back.") : mode === "new" ? "Choose a new passcode." : "Enter it again.";
  return (
    <div className="grid justify-items-center gap-10 text-center">
      <div className="grid justify-items-center gap-3">
        <span aria-hidden className="grid size-14 place-items-center rounded-full border border-glass-edge bg-glass text-xl backdrop-blur-md">
          {name ? name[0] : <Lock className="size-5" />}
        </span>
        <h1 className="text-[34px] leading-[1.05] font-light tracking-[-0.03em]">{heading}</h1>
        <p aria-live="polite" className="text-[15px] text-muted-foreground">
          {mode === "unlock" ? "Enter your passcode." : (note ?? "Four digits you'll remember.")}
        </p>
      </div>
      <PinPad key={mode} label={mode === "unlock" ? "Passcode" : "New passcode"} onComplete={mode === "unlock" ? tryUnlock : chooseNew} />
      {mode === "unlock" &&
        (canReset ? (
          // Asked for a reset and signed in again with the account password: that's proof enough.
          <button type="button" onClick={() => show("new")} className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Forgot it? Choose a new passcode
          </button>
        ) : (
          <form action={forgotPasscode}>
            <button type="submit" className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Forgot your passcode?
            </button>
          </form>
        ))}
      {mode !== "unlock" && (
        <button type="button" onClick={() => show("unlock")} className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Back to the passcode
        </button>
      )}
    </div>
  );
}
