"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { acceptSuggestions, setDailyGoalStatus } from "@/app/actions/goals";
import { GoalBreadcrumb } from "@/components/goals/breadcrumb";
import type { LocalDate } from "@/lib/day";
import { actionTitle } from "@/lib/goals/suggest";
import type { PlanAction, PlanSuggestion, TodayPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

function toItem(s: PlanSuggestion, big3: boolean) {
  return {
    title: actionTitle(s.title, s.quantity, s.unit),
    quantity: s.quantity,
    unit: s.unit,
    estimatedMinutes: s.estimatedMinutes,
    weeklyGoalId: s.weeklyGoalId,
    carriedFromId: s.carriedFromId,
    createsWorkBlock: s.createsWorkBlock,
    big3,
  };
}

/**
 * "What should I do today?" The Big 3 from this week's goals, ranked, each with why it ranks
 * there and what it supports. One tap puts them on today's mission.
 */
export function TodaySuggestions({ plan, date }: { plan: TodayPlan; date: LocalDate }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function accept(items: ReturnType<typeof toItem>[], key: string) {
    setBusy(key);
    try {
      const res = await acceptSuggestions({ date, items });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    } catch {
      toast.error("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  if (plan.big3.length === 0) return null;
  return (
    <section aria-labelledby="suggest-heading" className="mb-4 grid gap-3 rounded-xl bg-lamp-soft p-4">
      <div className="grid gap-0.5">
        <h3 id="suggest-heading" className="text-lg font-medium tracking-tight">
          What should I do today?
        </h3>
        <p className="text-sm text-muted-foreground">From this week&apos;s goals, most important first.</p>
      </div>
      <ol className="grid gap-3">
        {plan.big3.map((s, i) => (
          <li key={s.key} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2">
            <span className="grid size-7 place-items-center rounded-full border border-primary/60 text-sm text-primary">{i + 1}</span>
            <div className="grid gap-0.5">
              <p className="text-[17px] leading-snug">{actionTitle(s.title, s.quantity, s.unit)}</p>
              {s.reasons[0] && <p className="text-sm text-muted-foreground">{s.reasons.slice(0, 2).join(" · ")}</p>}
              {s.chain && <GoalBreadcrumb chain={s.chain} />}
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => accept(plan.big3.map((s) => toItem(s, true)), "big3")}
        className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy === "big3" ? "Adding…" : plan.big3.length === 1 ? "Make it today's #1" : `Make these today's Big ${plan.big3.length}`}
      </button>

      {plan.supporting.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm text-muted-foreground hover:text-foreground">
            {plan.supporting.length} supporting {plan.supporting.length === 1 ? "task" : "tasks"} if there&apos;s time
          </summary>
          <ul className="grid gap-2">
            {plan.supporting.map((s) => (
              <li key={s.key} className="flex items-start justify-between gap-3">
                <div className="grid min-w-0 gap-0.5">
                  <p className="text-[15px]">{actionTitle(s.title, s.quantity, s.unit)}</p>
                  {s.reasons[0] && <p className="text-xs text-muted-foreground">{s.reasons[0]}</p>}
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => accept([toItem(s, false)], s.key)}
                  aria-label={`Add ${s.title}`}
                  className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full border border-input px-3 text-sm hover:bg-accent disabled:opacity-60"
                >
                  <Plus className="size-4" aria-hidden /> Add
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Accepted actions that aren't on the mission slots: supporting tasks, ticked here. */
export function SupportingActions({ actions, readOnly }: { actions: PlanAction[]; readOnly: boolean }) {
  const [list, setList] = useState(actions);
  if (list.length === 0) return null;

  async function toggle(a: PlanAction) {
    const next = a.status === "done" ? "pending" : "done";
    setList((l) => l.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    try {
      const res = await setDailyGoalStatus({ id: a.id, status: next });
      if (!res.ok) throw new Error(res.error);
    } catch (e) {
      setList((l) => l.map((x) => (x.id === a.id ? { ...x, status: a.status } : x)));
      toast.error(e instanceof Error && e.message ? e.message : "That didn't save. Check your connection and try again.");
    }
  }

  return (
    <div className="mt-2 border-t border-border pt-3">
      <h3 className="mb-1 text-sm text-muted-foreground">Supporting tasks</h3>
      <ul className="grid">
        {list.map((a) => {
          const done = a.status === "done";
          return (
            <li key={a.id} className="grid gap-0.5 py-1.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={a.title}
                disabled={readOnly || a.status === "dropped"}
                onClick={() => toggle(a)}
                className="flex min-h-11 w-full items-center gap-3 text-left"
              >
                <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-full border transition-colors", done ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                  {done && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className={cn("text-[16px]", done && "text-muted-foreground")}>{a.title}</span>
              </button>
              {a.chain && <GoalBreadcrumb chain={a.chain} className="pl-9" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** When goals exist but this week has no plan, point at the one step that unlocks today. */
export function PlanWeekPrompt({ weekStart }: { weekStart: LocalDate }) {
  return (
    <Link href={`/goals/week/${weekStart}`} className="mb-3 flex min-h-11 items-center rounded-xl border border-dashed border-primary/40 px-4 text-[15px] text-primary">
      Plan this week to get today&apos;s Big 3 from your goals
    </Link>
  );
}
