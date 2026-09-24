import Link from "next/link";
import { shortDate, type LocalDate } from "@/lib/day";
import type { DayScore } from "@/lib/streak";
import { cn } from "@/lib/utils";

interface DayStripProps {
  days: DayScore[];
  threshold: number;
  selected: LocalDate;
  today: LocalDate;
  firstDay: LocalDate;
}

/**
 * The last 30 days as thin bars, with the streak line across them. The chain you keep.
 * Each bar opens that day.
 */
export function DayStrip({ days, threshold, selected, today, firstDay }: DayStripProps) {
  return (
    <nav aria-label="Last 30 days" className="relative pb-2.5">
      <div className="mb-2 flex items-baseline justify-between text-xs text-faint" aria-hidden>
        <span>Last 30 days</span>
        <span>Streak line {threshold}</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 h-px bg-primary/35" style={{ bottom: `calc(0.625rem + ${threshold} * 0.48px)` }} aria-hidden />
      <ol className="flex h-12 items-end gap-[3px]">
        {days.map((d) => {
          const before = d.date < firstDay;
          const met = d.score >= threshold;
          const isSelected = d.date === selected;
          if (before) {
            return (
              <li key={d.date} className="flex h-full flex-1 items-end" aria-hidden>
                <span className="block h-0.5 w-full rounded-full bg-border" />
              </li>
            );
          }
          return (
            <li key={d.date} className="flex h-full flex-1 items-end">
              <Link
                href={d.date === today ? "/" : `/?d=${d.date}`}
                aria-label={`${shortDate(d.date)}: score ${d.score}`}
                aria-current={isSelected ? "date" : undefined}
                className="flex h-full w-full items-end rounded-[2px] focus-visible:outline-offset-1"
                prefetch={false}
              >
                <span
                  className={cn(
                    "relative block w-full rounded-[2px] transition-[height,background-color] duration-500 ease-(--ease-out-quart)",
                    met ? "bg-primary" : d.score > 0 ? "bg-muted-foreground/45" : "bg-muted-foreground/30",
                  )}
                  style={{ height: d.score > 0 ? `${Math.max(6, d.score)}%` : "2px" }}
                >
                  {isSelected && (
                    <span aria-hidden className="absolute -bottom-2.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-foreground" />
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
