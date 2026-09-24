"use client";

import { Plus, Square } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { stopSession } from "@/app/actions/work";
import { Sheet } from "@/components/sheet";
import { TimerDisplay } from "@/components/timer-display";
import { QuickAdd } from "@/components/today/quick-add";
import { AREA_LABEL, type WorkArea } from "@/lib/areas";
import type { LocalDate } from "@/lib/day";

interface GlobalBarProps {
  today: LocalDate;
  running: { id: string; area: WorkArea | null; startedAt: string } | null;
  big3Free: boolean;
}

/**
 * Always within thumb reach, above the tab bar: the running timer (with Stop) on every page but
 * Today, which has its own, and a + to add a task from anywhere.
 */
export function GlobalBar({ today, running, big3Free }: GlobalBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [adding, setAdding] = useState(false);
  const [stopping, setStopping] = useState(false);
  const onToday = pathname === "/";

  async function stop() {
    if (!running) return;
    setStopping(true);
    try {
      const res = await stopSession({ sessionId: running.id });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    } catch {
      toast.error("That didn't save. Check your connection and try again.");
    } finally {
      setStopping(false);
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 md:bottom-6">
        <div className="mx-auto flex max-w-xl items-end justify-end gap-2 px-4 pb-3 sm:px-6 md:max-w-2xl">
          {running && !onToday && (
            <div className="pointer-events-auto mr-auto flex h-13 min-w-0 items-center gap-3 rounded-full border border-primary/40 bg-popover/95 pr-1 pl-4 shadow-lg backdrop-blur">
              <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-primary" />
              <span className="truncate text-sm text-muted-foreground">{running.area ? AREA_LABEL[running.area] : "Work"}</span>
              <TimerDisplay startedAt={running.startedAt} className="text-[17px]" />
              <button
                type="button"
                onClick={() => void stop()}
                disabled={stopping}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                <Square className="size-3 fill-current" aria-hidden />
                Stop
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Add a task"
            className="pointer-events-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
          >
            <Plus className="size-6" aria-hidden />
          </button>
        </div>
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a task">
        <QuickAdd
          date={today}
          big3Free={big3Free}
          autoFocus
          onAdded={(task) => {
            toast.success(task.localDate ? `Added to ${task.rank ? `Big 3 (#${task.rank})` : "today"}.` : "Saved for later.");
            router.refresh();
          }}
        />
        <p className="mt-3 text-xs text-faint">Type it and press Enter. Add as many as you like.</p>
      </Sheet>
    </>
  );
}
