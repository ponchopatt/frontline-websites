"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { forgotPasscode, resetPasscode, unlock } from "@/app/actions/lock";
import { PinPad } from "@/components/pin-pad";

/** Welcome back, and the passcode. A fresh sign-in can choose a new one instead. */
export function UnlockScreen({ name, canReset }: { name: string | null; canReset: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"unlock" | "new" | "confirm">("unlock");
  const [first, setFirst] = useState("");

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
      setMode("confirm");
      return null;
    }
    if (pin !== first) {
      setMode("new");
      return "Those didn't match. Choose it again.";
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
        <p className="text-[15px] text-muted-foreground">{mode === "unlock" ? "Enter your passcode." : "Four digits you'll remember."}</p>
      </div>
      <PinPad key={mode} label={mode === "unlock" ? "Passcode" : "New passcode"} onComplete={mode === "unlock" ? tryUnlock : chooseNew} />
      {mode === "unlock" &&
        (canReset ? (
          // Just signed in with the account password: that's proof enough to choose a new one.
          <button type="button" onClick={() => setMode("new")} className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
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
        <button type="button" onClick={() => setMode("unlock")} className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Back to the passcode
        </button>
      )}
    </div>
  );
}
