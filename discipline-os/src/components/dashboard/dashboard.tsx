"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { saveBibleText, setBibleCheck, setReading, savePriority, setPriorityStatus, saveReviewField, completeDay, reopenDay } from "@/app/actions/day";
import { setHabitDone } from "@/app/actions/habits";
import { addBlock, deleteBlock, endSessionAt, saveSessionNote, startSession, stopSession } from "@/app/actions/work";
import { HabitRow } from "@/components/habit-row";
import { PriorityCard } from "@/components/priority-card";
import { SectionCard } from "@/components/section-card";
import { useNow } from "@/hooks/use-now";
import { addDays, clockTime, shortDate, type LocalDate } from "@/lib/day";
import { BIBLE_ITEMS, REVIEW_ITEMS, computeScore } from "@/lib/score";
import type { DayScore } from "@/lib/streak";
import type {
  ActionResult,
  BibleCheck,
  BibleState,
  DayView,
  HabitCategory,
  HabitItem,
  PriorityItem,
  PriorityStatus,
  ReviewField,
  ReviewState,
  WorkBlockItem,
  WorkSessionItem,
} from "@/lib/types";
import { REVIEW_FIELDS } from "@/lib/types";
import { BibleSection } from "./bible-section";
import { PlanWeekPrompt, SupportingActions, TodaySuggestions } from "./goal-plan";
import { DayHeader } from "./day-header";
import { ReviewSection } from "./review-section";
import { WorkSection, type RunningSession } from "./work-section";

const SAVE_FAILED = "That didn't save. Check your connection and try again.";

/**
 * Optimistic write: show the change now, save in the background, put it back (and say so)
 * if the save fails.
 */
async function optimistic<T>(apply: () => void, rollback: () => void, action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  apply();
  try {
    const res = await action();
    if (!res.ok) {
      rollback();
      toast.error(res.error);
    }
    return res;
  } catch {
    rollback();
    toast.error(SAVE_FAILED);
    return { ok: false, error: SAVE_FAILED };
  }
}

async function call<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const res = await action();
    if (!res.ok) toast.error(res.error);
    return res;
  } catch {
    toast.error(SAVE_FAILED);
    return { ok: false, error: SAVE_FAILED };
  }
}

function minutesOn(date: LocalDate, sessions: WorkSessionItem[], running: RunningSession | null, now: number): number {
  let total = 0;
  const seen = new Set<string>();
  for (const s of sessions) {
    seen.add(s.id);
    const end = s.endedAt ? new Date(s.endedAt).getTime() : now || new Date(s.startedAt).getTime();
    total += Math.max(0, end - new Date(s.startedAt).getTime());
  }
  if (running && running.localDate === date && !seen.has(running.id) && now) {
    total += Math.max(0, now - new Date(running.startedAt).getTime());
  }
  return total / 60000;
}

