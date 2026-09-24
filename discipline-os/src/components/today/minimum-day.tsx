"use client";

import { Check, Play, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CheckChip } from "@/components/check-chip";
import { Meter } from "@/components/meter";
import { Sheet } from "@/components/sheet";
import { formatDuration } from "@/lib/day";
import type { MinimumItem } from "@/lib/next-action";
import type { HabitItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const MESSAGE = "You don't need a perfect day. You need to stop the bleeding.";

export interface MinimumState {
  items: MinimumItem[];
  done: number;
  total: number;
  secured: boolean;
}

/** The Minimum Day's items from today's habits, work and fitness. */
export function minimumItems(habits: HabitItem[], workMinutes: number, minWork: number, fitness: boolean): MinimumState {
  const items: MinimumItem[] = habits
    .filter((h) => h.minimum && h.due)
    .map((h) => ({ key: h.id, label: h.name, done: Boolean(h.completedAt), kind: "habit" as const, habitId: h.id }));
  if (minWork > 0) items.push({ key: "work", label: `${minWork} minutes of focused work`, done: workMinutes >= minWork, kind: "work" });
  if (fitness) {
    const done = habits.some((h) => (h.kind === "gym" || h.kind === "cardio") && h.completedAt);
    items.push({ key: "fitness", label: "Gym, or 20 minutes of cardio", done, kind: "fitness" });
  }
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, secured: items.length > 0 && done === items.length };
}

interface MinimumSwitchProps {
  open: boolean;
  preview: MinimumState;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** "I'm having a shit day": what the day comes down to, before it's switched on. */
export function MinimumSwitch({ open, preview, busy, onConfirm, onClose }: MinimumSwitchProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Minimum day">
      <div className="grid gap-4">
        <p className="text-[17px] leading-snug">{MESSAGE}</p>
        <div className="grid gap-1.5">
          <p className="text-sm text-muted-foreground">Today comes down to</p>
          <ul className="grid gap-1">
            {preview.items.map((i) => (
              <li key={i.key} className="flex items-center gap-2.5 text-[15px]">
                <span aria-hidden className={cn("grid size-5 place-items-center rounded-full border", i.done ? "border-kept bg-kept text-background" : "border-input")}>
                  {i.done && <Check className="size-3" strokeWidth={3} />}
                </span>
                {i.label}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          Everything else stays where it is. Keep My Word still counts all of it; a secured minimum day keeps your streak alive.{" "}
          <Link href="/settings#minimum" className="text-foreground underline underline-offset-4">
            Change the list
          </Link>
        </p>
        <button type="button" disabled={busy} onClick={onConfirm} className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Switching…" : "Switch to minimum day"}
        </button>
      </div>
    </Sheet>
  );
}

interface MinimumCardProps {
  state: MinimumState;
  habits: HabitItem[];
  workMinutes: number;
  minWork: number;
  running: boolean;
  readOnly: boolean;
  showingAll: boolean;
  onToggleHabit: (habit: HabitItem, done: boolean) => void;
  onStartWork: () => void;
  onShowAll: () => void;
  onEnd: () => void;
}

/** The day, cut to its non-negotiables. Secured once they're all done. */
export function MinimumCard({ state, habits, workMinutes, minWork, running, readOnly, showingAll, onToggleHabit, onStartWork, onShowAll, onEnd }: MinimumCardProps) {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const gym = habits.find((h) => h.kind === "gym");
  const cardio = habits.find((h) => h.kind === "cardio");

  return (
    <section
      id="minimum"
      aria-labelledby="minimum-heading"
      className={cn("scroll-mt-6 rounded-[26px] border px-4 pt-5 pb-3 sm:px-5", state.secured ? "border-kept/40 bg-kept-soft" : "border-primary/30 bg-card")}
    >
      <header className="mb-1 flex items-baseline justify-between gap-4">
        <h2 id="minimum-heading" className="inline-flex items-center gap-2 text-2xl font-medium tracking-tight">
          <ShieldCheck className={cn("size-5", state.secured ? "text-kept" : "text-primary")} aria-hidden />
          Minimum day
        </h2>
        <span className="text-sm text-muted-foreground">
          <span className="text-foreground">{state.done}</span>/{state.total}
        </span>
      </header>

      {state.secured ? (
        <div className="mb-3 grid gap-0.5" role="status">
          <p className="text-[19px] font-medium text-kept">Minimum day secured.</p>
          <p className="text-[15px] text-muted-foreground">You kept the chain alive.</p>
        </div>
      ) : (
        <p className="mb-3 text-[15px] text-muted-foreground">{MESSAGE}</p>
      )}

      <div className="grid gap-2">
        <div className="grid grid-cols-2 gap-2">
          {state.items
            .filter((i) => i.kind === "habit" && i.habitId && byId.has(i.habitId))
            .map((i) => {
              const h = byId.get(i.habitId!)!;
              return <CheckChip key={i.key} label={h.name} done={Boolean(h.completedAt)} disabled={readOnly} onToggle={(d) => onToggleHabit(h, d)} />;
            })}
        </div>

        {minWork > 0 && (
          <div className="grid gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px]">
                {minWork} minutes of focused work
                <span className="block text-xs text-faint">
                  {workMinutes >= minWork ? `Done: ${formatDuration(workMinutes)}` : `${formatDuration(workMinutes)} so far`}
                </span>
              </span>
              {workMinutes < minWork && !running && !readOnly && (
                <button type="button" onClick={onStartWork} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
                  <Play className="size-3.5" aria-hidden />
                  Start
                </button>
              )}
            </div>
            <Meter value={workMinutes / minWork} />
          </div>
        )}

        {state.items.some((i) => i.kind === "fitness") && (
          <div className="grid gap-1.5">
            <p className="text-sm text-muted-foreground">Gym, or 20 minutes of cardio</p>
            <div className="grid grid-cols-2 gap-2">
              {gym && <CheckChip label="Gym" done={Boolean(gym.completedAt)} disabled={readOnly} onToggle={(d) => onToggleHabit(gym, d)} />}
              {cardio && <CheckChip label="Cardio" done={Boolean(cardio.completedAt)} disabled={readOnly} onToggle={(d) => onToggleHabit(cardio, d)} />}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button type="button" onClick={onShowAll} aria-expanded={showingAll} className="min-h-11 text-sm text-foreground underline-offset-4 hover:underline">
          {showingAll ? "Hide the full day" : "Show the full day"}
        </button>
        {!readOnly && (
          <button type="button" onClick={onEnd} className="min-h-11 text-sm text-muted-foreground hover:text-foreground">
            End minimum day
          </button>
        )}
      </div>
    </section>
  );
}
