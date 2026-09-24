"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { AutosaveField } from "@/components/autosave-field";
import { SectionCard } from "@/components/section-card";
import { clockTime, type LocalDate } from "@/lib/day";
import { wordCaption, type WordResult } from "@/lib/keep-word";
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
}

export function ReviewSection({
  date,
  isToday,
  review,
  word,
  threshold,
  timeZone,
  locked,
  timerRunningToday,
  onSave,
  onSaved,
  onComplete,
  onReopen,
}: ReviewSectionProps) {
  const [confirming, setConfirming] = useState(false);
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
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Lock className="size-4 text-primary" aria-hidden />
              <p className="text-[15px]">
                Completed at {clockTime(locked.completedAt, timeZone)}. Kept my word:{" "}
                <span className="text-foreground">{locked.score}%</span>.
              </p>
            </div>
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
        ) : confirming ? (
          <div className="grid gap-3">
            <p className="text-[15px]">
              Lock {isToday ? "today" : "this day"} with <span className="text-foreground">{word.kept} of {word.made}</span> kept (
              {word.percent ?? 0}%)? {wordCaption(word, threshold)} You can reopen it later.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onComplete();
                  setBusy(false);
                  setConfirming(false);
                }}
                className="h-12 flex-1 rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Completing…" : "Complete day"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="h-12 rounded-full px-5 text-[15px] text-muted-foreground hover:text-foreground">
                Not yet
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[15px] text-muted-foreground">
              Keep my word: <span className="text-foreground">{word.kept} of {word.made}</span> commitments kept today.
            </p>
            <button
              type="button"
              disabled={timerRunningToday}
              onClick={() => setConfirming(true)}
              className="h-12 w-full rounded-full border border-primary/70 text-[15px] font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-primary"
            >
              Complete day
            </button>
            {timerRunningToday && <p className="mt-2 text-sm text-muted-foreground">Stop the running timer first.</p>}
          </>
        )}
      </div>
    </SectionCard>
  );
}
