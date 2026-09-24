"use client";

import { Check, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { addMilestone, approveMonthlyPlan, approveWeeklyPlan, logProgress, setGoalState, setMilestoneDone } from "@/app/actions/goals";
import { Row } from "@/components/os";
import { Sheet } from "@/components/sheet";
import type { DraftGoal } from "@/lib/goals/breakdown";
import type { GoalLevel, GoalState, Milestone } from "@/lib/goals/model";
import { cn } from "@/lib/utils";
import { field } from "./form-bits";
import { PlanEditor } from "./plan-editor";

/** "Where it stands now" for goals tracked by hand: one field and a quiet Update. */
export function LogProgress({ level, id, unit, current, label = "Where it stands now" }: { level: GoalLevel; id: string; unit: string | null; current: number | null; label?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current === null ? "" : String(current));
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        const n = Number(value);
        if (value.trim() === "" || !Number.isFinite(n)) return void toast.error("Enter a number.");
        setBusy(true);
        const res = await logProgress({ level, id, value: n });
        setBusy(false);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Progress saved.");
        router.refresh();
      }}
    >
      <label htmlFor={`log-${id}`} className="text-[14px] text-muted-foreground">
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <div className="flex gap-2">
        <input id={`log-${id}`} inputMode="decimal" enterKeyHint="done" value={value} onChange={(e) => setValue(e.target.value)} className={cn(field, "flex-1 tabular-nums")} />
        <button type="submit" disabled={busy} className="h-12 shrink-0 rounded-full bg-accent px-5 text-[15px] font-medium text-foreground transition-colors hover:bg-foreground/10 disabled:opacity-50">
          {busy ? "Saving…" : "Update"}
        </button>
      </div>
    </form>
  );
}

/** Complete, cancel or reopen a goal, as rows. Cancelling asks first. */
export function GoalStateControls({ level, id, state }: { level: GoalLevel; id: string; state: GoalState }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  async function set(next: "active" | "completed" | "cancelled") {
    const res = await setGoalState({ level, id, state: next });
    if (!res.ok) return void toast.error(res.error);
    setConfirm(false);
    router.refresh();
  }
  const icon = "size-[22px]";
  if (state === "completed" || state === "cancelled" || state === "missed") {
    return <Row onClick={() => void set("active")} leading={<RotateCcw className={icon} />} title="Reopen goal" chevron={false} />;
  }
  return (
    <>
      <Row onClick={() => void set("completed")} leading={<Check className={icon} />} title="Mark complete" chevron={false} />
      {confirm ? (
        <div role="alert" className="grid gap-2 px-4 py-3">
          <p className="text-[15px] text-muted-foreground">Cancel it? Its history stays.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void set("cancelled")} className="h-11 rounded-full bg-accent px-5 text-[15px] font-medium text-foreground">
              Cancel goal
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="h-11 rounded-full px-4 text-[15px] text-muted-foreground hover:text-foreground">
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <Row onClick={() => setConfirm(true)} leading={<X className={icon} />} title="Cancel goal…" chevron={false} />
      )}
    </>
  );
}

/** A milestone goal's steps: tick rows with their dates, then one line to add another. */
export function Milestones({ yearlyGoalId, milestones }: { yearlyGoalId: string; milestones: Milestone[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  return (
    <>
      {milestones.length === 0 ? (
        <p className="px-4 py-4 text-[15px] text-muted-foreground">Break the project into the steps that prove progress, each with a date.</p>
      ) : (
        <ul className="divide-y divide-border">
          {milestones.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={m.done}
                onClick={async () => {
                  const res = await setMilestoneDone({ id: m.id, done: !m.done });
                  if (!res.ok) return void toast.error(res.error);
                  router.refresh();
                }}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-accent"
              >
                <span
                  aria-hidden
                  className={cn("grid size-[26px] shrink-0 place-items-center rounded-full border-[1.5px]", m.done ? "border-kept bg-kept text-white" : "border-input")}
                >
                  {m.done && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className={cn("min-w-0 flex-1 text-[17px] leading-snug break-words", m.done && "text-muted-foreground")}>{m.title}</span>
                {m.dueDate && (
                  <span className="shrink-0 text-[15px] text-muted-foreground tabular-nums">
                    {m.dueDate.slice(8)}/{m.dueDate.slice(5, 7)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-2 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          const res = await addMilestone({ yearlyGoalId, title, dueDate: due || null });
          if (!res.ok) return void toast.error(res.error);
          setTitle("");
          setDue("");
          router.refresh();
        }}
      >
        <label className="sr-only" htmlFor="ms-title">
          Milestone
        </label>
        <input id="ms-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Add a milestone" className={field} />
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="ms-due">
            Due
          </label>
          <input id="ms-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cn(field, "flex-1")} />
          <button type="submit" aria-label="Add milestone" className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-foreground hover:bg-foreground/10">
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
      </form>
    </>
  );
}

/**
 * "Break down goal": a row that opens the suggested months (or weeks) in a sheet, editable,
 * saved on approval. Nothing is created until then.
 */
export function BreakdownPanel({
  parentId,
  level,
  drafts,
  groupLabels,
  buttonLabel,
  approveLabel,
}: {
  parentId: string;
  level: "monthly" | "weekly";
  drafts: DraftGoal[];
  groupLabels: Record<string, string>;
  buttonLabel: string;
  approveLabel: string;
}) {
  const [open, setOpen] = useState(false);
  if (drafts.length === 0) return null;
  // One wrapper, so a list's dividers don't count the sheet as a row.
  return (
    <div>
      <Row onClick={() => setOpen(true)} ariaLabel={buttonLabel} leading={<Sparkles className="size-[22px]" />} title={buttonLabel} />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={level === "monthly" ? "Monthly plan" : "Weekly plan"}
        subtitle="Untick what you don't want. Nothing is saved until you do."
      >
        {open && (
          <PlanEditor
            drafts={drafts}
            groupLabel={(g) => groupLabels[g] ?? g}
            approveLabel={approveLabel}
            onDone={() => setOpen(false)}
            onApprove={(selected) =>
              level === "monthly"
                ? approveMonthlyPlan({ yearlyGoalId: parentId, drafts: selected.map(toInput) })
                : approveWeeklyPlan({ monthlyGoalId: parentId, drafts: selected.map(toInput) })
            }
          />
        )}
      </Sheet>
    </div>
  );
}

function toInput(d: DraftGoal) {
  return {
    periodStart: d.periodStart,
    title: d.title,
    goalType: d.goalType,
    unit: d.unit,
    metric: d.metric,
    cadence: d.cadence,
    aggregation: d.aggregation,
    progressSource: d.progressSource,
    targetValue: d.targetValue,
    isMajor: d.isMajor,
    why: d.why,
    metricId: d.metricId,
    metricKey: d.metricKey,
  };
}
