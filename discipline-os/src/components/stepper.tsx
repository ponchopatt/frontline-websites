"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface StepperProps {
  label: string;
  value: number;
  /** Called once the number settles (after taps stop, or when typing ends). */
  onCommit: (value: number) => void;
  step?: number;
  /** "$" shows a money field instead of − / +. */
  unit?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * A number you change in a tap: − and + for counts (taps in a burst save once), or a plain
 * money field for revenue. Tap the number to type it.
 */
export function Stepper({ label, value, onCommit, step = 1, unit, disabled, className }: StepperProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<number | null>(null);
  const money = unit === "$";

  useEffect(() => {
    if (!editing && pending.current === null) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function settle(next: number) {
    pending.current = next;
    setDraft(String(next));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const v = pending.current;
      pending.current = null;
      if (v !== null && v !== value) onCommit(v);
    }, 600);
  }

  function commitTyped() {
    setEditing(false);
    const n = Number(draft.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || draft.trim() === "") {
      setDraft(String(value));
      return;
    }
    const clean = Math.max(0, money ? Math.round(n * 100) / 100 : Math.round(n));
    setDraft(String(clean));
    if (clean !== value) onCommit(clean);
  }

  const current = Number(draft) || 0;
  const field = (
    <input
      aria-label={label}
      inputMode={money ? "decimal" : "numeric"}
      enterKeyHint="done"
      value={editing ? draft : money ? current.toLocaleString("en-AU") : draft}
      disabled={disabled}
      onFocus={(e) => {
        setEditing(true);
        setDraft(String(current));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitTyped}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(
        "h-11 min-w-0 bg-transparent text-center text-[19px] font-medium tracking-tight outline-none disabled:opacity-60",
        money ? "w-24 text-right" : "w-12",
      )}
    />
  );

  if (money) {
    return (
      <label className={cn("flex h-11 items-center rounded-xl border border-input px-3 focus-within:border-primary/70", className)}>
        <span className="text-muted-foreground">$</span>
        {field}
      </label>
    );
  }

  return (
    <div className={cn("flex items-center rounded-xl border border-input", className)}>
      <button
        type="button"
        aria-label={`${label}: one less`}
        disabled={disabled || current <= 0}
        onClick={() => settle(Math.max(0, current - step))}
        className="grid size-11 touch-manipulation place-items-center rounded-l-xl text-muted-foreground active:bg-accent disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      {field}
      <button
        type="button"
        aria-label={`${label}: one more`}
        disabled={disabled}
        onClick={() => settle(current + step)}
        className="grid size-11 touch-manipulation place-items-center rounded-r-xl text-primary active:bg-accent disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
