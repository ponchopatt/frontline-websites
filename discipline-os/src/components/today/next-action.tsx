"use client";

import { ArrowRight, Check, Compass, Play, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { AREA_LABEL, type WorkArea } from "@/lib/areas";
import type { NextAction } from "@/lib/next-action";
import { cn } from "@/lib/utils";

interface NextActionProps {
  actions: NextAction[];
  running: boolean;
  onStart: (area: WorkArea) => void;
  onTaskDone: (taskId: string) => void;
  onHabitDone: (habitId: string) => void;
  onMove: (taskId: string) => void;
  onCloseDay: () => void;
}

function go(target: string) {
  document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * "What should I do next?" One action, why it's the one, and the button that starts it.
 * "Something else" steps down the list, still one at a time.
 */
export function NextActionCard({ actions, running, onStart, onTaskDone, onHabitDone, onMove, onCloseDay }: NextActionProps) {
  const [open, setOpen] = useState(false);
  const [skip, setSkip] = useState(0);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setSkip(0);
          setOpen(true);
        }}
        className="flex h-14 w-full items-center justify-center gap-2.5 rounded-[22px] border border-primary/40 bg-lamp-soft text-[17px] font-medium text-foreground transition-colors active:bg-primary/15"
      >
        <Compass className="size-5 text-primary" aria-hidden />
        What should I do next?
      </button>
    );
  }

  const action = actions.length > 0 ? actions[skip % actions.length] : null;
  const d = action?.do;
  const area: WorkArea | null = d && (d.type === "work" || d.type === "counter") ? d.area : d?.type === "task" ? d.area : null;

  return (
    <section aria-labelledby="next-heading" aria-live="polite" className="surface-strong rounded-[28px] border px-4 pt-4 pb-3 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="next-heading" className="inline-flex items-center gap-2 text-sm text-primary">
          <Compass className="size-4" aria-hidden />
          Do this now
        </h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide" className="-mr-2 grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-accent">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {action ? (
        <>
          <p className="mt-1 text-[22px] leading-snug font-medium tracking-tight">{action.title}</p>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            <span className="text-foreground">Why:</span> {action.why}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {area && !running && (
              <Primary onClick={() => onStart(area)} icon={<Play className="size-4" aria-hidden />}>
                Start {AREA_LABEL[area]}
              </Primary>
            )}
            {d?.type === "task" && (
              <Secondary onClick={() => onTaskDone(d.taskId)} strong={!area || running} icon={<Check className="size-4" aria-hidden />}>
                Done
              </Secondary>
            )}
            {d?.type === "habit" && (
              <Primary onClick={() => onHabitDone(d.habitId)} icon={<Check className="size-4" aria-hidden />}>
                Done
              </Primary>
            )}
            {d?.type === "move" && <Primary onClick={() => onMove(d.taskId)}>Do it today</Primary>}
            {d?.type === "counter" && (
              <Secondary onClick={() => go(d.metricId ? `counter-${d.metricId}` : "imperium")} strong={running}>
                Log it
              </Secondary>
            )}
            {d?.type === "open" && (
              <Primary onClick={() => go(d.target)} icon={<ArrowRight className="size-4" aria-hidden />}>
                Go there
              </Primary>
            )}
            {d?.type === "close" && <Primary onClick={onCloseDay}>Close the day</Primary>}
          </div>

          {actions.length > 1 && (
            <button
              type="button"
              onClick={() => setSkip((n) => n + 1)}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Something else
            </button>
          )}
        </>
      ) : (
        <p className="mt-1 text-[17px]">Nothing open. The day&apos;s done.</p>
      )}
    </section>
  );
}

function Primary({ children, onClick, icon }: { children: React.ReactNode; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground">
      {icon}
      {children}
    </button>
  );
}

function Secondary({ children, onClick, icon, strong }: { children: React.ReactNode; onClick: () => void; icon?: React.ReactNode; strong?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-medium",
        strong ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:bg-accent",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
