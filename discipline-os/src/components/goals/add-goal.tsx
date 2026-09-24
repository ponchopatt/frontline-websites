"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createMonthlyGoal, createWeeklyGoal } from "@/app/actions/goals";
import type { LocalDate } from "@/lib/day";

const field = "h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-[16px] outline-none placeholder:text-faint focus-visible:border-primary/70";

function toNumber(v: string) {
  return v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v);
}

/** A monthly objective added by hand, optionally under a yearly goal. */
export function AddMonthlyGoal({ monthStart, yearlyGoals }: { monthStart: LocalDate; yearlyGoals: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [parent, setParent] = useState("");
  const value = toNumber(target);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Plus className="size-4" aria-hidden /> Add an objective by hand
      </button>
    );
  }
  return (
    <form
      className="grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await createMonthlyGoal({
          monthStart,
          parentYearlyId: parent || null,
          title,
          goalType: value === null ? "binary" : "outcome",
          unit: unit || null,
          targetValue: value,
          progressSource: value === null ? "manual" : "children",
        });
        if (!res.ok) return void toast.error(res.error);
        setOpen(false);
        setTitle("");
        setTarget("");
        router.refresh();
      }}
    >
      <label className="sr-only" htmlFor="mg-title">Objective</label>
      <input id="mg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Complete 12 Bible study sessions" className={field} autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm text-muted-foreground">
          Target (optional)
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          Unit
          <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="sessions" className={field} />
        </label>
      </div>
      {yearlyGoals.length > 0 && (
        <label className="grid gap-1 text-sm text-muted-foreground">
          Supports
          <select value={parent} onChange={(e) => setParent(e.target.value)} className={field}>
            <option value="">No yearly goal</option>
            {yearlyGoals.map((y) => (
              <option key={y.id} value={y.id}>
                {y.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={!title.trim()} className="h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Add objective
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-11 px-4 text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** A weekly outcome or supporting task added by hand. */
export function AddWeeklyGoal({ weekStart, monthlyGoals }: { weekStart: LocalDate; monthlyGoals: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [parent, setParent] = useState("");
  const [major, setMajor] = useState(true);
  const [busy, setBusy] = useState(false);
  const value = toNumber(target);
  return (
    <form
      className="grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || busy) return;
        setBusy(true);
        const res = await createWeeklyGoal({
          weekStart,
          parentMonthlyId: parent || null,
          isMajor: major,
          title,
          goalType: value === null ? "binary" : "process",
          unit: unit || null,
          targetValue: value,
          progressSource: value === null ? "manual" : unit.trim() === "$" ? "manual" : unit.trim().toLowerCase().startsWith("hour") ? "work_hours" : "actions",
        });
        setBusy(false);
        if (!res.ok) return void toast.error(res.error);
        setTitle("");
        setTarget("");
        setUnit("");
        router.refresh();
      }}
    >
      <h3 className="text-lg font-medium tracking-tight">Add to this week</h3>
      <label className="sr-only" htmlFor="wg-title">Goal</label>
      <input id="wg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Follow up with 30 leads" className={field} />
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm text-muted-foreground">
          Target (optional)
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          Unit
          <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="leads" className={field} />
        </label>
      </div>
      {monthlyGoals.length > 0 && (
        <label className="grid gap-1 text-sm text-muted-foreground">
          Supports
          <select value={parent} onChange={(e) => setParent(e.target.value)} className={field}>
            <option value="">No monthly objective</option>
            {monthlyGoals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input type="checkbox" checked={major} onChange={(e) => setMajor(e.target.checked)} className="size-5 accent-[var(--primary)]" />
        A major outcome (not a supporting task)
      </label>
      <button type="submit" disabled={!title.trim() || busy} className="h-12 rounded-full border border-primary/70 text-[15px] font-medium text-primary disabled:opacity-50">
        {busy ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
