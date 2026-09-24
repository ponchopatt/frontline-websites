"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Meter } from "@/components/meter";
import type { LocalDate } from "@/lib/day";
import { cn } from "@/lib/utils";
import { amount, thisWeekTarget } from "./format";
import type { BoardCounter } from "./types";

interface TotalsRowProps {
  counter: BoardCounter;
  weekStart: LocalDate;
  onTarget: (weeklyTarget: number | null) => void;
  onPinned: (pinned: boolean) => void;
}

/** One counter's week, month and year, its weekly target, and whether it shows on Today. */
export function TotalsRow({ counter: c, weekStart, onTarget, onPinned }: TotalsRowProps) {
  const target = thisWeekTarget(c);
  const week = c.weekBefore + c.value;

  return (
    <li className="grid gap-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[17px]">{c.label}</p>
        <PinSwitch label={c.label} on={c.pinned} onChange={onPinned} />
      </div>

      {c.aggregation === "latest" ? (
        // A level has no week or year: it's just where it stands.
        <p className="text-sm text-muted-foreground">
          Now <span className="ml-1 text-xl text-foreground">{amount(c.value, c.unit)}</span>
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <div className="grid min-w-0 content-start">
              <dt className="text-xs text-muted-foreground">This week</dt>
              <dd className="truncate text-xl leading-tight">{amount(week, c.unit)}</dd>
              <dd>
                {c.goalTarget !== null ? (
                  <span className="inline-flex min-h-11 items-center text-sm text-muted-foreground">of {amount(c.goalTarget, c.unit)}</span>
                ) : (
                  <TargetEditor label={c.label} unit={c.unit} value={c.ownTarget} onSave={onTarget} />
                )}
              </dd>
            </div>
            <Cell label="This month" value={amount(c.monthBefore + c.value, c.unit)} />
            <Cell label="This year" value={amount(c.yearBefore + c.value, c.unit)} />
          </dl>
          {target !== null && target > 0 && <Meter value={week / target} label={`${c.label} this week`} />}
          {c.goalTarget !== null && (
            <Link
              href={`/goals/week/${weekStart}`}
              className="inline-flex min-h-11 items-center justify-self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              This week&apos;s goal sets the target
            </Link>
          )}
        </>
      )}
    </li>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 content-start">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-xl leading-tight">{value}</dd>
    </div>
  );
}

/** "of 50": tap it to type a new weekly target. Empty or 0 means no target. */
function TargetEditor({
  label,
  unit,
  value,
  onSave,
}: {
  label: string;
  unit: string | null;
  value: number | null;
  onSave: (value: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);
  const money = unit === "$";

  function commit(raw: string) {
    setEditing(false);
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

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <span className="sr-only">{label} weekly target: </span>
        {value === null ? "Set target" : `of ${amount(value, unit)}`}
        <Pencil className="size-3 text-faint" aria-hidden />
      </button>
    );
  }

  return (
    <label className="mt-1 flex h-11 items-center gap-1 rounded-lg border border-input px-2 text-sm focus-within:border-primary/70">
      <span className="sr-only">{label} weekly target</span>
      <span aria-hidden className="text-muted-foreground">
        of{money ? " $" : ""}
      </span>
      <input
        autoFocus
        inputMode={money ? "decimal" : "numeric"}
        enterKeyHint="done"
        defaultValue={value ?? ""}
        placeholder="None"
        onFocus={(e) => e.target.select()}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        className="w-full min-w-0 bg-transparent text-[16px] outline-none placeholder:text-faint"
      />
    </label>
  );
}

/** "Show on Today": whether the counter sits on the Today screen too. */
function PinSwitch({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <span className="sr-only">{label}: </span>
      Show on Today
      <span
        aria-hidden
        className={cn(
          "flex h-6 w-10 items-center rounded-full border p-0.5 transition-colors",
          on ? "border-primary bg-primary" : "border-input",
        )}
      >
        <span
          className={cn(
            "size-4 rounded-full transition-transform duration-200 ease-(--ease-out-quart)",
            on ? "translate-x-4 bg-primary-foreground" : "bg-muted-foreground",
          )}
        />
      </span>
    </button>
  );
}
