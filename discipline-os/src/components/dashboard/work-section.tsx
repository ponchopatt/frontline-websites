"use client";

import { Play, Plus, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/section-card";
import { TimerDisplay } from "@/components/timer-display";
import { useNow } from "@/hooks/use-now";
import { clockTime, formatElapsed, formatHours, localDateAt, type LocalDate } from "@/lib/day";
import type { WorkBlockItem, WorkSessionItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const LONG_RUNNING_MS = 8 * 60 * 60 * 1000;

export interface RunningSession extends WorkSessionItem {
  task: string | null;
}

interface WorkSectionProps {
  date: LocalDate;
  isToday: boolean;
  readOnly: boolean;
  timeZone: string;
  dayStartHour: number;
  targetHours: number;
  minutes: number;
  blocks: WorkBlockItem[];
  sessions: WorkSessionItem[];
  running: RunningSession | null;
  /** The session waiting for "What did you accomplish?" */
  noteFor: string | null;
  /** A start that found another timer running. */
  conflict: { blockId: string | null; running: RunningSession } | null;
  onStart: (blockId: string | null, replaceRunning?: boolean) => void;
  onCancelConflict: () => void;
  onStop: (sessionId: string) => void;
  onSaveNote: (sessionId: string, note: string) => void;
  onSkipNote: () => void;
  onEndAt: (sessionId: string, endDate: LocalDate, endTime: string) => void;
  onKeepRunning: (sessionId: string) => void;
  longRunningDismissed: boolean;
  onAddBlock: (task: string, start: string | null, end: string | null) => Promise<boolean>;
  onDeleteBlock: (blockId: string) => void;
}

function sessionMinutes(s: WorkSessionItem, now: number): number {
  const end = s.endedAt ? new Date(s.endedAt).getTime() : now || new Date(s.startedAt).getTime();
  return Math.max(0, (end - new Date(s.startedAt).getTime()) / 60000);
}

export function WorkSection(props: WorkSectionProps) {
  const {
    date,
    isToday,
    readOnly,
    timeZone,
    dayStartHour,
    targetHours,
    minutes,
    blocks,
    sessions,
    running,
    noteFor,
    conflict,
  } = props;
  const now = useNow();
  const [adding, setAdding] = useState(false);
  const pct = targetHours > 0 ? Math.min(100, (minutes / (targetHours * 60)) * 100) : 0;
  const longRunning = running && now > 0 && now - new Date(running.startedAt).getTime() > LONG_RUNNING_MS;

  const loggedByBlock = new Map<string, number>();
  let unplanned = 0;
  for (const s of sessions) {
    const m = sessionMinutes(s, now);
    if (s.blockId) loggedByBlock.set(s.blockId, (loggedByBlock.get(s.blockId) ?? 0) + m);
    else unplanned += m;
  }
  const noteSession = noteFor ? sessions.find((s) => s.id === noteFor) ?? null : null;

  return (
    <SectionCard
      id="work"
      title="Work"
      meta={
        <span>
          <span className="text-foreground">{formatHours(minutes)}</span> of {targetHours}h
        </span>
      }
    >
      <div
        className="mb-4 h-1 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label="Work hours"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-(--ease-out-quart)" style={{ width: `${pct}%` }} />
      </div>

      {running && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">
                {running.task ?? "Unplanned work"} · since {clockTime(running.startedAt, timeZone)}
                {running.localDate !== date && " · started on another day"}
              </p>
              <TimerDisplay startedAt={running.startedAt} className="text-[40px] leading-none tracking-tight" />
            </div>
            <button
              type="button"
              onClick={() => props.onStop(running.id)}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground active:scale-[0.98]"
            >
              <Square className="size-4 fill-current" aria-hidden />
              Stop
            </button>
          </div>

          {longRunning && !props.longRunningDismissed && (
            <LongRunningPrompt
              session={running}
              timeZone={timeZone}
              dayStartHour={dayStartHour}
              onEndAt={props.onEndAt}
              onKeepRunning={props.onKeepRunning}
            />
          )}
        </div>
      )}

      {conflict && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4 text-[15px]" role="alert">
          <p>
            <span className="text-foreground">{conflict.running.task ?? "Unplanned work"}</span> is still running (
            <TimerDisplay startedAt={conflict.running.startedAt} />
            ). Stop it and start this one?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => props.onStart(conflict.blockId, true)}
              className="h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Stop it and start
            </button>
            <button type="button" onClick={props.onCancelConflict} className="h-11 rounded-full px-4 text-sm text-muted-foreground hover:text-foreground">
              Keep it running
            </button>
          </div>
        </div>
      )}

      {noteSession && (
        <NotePrompt
          key={noteSession.id}
          minutes={sessionMinutes(noteSession, now)}
          onSave={(note) => props.onSaveNote(noteSession.id, note)}
          onSkip={props.onSkipNote}
        />
      )}

      {blocks.length === 0 && !adding ? (
        <p className="py-2 text-[15px] text-muted-foreground">
          {isToday ? "No blocks planned yet. Add one, or start the timer without one." : "No blocks were planned for this day."}
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {blocks.map((b) => {
            const isRunning = running?.blockId === b.id;
            const logged = loggedByBlock.get(b.id) ?? 0;
            return (
              <li key={b.id} className="flex min-h-14 items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px]">{b.task}</p>
                  <p className="text-sm text-muted-foreground">
                    {b.plannedStart && b.plannedEnd
                      ? `${b.plannedStart}–${b.plannedEnd}`
                      : b.plannedStart
                        ? `From ${b.plannedStart}`
                        : "Any time"}
                    {logged > 0 && <span className="text-foreground"> · {formatHours(logged)} done</span>}
                  </p>
                </div>
                {!readOnly && isToday && !isRunning && (
                  <button
                    type="button"
                    onClick={() => props.onStart(b.id)}
                    className="inline-flex h-11 items-center gap-1.5 rounded-full border border-primary/60 px-4 text-sm font-medium text-primary active:scale-[0.98]"
                    aria-label={`Start ${b.task}`}
                  >
                    <Play className="size-3.5 fill-current" aria-hidden />
                    Start
                  </button>
                )}
                {isRunning && <span className="text-sm text-primary">Running</span>}
                {!readOnly && !isRunning && logged === 0 && (
                  <button
                    type="button"
                    onClick={() => props.onDeleteBlock(b.id)}
                    className="grid size-11 place-items-center rounded-full text-faint hover:text-foreground"
                    aria-label={`Remove ${b.task}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <div className="mt-2">
          {adding ? (
            <AddBlockForm
              onCancel={() => setAdding(false)}
              onAdd={async (task, start, end) => {
                const saved = await props.onAddBlock(task, start, end);
                if (saved) setAdding(false);
                return saved;
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-x-5">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-4" aria-hidden />
                Add a block
              </button>
              {isToday && !running && (
                <button
                  type="button"
                  onClick={() => props.onStart(null)}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Play className="size-3.5" aria-hidden />
                  Start without a block
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {sessions.length > 0 && (
        <details className="group mt-3 text-sm">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-muted-foreground hover:text-foreground">
            {sessions.length} {sessions.length === 1 ? "session" : "sessions"} logged
            {unplanned > 0 && ` · ${formatHours(unplanned)} unplanned`}
          </summary>
          <ul className="grid gap-2 pb-2">
            {sessions.map((s) => {
              const block = blocks.find((b) => b.id === s.blockId);
              return (
                <li key={s.id} className="grid gap-0.5 border-l border-border pl-3">
                  <span>
                    {clockTime(s.startedAt, timeZone)}–{s.endedAt ? clockTime(s.endedAt, timeZone) : "now"} ·{" "}
                    {formatElapsed(sessionMinutes(s, now) * 60000)} · {block?.task ?? "Unplanned"}
                  </span>
                  {s.note && <span className="text-muted-foreground">{s.note}</span>}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </SectionCard>
  );
}

function NotePrompt({ minutes, onSave, onSkip }: { minutes: number; onSave: (note: string) => void; onSkip: () => void }) {
  const [note, setNote] = useState("");
  return (
    <form
      className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(note.trim());
      }}
    >
      <label htmlFor="session-note" className="text-[15px]">
        What did you accomplish? <span className="text-muted-foreground">({formatHours(minutes)})</span>
      </label>
      <input
        id="session-note"
        autoFocus
        value={note}
        maxLength={1000}
        onChange={(e) => setNote(e.target.value)}
        enterKeyHint="done"
        className="h-12 rounded-lg border border-input bg-transparent px-3 text-[16px] outline-none placeholder:text-faint focus-visible:border-primary/70"
        placeholder="Finished the draft, sent it to Sam"
      />
      <div className="flex gap-2">
        <button type="submit" className="h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
          Save note
        </button>
        <button type="button" onClick={onSkip} className="h-11 rounded-full px-4 text-sm text-muted-foreground hover:text-foreground">
          Skip
        </button>
      </div>
    </form>
  );
}

function AddBlockForm({
  onAdd,
  onCancel,
}: {
  onAdd: (task: string, start: string | null, end: string | null) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [task, setTask] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "h-12 rounded-lg border border-input bg-transparent px-3 text-[16px] outline-none focus-visible:border-primary/70";
  return (
    <form
      className="grid gap-2 py-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!task.trim() || busy) return;
        setBusy(true);
        await onAdd(task.trim(), start || null, end || null);
        setBusy(false);
      }}
    >
      <label className="sr-only" htmlFor="block-task">
        Task
      </label>
      <input
        id="block-task"
        autoFocus
        value={task}
        maxLength={120}
        onChange={(e) => setTask(e.target.value)}
        placeholder="What's the block for?"
        className={cn(field, "placeholder:text-faint")}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm text-muted-foreground">
          Start
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          End
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!task.trim() || busy}
          className="h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Add block
        </button>
        <button type="button" onClick={onCancel} className="h-11 rounded-full px-4 text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </form>
  );
}

function LongRunningPrompt({
  session,
  timeZone,
  dayStartHour,
  onEndAt,
  onKeepRunning,
}: {
  session: RunningSession;
  timeZone: string;
  dayStartHour: number;
  onEndAt: (sessionId: string, endDate: LocalDate, endTime: string) => void;
  onKeepRunning: (sessionId: string) => void;
}) {
  const started = new Date(session.startedAt);
  // Suggest the start time + 1h as a starting point; the user sets the real one.
  const suggestion = new Date(started.getTime() + 60 * 60 * 1000);
  const [date, setDate] = useState<LocalDate>(localDateAt(suggestion, timeZone, 0));
  const [time, setTime] = useState(clockTime(suggestion, timeZone));
  const field = "h-11 rounded-lg border border-input bg-transparent px-2 text-[16px] outline-none focus-visible:border-primary/70";
  return (
    <div className="mt-4 grid gap-3 border-t border-border pt-4 text-[15px]" role="alert">
      <p>
        This timer has been running for over 8 hours, since {clockTime(started, timeZone)}
        {localDateAt(started, timeZone, dayStartHour) !== localDateAt(new Date(), timeZone, dayStartHour) ? " on an earlier day" : ""}. Did
        you forget to stop it?
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onEndAt(session.id, date, time);
        }}
      >
        <label className="grid gap-1 text-sm text-muted-foreground">
          It ended on
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} required />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          at
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} required />
        </label>
        <button type="submit" className="h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
          Save end time
        </button>
        <button
          type="button"
          onClick={() => onKeepRunning(session.id)}
          className="h-11 rounded-full px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          I&apos;m still working
        </button>
      </form>
    </div>
  );
}
