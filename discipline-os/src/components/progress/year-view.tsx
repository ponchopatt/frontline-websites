"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { dayDetails, type DayDetails } from "@/app/actions/day";
import { ReplayList } from "@/components/replay-list";
import { ScoreRing } from "@/components/score-ring";
import { Sheet } from "@/components/sheet";
import { verdictLine } from "@/lib/close-day";
import { addDays, formatDuration, isoWeekday, shortDate, type LocalDate } from "@/lib/day";
import type { DayState, YearDay } from "@/lib/history";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FILL: Record<DayState, string> = {
  strong: "bg-kept",
  average: "bg-kept/45",
  poor: "bg-kept/18",
  none: "bg-border",
  future: "border border-border/60",
  before: "bg-border/35",
};

const WORD: Record<DayState, string> = {
  strong: "strong",
  average: "average",
  poor: "poor",
  none: "not completed",
  future: "",
  before: "",
};

interface YearViewProps {
  days: YearDay[];
  today: LocalDate;
  threshold: number;
  timeZone: string;
}

function tappable(state: DayState | undefined): boolean {
  return state !== undefined && state !== "future" && state !== "before";
}

/**
 * The year in squares: one per day, sage by how much of the word was kept. A ring marks a
 * secured minimum day. Tap a day for its numbers and replay; the arrows step to the days either
 * side, so a square missed by a thumb is one tap to put right.
 */
export function YearView({ days, today, threshold, timeZone }: YearViewProps) {
  const [open, setOpen] = useState<LocalDate | null>(null);
  const [details, setDetails] = useState<DayDetails | null>(null);
  // The day asked for last. Stepping quickly, an older answer arriving late is dropped.
  const asked = useRef<LocalDate | null>(null);
  const stateOf = new Map(days.map((d) => [d.date, d.state]));
  const prev = open ? addDays(open, -1) : null;
  const next = open ? addDays(open, 1) : null;

  async function show(date: LocalDate) {
    asked.current = date;
    setOpen(date);
    setDetails(null);
    try {
      const res = await dayDetails({ date });
      if (asked.current !== date) return;
      if (res.ok) setDetails(res.data);
      else toast.error(res.error);
    } catch {
      if (asked.current === date) toast.error("That day couldn't be loaded. Check your connection and try again.");
    }
  }

  const months = MONTHS.map((label, m) => {
    const list = days.filter((d) => Number(d.date.slice(5, 7)) === m + 1);
    return { label, list, lead: list.length ? isoWeekday(list[0].date) - 1 : 0 };
  });

  return (
    <>
      <div className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-4">
        {months.map((month) => (
          <div key={month.label} className="grid content-start gap-1.5">
            <p className="text-[13px] text-muted-foreground">{month.label}</p>
            <ol className="grid grid-cols-7 gap-[3px]">
              {Array.from({ length: month.lead }, (_, i) => (
                <li key={`lead-${i}`} aria-hidden />
              ))}
              {month.list.map((d) => {
                const canTap = tappable(d.state);
                const label = `${shortDate(d.date)}: ${canTap ? `${d.score}%, ${WORD[d.state]}${d.minimum === "secured" ? ", minimum day secured" : ""}` : d.state === "future" ? "to come" : "before you started"}`;
                return (
                  <li key={d.date} className="aspect-square">
                    {/* A square's tap area reaches halfway across the gap to each neighbour, so no tap lands on nothing. */}
                    {canTap ? (
                      <button
                        type="button"
                        aria-label={label}
                        onClick={() => void show(d.date)}
                        className={cn(
                          "relative block size-full rounded-[3px] transition-transform before:absolute before:-inset-[1.5px] active:scale-90",
                          FILL[d.state],
                          d.minimum === "secured" && "ring-1 ring-primary ring-inset",
                          d.date === today && "outline outline-1 outline-offset-1 outline-foreground",
                        )}
                      />
                    ) : (
                      <span aria-label={label} role="img" className={cn("block size-full rounded-[3px]", FILL[d.state])} />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted-foreground" aria-label="Key">
        <Key className="bg-kept">Strong ({threshold}%+)</Key>
        <Key className="bg-kept/45">Average</Key>
        <Key className="bg-kept/18">Poor</Key>
        <Key className="bg-border">Not completed</Key>
        <Key className="bg-kept/18 ring-1 ring-primary ring-inset">Minimum day</Key>
      </ul>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? shortDate(open) : "Day"}>
        <div className="-mt-1 mb-3 flex items-center justify-between gap-3">
          <DayStep label="Previous day" disabled={!prev || !tappable(stateOf.get(prev))} onClick={() => prev && void show(prev)}>
            <ChevronLeft className="size-5" aria-hidden />
          </DayStep>
          <DayStep label="Next day" disabled={!next || !tappable(stateOf.get(next))} onClick={() => next && void show(next)}>
            <ChevronRight className="size-5" aria-hidden />
          </DayStep>
        </div>
        {!details ? (
          <p className="py-6 text-[15px] text-muted-foreground">Loading the day…</p>
        ) : (
          <div className="grid gap-5">
            <div className="flex items-center gap-4">
              <ScoreRing score={details.score} threshold={threshold} size={84} suffix="%" label={details.locked ? "Kept my word" : "Keep my word"} />
              <div className="grid gap-0.5 text-[15px]">
                <p>
                  <span className="text-foreground">{details.kept}</span> <span className="text-muted-foreground">of {details.made} commitments kept</span>
                </p>
                <p className="text-muted-foreground">{formatDuration(details.workMinutes)} focused work</p>
                <p className={cn("text-sm", details.locked ? "text-kept" : "text-muted-foreground")}>
                  {details.closed ? verdictLine(details.closed.verdict, details.closed.score) : details.locked ? "Closed." : "Not closed."}
                  {details.minimum && ` Minimum day${details.minimum === "secured" ? " secured" : ""}.`}
                </p>
              </div>
            </div>
            {details.closed && details.closed.achievements.length > 0 && (
              <ul className="grid gap-1 text-[15px]">
                {details.closed.achievements.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span aria-hidden className="text-kept">✓</span>
                    {a}
                  </li>
                ))}
              </ul>
            )}
            <ReplayList events={details.replay} timeZone={timeZone} />
            <Link href={details.date === today ? "/" : `/?d=${details.date}`} className="inline-flex h-12 items-center justify-center rounded-full border border-border text-[15px] hover:bg-accent">
              Open this day
            </Link>
          </div>
        )}
      </Sheet>
    </>
  );
}

function DayStep({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full border border-border text-foreground hover:bg-accent disabled:text-faint/60 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-3 rounded-[3px]", className)} />
      {children}
    </li>
  );
}
