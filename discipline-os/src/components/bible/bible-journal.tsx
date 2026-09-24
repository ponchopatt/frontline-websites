"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveBibleText, setReading } from "@/app/actions/day";
import { AutosaveField } from "@/components/autosave-field";
import { formatReading } from "@/lib/bible";
import { ReadingPicker } from "@/components/reading-picker";
import type { LocalDate } from "@/lib/day";
import type { BibleTextField } from "@/lib/types";

const FIELDS: Array<{ key: BibleTextField; label: string; hint: string; multiline: boolean }> = [
  { key: "scripture_notes", label: "Scripture", hint: "The verse that stood out, written out.", multiline: true },
  { key: "observation", label: "Observation", hint: "What does it say? What does it show about God?", multiline: true },
  { key: "application", label: "Application", hint: "What does it mean for me today?", multiline: true },
  { key: "prayer", label: "Prayer", hint: "Answer it back to God.", multiline: true },
  { key: "obey_today", label: "What will I obey today?", hint: "", multiline: false },
];

interface BibleJournalProps {
  date: LocalDate;
  locked: boolean;
  reading: { book: string; chapter: number; passage: string | null; suggested: boolean };
  entry: Record<BibleTextField, string>;
}

export function BibleJournal({ date, locked, reading: initial, entry }: BibleJournalProps) {
  const [reading, setReadingState] = useState(initial);
  const [editing, setEditing] = useState(false);
  const ref = { book: reading.book, chapter: reading.chapter };

  return (
    <section aria-labelledby="soap-heading" className="grid gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="soap-heading" className="text-[26px] leading-tight font-medium tracking-tight">
          {formatReading(reading, reading.passage)}
          {reading.suggested && <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">next in order</span>}
        </h2>
        {!locked && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="min-h-11 shrink-0 px-1 text-sm text-muted-foreground hover:text-foreground">
            Change
          </button>
        )}
      </div>
      {locked && <p className="-mt-3 text-sm text-muted-foreground">This day is completed. Reopen it on Today to edit these notes.</p>}

      {editing && (
        <ReadingPicker
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

      {FIELDS.map((f) => (
        <div key={f.key} className="grid gap-1">
          <AutosaveField
            label={f.label}
            value={entry[f.key]}
            multiline={f.multiline}
            maxLength={f.key === "obey_today" ? 500 : 4000}
            disabled={locked}
            inputClassName={f.multiline ? "min-h-[6.5rem]" : undefined}
            onSave={(value) => saveBibleText({ date, field: f.key, value, reading: ref })}
            onSaved={() => setReadingState((r) => ({ ...r, suggested: false }))}
          />
          {f.hint && <p className="text-xs text-faint">{f.hint}</p>}
        </div>
      ))}
    </section>
  );
}
