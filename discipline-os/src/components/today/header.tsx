import { Check, ChevronLeft, ChevronRight, Flame, Settings2, Swords, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { Meter } from "@/components/meter";
import { ScoreRing } from "@/components/score-ring";
import { addDays, dayMonth, formatDuration, weekdayName, type LocalDate } from "@/lib/day";
import type { Momentum } from "@/lib/history";
import type { WordResult } from "@/lib/keep-word";
import type { BoardKey, Tally } from "@/lib/scoreboard";
import type { BossSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TodayHeaderProps {
  date: LocalDate;
  today: LocalDate;
  firstDay: LocalDate;
  greeting: string;
  word: WordResult;
  locked: boolean;
  threshold: number;
  weekAverage: number | null;
  streak: number;
  /** "Build the day", "Keep going", "Close it out", "Day complete", "New day". Null looking back. */
  phase: { line: string; tone: "lamp" | "kept" } | null;
  /** "One commitment left." when it's down to the last one or two. */
  nudge: string | null;
}

function dayHref(date: LocalDate, today: LocalDate) {
  return date === today ? "/" : `/?d=${date}`;
}

/** Good morning, the date, and the day's one number: Keep My Word. */
export function TodayHeader({ date, today, firstDay, greeting, word, locked, threshold, weekAverage, streak, phase, nudge }: TodayHeaderProps) {
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const isToday = date === today;
  return (
    <header className="grid gap-3 pt-1">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] text-muted-foreground">
            {isToday ? greeting : "Looking back"}
            {phase && (
              <>
                {". "}
                <span className={cn("font-medium", phase.tone === "kept" ? "text-kept" : "text-primary")}>{phase.line}</span>
              </>
            )}
          </p>
          <h1 className="mt-0.5 text-[clamp(28px,8vw,40px)] leading-[1.05] font-medium tracking-[-0.02em]">
            {weekdayName(date)}
            <span className="block text-muted-foreground">{dayMonth(date)}</span>
          </h1>
          <div className="mt-1 -ml-2.5 flex items-center">
            <DayNav href={prev >= firstDay ? dayHref(prev, today) : null} label="Previous day">
              <ChevronLeft className="size-5" />
            </DayNav>
            <DayNav href={next <= today ? dayHref(next, today) : null} label="Next day">
              <ChevronRight className="size-5" />
            </DayNav>
            {!isToday && (
              <Link href="/" className="ml-1 inline-flex min-h-11 items-center px-2 text-sm text-primary underline-offset-4 hover:underline">
                Back to today
              </Link>
            )}
            <Link href="/settings" aria-label="Settings" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground md:hidden">
              <Settings2 className="size-[18px]" />
            </Link>
          </div>
        </div>
        <a href="#review" className="grid justify-items-center gap-1 rounded-2xl" aria-label={`Keep my word: ${word.percent ?? 0}%. Go to the night review.`}>
          <ScoreRing score={word.percent ?? 0} threshold={threshold} size={96} suffix="%" label={locked ? "Kept my word" : "Keep my word"} />
          <span className="text-xs text-muted-foreground">Keep my word</span>
        </a>
      </div>
      <p className="text-sm text-muted-foreground">
        <span id="kept" className="text-foreground">
          {word.kept} of {word.made}
        </span>{" "}
        kept{weekAverage !== null && (
          <>
            {" · "}Week <span className="text-foreground">{weekAverage}%</span>
          </>
        )}
        {" · "}
        <span className="inline-flex items-baseline gap-1">
          {streak > 0 && <Flame className="size-3.5 self-center text-primary" aria-hidden />}
          Streak <span className="text-foreground">{streak}</span> {streak === 1 ? "day" : "days"}
        </span>
      </p>
      {nudge && <p className="-mt-1 text-sm font-medium text-primary">{nudge}</p>}
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

const BOARD_LABEL: Record<BoardKey, string> = {
  faith: "Faith",
  fitness: "Fitness",
  imperium: "Imperium",
  websites: "Websites",
  trading: "AI Bot",
  discipline: "Discipline",
};

/** The daily scoreboard: done of planned for each part of life, then work hours. Bars fill as things get done and turn sage when a part is complete. */
export function Scoreboard({ board, workMinutes, workTargetHours }: { board: Record<BoardKey, Tally>; workMinutes: number; workTargetHours: number }) {
  const keys = Object.keys(BOARD_LABEL) as BoardKey[];
  const workTarget = workTargetHours * 60;
  const workDone = workTarget > 0 && workMinutes >= workTarget;
  return (
    <section aria-label="Scoreboard" className="grid grid-cols-2 gap-x-6 rounded-[26px] border border-glass-edge bg-glass px-4 py-3 sm:px-5">
      {keys.map((k) => {
        const t = board[k];
        const complete = t.total > 0 && t.done === t.total;
        return (
          <a key={k} href={`#${k}`} className="grid min-h-12 content-center gap-1.5 py-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[15px] text-muted-foreground">{BOARD_LABEL[k]}</span>
              <span className={cn("inline-flex items-center gap-1 text-[17px] tabular-nums", complete ? "text-kept" : "text-foreground")}>
                {complete && <Check className="size-3.5 animate-in zoom-in-50 duration-300" strokeWidth={3} aria-hidden />}
                {t.total === 0 ? "–" : `${t.done}/${t.total}`}
              </span>
            </span>
            <Meter value={t.total ? t.done / t.total : 0} size="md" />
          </a>
        );
      })}
      <a href="#work" className="col-span-2 grid min-h-12 content-center gap-1.5 py-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] text-muted-foreground">Work</span>
          <span className={cn("inline-flex items-center gap-1 text-[17px] tabular-nums", workDone && "text-kept")}>
            {workDone && <Trophy className="size-3.5" aria-hidden />}
            {formatDuration(workMinutes)} <span className="text-muted-foreground">/ {workTargetHours}h</span>
          </span>
        </span>
        <Meter value={workTarget ? workMinutes / workTarget : 0} size="md" />
      </a>
    </section>
  );
}

/** This week at a glance: momentum and the Weekly Boss, each a tap from the full picture. */
export function WeekGlance({ momentum, boss, weekStart }: { momentum: Momentum | null; boss: BossSummary | null; weekStart: LocalDate }) {
  if (!momentum && !boss) return null;
  const Trend = momentum?.trend === "falling" ? TrendingDown : TrendingUp;
  return (
    <div className={cn("-mt-2 grid gap-2", momentum && boss ? "grid-cols-2" : "grid-cols-1")}>
      {momentum ? (
        <Link href="/progress#momentum" className="grid gap-0.5 rounded-[22px] border border-glass-edge bg-glass px-4 py-3">
          <span className="text-[13px] text-muted-foreground">Momentum</span>
          <span className="flex items-baseline gap-2">
            <span className="text-[24px] leading-none tabular-nums">{momentum.score}</span>
            {momentum.trend && (
              <span className={cn("inline-flex items-center gap-1 text-[13px]", momentum.trend === "rising" ? "text-kept" : momentum.trend === "falling" ? "text-primary" : "text-muted-foreground")}>
                {momentum.trend !== "stable" && <Trend className="size-3.5" aria-hidden />}
                {momentum.trend === "rising" ? "Rising" : momentum.trend === "falling" ? "Falling" : "Stable"}
              </span>
            )}
          </span>
        </Link>
      ) : null}
      {boss ? (
        <Link href={`/goals/week/${weekStart}#boss`} className="grid gap-1 rounded-[22px] border border-glass-edge bg-glass px-4 py-3">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Swords className="size-3.5" aria-hidden />
            Weekly boss
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className={cn("text-[24px] leading-none tabular-nums", boss.hit === boss.total && "text-kept")}>{boss.hit}</span>
            <span className="text-[13px] text-muted-foreground">of {boss.total} targets</span>
          </span>
          <Meter value={boss.ratio} />
        </Link>
      ) : null}
    </div>
  );
}
