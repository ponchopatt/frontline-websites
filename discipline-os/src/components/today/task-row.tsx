"use client";

import { Camera, Check, NotebookText } from "lucide-react";
import { GoalBreadcrumb } from "@/components/goals/breadcrumb";
import { AREA_SHORT } from "@/lib/areas";
import { shortDate, type LocalDate } from "@/lib/day";
import type { TaskItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TaskRowProps {
  task: TaskItem;
  today: LocalDate;
  /** Shows the Big 3 number in the circle until it's done. */
  big?: boolean;
  disabled?: boolean;
  /** Show what the task supports (Week › Month › Year). */
  showChain?: boolean;
  onToggle: (task: TaskItem) => void;
  onOpen: (task: TaskItem) => void;
}

/** A task: tap the circle to finish it, tap the words to change it. */
export function TaskRow({ task, today, big, disabled, showChain, onToggle, onOpen }: TaskRowProps) {
  const done = task.status === "done";
  const dropped = task.status === "dropped";
  const overdue = task.dueDate && task.dueDate < today && !done;

  return (
    <li className="py-1.5">
      <div className="flex gap-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark "${task.title}" done`}
        disabled={disabled || dropped}
        onClick={() => {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
          onToggle(task);
        }}
        className="-my-0.5 -ml-2 grid size-12 shrink-0 touch-manipulation place-items-center rounded-full disabled:cursor-default disabled:opacity-55"
      >
        <span
          aria-hidden
          className={cn(
            "grid place-items-center rounded-full border-[1.5px] transition-colors duration-200",
            big ? "size-8" : "size-6",
            done ? "border-primary bg-primary text-primary-foreground" : dropped ? "border-input" : big ? "border-primary/70" : "border-input",
          )}
        >
          {done ? (
            <Check className={cn("animate-in zoom-in-50 duration-200", big ? "size-4" : "size-3.5")} strokeWidth={3} />
          ) : big && task.rank ? (
            <span className="text-[13px] text-muted-foreground">{task.rank}</span>
          ) : null}
        </span>
      </button>

      <button type="button" onClick={() => onOpen(task)} className="grid min-h-11 min-w-0 flex-1 content-center gap-0.5 text-left" aria-label={`Open ${task.title}`}>
        <span
          className={cn(
            "leading-snug [overflow-wrap:anywhere]",
            big ? "text-[18px] font-medium tracking-tight" : "text-[16px]",
            done && "text-muted-foreground",
            dropped && "text-faint line-through",
          )}
        >
          {task.title}
        </span>
        {(task.area || task.dueDate || task.notes || task.proofCount > 0 || task.priority === 1 || dropped) && (
          <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
            {task.area && <span>{AREA_SHORT[task.area]}</span>}
            {task.priority === 1 && !done && <span className="text-primary">High</span>}
            {task.dueDate && <span className={cn(overdue && "text-primary")}>{task.dueDate === today ? "Due today" : `Due ${shortDate(task.dueDate)}`}</span>}
            {task.notes && <NotebookText className="size-3.5" aria-label="Has notes" />}
            {task.proofCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Camera className="size-3.5" aria-hidden />
                <span className="sr-only">Proof photos:</span>
                {task.proofCount}
              </span>
            )}
            {dropped && <span>Dropped</span>}
          </span>
        )}
      </button>
      </div>
      {showChain && task.chain && <GoalBreadcrumb chain={task.chain} className={cn("mt-0.5", big ? "pl-12" : "pl-10")} />}
    </li>
  );
}
