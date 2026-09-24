"use client";

import { Archive, ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createHabit, moveHabit, renameHabit, saveMinimumDay, setHabitArchived, setHabitDays } from "@/app/actions/habits";
import { Group, PageHeader, PrimaryButton, Row, TextAction } from "@/components/os";
import { Sheet } from "@/components/sheet";
import type { HabitStats } from "@/lib/data";
import type { ActionResult, HabitCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WEEKDAY_NAMES, WEEKDAY_SHORT, daysLabel } from "./days";

const SECTIONS: Array<{ key: HabitCategory; title: string; note?: string }> = [
  { key: "morning", title: "Morning routine", note: "Bible, Journal and Pray also show under Faith." },
  { key: "god", title: "Faith" },
  { key: "body", title: "Fitness" },
  { key: "discipline", title: "Discipline" },
];

const SECTION_TITLE = Object.fromEntries(SECTIONS.map((s) => [s.key, s.title])) as Record<HabitCategory, string>;

const field = "h-12 w-full rounded-xl border border-input bg-transparent px-3 text-[17px] text-foreground outline-none focus-visible:border-primary/70";

function pct(v: number | null) {
  return v === null ? "–" : `${Math.round(v * 100)}%`;
}

function dueLine(days: number[] | null) {
  return days && days.length < 7 ? `Due ${days.length} ${days.length === 1 ? "day" : "days"} a week` : "Due every day";
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

interface HabitsManagerProps {
  initial: HabitStats[];
  /** ISO weekday of the day being shown, to say whether today is a rest day. */
  weekday: number;
  /** The Minimum Day as saved: which habits, and the work and fitness that go with them. */
  minimum: { habitIds: string[]; workMinutes: number; fitness: boolean };
  /** The streak figures and history, rendered on the server, between the title and the lists. */
  children?: ReactNode;
}

/**
 * Every habit as a calm list, grouped by part of the day. Tap one for everything about it:
 * its name, the days it's due, its place in the minimum day, its order, and archiving.
 */
export function HabitsManager({ initial, weekday, minimum, children }: HabitsManagerProps) {
  const router = useRouter();
  const [habits, setHabits] = useState(initial);
  const [minimumIds, setMinimumIds] = useState(() => new Set(minimum.habitIds));
  const [savingMinimum, setSavingMinimum] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const active = useMemo(() => habits.filter((h) => !h.archivedAt), [habits]);
  const archived = useMemo(() => habits.filter((h) => h.archivedAt), [habits]);
  const open = habits.find((h) => h.id === openId) ?? null;

  function inSection(category: HabitCategory) {
    return active.filter((h) => h.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async function schedule(id: string, days: number[] | null) {
    const before = habits;
    setHabits((list) => list.map((h) => (h.id === id ? { ...h, days } : h)));
    const res = await run(() => setHabitDays({ habitId: id, days }));
    if (!res.ok) setHabits(before);
  }

  async function add(name: string, category: HabitCategory) {
    const res = await run(() => createHabit({ name, category }));
    if (res.ok) {
      setHabits((list) => [
        ...list,
        { ...res.data, kind: null, days: null, archivedAt: null, doneToday: false, week: null, month: null, run: 0 },
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
    const name = habits.find((h) => h.id === id)?.name ?? "the habit";
    setOpenId(null);
    setHabits((list) => list.map((h) => (h.id === id ? { ...h, archivedAt: archivedFlag ? new Date().toISOString() : null } : h)));
    const res = await run(() => setHabitArchived({ habitId: id, archived: archivedFlag }));
    if (!res.ok) setHabits(before);
    else {
      toast.success(archivedFlag ? `Archived “${name}”.` : `Restored “${name}”.`);
      router.refresh();
    }
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

  // The minimum day is saved as a whole, so one habit's switch sends the full list.
  async function setMinimum(id: string, on: boolean) {
    const before = minimumIds;
    const next = new Set(before);
    if (on) next.add(id);
    else next.delete(id);
    setMinimumIds(next);
    setSavingMinimum(true);
    const res = await run(() => saveMinimumDay({ habitIds: [...next], workMinutes: minimum.workMinutes, fitness: minimum.fitness }));
    setSavingMinimum(false);
    if (!res.ok) setMinimumIds(before);
  }

  const siblings = open ? inSection(open.category) : [];
  const index = open ? siblings.findIndex((h) => h.id === open.id) : -1;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader
        back={{ href: "/you", label: "You" }}
        title="Habits"
        subtitle="What you tick each day. Tap one to change it."
        trailing={
          <TextAction onClick={() => setAdding(true)} className="px-2 text-[17px] text-foreground">
            <Plus className="size-5" aria-hidden />
            Add a habit
          </TextAction>
        }
      />

      {children}

      {SECTIONS.map((section) => {
        const list = inSection(section.key);
        return (
          <Group key={section.key} id={`h-${section.key}`} title={section.title} footer={list.length > 0 ? section.note : undefined}>
            {list.length === 0 ? (
              <p className="px-4 py-4 text-[15px] text-muted-foreground">No habits here.</p>
            ) : (
              list.map((h) => <HabitRow key={h.id} habit={h} onOpen={() => setOpenId(h.id)} />)
            )}
          </Group>
        );
      })}

      {archived.length > 0 && (
        <Group id="h-archived" title="Archived" footer="Archived habits are off your days from then on. Every day you did them is kept.">
          {archived.map((h) => (
            <Row key={h.id} onClick={() => setOpenId(h.id)} title={<span className="text-muted-foreground">{h.name}</span>} subtitle={SECTION_TITLE[h.category]} />
          ))}
        </Group>
      )}

      <Sheet
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open?.name ?? "Habit"}
        subtitle={open ? sheetSubtitle(open, weekday) : undefined}
      >
        {open && (
          <HabitDetail
            key={open.id}
            habit={open}
            first={index <= 0}
            last={index === -1 || index === siblings.length - 1}
            minimum={minimumIds.has(open.id)}
            savingMinimum={savingMinimum}
            onRename={(name) => rename(open.id, name)}
            onDays={(days) => schedule(open.id, days)}
            onMinimum={(on) => setMinimum(open.id, on)}
            onMove={(d) => move(open.id, d)}
            onArchive={(flag) => archive(open.id, flag)}
          />
        )}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a habit" subtitle="It's on your days from today.">
        {adding && <AddHabit onAdd={add} onDone={() => setAdding(false)} />}
      </Sheet>
    </div>
  );
}

function sheetSubtitle(habit: HabitStats, weekday: number) {
  const section = SECTION_TITLE[habit.category];
  if (habit.archivedAt) return `${section} · Archived`;
  const due = !habit.days || habit.days.includes(weekday);
  return `${section} · ${habit.doneToday ? "Done today" : due ? "Not done yet today" : "Rest day today"}`;
}

function HabitRow({ habit, onOpen }: { habit: HabitStats; onOpen: () => void }) {
  const days = daysLabel(habit.days);
  const streak = habit.run > 0 ? `${habit.run} in a row` : null;
  return (
    <Row
      onClick={onOpen}
      ariaLabel={`${habit.name}, ${days}${streak ? `, ${streak}` : ""}, ${habit.month === null ? "not due yet" : `${pct(habit.month)} of the last 30 days`}`}
      title={habit.name}
      subtitle={streak ? `${days} · ${streak}` : days}
      value={pct(habit.month)}
    />
  );
}

interface HabitDetailProps {
  habit: HabitStats;
  first: boolean;
  last: boolean;
  minimum: boolean;
  savingMinimum: boolean;
  onRename: (name: string) => void;
  onDays: (days: number[] | null) => void;
  onMinimum: (on: boolean) => void;
  onMove: (direction: "up" | "down") => void;
  onArchive: (archived: boolean) => void;
}

function HabitDetail({ habit, first, last, minimum, savingMinimum, onRename, onDays, onMinimum, onMove, onArchive }: HabitDetailProps) {
  const [name, setName] = useState(habit.name);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const action = "inline-flex min-h-11 items-center gap-1.5 text-[15px] text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground";

  function commitName() {
    const next = name.trim();
    if (!next) setName(habit.name);
    else if (next !== habit.name) onRename(next);
  }

  const figures: Array<[string, string]> = [
    ["Last 7 days", pct(habit.week)],
    ["Last 30 days", pct(habit.month)],
    ["In a row", String(habit.run)],
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 pt-2">
      <dl className="grid grid-cols-3 gap-3" aria-label="How it's going">
        {figures.map(([label, value]) => (
          <div key={label} className="grid gap-0.5">
            <dt className="text-[14px] text-muted-foreground">{label}</dt>
            <dd className="text-[28px] leading-none font-light tracking-tight tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {habit.archivedAt ? (
        <div className="grid gap-4">
          <p className="text-[15px] leading-snug text-muted-foreground">Archived. It&apos;s off your days, and every day you did it is kept. Restore it to bring it back from today.</p>
          <PrimaryButton onClick={() => onArchive(false)} className="w-full">
            Restore
          </PrimaryButton>
        </div>
      ) : (
        <>
          <label className="grid gap-1.5 text-[15px] text-muted-foreground">
            Name
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className={field}
            />
          </label>

          <div className="grid gap-2">
            <p className="text-[15px] text-muted-foreground">Due on</p>
            <div className="grid grid-cols-7 gap-1" role="group" aria-label={`Days ${habit.name} is due`}>
              {WEEKDAY_SHORT.map((d, i) => {
                const day = i + 1;
                const on = !habit.days || habit.days.includes(day);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={WEEKDAY_NAMES[i]}
                    onClick={() => {
                      const current = habit.days ?? [1, 2, 3, 4, 5, 6, 7];
                      const next = on ? current.filter((x) => x !== day) : [...current, day].sort();
                      if (next.length === 0) return;
                      onDays(next.length === 7 ? null : next);
                    }}
                    className={cn(
                      "h-11 min-w-0 rounded-xl text-[14px] transition-colors",
                      on ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <p className="text-[14px] text-muted-foreground">
              {dueLine(habit.days)}
              {habit.days && habit.days.length < 7 ? `: ${daysLabel(habit.days)}` : ""}. Days off don&apos;t break its streak.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 border-y border-border py-2">
            <span className="grid gap-0.5">
              <span className="text-[17px]">Part of the minimum day</span>
              <span className="text-[14px] leading-snug text-muted-foreground">The few things that keep the chain alive on a bad day.</span>
            </span>
            <Switch label="Part of the minimum day" on={minimum} disabled={savingMinimum} onChange={onMinimum} />
          </div>

          {confirmArchive ? (
            <div className="grid gap-3">
              <p className="text-[15px] leading-snug">Archive it? It comes off your days from today, and every day you did it is kept.</p>
              <div className="flex items-center gap-5">
                <PrimaryButton onClick={() => onArchive(true)}>Archive</PrimaryButton>
                <TextAction onClick={() => setConfirmArchive(false)}>Keep it</TextAction>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-6">
              <button type="button" className={action} disabled={first} onClick={() => onMove("up")}>
                <ArrowUp className="size-4" aria-hidden />
                Move up
              </button>
              <button type="button" className={action} disabled={last} onClick={() => onMove("down")}>
                <ArrowDown className="size-4" aria-hidden />
                Move down
              </button>
              <button type="button" className={cn(action, "ml-auto")} onClick={() => setConfirmArchive(true)}>
                <Archive className="size-4" aria-hidden />
                Archive
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** An on/off switch with a 44-point tap area around the track. */
function Switch({ label, on, disabled, onChange }: { label: string; on: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="-mr-1 grid h-11 w-[60px] shrink-0 place-items-center disabled:opacity-60"
    >
      <span aria-hidden className={cn("relative h-[31px] w-[51px] rounded-full transition-colors", on ? "bg-kept" : "bg-foreground/15")}>
        <span className={cn("absolute top-0.5 size-[27px] rounded-full bg-background shadow transition-[left] duration-200", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function AddHabit({ onAdd, onDone }: { onAdd: (name: string, category: HabitCategory) => Promise<boolean>; onDone: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<HabitCategory>("morning");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-5 pt-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        const ok = await onAdd(name.trim(), category);
        setBusy(false);
        if (ok) onDone();
      }}
    >
      <label htmlFor="new-habit" className="grid gap-1.5 text-[15px] text-muted-foreground">
        Habit name
        <input id="new-habit" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Cold shower" className={cn(field, "placeholder:text-faint")} />
      </label>
      <div className="grid gap-2">
        <p id="new-habit-section" className="text-[15px] text-muted-foreground">
          Section
        </p>
        <div role="radiogroup" aria-labelledby="new-habit-section" className="grid grid-cols-2 gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={category === s.key}
              onClick={() => setCategory(s.key)}
              className={cn(
                "min-h-12 rounded-2xl px-3 text-[15px] transition-colors",
                category === s.key ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>
      <PrimaryButton type="submit" disabled={!name.trim() || busy} className="w-full">
        {busy ? "Adding…" : "Add habit"}
      </PrimaryButton>
    </form>
  );
}
