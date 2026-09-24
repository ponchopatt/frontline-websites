"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { dayDetails, type DayDetails } from "@/app/actions/day";
import { Group } from "@/components/os";
import { ReplayList } from "@/components/replay-list";
import { ScoreRing } from "@/components/score-ring";
import { Sheet } from "@/components/sheet";
import { verdictLine } from "@/lib/close-day";
import { addDays, formatDuration, isoWeekday, shortDate, type LocalDate } from "@/lib/day";
import type { DayState, YearDay } from "@/lib/history";
import { cn } from "@/lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** A square in the year picture. */
const FILL: Record<DayState, string> = {
  strong: "bg-kept",
  average: "bg-kept/45",
  poor: "bg-kept/18",
  none: "bg-border",
  future: "border border-border",
  before: "bg-border/35",
};

/** A day in the month calendar: the same shades, with its number on top. */
const CELL: Record<DayState, string> = {
  strong: "bg-kept text-background",
  average: "bg-kept/45 text-foreground",
  poor: "bg-kept/18 text-foreground",
  none: "bg-border text-muted-foreground",
  future: "text-faint",
  before: "text-faint/60",
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
  year: number;
  days: YearDay[];
  today: LocalDate;
  threshold: number;
  timeZone: string;
  /** The previous and next year links, on the title line. */
  nav?: ReactNode;
}

function tappable(state: DayState | undefined): boolean {
  return state !== undefined && state !== "future" && state !== "before";
}

function dayLabel(d: YearDay): string {
  if (!tappable(d.state)) return `${shortDate(d.date)}: ${d.state === "future" ? "to come" : "before you started"}`;
  return `${shortDate(d.date)}: ${d.score}%, ${WORD[d.state]}${d.minimum === "secured" ? ", minimum day secured" : ""}`;
}

/** "18 strong, 3 average, 1 poor", from what a month holds. */
function monthSummary(list: YearDay[]): string {
  const count = (s: DayState) => list.filter((d) => d.state === s).length;
  const parts = (["strong", "average", "poor", "none"] as const).filter((s) => count(s) > 0).map((s) => `${count(s)} ${WORD[s]}`);
  if (parts.length > 0) return parts.join(", ");
  return list.some((d) => d.state === "future") ? "to come" : "before you started";
}

/**
 * The year in squares: one per day, sage by how much of the word was kept, as a picture. Tap a
 * month to see it as a calendar below, big enough to hit, and tap a day there for its numbers
 * and replay. The arrows in the day step to the days either side.
 */
