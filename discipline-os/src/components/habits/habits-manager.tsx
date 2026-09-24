"use client";

import { Archive, ArrowDown, ArrowUp, Check, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createHabit, moveHabit, renameHabit, setHabitArchived } from "@/app/actions/habits";
import type { HabitStats } from "@/lib/data";
import type { ActionResult, HabitCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const SECTIONS: Array<{ key: HabitCategory; title: string; note: string }> = [
  { key: "morning", title: "Morning routine", note: "Counts towards Discipline." },
  { key: "god", title: "God", note: "Alongside the four Bible checks." },
  { key: "body", title: "Body", note: "" },
  { key: "discipline", title: "Discipline", note: "" },
];

function pct(v: number | null) {
  return v === null ? "–" : `${Math.round(v * 100)}%`;
}

async function run<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const res = await action();
    if (!res.ok) toast.error(res.error);
    return res;
  } catch {
    const error = "That didn't save. Check your connection and try again.";
    toast.error(error);
    return { ok: false, error };
  }
}

export function HabitsManager({ initial }: { initial: HabitStats[] }) {
  const router = useRouter();
  const [habits, setHabits] = useState(initial);
  const active = useMemo(() => habits.filter((h) => !h.archivedAt), [habits]);
  const archived = useMemo(() => habits.filter((h) => h.archivedAt), [habits]);

  async function add(name: string, category: HabitCategory) {
    const res = await run(() => createHabit({ name, category }));
    if (res.ok) {
      setHabits((list) => [
        ...list,
        { ...res.data, archivedAt: null, doneToday: false, week: null, month: null, run: 0 },
      ]);
      toast.success(`Added “${res.data.name}”.`);
    }
    return res.ok;
  }

  async function rename(id: string, name: string) {
    const before = habits;
    setHabits((list) => list.map((h) => (h.id === id ? { ...h, name } : h)));
    const res = await run(() => renameHabit({ habitId: id, name }));
    if (!res.ok) setHabits(before);
  }

  async function archive(id: string, archivedFlag: boolean) {
    const before = habits;
    setHabits((list) => list.map((h) => (h.id === id ? { ...h, archivedAt: archivedFlag ? new Date().toISOString() : null } : h)));
    const res = await run(() => setHabitArchived({ habitId: id, archived: archivedFlag }));
    if (!res.ok) setHabits(before);
    else router.refresh();
  }

  async function move(id: string, direction: "up" | "down") {
    const before = habits;
    setHabits((list) => {
      const target = list.find((h) => h.id === id);
      if (!target) return list;
      const siblings = list.filter((h) => h.category === target.category && !h.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder);
      const i = siblings.findIndex((h) => h.id === id);
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= siblings.length) return list;
      [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
      const order = new Map(siblings.map((h, k) => [h.id, k + 1]));
      return list.map((h) => (order.has(h.id) ? { ...h, sortOrder: order.get(h.id)! } : h));
    });
    const res = await run(() => moveHabit({ habitId: id, direction }));
    if (!res.ok) setHabits(before);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <AddHabit onAdd={add} />

      {SECTIONS.map((section) => {
        const list = active.filter((h) => h.category === section.key).sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <section key={section.key} aria-labelledby={`h-${section.key}`} className="border-t border-border pt-6">
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <h2 id={`h-${section.key}`} className="text-xl font-medium tracking-tight">
                {section.title}
              </h2>
              {section.note && <p className="text-sm text-muted-foreground">{section.note}</p>}
            </div>
            {list.length === 0 ? (
              <p className="py-2 text-[15px] text-muted-foreground">No habits here. Add one above.</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {list.map((h, i) => (
                  <HabitStatRow
                    key={h.id}
                    habit={h}
                    first={i === 0}
                    last={i === list.length - 1}
                    onRename={(name) => rename(h.id, name)}
                    onMove={(d) => move(h.id, d)}
                    onArchive={() => archive(h.id, true)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section aria-labelledby="h-archived" className="border-t border-border pt-6">
        <details>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between">
            <h2 id="h-archived" className="text-xl font-medium tracking-tight">
              Archived
            </h2>
            <span className="text-sm text-muted-foreground">{archived.length}</span>
          </summary>
          {archived.length === 0 ? (
            <p className="py-2 text-[15px] text-muted-foreground">
              Nothing archived. Archiving a habit hides it from today on and keeps every day you did it.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {archived.map((h) => (
                <li key={h.id} className="flex min-h-14 items-center justify-between gap-3">
                  <span className="text-[17px] text-muted-foreground">{h.name}</span>
                  <button
                    type="button"
                    onClick={() => archive(h.id, false)}
                    className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </details>
      </section>
    </div>
  );
}

function HabitStatRow({
  habit,
  first,
  last,
  onRename,
  onMove,
  onArchive,
}: {
  habit: HabitStats;
  first: boolean;
  last: boolean;
  onRename: (name: string) => void;
  onMove: (direction: "up" | "down") => void;
  onArchive: () => void;
}) {
  const [name, setName] = useState(habit.name);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const icon = "grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <span
          aria-label={habit.doneToday ? "Done today" : "Not done today"}
          className={cn("size-2 shrink-0 rounded-full", habit.doneToday ? "bg-primary" : "border border-input")}
        />
        <input
          aria-label={`Name of ${habit.name}`}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim();
            if (!next) setName(habit.name);
            else if (next !== habit.name) onRename(next);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-11 min-w-0 flex-1 rounded-md bg-transparent px-1 text-[17px] outline-none focus-visible:bg-accent"
        />
        <button type="button" className={icon} disabled={first} onClick={() => onMove("up")} aria-label={`Move ${habit.name} up`}>
          <ArrowUp className="size-4" aria-hidden />
        </button>
        <button type="button" className={icon} disabled={last} onClick={() => onMove("down")} aria-label={`Move ${habit.name} down`}>
          <ArrowDown className="size-4" aria-hidden />
        </button>
        <button type="button" className={icon} onClick={() => setConfirmArchive((v) => !v)} aria-label={`Archive ${habit.name}`} aria-expanded={confirmArchive}>
          <Archive className="size-4" aria-hidden />
        </button>
      </div>
      <p className="pl-4 text-sm text-muted-foreground">
        7 days <span className="text-foreground">{pct(habit.week)}</span> · 30 days <span className="text-foreground">{pct(habit.month)}</span>
        {habit.run > 0 && (
          <>
            {" "}
            · <span className="text-foreground">{habit.run}</span> in a row
          </>
        )}
      </p>
      {confirmArchive && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-4 text-sm">
          <span className="text-muted-foreground">Archive it? Past days keep it.</span>
          <button type="button" onClick={onArchive} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-4 font-medium text-primary-foreground">
            <Check className="size-4" aria-hidden />
            Archive
          </button>
          <button type="button" onClick={() => setConfirmArchive(false)} className="h-11 px-3 text-muted-foreground hover:text-foreground">
            Keep
          </button>
        </div>
      )}
    </li>
  );
}

function AddHabit({ onAdd }: { onAdd: (name: string, category: HabitCategory) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<HabitCategory>("morning");
  const [busy, setBusy] = useState(false);
  const field = "h-12 rounded-lg border border-input bg-background px-3 text-[16px] outline-none focus-visible:border-primary/70";
  return (
    <form
      className="grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        const ok = await onAdd(name.trim(), category);
        setBusy(false);
        if (ok) setName("");
      }}
    >
      <h2 className="text-xl font-medium tracking-tight">Add a habit</h2>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label className="sr-only" htmlFor="new-habit">
          Habit name
        </label>
        <input
          id="new-habit"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cold shower"
          className={cn(field, "w-full min-w-0 placeholder:text-faint")}
        />
        <label className="sr-only" htmlFor="new-habit-section">
          Section
        </label>
        <select id="new-habit-section" value={category} onChange={(e) => setCategory(e.target.value as HabitCategory)} className={cn(field, "max-w-[11rem]")}>
          {SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={!name.trim() || busy}
        className="h-12 rounded-full border border-primary/70 text-[15px] font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-primary"
      >
        {busy ? "Adding…" : "Add habit"}
      </button>
    </form>
  );
}
