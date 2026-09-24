"use client";

import { useState } from "react";
import { saveBotNotes } from "@/app/actions/bot";
import { AutosaveField } from "@/components/autosave-field";
import { Group, Row } from "@/components/os";
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

      <Group
        title="Done milestones"
        action={done.length > 0 ? <span className="text-[15px] text-muted-foreground">{done.length}</span> : undefined}
      >
        {done.length === 0 ? (
          <p className="px-4 py-4 text-[15px] text-muted-foreground">Milestones you finish are kept here.</p>
        ) : (
          done.map((m) => <Row key={m.id} title={<span className="break-words">{m.title}</span>} value={m.doneOn ? <span className="text-[15px]">{doneLabel(m.doneOn, today)}</span> : undefined} />)
        )}
      </Group>

      <Group title="Notes" plain>
        <div className="p-4">
          <AutosaveField
            label="Important findings"
            multiline
            value={notes}
            maxLength={4000}
            placeholder="What you've found, so it isn't lost"
            onSave={saveNotes}
            inputClassName="min-h-[7rem] text-[17px]"
          />
        </div>
      </Group>
    </>
  );
}
