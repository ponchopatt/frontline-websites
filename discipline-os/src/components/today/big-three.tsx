"use client";

import { ArrowDownToLine, ArrowUpToLine, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/section-card";
import { shortDate, type LocalDate } from "@/lib/day";
import type { TaskItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuickAdd } from "./quick-add";
import { TaskRow } from "./task-row";

interface BigThreeProps {
  date: LocalDate;
  today: LocalDate;
  isToday: boolean;
  readOnly: boolean;
  tasks: TaskItem[];
  unfinished: TaskItem[];
  later: TaskItem[];
  lastNightPriority: string | null;
  planning: boolean;
  onPlan: () => void;
  onToggle: (task: TaskItem) => void;
  onOpen: (task: TaskItem) => void;
  onAdded: (task: TaskItem) => void;
  onMove: (task: TaskItem, to: "today" | "later") => void;
  onUseLastNight: (title: string) => void;
}

/**
 * The top of the day: the three things that matter most, what else is on, and a way to add
 * more in one line. Unfinished and "later" tasks sit folded underneath.
 */
export function BigThree(props: BigThreeProps) {
  const { date, today, isToday, readOnly, tasks, unfinished, later, lastNightPriority } = props;
  const [adding, setAdding] = useState<"task" | "big3" | null>(null);
  const bySlot = new Map(tasks.filter((t) => t.rank !== null).map((t) => [t.rank, t]));
  const supporting = tasks.filter((t) => t.rank === null);
  const big = [...bySlot.values()];
  const free = 3 - big.length;
  const doneBig = big.filter((t) => t.status === "done").length;
  const doneAll = tasks.filter((t) => t.status === "done").length;

  return (
    <SectionCard
      id="big3"
      title="Today's Big 3"
      prominent
      stacked
      meta={big.length > 0 ? `${doneBig} of ${big.length} done` : undefined}
    >
      <ol className="grid">
        {([1, 2, 3] as const).map((slot) => {
          const task = bySlot.get(slot);
          if (task) return <TaskRow key={task.id} task={task} today={today} big showChain disabled={readOnly} onToggle={props.onToggle} onOpen={props.onOpen} />;
          return (
            <li key={`empty-${slot}`} className="py-1.5">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setAdding("big3")}
                className="flex min-h-12 w-full items-center gap-3 text-left text-muted-foreground disabled:cursor-default"
              >
                <span aria-hidden className="-ml-0.5 grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-input text-[13px]">
                  {slot}
                </span>
                <span className="text-[17px]">{readOnly ? "Not set" : slot === 1 ? "Add your #1" : `Add #${slot}`}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {!readOnly && !bySlot.has(1) && lastNightPriority && (
        <button
          type="button"
          onClick={() => props.onUseLastNight(lastNightPriority)}
          className="mb-1 min-h-11 text-left text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        >
          Use last night&apos;s #1: <span className="text-foreground">{lastNightPriority}</span>
        </button>
      )}

      {!readOnly && (
        <div className="mt-2 grid gap-3">
          {adding ? (
            <QuickAdd date={date} big3Free={free > 0} big3Default={adding === "big3"} autoFocus onAdded={props.onAdded} />
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdding("task")}
                className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-border text-[15px] text-foreground hover:bg-accent"
              >
                <Plus className="size-4" aria-hidden />
                Add task
              </button>
              {isToday && (
                <button
                  type="button"
                  disabled={props.planning}
                  onClick={props.onPlan}
                  className={cn(
                    "inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full text-[15px] font-medium disabled:opacity-60",
                    free === 3 ? "bg-primary text-primary-foreground" : "border border-primary/60 text-primary",
                  )}
                >
                  <Sparkles className="size-4" aria-hidden />
                  {props.planning ? "Planning…" : "Plan my day"}
                </button>
              )}
            </div>
          )}
          {adding && (
            <button type="button" onClick={() => setAdding(null)} className="-mt-1 min-h-11 justify-self-start text-sm text-muted-foreground hover:text-foreground">
              Done adding
            </button>
          )}
        </div>
      )}

      {supporting.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <h3 className="flex items-baseline justify-between pt-1 text-sm text-muted-foreground">
            Supporting tasks
            <span>
              {doneAll - doneBig} of {supporting.length}
            </span>
          </h3>
          <ul>
            {supporting.map((t) => (
              <TaskRow key={t.id} task={t} today={today} disabled={readOnly} onToggle={props.onToggle} onOpen={props.onOpen} />
            ))}
          </ul>
        </div>
      )}

      {isToday && !readOnly && unfinished.length > 0 && (
        <details className="group mt-2 border-t border-border pt-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm text-muted-foreground hover:text-foreground">
            {unfinished.length} unfinished from earlier
          </summary>
          <ul className="grid gap-1 pb-2">
            {unfinished.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-snug">{t.title}</span>
                  <span className="text-[13px] text-faint">{t.localDate ? shortDate(t.localDate) : ""}</span>
                </span>
                <button type="button" onClick={() => props.onMove(t, "today")} aria-label={`Do "${t.title}" today`} className="inline-flex h-11 items-center gap-1 rounded-full border border-border px-3 text-sm">
                  <ArrowUpToLine className="size-3.5" aria-hidden />
                  Today
                </button>
                <button type="button" onClick={() => props.onMove(t, "later")} aria-label={`Move "${t.title}" to later`} className="inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm text-muted-foreground">
                  <ArrowDownToLine className="size-3.5" aria-hidden />
                  Later
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {isToday && later.length > 0 && (
        <details className="group mt-1 border-t border-border pt-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm text-muted-foreground hover:text-foreground">
            {later.length} for later
          </summary>
          <ul className="grid gap-1 pb-2">
            {later.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <button type="button" onClick={() => props.onOpen(t)} className="min-h-11 min-w-0 flex-1 text-left">
                  <span className="block text-[15px] leading-snug">{t.title}</span>
                  {t.dueDate && <span className="text-[13px] text-faint">Due {shortDate(t.dueDate)}</span>}
                </button>
                {!readOnly && (
                  <button type="button" onClick={() => props.onMove(t, "today")} aria-label={`Do "${t.title}" today`} className="inline-flex h-11 items-center gap-1 rounded-full border border-border px-3 text-sm">
                    <ArrowUpToLine className="size-3.5" aria-hidden />
                    Today
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </SectionCard>
  );
}
