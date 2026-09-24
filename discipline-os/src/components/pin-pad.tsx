"use client";

import { Delete } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PinPadProps {
  /** Called with four digits. Resolve to an error message to show, or null when it worked. */
  onComplete: (pin: string) => Promise<string | null>;
  label: string;
  disabled?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

/** Four dots and a number pad. Types from a keyboard too. */
export function PinPad({ onComplete, label, disabled }: PinPadProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const press = useCallback(
    async (key: string) => {
      if (busy || disabled) return;
      if (key === "del") {
        setPin((p) => p.slice(0, -1));
        return;
      }
      if (!/^[0-9]$/.test(key) || pin.length >= 4) return;
      const next = pin + key;
      setPin(next);
      setError(null);
      if (next.length < 4) return;
      setBusy(true);
      const message = await onComplete(next).catch(() => "That didn't work. Check your connection and try again.");
      setBusy(false);
      if (message) {
        setError(message);
        setShake((n) => n + 1);
        setPin("");
      }
    },
    [busy, disabled, onComplete, pin],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) void press(e.key);
      else if (e.key === "Backspace") void press("del");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <div className="grid justify-items-center gap-8">
      <div key={shake} className={cn("flex gap-4", shake > 0 && "animate-[pin-shake_320ms_ease-in-out]")} role="status" aria-label={`${label}: ${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} aria-hidden className={cn("size-4 rounded-full border-2 border-foreground/70 transition-colors", i < pin.length && "bg-foreground")} />
        ))}
      </div>
      <p aria-live="assertive" className="-mt-4 min-h-5 text-center text-[15px] font-medium">
        {error}
      </p>
      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={busy || disabled}
              aria-label={k === "del" ? "Delete" : k}
              onClick={() => void press(k)}
              className="grid size-[76px] touch-manipulation place-items-center rounded-full border border-glass-edge bg-glass text-[28px] font-light backdrop-blur-md transition-transform active:scale-95 disabled:opacity-60"
            >
              {k === "del" ? <Delete className="size-6" aria-hidden /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
