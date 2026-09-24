"use client";

import { Check, Pencil, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { completeMilestone, saveMilestone, startMilestone } from "@/app/actions/bot";
import { CheckChip } from "@/components/check-chip";
import { Meter } from "@/components/meter";
import { SectionCard } from "@/components/section-card";
import type { MilestoneItem, MilestoneStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { run } from "./run";

const MAX_STEPS = 20;
const field =
  "h-12 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-[16px] outline-none placeholder:text-faint focus-visible:border-primary/70 disabled:opacity-60";

interface MilestoneCardProps {
  initial: MilestoneItem | null;
  onCompleted: (milestone: { id: string; title: string }) => void;
}

/**
 * The bot's one current milestone: its steps to tick, and "Complete milestone". With none
 * running, just the question of what's next.
 */
export function MilestoneCard({ initial, onCompleted }: MilestoneCardProps) {
  const [milestone, setMilestone] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // Straight after completing one, the next question takes the focus.
  const [justFinished, setJustFinished] = useState(false);

  if (!milestone) {
    return (
      <SectionCard title="Milestone">
        <StartForm autoFocus={justFinished} onStarted={setMilestone} />
      </SectionCard>
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
    <SectionCard
      title="Milestone"
      meta={
        <span>
          <span className="text-foreground">{Math.round(ratio * 100)}%</span> done
        </span>
      }
    >
      <TitleEditor title={title} onSave={(t) => void rename(t)} />
      <Meter value={ratio} label="Milestone progress" className="mt-3" />
      <p className="mt-2 text-sm text-muted-foreground">
        {doneCount} of {steps.length} {steps.length === 1 ? "step" : "steps"} done
      </p>

      {steps.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {steps.map((s, i) => (
            // Steps have no ids; a step is its place in the list.
            <li key={`${i}:${s.title}`} className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-1">
              <CheckChip
                label={s.title}
                done={s.done}
                onToggle={(done) => void saveSteps(steps.map((x, j) => (j === i ? { ...x, done } : x)))}
              />
              <button
                type="button"
                onClick={() => removeStep(i)}
                aria-label={`Remove step: ${s.title}`}
                className="grid size-11 place-items-center rounded-full text-faint hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AddStep full={steps.length >= MAX_STEPS} onAdd={(t) => void saveSteps([...steps, { title: t, done: false }])} />

      {confirming ? (
        <div role="alert" className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-4 text-[15px]">
          <p>
            {left === 1 ? "1 step isn't" : `${left} steps aren't`} ticked yet. Complete the milestone anyway?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void complete()}
              className="h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Complete anyway
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="h-11 rounded-full px-4 text-sm text-muted-foreground hover:text-foreground">
              Not yet
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => (left > 0 ? setConfirming(true) : void complete())}
          className={cn(
            "mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium active:scale-[0.99] disabled:opacity-60",
            left === 0 ? "bg-primary text-primary-foreground" : "border border-primary/60 text-primary",
          )}
        >
          <Check className="size-4" aria-hidden />
          {busy ? "Completing…" : "Complete milestone"}
        </button>
      )}
    </SectionCard>
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
        className={cn(field, "text-[20px]")}
      />
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="group flex min-h-12 w-full items-start gap-2 text-left">
      <span className="sr-only">Rename milestone: </span>
      <span className="min-w-0 text-[22px] leading-snug font-medium tracking-tight break-words">{title}</span>
      <Pencil className="mt-2 size-4 shrink-0 text-faint group-hover:text-foreground" aria-hidden />
    </button>
  );
}

function AddStep({ full, onAdd }: { full: boolean; onAdd: (title: string) => void }) {
  const id = useId();
  const [text, setText] = useState("");
  return (
    <form
      className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t || full) return;
        onAdd(t);
        setText("");
      }}
    >
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
        className={field}
      />
      <button
        type="submit"
        disabled={full || !text.trim()}
        className="h-12 rounded-full border border-primary/60 px-5 text-sm font-medium text-primary disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}

function StartForm({ autoFocus, onStarted }: { autoFocus: boolean; onStarted: (milestone: MilestoneItem) => void }) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-2"
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
      <label htmlFor={id} className="text-[15px]">
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
      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Starting…" : "Start milestone"}
      </button>
    </form>
  );
}
