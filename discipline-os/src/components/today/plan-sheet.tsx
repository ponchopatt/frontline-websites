"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { applyPlan } from "@/app/actions/tasks";
import { Sheet } from "@/components/sheet";
import { AREA_LABEL, AREA_SHORT } from "@/lib/areas";
import { formatDuration, type LocalDate } from "@/lib/day";
import type { DayPlan, PlanItem } from "@/lib/plan";
import { cn } from "@/lib/utils";

interface PlanSheetProps {
  date: LocalDate;
  plan: DayPlan | null;
  /** "Morning 8 · Faith 5 · Fitness 2 · Discipline 3" */
  habitsLine: string;
  onClose: () => void;
  onApplied: () => void;
}

/**
 * Plan my day: the suggested Big 3, a short supporting list, today's habits and where the
 * work hours go. Untick anything you don't want; nothing is saved until "Use this plan".
 */
export function PlanSheet({ date, plan, habitsLine, onClose, onApplied }: PlanSheetProps) {
  return (
    <Sheet open={plan !== null} onClose={onClose} title="Plan my day">
      {plan && <PlanBody key={JSON.stringify(plan.big3.map((b) => b.key))} date={date} plan={plan} habitsLine={habitsLine} onApplied={onApplied} />}
    </Sheet>
  );
}

function PlanBody({ date, plan, habitsLine, onApplied }: Omit<PlanSheetProps, "plan" | "onClose"> & { plan: DayPlan }) {
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const toggle = (key: string) =>
    setOff((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const blockKey = (i: number) => `block-${i}`;
  const empty = plan.big3.length === 0 && plan.supporting.length === 0 && plan.blocks.length === 0;

  async function apply() {
    setBusy(true);
    const pick = (items: PlanItem[]) =>
      items
        .filter((i) => !off.has(i.key))
        .map(({ title, area, quantity, unit, metricId, weeklyGoalId, carriedFromId, taskId, estimatedMinutes }) => ({
          title,
          area,
          quantity,
          unit,
          metricId,
          weeklyGoalId,
          carriedFromId,
          taskId,
          estimatedMinutes,
        }));
    try {
      const res = await applyPlan({
        date,
        big3: pick(plan.big3),
        supporting: pick(plan.supporting),
        blocks: plan.blocks.filter((_, i) => !off.has(blockKey(i))).map(({ area, start, end }) => ({ area, start, end })),
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Today is planned.");
        onApplied();
      }
    } catch {
      toast.error("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (empty) {
    return (
      <p className="pb-2 text-[15px] text-muted-foreground">
        Nothing to add. Your Big 3 is set and the day&apos;s hours are planned. Add a task yourself if something&apos;s missing.
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      {plan.big3.length > 0 && (
        <section className="grid gap-1">
          <h3 className="text-sm text-muted-foreground">Big 3</h3>
          <ul>
            {plan.big3.map((item) => (
              <Pick key={item.key} on={!off.has(item.key)} onToggle={() => toggle(item.key)} title={item.title} sub={[item.area ? AREA_SHORT[item.area] : null, item.reasons[0]]} />
            ))}
          </ul>
        </section>
      )}
      {plan.supporting.length > 0 && (
        <section className="grid gap-1">
          <h3 className="text-sm text-muted-foreground">Supporting tasks</h3>
          <ul>
            {plan.supporting.map((item) => (
              <Pick key={item.key} on={!off.has(item.key)} onToggle={() => toggle(item.key)} title={item.title} sub={[item.area ? AREA_SHORT[item.area] : null, item.reasons[0]]} />
            ))}
          </ul>
        </section>
      )}
      <section className="grid gap-1">
        <h3 className="text-sm text-muted-foreground">Habits</h3>
        <p className="text-[15px]">{habitsLine}</p>
      </section>
      {plan.blocks.length > 0 && (
        <section className="grid gap-1">
          <h3 className="text-sm text-muted-foreground">Work blocks</h3>
          <ul>
            {plan.blocks.map((b, i) => (
              <Pick
                key={blockKey(i)}
                on={!off.has(blockKey(i))}
                onToggle={() => toggle(blockKey(i))}
                title={`${b.start}–${b.end} ${AREA_LABEL[b.area]}`}
                sub={[formatDuration(b.minutes)]}
              />
            ))}
          </ul>
        </section>
      )}
      {/* Pinned to the bottom so it's always in reach, however long the plan. */}
      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 bg-popover/95 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button type="button" disabled={busy} onClick={() => void apply()} className="h-12 w-full rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : "Use this plan"}
        </button>
      </div>
    </div>
  );
}

function Pick({ on, onToggle, title, sub }: { on: boolean; onToggle: () => void; title: string; sub: Array<string | null | undefined> }) {
  const line = sub.filter(Boolean).join(" · ");
  return (
    <li>
      <button type="button" role="checkbox" aria-checked={on} aria-label={title} onClick={onToggle} className="flex min-h-12 w-full items-center gap-3 py-1 text-left">
        <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
          {on && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="grid min-w-0">
          <span className={cn("text-[16px] leading-snug", !on && "text-muted-foreground line-through decoration-faint")}>{title}</span>
          {line && <span className="text-[13px] text-muted-foreground">{line}</span>}
        </span>
      </button>
    </li>
  );
}
