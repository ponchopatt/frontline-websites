"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SwitchRow } from "@/components/goals/form-bits";
import { Ring, Row } from "@/components/os";
import type { LocalDate } from "@/lib/day";
import { amount, thisWeekTarget } from "./format";
import type { BoardCounter } from "./types";

interface CounterSheetProps {
  counter: BoardCounter;
  /** Today's target, worked out by the board. Null: none. */
  target: number | null;
  weekStart: LocalDate;
  onValue: (value: number) => void;
  onTarget: (weeklyTarget: number | null) => void;
  onPinned: (pinned: boolean) => void;
}

/**
 * One counter, opened from its row: today's number in large type with − and +, then the week,
 * month and year it adds up to, its weekly target, and whether it shows on Today.
 */
export function CounterSheet({ counter: c, target, weekStart, onValue, onTarget, onPinned }: CounterSheetProps) {
  // The number on screen while taps settle, so the totals below move with it.
  const [live, setLive] = useState(c.value);
  const level = c.aggregation === "latest";
  const weekTarget = thisWeekTarget(c);
  const week = c.weekBefore + live;

  const hint = level
    ? "How many there are now"
    : target === null
      ? "Today"
      : target === 0
        ? "This week's target is already hit."
        : live >= target
          ? "Today's target is hit."
          : `of ${amount(target, c.unit)} today`;

  return (
    <div className="grid gap-5 pt-2">
      <div className="grid gap-2">
        <CountField label={c.label} value={c.value} unit={c.unit} onLive={setLive} onCommit={onValue} />
        <p className={target !== null && (target === 0 || live >= target) ? "text-center text-[15px] font-medium text-kept" : "text-center text-[15px] text-muted-foreground"}>{hint}</p>
      </div>

      <div className="-mx-5 divide-y divide-border border-y border-border">
        {!level && (
          <>
            <Row
              title="This week"
              value={weekTarget !== null && weekTarget > 0 ? `${amount(week, c.unit)} of ${amount(weekTarget, c.unit)}` : amount(week, c.unit)}
              trailing={weekTarget !== null && weekTarget > 0 ? <Ring value={week / weekTarget} size={26} label={`${c.label} this week`} /> : undefined}
            />
            <Row title="This month" value={amount(c.monthBefore + live, c.unit)} />
            <Row title="This year" value={amount(c.yearBefore + live, c.unit)} />
            {c.goalTarget !== null ? (
              <Row href={`/goals/week/${weekStart}`} title="Weekly target" subtitle="Set by this week's goal" value={amount(c.goalTarget, c.unit)} />
            ) : (
              <TargetRow label={c.label} unit={c.unit} value={c.ownTarget} onSave={onTarget} />
            )}
          </>
        )}
        <SwitchRow title="Show on Today" subtitle="Count it from the Today screen too" ariaLabel={`${c.label}: Show on Today`} on={c.pinned} onChange={onPinned} />
      </div>
    </div>
  );
}

/**
 * Today's number, large. − and + for counts (a burst of taps saves once), or a money field for
 * revenue. Tap the number to type it. Closing the sheet mid-burst still saves the last tap.
 */
