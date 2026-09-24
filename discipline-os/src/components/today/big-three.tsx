"use client";

import { ArrowDownToLine, ArrowUpToLine, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
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

  const nextSlot = ([1, 2, 3] as const).find((slot) => !bySlot.has(slot));
  const row = "flex min-h-14 w-full items-center gap-3 text-left text-[17px] text-muted-foreground disabled:cursor-default";

  return (
    <section id="big3" aria-labelledby="big3-heading" className="grid scroll-mt-6 grid-cols-[minmax(0,1fr)] gap-2">
      <div className="glow-ink flex min-h-6 items-baseline justify-between gap-3 px-1">
        <h2 id="big3-heading" className="text-[15px] font-medium text-muted-foreground">
          Today&apos;s Big 3
        </h2>
        {big.length > 0 && (
          <span className="text-[15px] text-muted-foreground">
            {doneBig} of {big.length} done
          </span>
        )}
      </div>

      <div className="surface-strong grid grid-cols-[minmax(0,1fr)] rounded-[22px] border px-4 py-1">
        <ol className="grid divide-y divide-border">
          {([1, 2, 3] as const).map((slot) => {
            const task = bySlot.get(slot);
            if (task) return <TaskRow key={task.id} task={task} today={today} big showChain disabled={readOnly} onToggle={props.onToggle} onOpen={props.onOpen} />;
            // Only the next empty slot shows, so an empty day reads as one invitation, not three.
            if (slot !== nextSlot || readOnly) return null;
            return (
              <li key={`empty-${slot}`}>
                <button type="button" onClick={() => setAdding("big3")} className={row}>
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-input text-[13px]">
                    {slot}
                  </span>
                  {slot === 1 ? "Add your #1" : `Add #${slot}`}
                </button>
              </li>
            );
          })}
        </ol>

        {!readOnly && !bySlot.has(1) && lastNightPriority && (
          <button type="button" onClick={() => props.onUseLastNight(lastNightPriority)} className="min-h-11 border-t border-border py-2 text-left text-[15px] text-muted-foreground">
            Use last night&apos;s #1: <span className="text-foreground">{lastNightPriority}</span>
          </button>
        )}

        {supporting.length > 0 && (
          <div className="border-t border-border pt-2">
            <h3 className="flex items-baseline justify-between text-[14px] text-muted-foreground">
              Supporting tasks
              <span>
                {doneAll - doneBig} of {supporting.length}
              </span>
            </h3>
            <ul className="grid divide-y divide-border">
              {supporting.map((t) => (
                <TaskRow key={t.id} task={t} today={today} disabled={readOnly} onToggle={props.onToggle} onOpen={props.onOpen} />
              ))}
            </ul>
          </div>
        )}

        {!readOnly && (
          <div className="border-t border-border">
            {adding ? (
              <div className="grid gap-2 py-3">
                <QuickAdd date={date} big3Free={free > 0} big3Default={adding === "big3"} autoFocus onAdded={props.onAdded} />
                <button type="button" onClick={() => setAdding(null)} className="min-h-11 justify-self-start text-[15px] text-muted-foreground hover:text-foreground">
                  Done adding
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setAdding("task")} className={cn(row, "flex-1")}>
                  <Plus className="size-5" aria-hidden />
                  Add task
                </button>
                {isToday && free > 0 && (
                  <button
                    type="button"
                    disabled={props.planning}
                    onClick={props.onPlan}
                    className={cn(
                      "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium disabled:opacity-60",
                      tasks.length === 0 ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
                    )}
                  >
                    <Sparkles className="size-4" aria-hidden />
                    {props.planning ? "Planning…" : "Plan my day"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {isToday && !readOnly && unfinished.length > 0 && (
          <details className="group border-t border-border">
            <summary className="flex min-h-12 cursor-pointer list-none items-center text-[15px] text-muted-foreground hover:text-foreground">
              {unfinished.length} unfinished from earlier
            </summary>
            <ul className="grid gap-1 pb-2">
              {unfinished.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug">{t.title}</span>
                    <span className="text-[13px] text-muted-foreground">{t.localDate ? shortDate(t.localDate) : ""}</span>
                  </span>
                  <button type="button" onClick={() => props.onMove(t, "today")} aria-label={`Do "${t.title}" today`} className="inline-flex h-11 items-center gap-1 rounded-full border border-border px-3 text-[15px]">
                    <ArrowUpToLine className="size-3.5" aria-hidden />
                    Today
                  </button>
                  <button type="button" onClick={() => props.onMove(t, "later")} aria-label={`Move "${t.title}" to later`} className="inline-flex h-11 items-center gap-1 rounded-full px-2 text-[15px] text-muted-foreground">
                    <ArrowDownToLine className="size-3.5" aria-hidden />
                    Later
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {isToday && later.length > 0 && (
          <details className="group border-t border-border">
            <summary className="flex min-h-12 cursor-pointer list-none items-center text-[15px] text-muted-foreground hover:text-foreground">
              {later.length} for later
            </summary>
            <ul className="grid gap-1 pb-2">
              {later.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <button type="button" onClick={() => props.onOpen(t)} className="min-h-11 min-w-0 flex-1 text-left">
                    <span className="block text-[15px] leading-snug">{t.title}</span>
                    {t.dueDate && <span className="text-[13px] text-muted-foreground">Due {shortDate(t.dueDate)}</span>}
                  </button>
                  {!readOnly && (
                    <button type="button" onClick={() => props.onMove(t, "today")} aria-label={`Do "${t.title}" today`} className="inline-flex h-11 items-center gap-1 rounded-full border border-border px-3 text-[15px]">
                      <ArrowUpToLine className="size-3.5" aria-hidden />
                      Today
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
