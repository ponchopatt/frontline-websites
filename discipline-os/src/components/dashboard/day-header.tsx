import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import Link from "next/link";
import { DayStrip } from "@/components/day-strip";
import { ScoreRing } from "@/components/score-ring";
import { Stat, StatStrip } from "@/components/stat-strip";
import { addDays, dayMonth, formatHours, weekdayName, type LocalDate } from "@/lib/day";
import type { DayScore } from "@/lib/streak";
import type { PriorityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DayHeaderProps {
  date: LocalDate;
  today: LocalDate;
  firstDay: LocalDate;
  score: number;
  threshold: number;
  locked: boolean;
  streak: number;
  morning: { done: number; total: number };
  workMinutes: number;
  workTargetHours: number;
  priorities: PriorityItem[];
  strip: DayScore[];
}

function dayHref(date: LocalDate, today: LocalDate) {
  return date === today ? "/" : `/?d=${date}`;
}

export function DayHeader({
  date,
  today,
  firstDay,
  score,
  threshold,
  locked,
  streak,
  morning,
  workMinutes,
  workTargetHours,
  priorities,
  strip,
}: DayHeaderProps) {
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const canGoBack = prev >= firstDay;
  const canGoForward = next <= today;
  const filled = priorities.filter((p) => p.title.trim());

  return (
    <header className="grid gap-5 pt-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="text-base">{weekdayName(date)}</span>
          </div>
          <h1 className="mt-0.5 text-[clamp(30px,8.4vw,44px)] leading-[1.04] font-medium tracking-[-0.02em] whitespace-nowrap">{dayMonth(date)}</h1>
          <div className="mt-2 -ml-2.5 flex items-center">
            <DayNav href={canGoBack ? dayHref(prev, today) : null} label="Previous day">
              <ChevronLeft className="size-5" />
            </DayNav>
            <DayNav href={canGoForward ? dayHref(next, today) : null} label="Next day">
              <ChevronRight className="size-5" />
            </DayNav>
            {date !== today && (
              <Link href="/" className="ml-1 inline-flex min-h-11 items-center px-2 text-sm text-primary underline-offset-4 hover:underline">
                Back to today
              </Link>
            )}
            <Link href="/settings" aria-label="Settings" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground md:hidden">
              <Settings2 className="size-[18px]" />
            </Link>
          </div>
        </div>
        <div className="grid justify-items-center gap-1">
          <ScoreRing score={score} threshold={threshold} size={104} label={locked ? "Completed score" : "Score so far"} />
          <span className="text-xs text-muted-foreground">{locked ? "Completed" : "Score"}</span>
        </div>
      </div>

      <StatStrip>
        <Stat label="Streak" value={streak} unit={streak === 1 ? "day" : "days"} />
        <Stat label="Morning" value={`${morning.done}/${morning.total}`} />
        <Stat label="Work" value={formatHours(workMinutes)} unit={`of ${workTargetHours}h`} />
      </StatStrip>

      {filled.length > 0 && (
        <a href="#mission" className="-mt-1 grid gap-1 rounded-lg text-[15px]" aria-label="Today's mission">
          {priorities.map((p) =>
            p.title.trim() ? (
              <span key={p.position} className="flex items-center gap-2.5 truncate">
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    p.status === "done" ? "bg-primary" : p.status === "dropped" ? "bg-faint" : "border border-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "truncate",
                    p.status === "done" && "text-muted-foreground",
                    p.status === "dropped" && "text-faint line-through",
                  )}
                >
                  {p.title}
                </span>
              </span>
            ) : null,
          )}
        </a>
      )}

      <DayStrip days={strip} threshold={threshold} selected={date} today={today} firstDay={firstDay} />
    </header>
  );
}

function DayNav({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls = "grid size-11 place-items-center rounded-full";
  if (!href) {
    return (
      <span aria-disabled="true" aria-label={label} className={cn(cls, "text-faint/60")}>
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
