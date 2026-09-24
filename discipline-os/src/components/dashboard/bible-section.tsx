"use client";

import Link from "next/link";
import { useState } from "react";
import { AutosaveField } from "@/components/autosave-field";
import { HabitRow } from "@/components/habit-row";
import { SectionCard } from "@/components/section-card";
import { formatReading } from "@/lib/bible";
import { ReadingPicker } from "@/components/reading-picker";
import { clockTime, type LocalDate } from "@/lib/day";
import type { ActionResult, BibleCheck, BibleState, HabitItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHECKS: Array<{ key: BibleCheck; label: string }> = [
  { key: "reading", label: "Reading" },
  { key: "soap", label: "SOAP" },
  { key: "prayer", label: "Prayer" },
  { key: "application", label: "Application" },
];

interface BibleSectionProps {
  date: LocalDate;
  bible: BibleState;
  godHabits: HabitItem[];
  readOnly: boolean;
  timeZone: string;
  onCheck: (item: BibleCheck, done: boolean) => void;
  onSetReading: (book: string, chapter: number, passage: string | null) => Promise<boolean>;
  onSaveObey: (value: string) => Promise<ActionResult<unknown>>;
  onObeySaved: (value: string) => void;
  onToggleHabit: (habit: HabitItem, done: boolean) => void;
}

export function BibleSection({
  date,
  bible,
  godHabits,
  readOnly,
  timeZone,
  onCheck,
  onSetReading,
  onSaveObey,
  onObeySaved,
  onToggleHabit,
}: BibleSectionProps) {
  const [editing, setEditing] = useState(false);
  const done = CHECKS.filter((c) => bible.checks[c.key]).length + godHabits.filter((h) => h.completedAt).length;
  const total = CHECKS.length + godHabits.length;

  return (
    <SectionCard id="bible" title="Bible" meta={`${done} of ${total}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-[19px] font-medium tracking-tight">
          {formatReading(bible, bible.passage)}
          {bible.suggested && <span className="ml-2 text-sm font-normal text-muted-foreground">next in order</span>}
        </p>
        {!readOnly && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 shrink-0 px-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Change
          </button>
        )}
      </div>

      {editing && (
        <ReadingPicker
          className="mb-4"
          value={bible}
          onCancel={() => setEditing(false)}
          onSave={async (book, chapter, passage) => {
            const saved = await onSetReading(book, chapter, passage);
            if (saved) setEditing(false);
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Bible study">
        {CHECKS.map((c) => {
          const on = bible.checks[c.key];
          return (
            <button
              key={c.key}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={readOnly}
              onClick={() => onCheck(c.key, !on)}
              className={cn(
                "flex h-12 touch-manipulation items-center justify-center gap-2 rounded-xl border text-[15px] transition-colors duration-200",
                on ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground active:bg-accent",
                readOnly && "cursor-default",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {godHabits.length > 0 && (
        <div className="mt-2">
          {godHabits.map((h) => (
            <HabitRow
              key={h.id}
              name={h.name}
              done={Boolean(h.completedAt)}
              time={h.completedAt ? clockTime(h.completedAt, timeZone) : null}
              edited={Boolean(h.editedAt)}
              disabled={readOnly}
              onToggle={(d) => onToggleHabit(h, d)}
            />
          ))}
        </div>
      )}

      <AutosaveField
        key={`${date}-obey`}
        className="mt-4"
        label="What will I obey today?"
        value={bible.obeyToday}
        maxLength={500}
        disabled={readOnly}
        onSave={onSaveObey}
        onSaved={onObeySaved}
      />
      <Link
        href={date ? `/bible?d=${date}` : "/bible"}
        className="mt-2 inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Write SOAP notes
      </Link>
    </SectionCard>
  );
}