function CountField({
  label,
  value,
  unit,
  onLive,
  onCommit,
}: {
  label: string;
  value: number;
  unit: string | null;
  onLive: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const money = unit === "$";
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<number | null>(null);
  const saved = useRef(value);
  const commit = useRef(onCommit);

  useEffect(() => {
    commit.current = onCommit;
    saved.current = value;
  });

  useEffect(() => {
    if (!editing && pending.current === null) setDraft(String(value));
  }, [value, editing]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      const v = pending.current;
      pending.current = null;
      if (v !== null && v !== saved.current) commit.current(v);
    },
    [],
  );

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    const v = pending.current;
    pending.current = null;
    if (v !== null && v !== saved.current) commit.current(v);
  }

  function settle(next: number) {
    pending.current = next;
    setDraft(String(next));
    onLive(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }

  function commitTyped() {
    setEditing(false);
    const n = Number(draft.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || draft.trim() === "") {
      setDraft(String(value));
      onLive(value);
      return;
    }
    const clean = Math.max(0, money ? Math.round(n * 100) / 100 : Math.round(n));
    setDraft(String(clean));
    onLive(clean);
    if (clean !== value) onCommit(clean);
  }

  const current = Number(draft) || 0;
  const input = (
    <input
      aria-label={label}
      inputMode={money ? "decimal" : "numeric"}
      enterKeyHint="done"
      value={editing ? draft : money ? current.toLocaleString("en-AU") : draft}
      onFocus={(e) => {
        flush();
        setEditing(true);
        setDraft(String(current));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitTyped}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="h-16 w-full min-w-0 bg-transparent text-center text-[52px] leading-none font-light tracking-[-0.03em] tabular-nums outline-none"
    />
  );

  if (money) {
    return (
      <label className="mx-auto flex w-full max-w-[16rem] items-center justify-center rounded-2xl px-2 focus-within:bg-accent">
        <span aria-hidden className="text-[30px] font-light text-muted-foreground">
          $
        </span>
        {input}
      </label>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label={`${label}: one less`}
        disabled={current <= 0}
        onClick={() => settle(Math.max(0, current - 1))}
        className="grid size-14 shrink-0 touch-manipulation place-items-center rounded-full bg-accent text-foreground transition-transform active:scale-95 disabled:opacity-40"
      >
        <Minus className="size-6" aria-hidden />
      </button>
      <div className="w-32 rounded-2xl focus-within:bg-accent">{input}</div>
      <button
        type="button"
        aria-label={`${label}: one more`}
        onClick={() => settle(current + 1)}
        className="grid size-14 shrink-0 touch-manipulation place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
      >
        <Plus className="size-6" aria-hidden />
      </button>
    </div>
  );
}

/** "Weekly target": typed in place. Empty or 0 means no target; Escape keeps what was there. */
function TargetRow({ label, unit, value, onSave }: { label: string; unit: string | null; value: number | null; onSave: (value: number | null) => void }) {
  const money = unit === "$";
  const cancelled = useRef(false);

  function commit(raw: string) {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const text = raw.replace(/[^0-9.]/g, "");
    if (raw.trim() === "") {
      if (value !== null) onSave(null);
      return;
    }
    const n = Number(text);
    if (text === "" || !Number.isFinite(n)) return void toast.error("Enter a number.");
    if (n > 99_999_999) return void toast.error("That number is too big.");
    const clean = money ? Math.round(n * 100) / 100 : Math.round(n);
    const next = clean > 0 ? clean : null;
    if (next !== value) onSave(next);
  }

  return (
    <label className="flex min-h-14 items-center gap-3 px-4 py-2">
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-[17px] leading-snug">Weekly target</span>
        <span className="text-[14px] leading-snug text-muted-foreground">Empty for none</span>
      </span>
      <span className="flex h-11 w-32 shrink-0 items-center gap-1 rounded-xl bg-accent px-3 focus-within:ring-2 focus-within:ring-foreground/20">
        {money && (
          <span aria-hidden className="text-[17px] text-muted-foreground">
            $
          </span>
        )}
        <input
          aria-label={`${label} weekly target`}
          inputMode={money ? "decimal" : "numeric"}
          enterKeyHint="done"
          defaultValue={value ?? ""}
          placeholder="None"
          onFocus={(e) => e.target.select()}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              // Keep the sheet open; just put the number back.
              e.preventDefault();
              e.stopPropagation();
              cancelled.current = true;
              e.currentTarget.value = value === null ? "" : String(value);
              e.currentTarget.blur();
            }
          }}
          className="w-full min-w-0 bg-transparent text-right text-[17px] tabular-nums outline-none placeholder:text-faint"
        />
      </span>
    </label>
  );
}
