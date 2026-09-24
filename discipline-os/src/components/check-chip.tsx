"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckChipProps {
  label: string;
  done: boolean;
  disabled?: boolean;
  /** A quiet second line, e.g. "05:42" or "Rest day". */
  hint?: string | null;
  onToggle: (done: boolean) => void;
  className?: string;
}

/** One tap to tick. A pill with a check, 48px tall, laid out two to a row. */
export function CheckChip({ label, done, disabled, hint, onToggle, className }: CheckChipProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
        onToggle(!done);
      }}
      className={cn(
        "group flex min-h-12 w-full touch-manipulation items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-default",
        done ? "border-primary/35 bg-lamp-soft" : "border-border bg-card/40",
        !disabled && "active:bg-accent/70",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border transition-[background-color,border-color,transform] duration-200 ease-(--ease-out-quart)",
          done ? "border-primary bg-primary text-primary-foreground" : "border-input group-active:scale-90",
        )}
      >
        {done && <Check className="size-3 animate-in zoom-in-50 duration-200" strokeWidth={3.2} />}
      </span>
      <span className="grid min-w-0 leading-tight">
        <span className={cn("truncate text-[15px]", done ? "text-foreground" : "text-foreground/90")}>{label}</span>
        {hint && <span className="truncate text-xs text-faint">{hint}</span>}
      </span>
    </button>
  );
}
