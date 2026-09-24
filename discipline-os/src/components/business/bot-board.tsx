"use client";

import { useState } from "react";
import { saveBotNotes } from "@/app/actions/bot";
import { AutosaveField } from "@/components/autosave-field";
import { SectionCard } from "@/components/section-card";
import { shortDate, type LocalDate } from "@/lib/day";
import type { ActionResult, MilestoneItem } from "@/lib/types";
import { AreaHours } from "./area-hours";
import { MilestoneCard } from "./milestone-card";
import { SAVE_FAILED } from "./run";
import type { DoneMilestone, HoursData } from "./types";

interface BotBoardProps {
  milestone: MilestoneItem | null;
  done: DoneMilestone[];
  notes: string;
  today: LocalDate;
  hours: HoursData;
}

/** "Wed 24 Sep", with the year when it isn't this one. */
function doneLabel(date: LocalDate, today: LocalDate): string {
  return date.slice(0, 4) === today.slice(0, 4) ? shortDate(date) : `${shortDate(date)} ${date.slice(0, 4)}`;
}

/** AutosaveField shows its own error, so this only turns a dropped connection into one. */
async function saveNotes(content: string): Promise<ActionResult> {
  try {
    return await saveBotNotes({ content });
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/** The AI bot: the current milestone, time on it, what's finished, and one place for notes. */
export function BotBoard({ milestone, done: initialDone, notes, today, hours }: BotBoardProps) {
  const [done, setDone] = useState(initialDone);

  return (
    <>
      <MilestoneCard initial={milestone} onCompleted={(m) => setDone((list) => [{ ...m, doneOn: today }, ...list])} />

      <AreaHours data={hours} />

      <SectionCard title="Done milestones" meta={done.length > 0 ? String(done.length) : undefined}>
        {done.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">Milestones you finish are kept here.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {done.map((m) => (
              <li key={m.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <span className="min-w-0 text-[16px] break-words">{m.title}</span>
                {m.doneOn && <span className="shrink-0 text-sm text-muted-foreground">{doneLabel(m.doneOn, today)}</span>}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <section aria-label="Notes" className="border-t border-border pt-6">
        <AutosaveField
          label="Notes"
          multiline
          value={notes}
          maxLength={4000}
          placeholder="Important findings"
          onSave={saveNotes}
          className="[&_label]:text-xl [&_label]:font-medium [&_label]:tracking-tight [&_label]:text-foreground"
        />
      </section>
    </>
  );
}
