"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { saveJournal, setReading } from "@/app/actions/day";
import { setHabitDone } from "@/app/actions/habits";
import { AutosaveField } from "@/components/autosave-field";
import { Group } from "@/components/os";
import { ReadingPicker } from "@/components/reading-picker";
import { formatReading } from "@/lib/bible";
import type { LocalDate } from "@/lib/day";
import { cn } from "@/lib/utils";

export interface FaithTick {
  id: string;
  label: string;
  done: boolean;
}

interface FaithTodayProps {
  date: LocalDate;
  locked: boolean;
  reading: { book: string; chapter: number; passage: string | null; suggested: boolean };
  /** Name of the reading plan today's chapter comes from. */
  planLabel: string;
  journal: string;
  ticks: FaithTick[];
}

/**
 * The day with God, kept quiet: the chapter, three ticks, and one place to write.
 */
export function FaithToday({ date, locked, reading: initial, planLabel, journal, ticks: initialTicks }: FaithTodayProps) {
  const [reading, setReadingState] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [ticks, setTicks] = useState(initialTicks);
  const ref = { book: reading.book, chapter: reading.chapter };

  async function toggle(t: FaithTick) {
    const done = !t.done;
    setTicks((list) => list.map((x) => (x.id === t.id ? { ...x, done } : x)));
    try {
      const res = await setHabitDone({ habitId: t.id, date, done });
      if (!res.ok) throw new Error(res.error);
    } catch (e) {
      setTicks((list) => list.map((x) => (x.id === t.id ? { ...x, done: t.done } : x)));
      toast.error(e instanceof Error && e.message ? e.message : "That didn't save. Check your connection and try again.");
    }
  }

  return (
    <>
      <section aria-labelledby="reading-heading" className="grid gap-2">
        <p className="text-[15px] text-muted-foreground">{reading.suggested ? `Next in ${planLabel}` : "Today's reading"}</p>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="reading-heading" className="text-[30px] leading-tight font-light tracking-[-0.02em]">
            {formatReading(reading, reading.passage)}
          </h2>
          {!locked && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="min-h-11 shrink-0 px-1 text-[15px] text-muted-foreground hover:text-foreground">
              Change
            </button>
          )}
        </div>
        {editing && (
          <ReadingPicker
            className="surface-light rounded-[22px] border p-4"
            value={reading}
            onCancel={() => setEditing(false)}
            onSave={async (book, chapter, passage) => {
              try {
                const res = await setReading({ date, reading: { book, chapter }, passage });
                if (!res.ok) return void toast.error(res.error);
                setReadingState({ book, chapter, passage, suggested: false });
                setEditing(false);
              } catch {
                toast.error("That didn't save. Check your connection and try again.");
              }
            }}
          />
        )}
        {locked && <p className="text-[15px] text-muted-foreground">This day is complete. Reopen it on Today to change anything.</p>}
      </section>

      {ticks.length > 0 && (
        <Group title="Today">
          {ticks.map((t) => (
            <button
              key={t.id}
              type="button"
              role="checkbox"
              aria-checked={t.done}
              aria-label={t.label}
              disabled={locked}
              onClick={() => void toggle(t)}
              className="flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors active:bg-accent disabled:cursor-default"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
                  t.done ? "border-kept bg-kept text-white" : "border-input",
                )}
              >
                {t.done && <Check className="size-4" strokeWidth={3} />}
              </span>
              <span className={cn("text-[17px]", t.done && "text-muted-foreground")}>{t.label}</span>
            </button>
          ))}
        </Group>
      )}

      <Group title="Journal" plain>
        <div className="p-4">
          <AutosaveField
            label="What stood out, and what will I do about it?"
            value={journal}
            multiline
            placeholder="Write a line or two."
            maxLength={4000}
            disabled={locked}
            inputClassName="min-h-[8rem]"
            onSave={(value) => saveJournal({ date, value, reading: ref })}
            onSaved={() => setReadingState((r) => ({ ...r, suggested: false }))}
          />
        </div>
      </Group>
    </>
  );
}
