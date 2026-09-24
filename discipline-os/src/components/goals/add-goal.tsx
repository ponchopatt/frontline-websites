"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createMonthlyGoal, createWeeklyGoal } from "@/app/actions/goals";
import { PrimaryButton, Row } from "@/components/os";
import { Sheet } from "@/components/sheet";
import type { LocalDate } from "@/lib/day";
import { field, fieldLabel, SwitchRow } from "./form-bits";

function toNumber(v: string) {
  return v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v);
}

/** A monthly objective added by hand, optionally under a yearly goal: a row that opens a sheet. */
export function AddMonthlyGoal({ monthStart, yearlyGoals }: { monthStart: LocalDate; yearlyGoals: Array<{ id: string; title: string }> }) {
  const [open, setOpen] = useState(false);
  // One wrapper, so a list's dividers don't count the sheet as a row.
  return (
    <div>
      <Row onClick={() => setOpen(true)} leading={<Plus className="size-[22px]" />} title="Add an objective by hand" />
      <Sheet open={open} onClose={() => setOpen(false)} title="Add an objective">
        {open && <MonthlyForm monthStart={monthStart} yearlyGoals={yearlyGoals} onAdded={() => setOpen(false)} />}
      </Sheet>
    </div>
  );
}

function MonthlyForm({ monthStart, yearlyGoals, onAdded }: { monthStart: LocalDate; yearlyGoals: Array<{ id: string; title: string }>; onAdded: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [parent, setParent] = useState("");
  const [busy, setBusy] = useState(false);
  const value = toNumber(target);
  return (
    <form
      className="grid gap-4 pt-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || busy) return;
        setBusy(true);
        const res = await createMonthlyGoal({
          monthStart,
          parentYearlyId: parent || null,
          title,
          goalType: value === null ? "binary" : "outcome",
          unit: unit || null,
          targetValue: value,
          progressSource: value === null ? "manual" : "children",
        });
        setBusy(false);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Objective added.");
        onAdded();
        router.refresh();
      }}
    >
      <label className={fieldLabel} htmlFor="mg-title">
        Objective
        <input id="mg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Complete 12 Bible study sessions" className={field} autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={fieldLabel}>
          Target (optional)
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className={field} />
        </label>
        <label className={fieldLabel}>
          Unit
          <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="sessions" className={field} />
        </label>
      </div>
      {yearlyGoals.length > 0 && (
        <label className={fieldLabel}>
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
      <PrimaryButton type="submit" disabled={!title.trim() || busy} className="mt-1 w-full">
        {busy ? "Adding…" : "Add objective"}
      </PrimaryButton>
    </form>
  );
}

/** A weekly outcome or supporting task added by hand: a row that opens a sheet. */
export function AddWeeklyGoal({ weekStart, monthlyGoals }: { weekStart: LocalDate; monthlyGoals: Array<{ id: string; title: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Row onClick={() => setOpen(true)} leading={<Plus className="size-[22px]" />} title="Add to this week" />
      <Sheet open={open} onClose={() => setOpen(false)} title="Add to this week">
        {open && <WeeklyForm weekStart={weekStart} monthlyGoals={monthlyGoals} onAdded={() => setOpen(false)} />}
      </Sheet>
    </div>
  );
}

function WeeklyForm({ weekStart, monthlyGoals, onAdded }: { weekStart: LocalDate; monthlyGoals: Array<{ id: string; title: string }>; onAdded: () => void }) {
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
      className="grid gap-4 pt-1"
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
        toast.success("Added to this week.");
        onAdded();
        router.refresh();
      }}
    >
      <label className={fieldLabel} htmlFor="wg-title">
        Goal
        <input id="wg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Follow up with 30 leads" className={field} autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={fieldLabel}>
          Target (optional)
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className={field} />
        </label>
        <label className={fieldLabel}>
          Unit
          <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="leads" className={field} />
        </label>
      </div>
      {monthlyGoals.length > 0 && (
        <label className={fieldLabel}>
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
      <div className="-mx-5 border-y border-border">
        <SwitchRow
          title="A major outcome"
          subtitle="Off for a supporting task"
          ariaLabel="A major outcome (not a supporting task)"
          on={major}
          onChange={setMajor}
          className="px-5"
        />
      </div>
      <PrimaryButton type="submit" disabled={!title.trim() || busy} className="mt-1 w-full">
        {busy ? "Adding…" : "Add"}
      </PrimaryButton>
    </form>
  );
}
