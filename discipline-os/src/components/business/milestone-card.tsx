"use client";

import { Check, Pencil, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { completeMilestone, saveMilestone, startMilestone } from "@/app/actions/bot";
import { field } from "@/components/goals/form-bits";
import { Group, PrimaryButton, Ring, Row } from "@/components/os";
import type { MilestoneItem, MilestoneStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { run } from "./run";

const MAX_STEPS = 20;

interface MilestoneCardProps {
  initial: MilestoneItem | null;
  onCompleted: (milestone: { id: string; title: string }) => void;
}

/**
 * The bot's one current milestone as a list: its name, its steps to tick, a line to add one,
 * and "Complete milestone". With none running, just the question of what's next.
 */
export function MilestoneCard({ initial, onCompleted }: MilestoneCardProps) {
  const [milestone, setMilestone] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // Straight after completing one, the next question takes the focus.
  const [justFinished, setJustFinished] = useState(false);

  if (!milestone) {
    return (
      <Group title="Milestone" plain>
        <StartForm autoFocus={justFinished} onStarted={setMilestone} />
      </Group>
    );
  }

  const { id, title, steps } = milestone;
  const doneCount = steps.filter((s) => s.done).length;
  const ratio = steps.length > 0 ? doneCount / steps.length : 0;
  const left = steps.length - doneCount;

  function apply(p: Partial<MilestoneItem>) {
    setMilestone((m) => (m && m.id === id ? { ...m, ...p } : m));
  }

  async function saveSteps(next: MilestoneStep[]) {
    const prev = steps;
    apply({ steps: next });
    const res = await run(() => saveMilestone({ id, steps: next }));
    if (!res.ok) apply({ steps: prev });
  }

  async function rename(raw: string) {
    const next = raw.trim();
    if (!next || next === title) return;
    apply({ title: next });
    const res = await run(() => saveMilestone({ id, title: next }));
    if (!res.ok) apply({ title });
  }

  function removeStep(index: number) {
    const prev = steps;
    void saveSteps(steps.filter((_, i) => i !== index));
    toast(`Removed “${steps[index].title}”.`, { action: { label: "Undo", onClick: () => void saveSteps(prev) } });
  }

  async function complete() {
    setBusy(true);
    const res = await run(() => completeMilestone({ id }));
    setBusy(false);
    if (!res.ok) return;
    setConfirming(false);
    setJustFinished(true);
    setMilestone(null);
    onCompleted({ id, title });
    toast.success(`“${title}” is done.`);
  }

  return (
    <Group
      title="Milestone"
      action={
        <span className="text-[15px] text-muted-foreground">
          {Math.round(ratio * 100)}% done
        </span>
      }
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <TitleEditor title={title} onSave={(t) => void rename(t)} />
          <p className="text-[14px] text-muted-foreground">
            {doneCount} of {steps.length} {steps.length === 1 ? "step" : "steps"} done
          </p>
        </div>
        <Ring value={ratio} size={36} label={`Milestone ${Math.round(ratio * 100)}% done`} />
      </div>

      {steps.length > 0 && (
        <ul className="divide-y divide-border">
          {steps.map((s, i) => (
            // Steps have no ids; a step is its place in the list.
            <li key={`${i}:${s.title}`} className="flex items-center pr-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={s.done}
                aria-label={s.title}
                onClick={() => void saveSteps(steps.map((x, j) => (j === i ? { ...x, done: !s.done } : x)))}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left transition-colors active:bg-accent"
              >
                <Tick done={s.done} />
                <span className={cn("min-w-0 text-[17px] leading-snug break-words", s.done && "text-muted-foreground")}>{s.title}</span>
              </button>
              <button
                type="button"
                onClick={() => removeStep(i)}
                aria-label={`Remove step: ${s.title}`}
                className="grid size-11 shrink-0 place-items-center rounded-full text-faint hover:bg-accent hover:text-foreground"
              >
                <X className="size-[18px]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AddStep full={steps.length >= MAX_STEPS} onAdd={(t) => void saveSteps([...steps, { title: t, done: false }])} />

      {confirming ? (
        <div role="alert" className="grid gap-3 px-4 py-4 text-[15px] leading-snug">
          <p>
            {left === 1 ? "1 step isn't" : `${left} steps aren't`} ticked yet. Complete the milestone anyway?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void complete()}
              className="h-11 rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground disabled:opacity-60"
            >
              Complete anyway
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="h-11 rounded-full px-4 text-[15px] text-muted-foreground hover:text-foreground">
              Not yet
            </button>
          </div>
        </div>
      ) : (
        <Row
          onClick={() => (left > 0 ? setConfirming(true) : void complete())}
          disabled={busy}
          leading={<Check className="size-5" />}
          title={<span className={cn(left === 0 && steps.length > 0 && "font-medium")}>{busy ? "Completing…" : "Complete milestone"}</span>}
          chevron={false}
        />
      )}
    </Group>
  );
}

/** A round tick, filled once done. */
function Tick({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-[26px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-200",
        done ? "border-kept bg-kept text-white" : "border-input",
      )}
    >
      {done && <Check className="size-4" strokeWidth={3} />}
    </span>
  );
}

/** The milestone's name. Tap it to rename; Enter or leaving the field saves, Escape keeps it. */
function TitleEditor({ title, onSave }: { title: string; onSave: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);

  if (editing) {
    return (
      <input
        autoFocus
        aria-label="Milestone name"
        defaultValue={title}
        maxLength={120}
        enterKeyHint="done"
        onFocus={(e) => e.target.select()}
        onBlur={(e) => {
          setEditing(false);
          if (cancelled.current) cancelled.current = false;
          else onSave(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        className="-mx-2 h-11 w-[calc(100%+1rem)] min-w-0 rounded-xl bg-accent px-2 text-[20px] leading-snug font-medium tracking-tight outline-none"
      />
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="group flex min-h-11 w-full items-center gap-2 text-left">
      <span className="sr-only">Rename milestone: </span>
      <span className="min-w-0 text-[20px] leading-snug font-medium tracking-tight break-words">{title}</span>
      <Pencil className="size-4 shrink-0 text-faint group-hover:text-foreground" aria-hidden />
    </button>
  );
}

function AddStep({ full, onAdd }: { full: boolean; onAdd: (title: string) => void }) {
  const id = useId();
  const [text, setText] = useState("");
  return (
    <form
      className="flex min-h-14 items-center gap-3 pr-2 pl-4"
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t || full) return;
        onAdd(t);
        setText("");
      }}
    >
      <Plus className="size-[22px] shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor={id} className="sr-only">
        New step
      </label>
      <input
        id={id}
        value={text}
        maxLength={60}
        disabled={full}
        enterKeyHint="done"
        onChange={(e) => setText(e.target.value)}
        placeholder={full ? "Twenty steps is the most" : "Add a step"}
        className="h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted-foreground disabled:opacity-60"
      />
      {text.trim() && !full && (
        <button type="submit" className="h-11 shrink-0 rounded-full px-3 text-[15px] font-medium text-foreground hover:bg-accent">
          Add
        </button>
      )}
    </form>
  );
}

function StartForm({ autoFocus, onStarted }: { autoFocus: boolean; onStarted: (milestone: MilestoneItem) => void }) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const t = title.trim();
        if (!t || busy) return;
        setBusy(true);
        const res = await run(() => startMilestone({ title: t }));
        setBusy(false);
        if (res.ok) onStarted(res.data);
      }}
    >
      <label htmlFor={id} className="text-[17px]">
        What&apos;s the next milestone?
      </label>
      <input
        id={id}
        autoFocus={autoFocus}
        value={title}
        maxLength={120}
        enterKeyHint="go"
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Complete TradingView comparison"
        className={field}
      />
      <PrimaryButton type="submit" disabled={busy || !title.trim()}>
        {busy ? "Starting…" : "Start milestone"}
      </PrimaryButton>
    </form>
  );
}
