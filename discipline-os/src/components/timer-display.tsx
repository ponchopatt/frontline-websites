"use client";

import { useNow } from "@/hooks/use-now";
import { formatElapsed } from "@/lib/day";
import { cn } from "@/lib/utils";

interface TimerDisplayProps {
  startedAt: string;
  endedAt?: string | null;
  className?: string;
}

/**
 * Elapsed time for a session. Computed from the stored start time on every tick, never
 * counted up in memory, so a refresh or a closed tab cannot lose time.
 */
export function TimerDisplay({ startedAt, endedAt, className }: TimerDisplayProps) {
  const now = useNow();
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now;
  const text = end === 0 ? "–:––" : formatElapsed(end - start);
  return (
    <span className={cn("tabular-nums", className)} role="timer" aria-live="off">
      {text}
    </span>
  );
}