export function YearView({ year, days, today, threshold, timeZone, nav }: YearViewProps) {
  const months = MONTHS.map((name, m) => {
    const list = days.filter((d) => Number(d.date.slice(5, 7)) === m + 1);
    return { name, list, lead: list.length ? isoWeekday(list[0].date) - 1 : 0, open: list.some((d) => tappable(d.state)) };
  });
  const [month, setMonth] = useState(() => {
    if (today.startsWith(`${year}-`)) return Number(today.slice(5, 7)) - 1;
    const last = months.findLastIndex((m) => m.open);
    return last >= 0 ? last : 0;
  });
  const [open, setOpen] = useState<LocalDate | null>(null);
  const [details, setDetails] = useState<DayDetails | null>(null);
  // The day asked for last. Stepping quickly, an older answer arriving late is dropped.
  const asked = useRef<LocalDate | null>(null);
  const stateOf = new Map(days.map((d) => [d.date, d.state]));
  const prev = open ? addDays(open, -1) : null;
  const next = open ? addDays(open, 1) : null;

  const shown = months[month];
  const scored = shown.list.filter((d) => tappable(d.state));
  const average = scored.length ? Math.round(scored.reduce((sum, d) => sum + (d.score ?? 0), 0) / scored.length) : null;

  async function show(date: LocalDate) {
    asked.current = date;
    setOpen(date);
    setDetails(null);
    // Stepping into another month brings the calendar along.
    if (date.startsWith(`${year}-`)) setMonth(Number(date.slice(5, 7)) - 1);
    try {
      const res = await dayDetails({ date });
      if (asked.current !== date) return;
      if (res.ok) setDetails(res.data);
      else toast.error(res.error);
    } catch {
      if (asked.current === date) toast.error("That day couldn't be loaded. Check your connection and try again.");
    }
  }

  return (
    <>
      <Group id="year" title={String(year)} action={nav} plain>
        {/* The picture: a month is the thing to tap, never a square. */}
        <div className="grid grid-cols-4 gap-x-1.5 gap-y-1 p-2.5">
          {months.map((m, i) => {
            const on = i === month;
            const picture = (
              <>
                <span className={cn("text-[13px] leading-none", on ? "font-medium text-foreground" : "text-muted-foreground")}>{m.name.slice(0, 3)}</span>
                <span aria-hidden className="grid grid-cols-7 gap-[2px]">
                  {Array.from({ length: m.lead }, (_, k) => (
                    <span key={`lead-${k}`} />
                  ))}
                  {m.list.map((d) => (
                    <span
                      key={d.date}
                      className={cn(
                        "aspect-square rounded-[2px]",
                        FILL[d.state],
                        d.minimum === "secured" && "ring-1 ring-primary ring-inset",
                        d.date === today && "outline-1 outline-offset-1 outline-foreground",
                      )}
                    />
                  ))}
                </span>
              </>
            );
            const cls = "grid content-start gap-1.5 rounded-[12px] p-1.5 text-left";
            if (!m.open) {
              return (
                <div key={m.name} role="img" aria-label={`${m.name}: ${monthSummary(m.list)}`} className={cls}>
                  {picture}
                </div>
              );
            }
            return (
              <button
                key={m.name}
                type="button"
                onClick={() => setMonth(i)}
                aria-pressed={on}
                aria-controls="year-month"
                aria-label={`${m.name}: ${monthSummary(m.list)}`}
                className={cn(cls, "transition-colors", on ? "bg-accent" : "active:bg-accent")}
              >
                {picture}
              </button>
            );
          })}
        </div>

        <div id="year-month" className="border-t border-border px-3 pt-4 pb-2">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h3 className="text-[17px] font-medium">{shown.name}</h3>
            {average !== null && <p className="text-[15px] text-muted-foreground tabular-nums">{average}% average</p>}
          </div>
          <div aria-hidden className="mt-3 grid grid-cols-7 text-center text-[13px] text-muted-foreground">
            {LETTERS.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          <ol aria-label={`${shown.name} ${year}`} className="mt-1 grid grid-cols-7">
            {Array.from({ length: shown.lead }, (_, i) => (
              <li key={`lead-${i}`} aria-hidden />
            ))}
            {shown.list.map((d) => {
              const face = cn(
                "grid size-10 place-items-center rounded-[12px] text-[15px] tabular-nums",
                CELL[d.state],
                d.minimum === "secured" && "ring-2 ring-primary ring-inset",
                d.date === today && "font-semibold outline-2 outline-offset-2 outline-foreground",
              );
              return (
                <li key={d.date}>
                  {tappable(d.state) ? (
                    <button
                      type="button"
                      aria-label={dayLabel(d)}
                      aria-current={d.date === today ? "date" : undefined}
                      onClick={() => void show(d.date)}
                      className="group grid h-12 w-full place-items-center"
                    >
                      <span aria-hidden className={cn(face, "transition-transform group-active:scale-90")}>
                        {Number(d.date.slice(8))}
                      </span>
                    </button>
                  ) : (
                    <span className="grid h-12 place-items-center">
                      <span aria-hidden className={face}>
                        {Number(d.date.slice(8))}
                      </span>
                      <span className="sr-only">{dayLabel(d)}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border px-4 py-3.5 text-[13px] text-muted-foreground" aria-label="Key">
          <Key className="bg-kept">Strong ({threshold}%+)</Key>
          <Key className="bg-kept/45">Average</Key>
          <Key className="bg-kept/18">Poor</Key>
          <Key className="bg-border">Not completed</Key>
          <Key className="bg-kept/18 ring-1 ring-primary ring-inset">Minimum day</Key>
        </ul>
      </Group>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? shortDate(open) : "Day"}>
        <div className="-mx-2 -mt-1 mb-3 flex items-center justify-between gap-3">
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
                <p className={cn("text-[14px]", details.locked ? "text-kept" : "text-muted-foreground")}>
                  {details.closed ? verdictLine(details.closed.verdict, details.closed.score) : details.locked ? "Closed." : "Not closed."}
                  {details.minimum && ` Minimum day${details.minimum === "secured" ? " secured" : ""}.`}
                </p>
              </div>
            </div>
            {details.closed && details.closed.achievements.length > 0 && (
              <ul className="grid gap-1 text-[15px]">
                {details.closed.achievements.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span aria-hidden className="text-kept">
                      ✓
                    </span>
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

function DayStep({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full text-foreground hover:bg-accent disabled:text-faint/50 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Key({ className, children }: { className: string; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-3 rounded-[3px]", className)} />
      {children}
    </li>
  );
}
