"use client";

import { Play, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { startSession, stopSession } from "@/app/actions/work";
import { Meter } from "@/components/meter";
import { SectionCard } from "@/components/section-card";
import { TimerDisplay } from "@/components/timer-display";
import { useNow } from "@/hooks/use-now";
import { AREA_LABEL } from "@/lib/areas";
import type { LocalDate } from "@/lib/day";
import { hours } from "./format";
import { run } from "./run";
import type { HoursData, HoursSession, RunningTimer } from "./types";

function minutesSince(sessions: HoursSession[], from: LocalDate, now: number): number {
  let ms = 0;
  for (const s of sessions) {
    if (s.localDate < from) continue;
    const end = s.endedAt ? new Date(s.endedAt).getTime() : now;
    ms += Math.max(0, end - new Date(s.startedAt).getTime());
  }
  return ms / 60000;
}

/** "The Websites timer", or the block's name when it was started from one. */
function runningName(r: RunningTimer): string {
  if (r.task) return `“${r.task}”`;
  if (r.area && r.area !== "other") return `The ${AREA_LABEL[r.area]} timer`;
  return "Another timer";
}

/**
 * Time given to one business today, this week and this month, counting a running timer up to
 * now, with the button that starts its timer.
 */
export function AreaHours({ data }: { data: HoursData }) {
  const { area, today, weekStart, monthStart, targetHours, serverNow } = data;
  const now = useNow() || serverNow;
  const [sessions, setSessions] = useState(data.sessions);
  const [running, setRunning] = useState(data.running);
  const [conflict, setConflict] = useState<RunningTimer | null>(null);
  const [busy, setBusy] = useState(false);
  const name = AREA_LABEL[area];

  const todayMin = minutesSince(sessions, today, now);
  const weekMin = minutesSince(sessions, weekStart, now);
  const monthMin = minutesSince(sessions, monthStart, now);
  const mine = running?.area === area ? running : null;

  async function start(replaceRunning: boolean) {
    // Another business's timer is already known to be running: ask first, no round trip.
    if (!replaceRunning && running && running.area !== area) {
      setConflict(running);
      return;
    }
    setBusy(true);
    setConflict(null);
    const res = await run(() => startSession({ blockId: null, area, replaceRunning }));
    setBusy(false);
    if (!res.ok) return;
    if ("running" in res.data) {
      const r = res.data.running;
      setConflict({ id: r.id, area: r.area, localDate: r.localDate, startedAt: r.startedAt, task: r.task });
      return;
    }
    const s = res.data.started;
    const stopped = running?.id;
    setSessions((list) => [
      ...list.map((x) => (x.id === stopped ? { ...x, endedAt: s.startedAt } : x)),
      { id: s.id, localDate: s.localDate, startedAt: s.startedAt, endedAt: null },
    ]);
    setRunning({ id: s.id, area: s.area, localDate: s.localDate, startedAt: s.startedAt, task: null });
  }

  async function stop(r: RunningTimer) {
    setBusy(true);
    const res = await run(() => stopSession({ sessionId: r.id }));
    setBusy(false);
    if (!res.ok) return;
    const endedAt = res.data.endedAt ?? new Date().toISOString();
    setRunning(null);
    setSessions((list) => list.map((x) => (x.id === r.id ? { ...x, endedAt } : x)));
    const logged = (new Date(endedAt).getTime() - new Date(r.startedAt).getTime()) / 60000;
    toast.success(`Logged ${hours(logged)} on ${name}.`);
  }

  return (
    <SectionCard
      title="Hours"
      meta={
        targetHours ? (
          <span>
            <span className="text-foreground">{hours(todayMin)}</span> of {targetHours}h today
          </span>
        ) : undefined
      }
    >
      {targetHours ? <Meter value={todayMin / (targetHours * 60)} label={`${name} hours today`} className="mb-4" /> : null}

      <dl className="grid grid-cols-3 gap-3">
        <Figure label="Today" value={hours(todayMin)} />
        <Figure label="This week" value={hours(weekMin)} />
        <Figure label="This month" value={hours(monthMin)} />
      </dl>

      <div className="mt-5">
        {mine ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-card p-4">
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">{mine.task ?? `${name} timer`}</p>
              <TimerDisplay startedAt={mine.startedAt} className="text-[34px] leading-none tracking-tight" />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void stop(mine)}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground active:scale-[0.98] disabled:opacity-60"
            >
              <Square className="size-4 fill-current" aria-hidden />
              Stop
            </button>
          </div>
        ) : conflict ? (
          <div role="alert" className="rounded-xl border border-border bg-card p-4 text-[15px]">
            <p>
              {runningName(conflict)} is running (<TimerDisplay startedAt={conflict.startedAt} />
              ). Stop it and start {name}?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void start(true)}
                className="h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                Switch to this
              </button>
              <button type="button" onClick={() => setConflict(null)} className="h-11 rounded-full px-4 text-sm text-muted-foreground hover:text-foreground">
                Keep it running
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void start(false)}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-primary/60 text-[15px] font-medium text-primary active:scale-[0.99] disabled:opacity-60"
          >
            <Play className="size-4 fill-current" aria-hidden />
            Start {name} timer
          </button>
        )}
      </div>
    </SectionCard>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate text-2xl leading-tight tracking-tight">{value}</dd>
    </div>
  );
}
