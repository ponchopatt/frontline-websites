"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveJournal, setReading } from "@/app/actions/day";
import { AutosaveField } from "@/components/autosave-field";
import { formatReading } from "@/lib/bible";
import { ReadingPicker } from "@/components/reading-picker";
import type { LocalDate } from "@/lib/day";

interface BibleJournalProps {
  date: LocalDate;
  locked: boolean;
  reading: { book: string; chapter: number; passage: string | null; suggested: boolean };
  /** Name of the reading plan today's chapter comes from. */
  planLabel: string;
  journal: string;
}

/** The day's chapter and one journal box. Simple on purpose. */
export function BibleJournal({ date, locked, reading: initial, planLabel, journal }: BibleJournalProps) {
  const [reading, setReadingState] = useState(initial);
  const [editing, setEditing] = useState(false);
  const ref = { book: reading.book, chapter: reading.chapter };

  return (
    <section aria-labelledby="soap-heading" className="grid gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="soap-heading" className="text-[26px] leading-tight font-medium tracking-tight">
          {formatReading(reading, reading.passage)}
          {reading.suggested && <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">next in {planLabel}</span>}
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

      <AutosaveField
        label="Journal"
        value={journal}
        multiline
        placeholder="What stood out, and what will I do about it?"
        maxLength={4000}
        disabled={locked}
        inputClassName="min-h-[8rem]"
        onSave={(value) => saveJournal({ date, value, reading: ref })}
        onSaved={() => setReadingState((r) => ({ ...r, suggested: false }))}
      />
      <p className="-mt-3 text-xs text-faint">Tick Read, Journal and Pray on the Today screen.</p>
    </section>
  );
}
