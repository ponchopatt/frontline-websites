"use client";

import { Check, Film } from "lucide-react";
import { useState } from "react";
import { AutosaveField } from "@/components/autosave-field";
import { SectionCard } from "@/components/section-card";
import { clockTime, type LocalDate } from "@/lib/day";
import type { WordResult } from "@/lib/keep-word";
import type { ActionResult, ReviewField, ReviewState } from "@/lib/types";
import { REVIEW_FIELDS } from "@/lib/types";

const PROMPTS: Record<ReviewField, string> = {
  accomplished: "What did I accomplish?",
  wasted_time_on: "What did I waste time on?",
  broke_word_where: "Where did I break my word?",
  tomorrow_priority: "What is tomorrow's #1 priority?",
};

interface ReviewSectionProps {
  date: LocalDate;
  isToday: boolean;
  review: ReviewState;
  word: WordResult;
  threshold: number;
  timeZone: string;
  locked: { score: number; completedAt: string } | null;
  timerRunningToday: boolean;
  onSave: (field: ReviewField, value: string) => Promise<ActionResult<unknown>>;
  onSaved: (field: ReviewField, value: string) => void;
  onComplete: () => Promise<void>;
  onReopen: () => Promise<void>;
  onReplay: () => void;
}

export function ReviewSection({
  date,
  isToday,
  review,
  word,
  timeZone,
  locked,
  timerRunningToday,
  onSave,
  onSaved,
  onComplete,
  onReopen,
  onReplay,
}: ReviewSectionProps) {
  const [busy, setBusy] = useState(false);
  const answered = REVIEW_FIELDS.filter((f) => review[f].trim()).length;

  return (
    <SectionCard id="review" title="Night review" meta={`${answered} of ${REVIEW_FIELDS.length}`}>
      <div className="grid gap-4">
        {REVIEW_FIELDS.map((f) => (
          <AutosaveField
            key={`${date}-${f}`}
            label={PROMPTS[f]}
            value={review[f]}
            multiline={f !== "tomorrow_priority"}
            maxLength={f === "tomorrow_priority" ? 120 : 2000}
            disabled={Boolean(locked)}
            onSave={(v) => onSave(f, v)}
            onSaved={(v) => onSaved(f, v)}
          />
        ))}
      </div>

      <div className="mt-6 border-t border-border pt-5" aria-live="polite">
        {locked ? (
          <div className="grid gap-3">
            <p className="inline-flex items-center gap-2 text-[15px]">
              <Check className="size-4 text-kept" aria-hidden />
              <span>
                Closed at {clockTime(locked.completedAt, timeZone)}. Kept my word: <span className="text-foreground">{locked.score}%</span>.
              </span>
            </p>
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={onReplay} className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-accent">
                <Film className="size-4" aria-hidden />
                Replay the day
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onReopen();
                  setBusy(false);
                }}
                className="min-h-11 shrink-0 px-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Reopen day
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[15px] text-muted-foreground">
              Keep my word: <span className="text-foreground">{word.kept} of {word.made}</span> commitments kept {isToday ? "today" : "that day"}.
              {timerRunningToday && " Closing stops the running timer."}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onComplete();
                setBusy(false);
              }}
              className="h-12 w-full rounded-full bg-primary text-[15px] font-medium text-primary-foreground transition-opacity disabled:opacity-60"
            >
              {busy ? "Closing…" : "Close day"}
            </button>
          </>
        )}
      </div>
    </SectionCard>
  );
}
