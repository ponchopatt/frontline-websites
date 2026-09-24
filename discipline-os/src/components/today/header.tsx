"use client";

import { BookOpen, Check, ChevronLeft, ChevronRight, Flame, LayoutGrid, ListChecks, Settings2, Swords, Timer, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Meter } from "@/components/meter";
import { ScoreRing } from "@/components/score-ring";
import { Sheet } from "@/components/sheet";
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
  /** "morning", "afternoon" or "evening", for "Thursday afternoon". */
  partOfDay: string;
  /** First name, for the headline and the avatar. */
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
}

function dayHref(date: LocalDate, today: LocalDate) {
  return date === today ? "/" : `/?d=${date}`;
}

const round = "grid size-11 place-items-center rounded-full border border-glass-edge bg-glass backdrop-blur-md";

/**
 * The top of the day: when it is, one big line for what the day needs now, and its number,
 * Keep My Word.
 */
export function TodayHeader({ date, today, firstDay, partOfDay, name, word, locked, threshold, weekAverage, streak, phase, nudge }: TodayHeaderProps) {
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const isToday = date === today;
  const headline = isToday && phase ? phase.line.replace(/\.$/, name ? `, ${name}.` : ".") : `${weekdayName(date)} ${dayMonth(date)}`;
  return (
    <header className="grid gap-5 pt-1">
      <div className="flex items-center justify-between gap-3">
        <Link href="/settings" aria-label="Settings" className={cn(round, "size-12 text-[17px] font-medium")}>
          {name ? name.slice(0, 1).toUpperCase() : <Settings2 className="size-5" aria-hidden />}
        </Link>
        <div className="flex items-center gap-2">
          <DayNav href={prev >= firstDay ? dayHref(prev, today) : null} label="Previous day">
            <ChevronLeft className="size-5" />
          </DayNav>
          <DayNav href={next <= today ? dayHref(next, today) : null} label="Next day">
            <ChevronRight className="size-5" />
          </DayNav>
          <MoreMenu />
        </div>
      </div>

      <div className="grid gap-1.5">
        <p className="text-[15px] text-muted-foreground">
          {isToday ? `${weekdayName(date)} ${partOfDay}, ${dayMonth(date)}` : "Looking back"}
          {!isToday && (
            <>
              {" · "}
              <Link href="/" className="text-foreground underline underline-offset-4">
                Back to today
              </Link>
            </>
          )}
        </p>
        <h1 className={cn("text-[clamp(38px,11vw,54px)] leading-[1.02] font-light tracking-[-0.035em]", phase?.tone === "kept" && "text-kept")}>{headline}</h1>
      </div>

      <div className="flex items-center gap-4">
        <a href="#review" className="shrink-0 rounded-full" aria-label={`Keep my word: ${word.percent ?? 0}%. Go to the night review.`}>
          <ScoreRing score={word.percent ?? 0} threshold={threshold} size={88} suffix="%" label={locked ? "Kept my word" : "Keep my word"} />
        </a>
        <div className="grid min-w-0 gap-0.5">
          <p className="text-[13px] text-muted-foreground">Keep my word</p>
          <p className="text-[17px]">
            <span id="kept">
              {word.kept} of {word.made}
            </span>{" "}
            <span className="text-muted-foreground">kept</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {weekAverage !== null && (
              <>
                Week <span className="text-foreground">{weekAverage}%</span>
                {" · "}
              </>
            )}
            <span className="inline-flex items-baseline gap-1">
              {streak > 0 && <Flame className="size-3.5 self-center" aria-hidden />}
              Streak <span className="text-foreground">{streak}</span> {streak === 1 ? "day" : "days"}
            </span>
          </p>
          {nudge && <p className="text-sm font-medium text-foreground">{nudge}</p>}
        </div>
      </div>
    </header>
  );
}

function DayNav({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  if (!href) {
    return (
      <span aria-disabled="true" aria-label={label} className={cn(round, "text-faint/60")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cn(round, "text-foreground hover:bg-accent")}>
      {children}
    </Link>
  );
}

const MORE = [
  { href: "/habits", label: "Habits", icon: ListChecks },
  { href: "/work", label: "Work log", icon: Timer },
  { href: "/bible", label: "Bible notes", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

/** The pages that don't fit in the tab bar, one tap from the top of Today. */
function MoreMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="More" className={cn(round, "text-foreground hover:bg-accent")}>
        <LayoutGrid className="size-[18px]" aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="More">
        <ul className="grid grid-cols-2 gap-2 pb-1">
          {MORE.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} onClick={() => setOpen(false)} className="flex h-14 items-center gap-3 rounded-2xl border border-border px-4 text-[15px] hover:bg-accent">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
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
    <section aria-label="Scoreboard" className="surface grid grid-cols-2 gap-x-6 rounded-[28px] border px-4 py-3 sm:px-5">
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
        <Link href="/progress#momentum" className="surface grid gap-0.5 rounded-[24px] border px-4 py-3">
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
        <Link href={`/goals/week/${weekStart}#boss`} className="surface grid gap-1 rounded-[24px] border px-4 py-3">
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
