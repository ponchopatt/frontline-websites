"use client";

import { Square } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { stopSession } from "@/app/actions/work";
import { TimerDisplay } from "@/components/timer-display";
import { AREA_LABEL, type WorkArea } from "@/lib/areas";

interface GlobalBarProps {
  running: { id: string; area: WorkArea | null; startedAt: string } | null;
}

/** Just above the tab bar on every page but Today (which has its own): the running timer, with Stop. */
export function GlobalBar({ running }: GlobalBarProps) {
  const router = useRouter();
  const pathname = usePathname();
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

  if (!running || onToday) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30">
      <div className="mx-auto flex max-w-xl px-4 pb-2 sm:px-6 md:max-w-2xl">
        <div className="surface-light pointer-events-auto flex h-13 min-w-0 items-center gap-3 rounded-full border border-primary/40 bg-popover/95 pr-1 pl-4 shadow-lg backdrop-blur">
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
      </div>
    </div>
  );
}
