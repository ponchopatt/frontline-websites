"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { addMilestone, approveMonthlyPlan, approveWeeklyPlan, logProgress, setGoalState, setMilestoneDone } from "@/app/actions/goals";
import type { DraftGoal } from "@/lib/goals/breakdown";
import type { GoalLevel, GoalState, Milestone } from "@/lib/goals/model";
import { cn } from "@/lib/utils";
import { PlanEditor } from "./plan-editor";

const field = "h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-[16px] outline-none placeholder:text-faint focus-visible:border-primary/70";

/** "Where it stands now" for goals tracked by hand. */
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
      <label htmlFor={`log-${id}`} className="text-sm text-muted-foreground">
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input id={`log-${id}`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className={field} />
        <button type="submit" disabled={busy} className="h-12 rounded-full border border-primary/70 px-5 text-sm font-medium text-primary disabled:opacity-50">
          {busy ? "Saving…" : "Update"}
        </button>
      </div>
    </form>
  );
}

/** Complete, cancel or reopen a goal. Cancelling asks first. */
export function GoalStateControls({ level, id, state }: { level: GoalLevel; id: string; state: GoalState }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  async function set(next: "active" | "completed" | "cancelled") {
    const res = await setGoalState({ level, id, state: next });
    if (!res.ok) return void toast.error(res.error);
    setConfirm(false);
    router.refresh();
  }
  const btn = "inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground hover:text-foreground";
  if (state === "completed" || state === "cancelled" || state === "missed") {
    return (
      <button type="button" className={btn} onClick={() => set("active")}>
        Reopen goal
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => set("completed")} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-primary/70 px-4 text-sm font-medium text-primary">
        <Check className="size-4" aria-hidden /> Mark complete
      </button>
      {confirm ? (
        <>
          <span className="text-sm text-muted-foreground">Cancel it? Its history stays.</span>
          <button type="button" className={btn} onClick={() => set("cancelled")}>
            Cancel goal
          </button>
          <button type="button" className={btn} onClick={() => setConfirm(false)}>
            Keep it
          </button>
        </>
      ) : (
        <button type="button" className={btn} onClick={() => setConfirm(true)}>
          Cancel goal…
        </button>
      )}
    </div>
  );
}

export function Milestones({ yearlyGoalId, milestones }: { yearlyGoalId: string; milestones: Milestone[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  return (
    <div className="grid gap-3">
      {milestones.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">Break the project into the steps that prove progress, each with a date.</p>
      ) : (
        <ul className="grid">
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
                className="flex min-h-12 w-full items-center gap-3 text-left"
              >
                <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-full border", m.done ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                  {m.done && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className={cn("flex-1 text-[17px]", m.done && "text-muted-foreground")}>{m.title}</span>
                {m.dueDate && <span className="text-sm text-faint">{m.dueDate.slice(8)}/{m.dueDate.slice(5, 7)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid grid-cols-[minmax(0,1fr)_9rem_auto] gap-2"
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
        <label className="sr-only" htmlFor="ms-title">Milestone</label>
        <input id="ms-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Add a milestone" className={field} />
        <label className="sr-only" htmlFor="ms-due">Due</label>
        <input id="ms-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
        <button type="submit" aria-label="Add milestone" className="grid size-12 place-items-center rounded-full border border-primary/70 text-primary">
          <Plus className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

/** "Break Down Goal": reveals the suggested months, editable, saved on approval. */
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
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-12 w-full rounded-full bg-primary text-[15px] font-medium text-primary-foreground">
        {buttonLabel}
      </button>
    );
  }
  return (
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
