"use client";

import { ArrowDownToLine, ArrowUpToLine, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { AREAS, AREA_SHORT, type Area } from "@/lib/areas";
import type { LocalDate } from "@/lib/day";
import type { ProofItem, TaskItem, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProofButton } from "./proof";

export interface TaskPatch {
  title?: string;
  area?: Area | null;
  category?: string | null;
  priority?: 1 | 2 | 3;
  dueDate?: LocalDate | null;
  notes?: string | null;
}

interface TaskSheetProps {
  task: TaskItem | null;
  date: LocalDate;
  readOnly: boolean;
  onClose: () => void;
  onSave: (task: TaskItem, patch: TaskPatch) => void;
  onStatus: (task: TaskItem, status: TaskStatus) => void;
  onRank: (task: TaskItem, rank: 1 | 2 | 3 | null) => void;
  onMove: (task: TaskItem, to: "today" | "later") => void;
  onDelete: (task: TaskItem) => void;
  onProof: (proof: ProofItem) => void;
}

const field = "w-full rounded-xl border border-input bg-transparent px-3 text-[16px] outline-none focus-visible:border-primary/70";

/** Everything about one task, for when the quick version isn't enough. */
export function TaskSheet(props: TaskSheetProps) {
  const { task } = props;
  return (
    <Sheet open={task !== null} onClose={props.onClose} title="Task">
      {task && <TaskForm key={task.id} {...props} task={task} />}
    </Sheet>
  );
}

function TaskForm({ task, date, readOnly, onClose, onSave, onStatus, onRank, onMove, onDelete, onProof }: TaskSheetProps & { task: TaskItem }) {
  const [title, setTitle] = useState(task.title);
  const [area, setArea] = useState<Area | null>(task.area);
  const [category, setCategory] = useState(task.category ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [due, setDue] = useState(task.dueDate ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const onDay = task.localDate === date;
  const dropped = task.status === "dropped";

  function save() {
    const patch: TaskPatch = {};
    if (title.trim() && title.trim() !== task.title) patch.title = title.trim();
    if (area !== task.area) patch.area = area;
    if ((category.trim() || null) !== task.category) patch.category = category.trim() || null;
    if (priority !== task.priority) patch.priority = priority;
    if ((due || null) !== task.dueDate) patch.dueDate = due || null;
    if ((notes.trim() || null) !== task.notes) patch.notes = notes.trim() || null;
    if (Object.keys(patch).length > 0) onSave(task, patch);
    onClose();
  }

  const chip = (on: boolean) => cn("h-11 rounded-xl border px-3 text-sm transition-colors", on ? "border-primary bg-lamp-soft text-foreground" : "border-border text-muted-foreground");

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="grid gap-1.5 text-sm text-muted-foreground">
        Task
        <textarea
          value={title}
          maxLength={140}
          rows={1}
          disabled={readOnly}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          className={cn(field, "min-h-12 resize-none py-2.5 text-[17px] text-foreground [field-sizing:content]")}
        />
      </label>

      {onDay && !readOnly && (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm text-muted-foreground">Today&apos;s Big 3</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {([1, 2, 3] as const).map((r) => (
              <button key={r} type="button" aria-pressed={task.rank === r} onClick={() => onRank(task, r)} className={chip(task.rank === r)}>
                #{r}
              </button>
            ))}
            <button type="button" aria-pressed={task.rank === null} onClick={() => onRank(task, null)} className={chip(task.rank === null)}>
              Not in 3
            </button>
          </div>
        </fieldset>
      )}

      <fieldset className="grid gap-1.5" disabled={readOnly}>
        <legend className="mb-1.5 text-sm text-muted-foreground">Area</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {AREAS.map((a) => (
            <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(area === a ? null : a)} className={cn(chip(area === a), "min-w-0 truncate px-1")}>
              {AREA_SHORT[a]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1.5 text-sm text-muted-foreground">
          Priority
          <select value={priority} disabled={readOnly} onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)} className={cn(field, "h-12")}>
            <option value={1}>High</option>
            <option value={2}>Normal</option>
            <option value={3}>Low</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm text-muted-foreground">
          Due date
          <input type="date" value={due} disabled={readOnly} onChange={(e) => setDue(e.target.value)} className={cn(field, "h-12")} />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm text-muted-foreground">
        Category <span className="text-faint">(optional, e.g. Sales)</span>
        <input value={category} maxLength={40} disabled={readOnly} onChange={(e) => setCategory(e.target.value)} className={cn(field, "h-12")} />
      </label>

      <label className="grid gap-1.5 text-sm text-muted-foreground">
        Notes
        <textarea
          value={notes}
          maxLength={1000}
          rows={2}
          disabled={readOnly}
          onChange={(e) => setNotes(e.target.value)}
          className={cn(field, "min-h-20 resize-none py-2.5 [field-sizing:content]")}
        />
      </label>

      {task.chain?.yearly && (
        <p className="text-sm text-muted-foreground">
          Supports <span className="text-foreground">{task.chain.weekly?.title ?? task.chain.yearly.title}</span>
          {task.chain.weekly && <> · {task.chain.yearly.title}</>}
        </p>
      )}

      {!readOnly && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3">
          {task.localDate && <ProofButton date={task.localDate} taskId={task.id} label={task.title} onUploaded={onProof} />}
          {onDay && (
            <button
              type="button"
              onClick={() => onStatus(task, dropped ? "pending" : "dropped")}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              {dropped ? <RotateCcw className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
              {dropped ? "Bring back" : "Drop it"}
            </button>
          )}
          {task.localDate === null ? (
            <button type="button" onClick={() => onMove(task, "today")} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowUpToLine className="size-4" aria-hidden />
              Do it today
            </button>
          ) : (
            task.status !== "done" && (
              <button type="button" onClick={() => onMove(task, "later")} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ArrowDownToLine className="size-4" aria-hidden />
                Move to later
              </button>
            )
          )}
          {confirmDelete ? (
            <button type="button" onClick={() => onDelete(task)} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary">
              <Trash2 className="size-4" aria-hidden />
              Yes, delete it
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Trash2 className="size-4" aria-hidden />
              Delete
            </button>
          )}
        </div>
      )}

      {!readOnly && (
        <button type="submit" className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground">
          Save
        </button>
      )}
      {dropped && <p className="text-sm text-muted-foreground">Dropped tasks still count as made, not kept. Drop means you chose not to do it.</p>}
    </form>
  );
}
