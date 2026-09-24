import { Check, Flame, Minus } from "lucide-react";
import { addDays, type LocalDate } from "@/lib/day";
import { keepsChain, type DayScore } from "@/lib/streak";
import { cn } from "@/lib/utils";

const LETTERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface WeekStreakProps {
  /** Recent days, today's number live. */
  days: DayScore[];
  weekStart: LocalDate;
  today: LocalDate;
  firstDay: LocalDate;
  threshold: number;
  streak: number;
}

/** The streak and this week at a glance: a tick for each day the word was kept. */
export function WeekStreak({ days, weekStart, today, firstDay, threshold, streak }: WeekStreakProps) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return (
    <section aria-label="This week's streak" className="surface rounded-[28px] border px-4 pt-4 pb-3.5 sm:px-5">
      <p className="flex items-center gap-2 text-[19px] font-medium tracking-tight">
        <Flame className="size-5" aria-hidden />
        {streak > 0 ? `${streak}-day streak` : "Start a streak today"}
      </p>
      <ol className="mt-3 grid grid-cols-7 gap-1">
        {LETTERS.map((letter, i) => {
          const date = addDays(weekStart, i);
          const d = byDate.get(date);
          const kept = d ? keepsChain(d, threshold) : false;
          const state = date === today ? (kept ? "today-kept" : "today") : date > today || date < firstDay ? "open" : kept ? "kept" : "missed";
          const label = `${NAMES[i]}: ${state === "open" ? (date > today ? "to come" : "before you started") : state === "missed" ? "not kept" : state === "today" ? "today, in progress" : "kept"}`;
          return (
            <li key={date} aria-label={label} className="grid justify-items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "grid size-10 place-items-center rounded-full transition-colors",
                  state === "kept" && "bg-foreground/[0.08] text-foreground",
                  state === "missed" && "bg-foreground/[0.04] text-faint",
                  state === "open" && "border border-dashed border-foreground/30",
                  (state === "today" || state === "today-kept") && "bg-white text-[#1c2a22] shadow-[0_6px_16px_-8px_rgb(0_0_0/0.45)]",
                )}
              >
                {state === "kept" || state === "today-kept" ? (
                  <Check className="size-4" strokeWidth={2.5} />
                ) : state === "missed" ? (
                  <Minus className="size-3.5" />
                ) : state === "today" ? (
                  <Flame className="size-4" />
                ) : null}
              </span>
              <span className={cn("text-[13px]", date === today ? "font-medium text-foreground" : "text-muted-foreground")}>{date === today ? "Today" : letter}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