export function Dashboard({ view }: { view: DayView }) {
  const router = useRouter();
  const now = useNow();
  const { date, today, isToday, profile } = view;
  const tz = profile.timezone;

  const [habits, setHabits] = useState<HabitItem[]>(view.habits);
  const [priorities, setPriorities] = useState<PriorityItem[]>(view.priorities);
  const [bible, setBible] = useState<BibleState>(view.bible);
  const [review, setReview] = useState<ReviewState>(view.review);
  const [blocks, setBlocks] = useState<WorkBlockItem[]>(view.blocks);
  const [sessions, setSessions] = useState<WorkSessionItem[]>(view.sessions);
  const [running, setRunning] = useState<RunningSession | null>(view.openSession);
  const [locked, setLocked] = useState(view.locked);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ blockId: string | null; running: RunningSession } | null>(null);
  const [keptRunning, setKeptRunning] = useState<string | null>(null);

  const readOnly = Boolean(locked);

  const byCategory = useMemo(() => {
    const groups: Record<HabitCategory, HabitItem[]> = { morning: [], body: [], discipline: [], god: [] };
    for (const h of [...habits].sort((a, b) => a.sortOrder - b.sortOrder)) groups[h.category].push(h);
    return groups;
  }, [habits]);

  const count = (list: HabitItem[]) => ({ done: list.filter((h) => h.completedAt).length, total: list.length });
  const morning = count(byCategory.morning);
  const body = count(byCategory.body);
  const discipline = count(byCategory.discipline);
  const god = count(byCategory.god);
  const bibleDone = (Object.values(bible.checks) as boolean[]).filter(Boolean).length;
  const reviewDone = REVIEW_FIELDS.filter((f) => review[f].trim()).length;
  const workMinutes = minutesOn(date, sessions, running, now);

  const live = computeScore({
    god: { done: god.done + bibleDone, total: god.total + BIBLE_ITEMS },
    body,
    discipline: { done: morning.done + discipline.done, total: morning.total + discipline.total },
    reflection: { done: reviewDone, total: REVIEW_ITEMS },
    work: { minutes: workMinutes, targetMinutes: profile.workTargetHours * 60 },
  }).score;
  const score = locked ? locked.score : live;

  // The streak and the strip move as today's score crosses the line.
  const threshold = profile.streakThreshold;
  const serverToday = view.history.find((d) => d.date === today);
  const baseStreak = view.streak.current - (serverToday && serverToday.score >= threshold ? 1 : 0);
  const streak = isToday ? baseStreak + (score >= threshold ? 1 : 0) : view.streak.current;
  const strip: DayScore[] = useMemo(() => {
    const byDate = new Map(view.history.map((d) => [d.date, d]));
    const out: DayScore[] = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = addDays(today, -i);
      const known = byDate.get(d);
      if (d === date) out.push({ date: d, score, locked: Boolean(locked) });
      else out.push(known ?? { date: d, score: 0, locked: false });
    }
    return out;
  }, [view.history, today, date, score, locked]);

  /* ------------------------------------------------------------- habits */
  function toggleHabit(habit: HabitItem, done: boolean) {
    const before = habits.find((h) => h.id === habit.id);
    const stamp = new Date().toISOString(); // display only, replaced by the server's time
    void optimistic(
      () =>
        setHabits((list) =>
          list.map((h) => (h.id === habit.id ? { ...h, completedAt: done ? stamp : null, editedAt: done && !isToday ? stamp : null } : h)),
        ),
      () => setHabits((list) => list.map((h) => (h.id === habit.id && before ? before : h))),
      async () => {
        const res = await setHabitDone({ habitId: habit.id, date, done });
        if (res.ok) {
          setHabits((list) =>
            list.map((h) => (h.id === habit.id ? { ...h, completedAt: res.data.completedAt, editedAt: res.data.editedAt } : h)),
          );
        }
        return res;
      },
    );
  }

  /* ------------------------------------------------------------- priorities */
  function updatePriority(position: 1 | 2 | 3, patch: Partial<PriorityItem>) {
    setPriorities((list) => list.map((p) => (p.position === position ? { ...p, ...patch } : p)));
  }

  function saveTitle(p: PriorityItem, title: string) {
    const before = { ...p };
    void optimistic(
      () => updatePriority(p.position, title ? { title } : { title: "", description: null, status: "pending", completedAt: null, id: null, dailyGoalId: null }),
      () => updatePriority(p.position, before),
      async () => {
        const res = await savePriority({ date, position: p.position, title });
        if (res.ok) updatePriority(p.position, { id: res.data.id });
        return res;
      },
    );
  }

  function saveDescription(p: PriorityItem, description: string) {
    const before = { ...p };
    void optimistic(
      () => updatePriority(p.position, { description: description || null }),
      () => updatePriority(p.position, before),
      () => savePriority({ date, position: p.position, title: p.title, description }),
    );
  }

  function setStatus(p: PriorityItem, status: PriorityStatus) {
    const before = { ...p };
    void optimistic(
      () => updatePriority(p.position, { status, completedAt: status === "done" ? new Date().toISOString() : null }),
      () => updatePriority(p.position, before),
      async () => {
        const res = await setPriorityStatus({ date, position: p.position, status });
        if (res.ok) updatePriority(p.position, { status: res.data.status, completedAt: res.data.completedAt });
        return res;
      },
    );
  }

  /* ------------------------------------------------------------- bible */
  const readingRef = { book: bible.book, chapter: bible.chapter };

  function checkBible(item: BibleCheck, done: boolean) {
    const before = bible;
    void optimistic(
      () => setBible((b) => ({ ...b, suggested: false, checks: { ...b.checks, [item]: done } })),
      () => setBible(before),
      async () => {
        const res = await setBibleCheck({ date, item, done, reading: readingRef });
        if (res.ok) setBible((b) => ({ ...b, readingId: res.data.readingId }));
        return res;
      },
    );
  }

  async function changeReading(book: string, chapter: number, passage: string | null): Promise<boolean> {
    const res = await call(() => setReading({ date, reading: { book, chapter }, passage }));
    if (res.ok) setBible((b) => ({ ...b, book, chapter, passage, suggested: false, readingId: res.data.readingId }));
    return res.ok;
  }

  /* ------------------------------------------------------------- work */
  async function start(blockId: string | null, replaceRunning = false) {
    setConflict(null);
    const res = await call(() => startSession({ blockId, replaceRunning }));
    if (!res.ok) return;
    if ("running" in res.data) {
      setConflict({ blockId, running: res.data.running });
      return;
    }
    const started = res.data.started;
    const task = blocks.find((b) => b.id === blockId)?.task ?? null;
    if (replaceRunning && running) {
      const stoppedId = running.id;
      setSessions((list) => list.map((s) => (s.id === stoppedId ? { ...s, endedAt: started.startedAt } : s)));
    }
    setRunning({ ...started, task });
    if (started.localDate === date) setSessions((list) => [...list, started]);
  }

  async function stop(sessionId: string) {
    const res = await call(() => stopSession({ sessionId }));
    if (!res.ok) return;
    setRunning(null);
    setSessions((list) => list.map((s) => (s.id === sessionId ? res.data : s)));
    if (res.data.localDate === date) setNoteFor(sessionId);
  }

  async function saveNote(sessionId: string, note: string) {
    setNoteFor(null);
    if (!note) return;
    const res = await call(() => saveSessionNote({ sessionId, note }));
    if (res.ok) setSessions((list) => list.map((s) => (s.id === sessionId ? { ...s, note } : s)));
  }

  async function endAt(sessionId: string, endDate: LocalDate, endTime: string) {
    const res = await call(() => endSessionAt({ sessionId, endDate, endTime }));
    if (!res.ok) return;
    setRunning(null);
    setSessions((list) => list.map((s) => (s.id === sessionId ? res.data : s)));
    toast.success(`Ended at ${clockTime(res.data.endedAt ?? new Date(), tz)}.`);
    router.refresh();
  }

  async function addWorkBlock(task: string, start: string | null, end: string | null) {
    const res = await call(() => addBlock({ date, task, plannedStart: start, plannedEnd: end }));
    if (res.ok) setBlocks((list) => [...list, res.data].sort((a, b) => (a.plannedStart ?? "99").localeCompare(b.plannedStart ?? "99")));
    return res.ok;
  }

  function removeBlock(blockId: string) {
    const before = blocks;
    void optimistic(
      () => setBlocks((list) => list.filter((b) => b.id !== blockId)),
      () => setBlocks(before),
      () => deleteBlock({ blockId }),
    );
  }

  /* ------------------------------------------------------------- complete */
  async function complete() {
    const res = await call(() => completeDay({ date }));
    if (res.ok) {
      setLocked({ score: res.data.score, completedAt: res.data.completedAt });
      router.refresh();
    }
  }

  async function reopen() {
    const res = await call(() => reopenDay({ date }));
    if (res.ok) {
      setLocked(null);
      router.refresh();
    }
  }

  const habitSection = (id: string, title: string, list: HabitItem[], empty: string) => {
    const c = count(list);
    return (
      <SectionCard id={id} title={title} meta={list.length ? `${c.done} of ${c.total}` : undefined}>
        {list.length === 0 ? (
          <p className="py-2 text-[15px] text-muted-foreground">
            {empty}{" "}
            <Link href="/habits" className="text-foreground underline underline-offset-4">
              Add one
            </Link>
          </p>
        ) : (
          <div className="grid">
            {list.map((h) => (
              <HabitRow
                key={h.id}
                name={h.name}
                done={Boolean(h.completedAt)}
                time={h.completedAt ? clockTime(h.completedAt, tz) : null}
                edited={Boolean(h.editedAt)}
                disabled={readOnly}
                onToggle={(done) => toggleHabit(h, done)}
              />
            ))}
          </div>
        )}
      </SectionCard>
    );
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <DayHeader
        date={date}
        today={today}
        firstDay={view.firstDay}
        score={score}
        threshold={threshold}
        locked={Boolean(locked)}
        streak={streak}
        morning={morning}
        workMinutes={workMinutes}
        workTargetHours={profile.workTargetHours}
        priorities={priorities}
        strip={strip}
      />

      {!isToday && (
        <p className="-mt-3 rounded-xl border border-border px-4 py-3 text-[15px] text-muted-foreground">
          You&apos;re filling in {shortDate(date)}. Anything you tick here is marked as edited.
        </p>
      )}
      {locked && (
        <p className="-mt-3 rounded-xl border border-primary/30 px-4 py-3 text-[15px] text-muted-foreground">
          This day is completed and locked. Reopen it at the bottom to change it.
        </p>
      )}

      {habitSection("morning", "Morning routine", byCategory.morning, "No morning habits yet.")}

      <BibleSection
        date={date}
        bible={bible}
        godHabits={byCategory.god}
        readOnly={readOnly}
        timeZone={tz}
        onCheck={checkBible}
        onSetReading={changeReading}
        onSaveObey={(value) => saveBibleText({ date, field: "obey_today", value, reading: readingRef })}
        onObeySaved={(value) => setBible((b) => ({ ...b, obeyToday: value, suggested: false }))}
        onToggleHabit={toggleHabit}
      />

      <SectionCard
        id="mission"
        title="Today's mission"
        prominent
        meta={`${priorities.filter((p) => p.status === "done").length} of ${priorities.filter((p) => p.title.trim()).length || 3}`}
      >
        {view.plan && isToday && !readOnly && <TodaySuggestions plan={view.plan} date={date} />}
        {view.plan && isToday && view.plan.hasGoals && !view.plan.hasWeekPlan && <PlanWeekPrompt weekStart={view.plan.weekStart} />}
        <ol className="grid">
          {priorities.map((p) => (
            <PriorityCard
              key={`${p.position}-${p.id ?? "new"}`}
              priority={p}
              chain={view.plan?.actions.find((a) => a.id === p.dailyGoalId)?.chain ?? null}
              suggestion={view.prioritySuggestion}
              disabled={readOnly}
              completedTime={p.completedAt ? clockTime(p.completedAt, tz) : null}
              onSaveTitle={(title) => saveTitle(p, title)}
              onSaveDescription={(d) => saveDescription(p, d)}
              onStatus={(s) => setStatus(p, s)}
            />
          ))}
        </ol>
        {view.plan && (
          <SupportingActions
            actions={view.plan.actions.filter((a) => !priorities.some((p) => p.dailyGoalId === a.id))}
            readOnly={readOnly}
          />
        )}
      </SectionCard>

      <WorkSection
        date={date}
        isToday={isToday}
        readOnly={readOnly}
        timeZone={tz}
        dayStartHour={profile.dayStartHour}
        targetHours={profile.workTargetHours}
        minutes={workMinutes}
        blocks={blocks}
        sessions={sessions}
        running={running}
        noteFor={noteFor}
        conflict={conflict}
        onStart={(blockId, replace) => void start(blockId, replace)}
        onCancelConflict={() => setConflict(null)}
        onStop={(id) => void stop(id)}
        onSaveNote={(id, note) => void saveNote(id, note)}
        onSkipNote={() => setNoteFor(null)}
        onEndAt={(id, d, t) => void endAt(id, d, t)}
        onKeepRunning={(id) => setKeptRunning(id)}
        longRunningDismissed={keptRunning === running?.id}
        onAddBlock={addWorkBlock}
        onDeleteBlock={removeBlock}
      />

      {habitSection("body", "Body", byCategory.body, "No body habits yet.")}
      {habitSection("discipline", "Discipline", byCategory.discipline, "No discipline habits yet.")}

      <ReviewSection
        date={date}
        isToday={isToday}
        review={review}
        score={score}
        threshold={threshold}
        timeZone={tz}
        locked={locked}
        timerRunningToday={Boolean(running && running.localDate === date)}
        onSave={(field: ReviewField, value: string) => saveReviewField({ date, field, value })}
        onSaved={(field, value) => setReview((r) => ({ ...r, [field]: value }))}
        onComplete={complete}
        onReopen={reopen}
      />
    </div>
  );
}
