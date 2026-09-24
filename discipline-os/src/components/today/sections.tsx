"use client";

import { Check, ChevronRight, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AutosaveField } from "@/components/autosave-field";
import { CheckChip } from "@/components/check-chip";
import { Meter } from "@/components/meter";
import { ReadingPicker } from "@/components/reading-picker";
import { SectionCard } from "@/components/section-card";
import { Stepper } from "@/components/stepper";
import { AREA_LABEL, type WorkArea } from "@/lib/areas";
import { PLANS, formatReading } from "@/lib/bible";
import { clockTime, formatDuration, isoWeekday, type LocalDate } from "@/lib/day";
import { formatValue } from "@/lib/goals/format";
import { monthShort } from "@/lib/goals/periods";
import type { ActionResult, BibleState, CounterItem, GoalLadder, HabitItem, MilestoneItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type ToggleHabit = (habit: HabitItem, done: boolean) => void;

function HabitGrid({ habits, readOnly, timeZone, onToggle, labels }: { habits: HabitItem[]; readOnly: boolean; timeZone: string; onToggle: ToggleHabit; labels?: Partial<Record<string, string>> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {habits.map((h) => (
        <CheckChip
          key={h.id}
          label={labels?.[h.kind ?? ""] ?? h.name}
          done={Boolean(h.completedAt)}
          disabled={readOnly}
          hint={h.completedAt ? `${h.editedAt ? "edited · " : ""}${clockTime(h.completedAt, timeZone)}` : !h.due ? "Not due today" : null}
          onToggle={(done) => onToggle(h, done)}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ morning */

export function MorningCard({ habits, readOnly, timeZone, onToggle }: { habits: HabitItem[]; readOnly: boolean; timeZone: string; onToggle: ToggleHabit }) {
  const due = habits.filter((h) => h.due || h.completedAt);
  const done = due.filter((h) => h.completedAt).length;
  const complete = due.length > 0 && done === due.length;
  const [open, setOpen] = useState(!complete);

  return (
    <SectionCard
      id="morning"
      title={complete ? "Morning complete" : "Morning"}
      meta={
        complete ? (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex min-h-11 items-center gap-1 text-primary">
            <Check className="size-4" aria-hidden />
            {open ? "Hide" : `${done}/${due.length}`}
          </button>
        ) : (
          <span>
            <span className="text-foreground">{done}</span>/{due.length}
          </span>
        )
      }
    >
      {due.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">
          No morning routine yet.{" "}
          <Link href="/habits" className="text-foreground underline underline-offset-4">
            Add one
          </Link>
        </p>
      ) : (
        (open || !complete) && <HabitGrid habits={due} readOnly={readOnly} timeZone={timeZone} onToggle={onToggle} />
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ faith */

interface FaithCardProps {
  date: LocalDate;
  habits: HabitItem[];
  bible: BibleState;
  reviewDone: boolean;
  readOnly: boolean;
  timeZone: string;
  onToggle: ToggleHabit;
  onSetReading: (book: string, chapter: number, passage: string | null) => Promise<boolean>;
  onSaveJournal: (value: string) => Promise<ActionResult<unknown>>;
  onJournalSaved: (value: string) => void;
}

const READING_LABELS = { bible: "Read", journal: "Journal", prayer: "Pray" };

/** Faith: today's chapter with Read / Journal / Pray (the same ticks as the morning routine), and the evening. */
export function FaithCard({ date, habits, bible, reviewDone, readOnly, timeZone, onToggle, onSetReading, onSaveJournal, onJournalSaved }: FaithCardProps) {
  const [picking, setPicking] = useState(false);
  const morning = (["bible", "journal", "prayer"] as const).map((k) => habits.find((h) => h.kind === k)).filter((h): h is HabitItem => Boolean(h));
  const evening = habits.filter((h) => h.category === "god" && (h.due || h.completedAt));
  const total = morning.length + evening.length + 1;
  const done = morning.filter((h) => h.completedAt).length + evening.filter((h) => h.completedAt).length + (reviewDone ? 1 : 0);

  return (
    <SectionCard
      id="faith"
      title="Faith"
      meta={
        <span>
          <span className="text-foreground">{done}</span>/{total}
        </span>
      }
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Today&apos;s reading · {PLANS[bible.plan].label}</p>
          <p className="text-[20px] font-medium tracking-tight">{formatReading(bible, bible.passage)}</p>
        </div>
        {!readOnly && !picking && (
          <button type="button" onClick={() => setPicking(true)} className="min-h-11 shrink-0 text-sm text-muted-foreground hover:text-foreground">
            Change
          </button>
        )}
      </div>
      {picking && (
        <ReadingPicker
          className="mb-3"
          value={bible}
          onCancel={() => setPicking(false)}
          onSave={async (book, chapter, passage) => {
            if (await onSetReading(book, chapter, passage)) setPicking(false);
          }}
        />
      )}

      {morning.length > 0 && (
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Reading">
          {morning.map((h) => (
            <CheckChip key={h.id} label={READING_LABELS[h.kind as keyof typeof READING_LABELS]} done={Boolean(h.completedAt)} disabled={readOnly} onToggle={(d) => onToggle(h, d)} className="px-2.5" />
          ))}
        </div>
      )}

      <AutosaveField
        key={`${date}-journal`}
        className="mt-3"
        label="Journal"
        value={bible.journal}
        multiline
        placeholder="What stood out, and what will I do about it?"
        maxLength={4000}
        disabled={readOnly}
        onSave={onSaveJournal}
        onSaved={onJournalSaved}
      />

      <p className="mt-4 mb-2 text-sm text-muted-foreground">Evening</p>
      <div className="grid grid-cols-2 gap-2">
        {evening.map((h) => (
          <CheckChip
            key={h.id}
            label={h.kind === "evening_prayer" ? "Prayer" : h.name}
            done={Boolean(h.completedAt)}
            disabled={readOnly}
            hint={h.completedAt ? clockTime(h.completedAt, timeZone) : null}
            onToggle={(d) => onToggle(h, d)}
          />
        ))}
        <a
          href="#review"
          className={cn(
            "flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2",
            reviewDone ? "border-primary/35 bg-lamp-soft" : "border-border bg-card/40",
          )}
        >
          <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full border", reviewDone ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
            {reviewDone && <Check className="size-3" strokeWidth={3.2} />}
          </span>
          <span className="grid leading-tight">
            <span className="text-[15px]">Reflection</span>
            <span className="text-xs text-faint">{reviewDone ? "Night review done" : "The night review"}</span>
          </span>
        </a>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ fitness */

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

interface FitnessCardProps {
  date: LocalDate;
  today: LocalDate;
  habits: HabitItem[];
  gymWeek: Array<{ date: LocalDate; due: boolean; done: boolean }>;
  cardioWeek: { done: number; days: number };
  cardio: CounterItem | null;
  readOnly: boolean;
  timeZone: string;
  onToggle: ToggleHabit;
  onCounter: (counter: CounterItem, value: number) => void;
}

/** Gym on its days (the week at a glance), cardio with minutes, and the optional extras. */
export function FitnessCard({ date, today, habits, gymWeek, cardioWeek, cardio, readOnly, timeZone, onToggle, onCounter }: FitnessCardProps) {
  const gym = habits.find((h) => h.kind === "gym");
  const cardioHabit = habits.find((h) => h.kind === "cardio");
  const extras = habits.filter((h) => h.category === "body" && h.kind !== "gym" && h.kind !== "cardio" && (h.due || h.completedAt));
  const counted = habits.filter((h) => h.category === "body" && (h.due || h.completedAt));
  const done = counted.filter((h) => h.completedAt).length;
  // The week strip follows the live tick for the day on screen.
  const week = gymWeek.map((d) => (d.date === date && gym ? { ...d, done: Boolean(gym.completedAt) } : d));
  const gymDone = week.filter((d) => d.done).length;
  const gymDue = week.filter((d) => d.due).length;
  const cardioDays = cardioWeek.done;

  return (
    <SectionCard
      id="fitness"
      title="Fitness"
      meta={
        <span>
          <span className="text-foreground">{done}</span>/{counted.length}
        </span>
      }
    >
      {counted.length === 0 && !gym && !cardioHabit && (
        <p className="text-[15px] text-muted-foreground">
          No fitness habits.{" "}
          <Link href="/habits" className="text-foreground underline underline-offset-4">
            Add one
          </Link>
        </p>
      )}

      {gym && (
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px]">Gym</span>
            <span className="text-sm text-muted-foreground">
              <span className="text-foreground">{gymDone}</span>/{gymDue} this week
            </span>
          </div>
          <ol className="grid grid-cols-7 gap-1" aria-label="Gym this week">
            {week.map((d, i) => {
              const past = d.date < today;
              const state = d.done ? "done" : !d.due ? "rest" : past ? "missed" : "open";
              return (
                <li
                  key={d.date}
                  className={cn(
                    "grid h-11 place-items-center rounded-lg border text-[13px]",
                    state === "done" ? "border-primary/40 bg-lamp-soft text-primary" : "border-border",
                    d.date === date && "ring-1 ring-primary/50",
                  )}
                  aria-label={`${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][isoWeekday(d.date) - 1]}: ${
                    state === "done" ? "done" : state === "rest" ? "rest day" : state === "missed" ? "missed" : "to do"
                  }`}
                >
                  <span className="leading-none text-muted-foreground">{DAY_LETTERS[i]}</span>
                  <span aria-hidden className={cn("leading-none", state === "missed" ? "text-muted-foreground" : "")}>
                    {state === "done" ? "✓" : state === "missed" ? "×" : state === "rest" ? "·" : "○"}
                  </span>
                </li>
              );
            })}
          </ol>
          <CheckChip label={gym.due ? "Gym today" : "Gym (rest day)"} done={Boolean(gym.completedAt)} disabled={readOnly} onToggle={(d) => onToggle(gym, d)} hint={gym.completedAt ? clockTime(gym.completedAt, timeZone) : null} />
        </div>
      )}

      {cardioHabit && (
        <div className="mt-4 grid gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px]">Cardio</span>
            <span className="text-sm text-muted-foreground">
              <span className="text-foreground">{cardioDays}</span>/{cardioWeek.days} days this week
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <CheckChip label="Cardio done" done={Boolean(cardioHabit.completedAt)} disabled={readOnly} onToggle={(d) => onToggle(cardioHabit, d)} />
            {cardio && (
              <div className="flex items-center gap-1.5">
                <Stepper label="Cardio minutes" value={cardio.value} step={5} disabled={readOnly} onCommit={(v) => onCounter(cardio, v)} />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            )}
          </div>
          {cardio?.target ? <p className="text-xs text-faint">{cardio.target}+ minutes ticks it for you.</p> : null}
        </div>
      )}

      {extras.length > 0 && (
        <div className="mt-4">
          <HabitGrid habits={extras} readOnly={readOnly} timeZone={timeZone} onToggle={onToggle} />
        </div>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ businesses */

interface CountersCardProps {
  id: string;
  title: string;
  tab: string;
  counters: CounterItem[];
  /** Tasks in this business today, for the done/planned count. */
  tasks: { done: number; total: number };
  readOnly: boolean;
  onCounter: (counter: CounterItem, value: number) => void;
}

/** A business's numbers for today: tap + as it happens, or type the number. */
export function CountersCard({ id, title, tab, counters, tasks, readOnly, onCounter }: CountersCardProps) {
  const pinned = counters.filter((c) => c.pinned);
  const targets = pinned.filter((c) => c.target !== null && c.target > 0);
  const met = targets.filter((c) => c.value >= (c.target ?? 0)).length;
  const weekly = pinned.filter((c) => c.weekTarget !== null && c.weekTarget > 0);

  return (
    <SectionCard
      id={id}
      title={title}
      meta={
        <span>
          <span className="text-foreground">{met + tasks.done}</span>/{targets.length + tasks.total}
        </span>
      }
    >
      <ul className="divide-y divide-border/70">
        {pinned.map((c) => {
          const hit = c.target !== null && c.target > 0 && c.value >= c.target;
          return (
            <li key={c.id} className="flex min-h-14 items-center justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-[16px]">{c.label}</p>
                <p className={cn("text-[13px]", hit ? "text-primary" : "text-muted-foreground")}>
                  {c.aggregation === "latest"
                    ? "Right now"
                    : c.target !== null && c.target > 0
                      ? `${hit ? "Hit · " : ""}target ${formatValue(c.target, c.unit === "$" ? "$" : null)}`
                      : c.weekTarget
                        ? `Week ${formatValue(c.weekTotal, c.unit === "$" ? "$" : null)} of ${formatValue(c.weekTarget, c.unit === "$" ? "$" : null)}`
                        : `Week ${formatValue(c.weekTotal, c.unit === "$" ? "$" : null)}`}
                </p>
              </div>
              <Stepper label={c.label} value={c.value} unit={c.unit} disabled={readOnly} onCommit={(v) => onCounter(c, v)} />
            </li>
          );
        })}
      </ul>
      {weekly.length > 0 && (
        <div className="mt-2 grid gap-2">
          {weekly.slice(0, 3).map((c) => (
            <div key={c.id} className="grid gap-1">
              <div className="flex justify-between text-[13px] text-muted-foreground">
                <span>{c.label} this week</span>
                <span>
                  <span className="text-foreground">{formatValue(c.weekTotal, c.unit === "$" ? "$" : null)}</span> / {formatValue(c.weekTarget, c.unit === "$" ? "$" : null)}
                </span>
              </div>
              <Meter value={(c.weekTotal ?? 0) / (c.weekTarget ?? 1)} />
            </div>
          ))}
        </div>
      )}
      <Link href={`/business?tab=${tab}`} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        All numbers and totals
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </SectionCard>
  );
}

interface BotCardProps {
  milestone: MilestoneItem | null;
  minutes: number;
  targetHours: number;
  tasks: { done: number; total: number };
  readOnly: boolean;
  isToday: boolean;
  running: boolean;
  onStep: (index: number, done: boolean) => void;
  onStart: (area: WorkArea) => void;
}

/** The AI bot: the one milestone that matters now, its steps, and today's hours on it. */
export function BotCard({ milestone, minutes, targetHours, tasks, readOnly, isToday, running, onStep, onStart }: BotCardProps) {
  const steps = milestone?.steps ?? [];
  const pct = steps.length ? steps.filter((s) => s.done).length / steps.length : 0;
  const hoursHit = targetHours > 0 && minutes >= targetHours * 60;
  const total = (targetHours > 0 ? 1 : 0) + tasks.total;
  const done = (hoursHit ? 1 : 0) + tasks.done;

  return (
    <SectionCard
      id="trading"
      title="AI Bot"
      meta={
        <span>
          <span className="text-foreground">{done}</span>/{total}
        </span>
      }
    >
      {milestone ? (
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 text-[17px] leading-snug">{milestone.title}</p>
            <span className="text-[17px] text-primary">{Math.round(pct * 100)}%</span>
          </div>
          <Meter value={pct} label="Milestone progress" />
          <div className="mt-1 flex flex-wrap gap-1.5">
            {steps.map((s, i) => (
              <button
                key={`${s.title}-${i}`}
                type="button"
                role="checkbox"
                aria-checked={s.done}
                disabled={readOnly}
                onClick={() => onStep(i, !s.done)}
                className={cn(
                  "inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                  s.done ? "border-primary/40 bg-lamp-soft text-foreground" : "border-border text-muted-foreground",
                )}
              >
                {s.done && <Check className="size-3.5 text-primary" strokeWidth={3} aria-hidden />}
                {s.title}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[15px] text-muted-foreground">No milestone set. Name the one thing the bot needs next.</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[15px]">
          <span className={cn(hoursHit ? "text-primary" : "text-foreground")}>{formatDuration(minutes)}</span>
          <span className="text-muted-foreground"> of {targetHours}h today</span>
        </p>
        {isToday && !readOnly && !running && (
          <button type="button" onClick={() => onStart("trading")} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-primary/60 px-4 text-sm font-medium text-primary">
            <Play className="size-3.5 fill-current" aria-hidden />
            Start
          </button>
        )}
      </div>
      <Link href="/business?tab=bot" className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        {milestone ? "Steps, notes and history" : "Set the milestone"}
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ discipline */

export function DisciplineCard({ habits, readOnly, timeZone, onToggle }: { habits: HabitItem[]; readOnly: boolean; timeZone: string; onToggle: ToggleHabit }) {
  const due = habits.filter((h) => h.due || h.completedAt);
  const done = due.filter((h) => h.completedAt).length;
  return (
    <SectionCard
      id="discipline"
      title="Discipline"
      meta={
        <span>
          <span className="text-foreground">{done}</span>/{due.length}
        </span>
      }
    >
      {due.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">
          No discipline habits.{" "}
          <Link href="/habits" className="text-foreground underline underline-offset-4">
            Add one
          </Link>
        </p>
      ) : (
        <HabitGrid habits={due} readOnly={readOnly} timeZone={timeZone} onToggle={onToggle} />
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ goals */

/** Today → Week → Month → Year for the main goals, each step a link. */
export function GoalsCard({ ladders, weekStart }: { ladders: GoalLadder[]; weekStart: LocalDate }) {
  return (
    <SectionCard id="goals" title="Goals" meta={<Link href="/goals" className="inline-flex min-h-11 items-center text-sm hover:text-foreground">All goals</Link>}>
      {ladders.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">
          No goals for this year yet.{" "}
          <Link href="/goals" className="text-foreground underline underline-offset-4">
            Set one
          </Link>{" "}
          and it breaks down into this month, this week and today.
        </p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {ladders.map((l) => (
            <li key={l.yearly.id} className="grid grid-cols-[minmax(0,1fr)] gap-1">
              {l.area && l.area !== "other" && <p className="text-xs text-faint">{AREA_LABEL[l.area]}</p>}
              <Step href={`/goals/year/${l.yearly.id}`} label={String(l.yearly.year)} title={l.yearly.title} ratio={l.yearly.ratio} depth={0} />
              {l.monthly ? (
                <Step href={`/goals/month/${l.monthly.monthStart.slice(0, 7)}`} label={monthShort(l.monthly.monthStart)} title={l.monthly.title} ratio={l.monthly.ratio} depth={1} />
              ) : (
                <Step href={`/goals/year/${l.yearly.id}`} label="Month" title="Not broken down yet" ratio={null} depth={1} muted />
              )}
              {l.weekly ? (
                <Step href={`/goals/week/${l.weekly.weekStart}`} label="Week" title={l.weekly.title} ratio={l.weekly.ratio} depth={2} />
              ) : l.monthly ? (
                <Step href={`/goals/week/${weekStart}`} label="Week" title="Plan this week" ratio={null} depth={2} muted />
              ) : null}
              {l.today && <Step href="#big3" label="Today" title={l.today} ratio={null} depth={3} />}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function Step({ href, label, title, ratio, depth, muted }: { href: string; label: string; title: string; ratio: number | null; depth: number; muted?: boolean }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-2 rounded-lg hover:bg-accent/50" style={{ paddingLeft: depth * 14 }}>
      {depth > 0 && <span aria-hidden className="h-4 w-2 shrink-0 border-b border-l border-border" />}
      <span className="w-12 shrink-0 text-[13px] text-faint">{label}</span>
      <span className={cn("min-w-0 flex-1 truncate text-[15px]", muted && "text-muted-foreground")}>{title}</span>
      {ratio !== null && <span className="shrink-0 text-[13px] text-muted-foreground">{Math.round(ratio * 100)}%</span>}
    </Link>
  );
}
