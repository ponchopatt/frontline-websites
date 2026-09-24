"use client";

import { Check, Flame, ShieldCheck, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ReplayList } from "@/components/replay-list";
import { ScoreRing } from "@/components/score-ring";
import { AREA_SHORT } from "@/lib/areas";
import { verdictLine, type CloseSummary, type Verdict } from "@/lib/close-day";
import { formatDuration, weekdayName, dayMonth, type LocalDate } from "@/lib/day";
import type { ReplayEvent } from "@/lib/replay";
import { cn } from "@/lib/utils";

export interface DayCompleteData {
  date: LocalDate;
  score: number;
  made: number;
  kept: number;
  workMinutes: number;
  minimum: "on" | "secured" | null;
  /** The summary stored when the day was closed; older days don't have one. */
  summary: CloseSummary | null;
  replay: ReplayEvent[];
}

interface DayCompleteProps {
  data: DayCompleteData | null;
  threshold: number;
  timeZone: string;
  /** "Day complete" right after closing; the date's name when looking back. */
  heading?: string;
  onClose: () => void;
}

/**
 * The end of the day, full screen: the number, what it's made of, what got done, records
 * broken, and the replay. One quiet moment: the ring fills once, nothing else moves.
 */
export function DayComplete({ data, threshold, timeZone, heading = "Day complete", onClose }: DayCompleteProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (data && !d.open) d.showModal();
    if (!data && d.open) d.close();
    if (!data) return;
    const t = setTimeout(() => setShown(data.score), 80);
    return () => clearTimeout(t);
  }, [data]);

  const s = data?.summary ?? null;
  const verdict: Verdict | null = data ? (s?.verdict ?? (data.score >= threshold ? "kept" : data.minimum === "secured" ? "minimum" : "short")) : null;
  const areas = s ? (Object.entries(s.byArea) as Array<[keyof typeof AREA_SHORT, number]>).filter(([, m]) => m >= 1) : [];

  return (
    <dialog
      ref={ref}
      aria-label={heading}
      onClose={() => {
        setShown(0);
        onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-background p-0 text-foreground backdrop:bg-background open:animate-in open:fade-in-0 open:duration-300"
    >
      {data && verdict && (
        <div className="mx-auto grid max-w-xl gap-8 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <p className="text-[15px] text-muted-foreground">
              {weekdayName(data.date)} {dayMonth(data.date)}
            </p>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="-mr-2 grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent">
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <section className="grid justify-items-center gap-4 text-center">
            <p className="inline-flex items-center gap-2 text-[15px] text-kept">
              <Check className="size-4" aria-hidden />
              {heading}
            </p>
            <ScoreRing score={shown} threshold={threshold} size={176} stroke={3} suffix="%" label="Kept my word" />
            <p className="flex items-center gap-2 text-[19px] leading-snug font-medium">
              {verdict === "kept" && <Flame className="size-5 text-primary" aria-hidden />}
              {verdict === "minimum" && <ShieldCheck className="size-5 text-kept" aria-hidden />}
              {verdictLine(verdict, data.score)}
            </p>
          </section>

          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Focused work" value={formatDuration(s?.workMinutes ?? data.workMinutes)} of={s && s.workTargetMinutes > 0 ? formatDuration(s.workTargetMinutes) : null} />
            <Stat label="Commitments kept" value={`${s?.kept ?? data.kept}/${s?.made ?? data.made}`} of={null} />
            {s && <Stat label="Tasks done" value={`${s.tasks.done}/${s.tasks.total}`} of={null} />}
            {s && <Stat label="Habits done" value={`${s.habits.done}/${s.habits.total}`} of={null} />}
          </dl>

          {areas.length > 0 && (
            <p className="-mt-4 text-center text-sm text-muted-foreground">
              {areas.map(([a, m]) => `${AREA_SHORT[a]} ${formatDuration(m)}`).join(" · ")}
            </p>
          )}

          {s && s.records.length > 0 && (
            <section aria-label="Personal records" className="grid gap-2">
              {s.records.map((r) => (
                <div key={r.key} className="flex gap-3 rounded-2xl border border-primary/30 bg-lamp-soft p-4">
                  <Trophy className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <div className="grid gap-0.5">
                    <p className="text-sm text-primary">New personal record</p>
                    <p className="text-[17px] font-medium">{r.text}</p>
                    <p className="text-sm text-muted-foreground">Previous record: {r.previous}</p>
                  </div>
                </div>
              ))}
            </section>
          )}

          {s && s.achievements.length > 0 && (
            <section aria-labelledby="done-heading" className="grid gap-2">
              <h2 id="done-heading" className="text-lg font-medium tracking-tight">
                What got done
              </h2>
              <ul className="grid gap-1.5">
                {s.achievements.map((a) => (
                  <li key={a} className="flex items-center gap-2.5 text-[15px]">
                    <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-kept-soft text-kept">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="replay-heading" className="grid gap-2">
            <h2 id="replay-heading" className="text-lg font-medium tracking-tight">
              The day
            </h2>
            <ReplayList events={data.replay} timeZone={timeZone} />
          </section>

          <button type="button" onClick={() => ref.current?.close()} className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground">
            Done
          </button>
        </div>
      )}
    </dialog>
  );
}

function Stat({ label, value, of }: { label: string; value: string; of: string | null }) {
  return (
    <div className={cn("grid gap-0.5 rounded-2xl border border-glass-edge bg-glass px-4 py-3")}>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-[22px] leading-tight tabular-nums">
        {value}
        {of && <span className="text-[15px] text-muted-foreground"> / {of}</span>}
      </dd>
    </div>
  );
}
