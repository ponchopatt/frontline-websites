"use client";

import { Play, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { startSession, stopSession } from "@/app/actions/work";
import { Meter } from "@/components/meter";
import { Group, Row } from "@/components/os";
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
 * now, and one row that starts its timer.
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
    <Group
      title="Hours"
      action={
        targetHours ? (
          <span className="text-[15px] text-muted-foreground">
            {hours(todayMin)} of {targetHours}h today
          </span>
        ) : undefined
      }
    >
      <div className="grid gap-4 px-4 pt-4 pb-4">
        <dl className="grid grid-cols-3 gap-3">
          <Figure label="Today" value={hours(todayMin)} />
          <Figure label="This week" value={hours(weekMin)} />
          <Figure label="This month" value={hours(monthMin)} />
        </dl>
        {targetHours ? <Meter value={todayMin / (targetHours * 60)} label={`${name} hours today`} /> : null}
      </div>

      {mine ? (
        <div className="flex min-h-16 items-center gap-3 px-4 py-3">
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="text-[14px] break-words text-muted-foreground">{mine.task ?? `${name} timer`}</span>
            <TimerDisplay startedAt={mine.startedAt} className="text-[28px] leading-none font-light tracking-tight" />
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void stop(mine)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <Square className="size-3.5 fill-current" aria-hidden />
            Stop
          </button>
        </div>
      ) : conflict ? (
        <div role="alert" className="grid gap-3 px-4 py-4 text-[15px] leading-snug">
          <p>
            {runningName(conflict)} is running (<TimerDisplay startedAt={conflict.startedAt} />
            ). Stop it and start {name}?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void start(true)}
              className="h-11 rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground disabled:opacity-60"
            >
              Switch to this
            </button>
            <button type="button" onClick={() => setConflict(null)} className="h-11 rounded-full px-4 text-[15px] text-muted-foreground hover:text-foreground">
              Keep it running
            </button>
          </div>
        </div>
      ) : (
        <Row onClick={() => void start(false)} disabled={busy} leading={<Play className="size-5 fill-current" />} title={`Start ${name} timer`} chevron={false} />
      )}
    </Group>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-[14px] text-muted-foreground">{label}</dt>
      <dd className="text-[clamp(19px,5.6vw,24px)] leading-tight font-light tracking-tight break-words tabular-nums">{value}</dd>
    </div>
  );
}
