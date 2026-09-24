"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "sage", label: "Sage" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

const subscribe = () => () => {};

export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const current = mounted ? theme : undefined;

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          onClick={() => setTheme(o.value)}
          className={cn(
            "h-12 rounded-xl border text-[15px] transition-colors",
            current === o.value ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
