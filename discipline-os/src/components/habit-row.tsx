"use client";

import { Check } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface HabitRowProps {
  name: string;
  done: boolean;
  /** "05:42" when done. */
  time?: string | null;
  edited?: boolean;
  disabled?: boolean;
  onToggle: (done: boolean) => void;
}

/** One habit: tap anywhere on the row. 48px tall, so it works one-handed and half awake. */
export function HabitRow({ name, done, time, edited, disabled, onToggle }: HabitRowProps) {
  const timeId = useId();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={name}
      aria-describedby={done && time ? timeId : undefined}
      disabled={disabled}
      onClick={() => {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
        onToggle(!done);
      }}
      className={cn(
        "group flex min-h-12 w-full touch-manipulation items-center gap-3.5 rounded-lg py-2 pr-1 text-left",
        "transition-colors disabled:cursor-default",
        !disabled && "active:bg-accent/60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border transition-[background-color,border-color,transform] duration-200 ease-(--ease-out-quart)",
          done ? "scale-100 border-primary bg-primary text-primary-foreground" : "border-input group-active:scale-90",
        )}
      >
        {done && <Check className="size-3.5 animate-in zoom-in-50 duration-200" strokeWidth={3} />}
      </span>
      <span className={cn("flex-1 text-[17px] leading-snug transition-colors", done ? "text-muted-foreground" : "text-foreground")}>
        {name}
      </span>
      {done && time && (
        <span id={timeId} className="text-sm text-faint">
          <span className="sr-only">Done at </span>
          {edited ? <span className="mr-1.5 text-xs">edited</span> : null}
          {time}
        </span>
      )}
    </button>
  );
}
