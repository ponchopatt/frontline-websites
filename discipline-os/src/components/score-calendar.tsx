import Link from "next/link";
import { addDays, shortDate, startOfWeek, type LocalDate } from "@/lib/day";
import type { DayScore } from "@/lib/streak";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

interface ScoreCalendarProps {
  scores: DayScore[];
  today: LocalDate;
  firstDay: LocalDate;
  threshold: number;
  weeks?: number;
}

/**
 * Recent weeks as a calendar. A filled square is a day at or above the streak line; a
 * faint one scored below it; an outline had nothing logged. Every day opens.
 */
export function ScoreCalendar({ scores, today, firstDay, threshold, weeks = 5 }: ScoreCalendarProps) {
  const byDate = new Map(scores.map((s) => [s.date, s]));
  const start = addDays(startOfWeek(today), -7 * (weeks - 1));
  const cells: LocalDate[] = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-xs text-faint" aria-hidden>
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1.5" aria-label={`Scores for the last ${weeks} weeks`}>
        {cells.map((date) => {
          if (date > today || date < firstDay) {
            return <li key={date} aria-hidden className="aspect-square rounded-md border border-border/40" />;
          }
          const s = byDate.get(date);
          const score = s?.score ?? 0;
          const met = score >= threshold;
          return (
            <li key={date}>
              <Link
                href={date === today ? "/" : `/?d=${date}`}
                aria-label={`${shortDate(date)}: ${score}${met ? ", on the streak" : ""}`}
                className={cn(
                  "grid aspect-square place-items-center rounded-md text-[11px] transition-colors",
                  met
                    ? "bg-primary text-primary-foreground"
                    : score > 0
                      ? "bg-primary/15 text-muted-foreground hover:bg-primary/25"
                      : "border border-border text-faint hover:border-input",
                  date === today && "ring-1 ring-foreground/50 ring-offset-2 ring-offset-background",
                )}
              >
                {Number(date.slice(8))}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
