"use client";

import { Check, ChevronLeft, ChevronRight, Flame, Minus } from "lucide-react";
import Link from "next/link";
import { ScoreRing } from "@/components/score-ring";
import { addDays, dayMonth, weekdayName, type LocalDate } from "@/lib/day";
import type { WordResult } from "@/lib/keep-word";
import { keepsChain, type DayScore } from "@/lib/streak";
import { cn } from "@/lib/utils";

interface TodayTopProps {
  date: LocalDate;
  today: LocalDate;
  firstDay: LocalDate;
  /** "morning", "afternoon" or "evening", for "Thursday afternoon". */
  partOfDay: string;
  name: string | null;
  word: WordResult;
  locked: boolean;
  threshold: number;
  weekAverage: number | null;
  streak: number;
  /** "Build the day", "Keep going", "Close it out", "Day complete", "New day". Null looking back. */
  phase: { line: string; tone: "lamp" | "kept" } | null;
  /** "One commitment left." when it's down to the last one or two. */
  nudge: string | null;
  /** Recent days, today's number live, for the week's dots. */
  days: DayScore[];
  weekStart: LocalDate;
}

function dayHref(date: LocalDate, today: LocalDate) {
  return date === today ? "/" : `/?d=${date}`;
}

/**
 * The top of the day: when it is, one line for what the day needs now, its number (Keep My
 * Word), the streak, and this week as seven dots.
 */
export function TodayTop(props: TodayTopProps) {
  const { date, today, firstDay, partOfDay, name, word, locked, threshold, weekAverage, streak, phase, nudge } = props;
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const isToday = date === today;
  const headline = isToday && phase ? phase.line.replace(/\.$/, name ? `, ${name}.` : ".") : `${weekdayName(date)} ${dayMonth(date)}`;
  return (
    <header className="grid gap-4">
      <div className="-mr-2 flex min-h-11 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] text-muted-foreground">
          {isToday ? `${weekdayName(date)} ${partOfDay} · ${dayMonth(date)}` : "Looking back"}
          {!isToday && (
            <>
              {" · "}
              <Link href="/" className="text-foreground underline underline-offset-4">
                Back to today
              </Link>
            </>
          )}
        </p>
        <div className="flex shrink-0 items-center">
          <DayNav href={prev >= firstDay ? dayHref(prev, today) : null} label="Previous day">
            <ChevronLeft className="size-5" />
          </DayNav>
          <DayNav href={next <= today ? dayHref(next, today) : null} label="Next day">
            <ChevronRight className="size-5" />
          </DayNav>
        </div>
      </div>

      <h1 className={cn("-mt-2 text-[clamp(34px,9.6vw,44px)] leading-[1.04] font-light tracking-[-0.035em] text-balance", phase?.tone === "kept" && "text-kept")}>{headline}</h1>

      <div className="flex items-center gap-4">
        <ScoreRing score={word.percent ?? 0} threshold={threshold} size={76} suffix="%" label={locked ? "Kept my word" : "Keep my word"} />
        <div className="grid min-w-0 gap-0.5">
          <p className="text-[17px]">
            <span id="kept">
              {word.kept} of {word.made}
            </span>{" "}
            <span className="text-muted-foreground">kept</span>
          </p>
          <p className="text-[15px] text-muted-foreground">
            {weekAverage !== null && (
              <>
                Week <span className="text-foreground">{weekAverage}%</span>
                {" · "}
              </>
            )}
            <span className="inline-flex items-baseline gap-1">
              {streak > 0 && <Flame className="size-3.5 self-center" aria-hidden />}
              <span>
                Streak <span className="text-foreground">{streak}</span> {streak === 1 ? "day" : "days"}
              </span>
            </span>
          </p>
          {nudge && <p className="text-[15px] font-medium text-foreground">{nudge}</p>}
        </div>
      </div>

      {isToday && <WeekDots days={props.days} weekStart={props.weekStart} today={today} firstDay={firstDay} threshold={threshold} />}
    </header>
  );
}

function DayNav({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls = "grid size-11 place-items-center rounded-full";
  if (!href) {
    return (
      <span aria-disabled="true" aria-label={label} className={cn(cls, "text-faint/50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cn(cls, "text-muted-foreground hover:bg-accent hover:text-foreground")}>
      {children}
    </Link>
  );
}

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** This week at a glance: a tick for each day the word was kept, today lit. */
function WeekDots({ days, weekStart, today, firstDay, threshold }: { days: DayScore[]; weekStart: LocalDate; today: LocalDate; firstDay: LocalDate; threshold: number }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const todayClosed = byDate.get(today)?.locked ?? false;
  return (
    <ol aria-label="This week's streak" className="grid grid-cols-7 gap-1">
      {LETTERS.map((letter, i) => {
        const date = addDays(weekStart, i);
        const d = byDate.get(date);
        const kept = d ? keepsChain(d, threshold) : false;
        const state = date === today ? (kept ? "today-kept" : todayClosed ? "missed" : "today") : date > today || date < firstDay ? "open" : kept ? "kept" : "missed";
        const label = `${NAMES[i]}: ${state === "open" ? (date > today ? "to come" : "before you started") : state === "missed" ? "not kept" : state === "today" ? "today, in progress" : "kept"}`;
        return (
          <li key={date} aria-label={label} className="grid justify-items-center gap-1">
            <span
              aria-hidden
              className={cn(
                "grid size-9 place-items-center rounded-full transition-colors",
                state === "kept" && "bg-foreground/[0.14] text-foreground",
                state === "missed" && "bg-foreground/[0.05] text-faint",
                state === "open" && "border border-dashed border-foreground/25",
                (state === "today" || state === "today-kept") && "bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_rgb(0_0_0/0.45)]",
              )}
            >
              {state === "kept" || state === "today-kept" ? <Check className="size-4" strokeWidth={2.5} /> : state === "missed" ? <Minus className="size-3.5" /> : state === "today" ? <Flame className="size-4" /> : null}
            </span>
            <span className={cn("text-[13px]", date === today ? "font-medium text-foreground" : "text-muted-foreground")}>{letter}</span>
          </li>
        );
      })}
    </ol>
  );
}
