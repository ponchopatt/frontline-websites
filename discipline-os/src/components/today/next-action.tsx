"use client";

import { Check, Play } from "lucide-react";
import { useState } from "react";
import { PrimaryButton, TextAction } from "@/components/os";
import { AREA_LABEL, type WorkArea } from "@/lib/areas";
import type { NextAction } from "@/lib/next-action";

interface NextActionProps {
  actions: NextAction[];
  running: boolean;
  onStart: (area: WorkArea) => void;
  onTaskDone: (taskId: string) => void;
  onHabitDone: (habitId: string) => void;
  onMove: (taskId: string) => void;
  onCloseDay: () => void;
  /** Opens the part of the day an action points to: "morning", "fitness", "review". */
  onOpen: (target: string) => void;
  /** Opens the counter an action is about. */
  onOpenCounter: (metricId: string) => void;
}

/**
 * Up next: the one thing to do now, why, and the one button that does it. "Something else"
 * steps down the list, still one at a time.
 */
export function NextActionCard({ actions, running, onStart, onTaskDone, onHabitDone, onMove, onCloseDay, onOpen, onOpenCounter }: NextActionProps) {
  const [skip, setSkip] = useState(0);
  const action = actions.length > 0 ? actions[skip % actions.length] : null;
  if (!action) return null;
  const d = action.do;
  const area: WorkArea | null = d.type === "work" || d.type === "counter" ? d.area : d.type === "task" ? d.area : null;

  let primary: { label: string; icon?: React.ReactNode; run: () => void } | null = null;
  let secondary: { label: string; run: () => void } | null = null;
  if (d.type === "task") {
    if (area && !running) {
      primary = { label: `Start ${AREA_LABEL[area]}`, icon: <Play className="size-4 fill-current" aria-hidden />, run: () => onStart(area) };
      secondary = { label: "Mark it done", run: () => onTaskDone(d.taskId) };
    } else {
      primary = { label: "Done", icon: <Check className="size-4" aria-hidden />, run: () => onTaskDone(d.taskId) };
    }
  } else if (d.type === "work" && !running) {
    primary = { label: `Start ${AREA_LABEL[d.area]}`, icon: <Play className="size-4 fill-current" aria-hidden />, run: () => onStart(d.area) };
  } else if (d.type === "counter") {
    primary = !running
      ? { label: `Start ${AREA_LABEL[d.area]}`, icon: <Play className="size-4 fill-current" aria-hidden />, run: () => onStart(d.area) }
      : { label: "Log it", run: () => onOpenCounter(d.metricId) };
    if (!running) secondary = { label: "Log it", run: () => onOpenCounter(d.metricId) };
  } else if (d.type === "habit") {
    primary = { label: "Done", icon: <Check className="size-4" aria-hidden />, run: () => onHabitDone(d.habitId) };
  } else if (d.type === "move") {
    primary = { label: "Do it today", run: () => onMove(d.taskId) };
  } else if (d.type === "open") {
    primary = { label: d.target === "review" ? "Open the review" : "Open", run: () => onOpen(d.target) };
  } else if (d.type === "close") {
    primary = { label: "Close the day", run: onCloseDay };
  }

  return (
    <section aria-labelledby="next-heading" aria-live="polite" className="surface-strong grid gap-1 rounded-[26px] border px-5 pt-4 pb-3">
      <h2 id="next-heading" className="text-[15px] text-muted-foreground">
        Up next
      </h2>
      <p className="text-[22px] leading-snug font-medium tracking-tight text-balance">{action.title}</p>
      <p className="text-[15px] leading-snug text-muted-foreground">{action.why}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {primary && (
          <PrimaryButton onClick={primary.run} className="min-w-[9.5rem]">
            {primary.icon}
            {primary.label}
          </PrimaryButton>
        )}
        {secondary && <TextAction onClick={secondary.run}>{secondary.label}</TextAction>}
        {actions.length > 1 && (
          <TextAction onClick={() => setSkip((n) => n + 1)} className="ml-auto">
            Something else
          </TextAction>
        )}
      </div>
    </section>
  );
}
