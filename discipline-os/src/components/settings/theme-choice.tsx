"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "onyx", label: "Onyx" },
  { value: "sage", label: "Sage" },
  { value: "spark", label: "Spark" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

const subscribe = () => () => {};

/** The look, as one segmented control: five choices in a single row. */
export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const current = mounted ? theme : undefined;

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-5 gap-1 p-1.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          onClick={() => setTheme(o.value)}
          className={cn(
            "h-11 min-w-0 rounded-2xl text-[14px] transition-colors",
            current === o.value ? "bg-primary font-medium text-primary-foreground" : "text-foreground hover:bg-accent",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
