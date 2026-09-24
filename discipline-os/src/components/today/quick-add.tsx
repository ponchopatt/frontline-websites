"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { addTask } from "@/app/actions/tasks";
import { AREAS, AREA_SHORT, detectArea, type Area } from "@/lib/areas";
import type { LocalDate } from "@/lib/day";
import type { TaskItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface QuickAddProps {
  date: LocalDate;
  /** Whether a Big 3 slot is free. */
  big3Free: boolean;
  /** Start with "Big 3" ticked (adding from an empty slot). */
  big3Default?: boolean;
  autoFocus?: boolean;
  /** Start with "Later" on: a note to self, kept under the tasks for later. */
  startLater?: boolean;
  onAdded: (task: TaskItem) => void;
  className?: string;
}

const field = "h-11 rounded-xl border border-input bg-transparent px-3 text-[15px] outline-none focus-visible:border-primary/70";

/**
 * Type a task, press Enter. The business is guessed from the words ("Call 10 Imperium
 * leads" → Imperium); everything else is optional and one tap away.
 */
export function QuickAdd({ date, big3Free, big3Default, autoFocus, startLater, onAdded, className }: QuickAddProps) {
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<Area | "auto" | "none">("auto");
  const [big3, setBig3] = useState(Boolean(big3Default) && big3Free);
  const [later, setLater] = useState(Boolean(startLater));
  const [more, setMore] = useState(false);
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const guessed = detectArea(title);
  const shownArea = area === "auto" ? guessed : area === "none" ? null : area;

  async function submit() {
    const text = title.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await addTask({
        date: later ? null : date,
        title: text,
        ...(area === "auto" ? {} : { area: area === "none" ? null : area }),
        big3: big3 && big3Free && !later,
        priority,
        dueDate: due || null,
        notes: notes || null,
      });
      if (!res.ok) toast.error(res.error);
      else {
        onAdded(res.data);
        setTitle("");
        setArea("auto");
        setNotes("");
        setDue("");
        setPriority(2);
        input.current?.focus();
      }
    } catch {
      toast.error("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className={cn("grid gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`quick-${date}`}>
          New task
        </label>
        <input
          ref={input}
          id={`quick-${date}`}
          autoFocus={autoFocus}
          value={title}
          maxLength={140}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => setTitle(e.target.value)}
          placeholder={startLater ? "Remember to…" : "Call 10 Imperium leads"}
          className={cn(field, "min-w-0 flex-1 text-[16px] placeholder:text-faint")}
        />
        <button
          type="submit"
          disabled={!title.trim() || busy}
          aria-label="Add task"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <label className="relative inline-flex h-11 items-center rounded-full border border-border px-3 text-muted-foreground">
          <span className="sr-only">Area</span>
          <span className={cn(shownArea && "text-foreground")}>{shownArea ? AREA_SHORT[shownArea] : "No area"}</span>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as Area | "auto" | "none")}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Area"
          >
            <option value="auto">{guessed ? `Auto (${AREA_SHORT[guessed]})` : "Auto"}</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {AREA_SHORT[a]}
              </option>
            ))}
            <option value="none">No area</option>
          </select>
        </label>
        <Toggle on={big3 && big3Free && !later} disabled={!big3Free || later} onClick={() => setBig3((v) => !v)}>
          Big 3
        </Toggle>
        <Toggle on={later} onClick={() => setLater((v) => !v)}>
          Later
        </Toggle>
        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="h-11 px-2 text-muted-foreground hover:text-foreground">
          {more ? "Less" : "More"}
        </button>
      </div>

      {more && (
        <div className="grid gap-2 pt-1">
          <div role="radiogroup" aria-label="Priority" className="grid grid-cols-3 gap-1.5">
            {([1, 2, 3] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                onClick={() => setPriority(p)}
                className={cn("h-11 rounded-xl border text-sm", priority === p ? "border-primary bg-lamp-soft" : "border-border text-muted-foreground")}
              >
                {p === 1 ? "High" : p === 2 ? "Normal" : "Low"}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Due date
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Notes
            <textarea
              value={notes}
              maxLength={1000}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
              className={cn(field, "h-auto min-h-16 resize-none py-2 [field-sizing:content]")}
            />
          </label>
        </div>
      )}
    </form>
  );
}

function Toggle({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-11 rounded-full border px-3.5 transition-colors disabled:opacity-40",
        on ? "border-primary bg-lamp-soft text-foreground" : "border-border text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
