"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { saveMilestone } from "@/app/actions/bot";
import { setCounter } from "@/app/actions/counters";
import { completeDay, dayDetails, reopenDay, saveJournal, saveReviewField, setMinimumDay, setReading } from "@/app/actions/day";
import { setHabitDone } from "@/app/actions/habits";
import { deleteTask, moveTask, planMyDay, setTaskRank, setTaskStatus, updateTask, addTask } from "@/app/actions/tasks";
import { addBlock, deleteBlock, endSessionAt, saveSessionNote, startSession, stopSession } from "@/app/actions/work";
import { Check, Film } from "lucide-react";
import { DayComplete, type DayCompleteData } from "@/components/day-complete";
import { DayStrip } from "@/components/day-strip";
import { useNow } from "@/hooks/use-now";
import { isWorkArea, type WorkArea } from "@/lib/areas";
import { addDays, clockTime, localHourAt, shortDate, type LocalDate } from "@/lib/day";
import { itemsNudge } from "@/lib/gradient";
import { newRecords, type LiveValues } from "@/lib/history";
import { keepWord, weekAverage } from "@/lib/keep-word";
import { nextActions } from "@/lib/next-action";
import type { DayPlan } from "@/lib/plan";
import { morningTally, scoreboard } from "@/lib/scoreboard";
import { keepsChain, type DayScore } from "@/lib/streak";
import type {
  ActionResult,
  BibleState,
  BossSummary,
  CounterItem,
  DayView,
  HabitItem,
  MilestoneItem,
  ProofItem,
  ReviewField,
  ReviewState,
  TaskItem,
  TaskStatus,
  WorkBlockItem,
  WorkSessionItem,
} from "@/lib/types";
import { REVIEW_FIELDS } from "@/lib/types";
import { BigThree } from "./big-three";
import { Scoreboard, TodayHeader, WeekGlance } from "./header";
import { MinimumCard, MinimumSwitch, minimumItems } from "./minimum-day";
import { MemoryNote, RecordBanner } from "./moments";
import { NextActionCard } from "./next-action";
import { WeekStreak } from "./week-streak";
import { PlanSheet } from "./plan-sheet";
import { ProofCard } from "./proof";
import { ReviewSection } from "./review-card";
import { BotCard, CountersCard, DisciplineCard, FaithCard, FitnessCard, GoalsCard, MorningCard } from "./sections";
import { TaskSheet, type TaskPatch } from "./task-sheet";
import { WorkSection, type RunningSession } from "./work-card";

const SAVE_FAILED = "That didn't save. Check your connection and try again.";

/** Show the change now, save in the background, put it back (and say so) if the save fails. */
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

function minutesBy(date: LocalDate, sessions: WorkSessionItem[], running: RunningSession | null, now: number): Partial<Record<WorkArea, number>> {
  const out: Partial<Record<WorkArea, number>> = {};
  const add = (area: WorkArea | null, ms: number) => {
    const key = area ?? "other";
    out[key] = (out[key] ?? 0) + Math.max(0, ms) / 60000;
  };
  const seen = new Set<string>();
  for (const s of sessions) {
    seen.add(s.id);
    const end = s.endedAt ? new Date(s.endedAt).getTime() : now || new Date(s.startedAt).getTime();
    add(s.area, end - new Date(s.startedAt).getTime());
  }
  if (running && running.localDate === date && !seen.has(running.id) && now) add(running.area, now - new Date(running.startedAt).getTime());
  return out;
}

/** The Today screen: one scroll from "what matters" to "did I do it". */
export function Today({ view, partOfDay, name, hour: serverHour, boss }: { view: DayView; partOfDay: string; name: string | null; hour: number; boss: BossSummary | null }) {
  const router = useRouter();
  const now = useNow();
  const { date, today, isToday, profile } = view;
  const tz = profile.timezone;

  const [habits, setHabits] = useState<HabitItem[]>(view.habits);
  const [tasks, setTasks] = useState<TaskItem[]>(view.tasks);
  const [unfinished, setUnfinished] = useState<TaskItem[]>(view.unfinished);
  const [later, setLater] = useState<TaskItem[]>(view.later);
  const [counters, setCounters] = useState<CounterItem[]>(view.counters);
  const [bible, setBible] = useState<BibleState>(view.bible);
  const [review, setReview] = useState<ReviewState>(view.review);
  const [blocks, setBlocks] = useState<WorkBlockItem[]>(view.blocks);
  const [sessions, setSessions] = useState<WorkSessionItem[]>(view.sessions);
  const [running, setRunning] = useState<RunningSession | null>(view.openSession);
  const [milestone, setMilestone] = useState<MilestoneItem | null>(view.milestone);
  const [proofs, setProofs] = useState<ProofItem[]>(view.proofs);
  const [locked, setLocked] = useState(view.locked);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ blockId: string | null; area: WorkArea | null; running: RunningSession } | null>(null);
  const [keptRunning, setKeptRunning] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<TaskItem | null>(null);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [minimumAt, setMinimumAt] = useState<string | null>(view.minimumAt);
  const [switching, setSwitching] = useState(false);
  const [askMinimum, setAskMinimum] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [closing, setClosing] = useState<{ data: DayCompleteData; heading: string } | null>(null);

  // When the server's lists change (a plan applied, a task moved, a block added), take its
  // lists. Everything else on screen stays as it is, so a refresh never undoes a number just
  // typed or a tick still saving.
  const listsKey = [view.tasks.map((t) => t.id).join("."), view.blocks.map((b) => b.id).join("."), view.milestone?.id ?? ""].join(":");
  const [seenLists, setSeenLists] = useState(listsKey);
  if (seenLists !== listsKey) {
    setSeenLists(listsKey);
    setTasks(view.tasks);
    setUnfinished(view.unfinished);
    setLater(view.later);
    setBlocks(view.blocks);
    setMilestone(view.milestone);
  }

  const readOnly = Boolean(locked);
  const byCategory = useMemo(() => {
    const sorted = [...habits].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      morning: sorted.filter((h) => h.category === "morning"),
      body: sorted.filter((h) => h.category === "body"),
      discipline: sorted.filter((h) => h.category === "discipline"),
      god: sorted.filter((h) => h.category === "god"),
    };
  }, [habits]);

  /* ------------------------------------------------------------- the day's numbers */
  const byArea = minutesBy(date, sessions, running, now);
  const workMinutes = Object.values(byArea).reduce((s, m) => s + (m ?? 0), 0);
  const reviewDone = REVIEW_FIELDS.every((f) => review[f].trim());
  const due = habits.filter((h) => h.due);
  const word = keepWord({
    habitsDone: due.filter((h) => h.completedAt).length,
    habitsTotal: due.length,
    tasksDone: tasks.filter((t) => t.status === "done").length,
    tasksTotal: tasks.length,
    reviewDone,
    workMinutes,
    workTargetMinutes: profile.workTargetHours * 60,
  });
  const percent = locked ? locked.score : word.percent ?? 0;
  const boardHabits = habits.map((h) => ({ category: h.category, kind: h.kind, due: h.due, done: Boolean(h.completedAt) }));
  const board = scoreboard({
    habits: boardHabits,
    tasks,
    counters,
    workedByArea: byArea,
    hourTargets: profile.hourTargets,
    reviewDone,
  });
  const morning = morningTally(boardHabits);
  const areaTasks = (area: string) => {
    const list = tasks.filter((t) => t.area === area);
    return { done: list.filter((t) => t.status === "done").length, total: list.length };
  };

  // Minimum Day: the non-negotiables, live.
  const minimumOn = Boolean(minimumAt);
  const minState = minimumItems(habits, workMinutes, profile.minimumWorkMinutes, profile.minimumFitness);
  const minimum: DayScore["minimum"] = minimumOn ? (minState.secured ? "secured" : "on") : null;

  // Streak, strip and week average follow today's live number.
  const threshold = profile.streakThreshold;
  const serverToday = view.history.find((d) => d.date === today);
  const baseStreak = view.streak.current - (serverToday && keepsChain(serverToday, threshold) ? 1 : 0);
  const streak = isToday ? baseStreak + (keepsChain({ date, score: percent, locked: Boolean(locked), minimum }, threshold) ? 1 : 0) : view.streak.current;
  const strip: DayScore[] = useMemo(() => {
    const known = new Map(view.history.map((d) => [d.date, d]));
    const out: DayScore[] = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = addDays(today, -i);
      out.push(d === date ? { date: d, score: percent, locked: Boolean(locked), minimum } : known.get(d) ?? { date: d, score: 0, locked: false, minimum: null });
    }
    return out;
  }, [view.history, today, date, percent, locked, minimum]);
  const weekAvg = weekAverage(
    strip.map((d) => ({ date: d.date, score: d.date >= view.firstDay ? d.score : null })),
    view.weekStart,
    today,
  );

  /* ------------------------------------------------------------- habits */
  function toggleHabit(habit: HabitItem, done: boolean) {
    const before = habits.find((h) => h.id === habit.id);
    const stamp = new Date().toISOString();
    void optimistic(
      () => setHabits((list) => list.map((h) => (h.id === habit.id ? { ...h, completedAt: done ? stamp : null, editedAt: done && !isToday ? stamp : null } : h))),
      () => setHabits((list) => list.map((h) => (h.id === habit.id && before ? before : h))),
      async () => {
        const res = await setHabitDone({ habitId: habit.id, date, done });
        if (res.ok) setHabits((list) => list.map((h) => (h.id === habit.id ? { ...h, completedAt: res.data.completedAt, editedAt: res.data.editedAt } : h)));
        if (res.ok && habit.kind === "bible") setBible((b) => ({ ...b, suggested: false }));
        return res;
      },
    );
  }

  /* ------------------------------------------------------------- tasks */
  const patchTask = (id: string, patch: Partial<TaskItem>) => setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  function toggleTask(task: TaskItem) {
    setStatus(task, task.status === "done" ? "pending" : "done");
  }

  function setStatus(task: TaskItem, status: TaskStatus) {
    const before = { ...task };
    void optimistic(
      () => patchTask(task.id, { status, completedAt: status === "done" ? new Date().toISOString() : null }),
      () => patchTask(task.id, before),
      async () => {
        const res = await setTaskStatus({ id: task.id, status });
        if (res.ok && res.data.counter) {
          const { metricId, value } = res.data.counter;
          setCounters((list) => list.map((c) => (c.id === metricId && c.value < value ? { ...c, value, weekTotal: c.weekTotal + (value - c.value) } : c)));
        }
        return res;
      },
    );
    setOpenTask((t) => (t && t.id === task.id ? { ...t, status } : t));
  }

  function added(task: TaskItem) {
    if (task.localDate === date) setTasks((list) => [...list, task]);
    else if (task.localDate === null) setLater((list) => [task, ...list]);
  }

  function saveTask(task: TaskItem, patch: TaskPatch) {
    const before = { ...task };
    const apply = (p: Partial<TaskItem>) => {
      patchTask(task.id, p);
      setLater((list) => list.map((t) => (t.id === task.id ? { ...t, ...p } : t)));
    };
    void optimistic(() => apply(patch), () => apply(before), () => updateTask({ id: task.id, ...patch }));
  }

  function rankTask(task: TaskItem, rank: 1 | 2 | 3 | null) {
    const before = tasks;
    void optimistic(
      () =>
        setTasks((list) =>
          list.map((t) => {
            if (t.id === task.id) return { ...t, rank };
            if (rank !== null && t.rank === rank) return { ...t, rank: task.rank };
            return t;
          }),
        ),
      () => setTasks(before),
      () => setTaskRank({ id: task.id, rank }),
    );
    setOpenTask(null);
  }

  async function move(task: TaskItem, to: "today" | "later") {
    const res = await call(() => moveTask({ id: task.id, to }));
    if (!res.ok) return;
    const moved = res.data;
    setUnfinished((list) => list.filter((t) => t.id !== task.id));
    setLater((list) => list.filter((t) => t.id !== task.id));
    setTasks((list) => list.filter((t) => t.id !== task.id));
    added(moved);
    setOpenTask(null);
    toast.success(to === "today" ? "Moved to today." : "Moved to later.");
  }

  async function removeTask(task: TaskItem) {
    const res = await call(() => deleteTask({ id: task.id }));
    if (!res.ok) return;
    setTasks((list) => list.filter((t) => t.id !== task.id));
    setLater((list) => list.filter((t) => t.id !== task.id));
    setOpenTask(null);
  }

  async function takeLastNight(title: string) {
    const res = await call(() => addTask({ date, title, big3: true }));
    if (res.ok) added(res.data);
  }

  async function startPlan() {
    setPlanning(true);
    const res = await call(() => planMyDay({ date }));
    setPlanning(false);
    if (res.ok) setPlan(res.data);
  }

  /* ------------------------------------------------------------- counters */
  function commitCounter(counter: CounterItem, value: number) {
    const before = { ...counter };
    const delta = value - counter.value;
    void optimistic(
      () => setCounters((list) => list.map((c) => (c.id === counter.id ? { ...c, value, weekTotal: c.aggregation === "latest" ? value : c.weekTotal + delta } : c))),
      () => setCounters((list) => list.map((c) => (c.id === counter.id ? before : c))),
      async () => {
        const res = await setCounter({ metricId: counter.id, date, value });
        if (res.ok) {
          if (res.data.completedTaskIds.length > 0) {
            const doneIds = new Set(res.data.completedTaskIds);
            setTasks((list) => list.map((t) => (doneIds.has(t.id) ? { ...t, status: "done", completedAt: new Date().toISOString() } : t)));
          }
          const ticked = res.data.tickedHabitId;
          if (ticked) setHabits((list) => list.map((h) => (h.id === ticked && !h.completedAt ? { ...h, completedAt: new Date().toISOString() } : h)));
        }
        return res;
      },
    );
  }

  /* ------------------------------------------------------------- bible */
  async function changeReading(book: string, chapter: number, passage: string | null): Promise<boolean> {
    const res = await call(() => setReading({ date, reading: { book, chapter }, passage }));
    if (res.ok) setBible((b) => ({ ...b, book, chapter, passage, suggested: false, readingId: res.data.readingId }));
    return res.ok;
  }

  /* ------------------------------------------------------------- bot */
  function toggleStep(index: number, done: boolean) {
    if (!milestone) return;
    const before = milestone;
    const steps = milestone.steps.map((s, i) => (i === index ? { ...s, done } : s));
    void optimistic(
      () => setMilestone({ ...milestone, steps }),
      () => setMilestone(before),
      () => saveMilestone({ id: milestone.id, steps }),
    );
  }

  /* ------------------------------------------------------------- work */
  async function start(blockId: string | null, replaceRunning = false, area: WorkArea | null = null) {
    setConflict(null);
    const res = await call(() => startSession({ blockId, replaceRunning, area }));
    if (!res.ok) return;
    if ("running" in res.data) {
      setConflict({ blockId, area, running: res.data.running });
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
    router.refresh();
  }

  async function stop(sessionId: string) {
    const res = await call(() => stopSession({ sessionId }));
    if (!res.ok) return;
    setRunning(null);
    setSessions((list) => list.map((s) => (s.id === sessionId ? res.data : s)));
    if (res.data.localDate === date) setNoteFor(sessionId);
    router.refresh();
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

  async function addWorkBlock(task: string, start: string | null, end: string | null, area: WorkArea | null) {
    const res = await call(() => addBlock({ date, task, plannedStart: start, plannedEnd: end, area }));
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
      const { summary, replay, score, completedAt } = res.data;
      setLocked({ score, completedAt });
      setRunning((r) => (r && r.localDate === date ? null : r));
      setClosing({
        heading: "Day complete",
        data: { date, score, made: summary.made, kept: summary.kept, workMinutes: summary.workMinutes, minimum: summary.minimum, summary, replay },
      });
      router.refresh();
    }
  }

  async function replayDay() {
    const res = await call(() => dayDetails({ date }));
    if (!res.ok) return;
    const d = res.data;
    setClosing({
      heading: d.locked ? "Day complete" : "The day so far",
      data: { date, score: d.score, made: d.made, kept: d.kept, workMinutes: d.workMinutes, minimum: d.minimum, summary: d.closed, replay: d.replay },
    });
  }

  async function switchMinimum(on: boolean) {
    setSwitching(true);
    const res = await call(() => setMinimumDay({ date, on }));
    setSwitching(false);
    if (!res.ok) return;
    setMinimumAt(res.data.minimumAt);
    setAskMinimum(false);
    setShowAll(false);
    if (on) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function reopen() {
    const res = await call(() => reopenDay({ date }));
    if (res.ok) {
      setLocked(null);
      router.refresh();
    }
  }

  /* ------------------------------------------------------------- what's next, and how it's going */
  const hour = (() => {
    const h = now ? localHourAt(now, tz) : serverHour;
    return h < profile.dayStartHour ? h + 24 : h; // 1 am still belongs to last night
  })();
  const phase = !isToday
    ? null
    : locked
      ? ({ line: "Day complete.", tone: "kept" } as const)
      : hour < 12
        ? ({ line: word.kept === 0 ? "New day." : "Build the day.", tone: "lamp" } as const)
        : hour < 17
          ? ({ line: "Keep going.", tone: "lamp" } as const)
          : ({ line: "Close it out.", tone: "lamp" } as const);
  const wordNudge = isToday && !locked && word.made >= 5 ? itemsNudge(word.kept, word.made, ["commitment", "commitments"]) : null;

  const counterValue = (area: string, key: string) => counters.filter((c) => c.area === area && c.key === key).reduce((sum, c) => sum + c.value, 0);
  const revenueToday = counters.filter((c) => c.key === "revenue").reduce((sum, c) => sum + c.value, 0);
  const done = (kind: string) => habits.some((h) => h.kind === kind && h.completedAt);
  const live: LiveValues = {
    day: { work: workMinutes, leads: counterValue("imperium", "leads_called"), calls: counterValue("websites", "cold_calls"), revenue: revenueToday, cardio: counterValue("fitness", "cardio_minutes") },
    week: { work: workMinutes, revenue: revenueToday, gym: done("gym") ? 1 : 0 },
    doneToday: {
      bible: done("bible"),
      prayer: done("prayer") || done("evening_prayer"),
      gym: done("gym"),
      cardio: done("cardio"),
      fitness: done("gym") || done("cardio"),
      morning: morning.total > 0 && morning.done === morning.total,
      review: reviewDone,
      work: profile.workTargetHours > 0 && workMinutes >= profile.workTargetHours * 60,
      word: keepsChain({ date, score: percent, locked: false, minimum }, threshold),
    },
  };
  const records = isToday && !locked && view.baseline ? newRecords(view.baseline, live) : [];

  const runningMinutes = running && now ? Math.max(0, (now - new Date(running.startedAt).getTime()) / 60000) : 0;
  const actions = nextActions({
    today,
    hour,
    locked: Boolean(locked),
    tasks: tasks.map((t) => ({ ...t })),
    overdue: [...unfinished, ...later.filter((t) => t.dueDate !== null && t.dueDate <= today)].filter((t) => t.status === "pending"),
    counters,
    habits: habits.map((h) => ({ id: h.id, name: h.name, category: h.category, kind: h.kind, due: h.due, done: Boolean(h.completedAt) })),
    workMinutes,
    workTargetMinutes: profile.workTargetHours * 60,
    byArea,
    hourTargets: profile.hourTargets,
    running: running ? { area: running.area, minutes: runningMinutes, task: running.task } : null,
    reviewDone,
    minimum: minimumOn && !minState.secured ? minState.items : null,
    milestone: milestone ? { title: milestone.title, nextStep: milestone.steps.find((st) => !st.done)?.title ?? null } : null,
  });
  const findTask = (id: string) => [...tasks, ...unfinished, ...later].find((t) => t.id === id);
  const workAction = actions.find((a) => a.do.type === "work")?.do;
  const minimumWorkArea: WorkArea = workAction?.type === "work" ? workAction.area : "imperium";
  const full = !minimumOn || showAll;

  const habitsLine = [
    `Morning ${morning.total}`,
    `Faith ${board.faith.total}`,
    `Fitness ${board.fitness.total}`,
    `Discipline ${board.discipline.total}`,
  ].join(" · ");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <TodayHeader
        date={date}
        today={today}
        firstDay={view.firstDay}
        partOfDay={partOfDay}
        name={name}
        word={locked ? { ...word, percent: locked.score } : word}
        locked={Boolean(locked)}
        threshold={threshold}
        weekAverage={weekAvg}
        streak={streak}
        phase={phase}
        nudge={wordNudge}
      />

      {!isToday && (
        <p className="-mt-2 rounded-2xl border border-border px-4 py-3 text-[15px] text-muted-foreground">
          You&apos;re filling in {shortDate(date)}. Anything you tick here is marked as edited.
        </p>
      )}

      {locked && (
        <button
          type="button"
          onClick={() => void replayDay()}
          className="surface flex items-center justify-between gap-3 rounded-[24px] border px-4 py-3 text-left"
        >
          <span className="grid gap-0.5">
            <span className="inline-flex items-center gap-2 text-[17px] font-medium text-kept">
              <Check className="size-4" aria-hidden />
              Day complete
            </span>
            <span className="text-sm text-muted-foreground">
              Kept my word {locked.score}%{view.closed ? ` · ${view.closed.achievements.length} things done` : ""}. Reopen it at the bottom to change it.
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm">
            <Film className="size-4" aria-hidden />
            Replay
          </span>
        </button>
      )}

      {records.length > 0 && <RecordBanner date={date} events={records} />}

      {isToday && !locked && (
        <div className="grid gap-1">
          <NextActionCard
            actions={actions}
            running={Boolean(running)}
            onStart={(area) => void start(null, false, area)}
            onTaskDone={(id) => {
              const t = findTask(id);
              if (t) setStatus(t, "done");
            }}
            onHabitDone={(id) => {
              const h = habits.find((x) => x.id === id);
              if (h) toggleHabit(h, true);
            }}
            onMove={(id) => {
              const t = findTask(id);
              if (t) void move(t, "today");
            }}
            onCloseDay={() => void complete()}
          />
          {!minimumOn && (
            <button type="button" onClick={() => setAskMinimum(true)} className="min-h-11 justify-self-end px-1 text-sm text-muted-foreground hover:text-foreground">
              I&apos;m having a shit day
            </button>
          )}
        </div>
      )}

      {minimumOn && (
        <MinimumCard
          state={minState}
          habits={habits}
          workMinutes={workMinutes}
          minWork={profile.minimumWorkMinutes}
          running={Boolean(running)}
          readOnly={readOnly}
          showingAll={showAll}
          onToggleHabit={toggleHabit}
          onStartWork={() => void start(null, false, minimumWorkArea)}
          onShowAll={() => setShowAll((v) => !v)}
          onEnd={() => void switchMinimum(false)}
        />
      )}

      {full && (
        <>
          <BigThree
            date={date}
            today={today}
            isToday={isToday}
            readOnly={readOnly}
            tasks={tasks}
            unfinished={unfinished}
            later={later}
            lastNightPriority={view.lastNightPriority}
            planning={planning}
            onPlan={() => void startPlan()}
            onToggle={toggleTask}
            onOpen={setOpenTask}
            onAdded={added}
            onMove={(t, to) => void move(t, to)}
            onUseLastNight={(t) => void takeLastNight(t)}
          />

          {isToday && <WeekStreak days={strip} weekStart={view.weekStart} today={today} firstDay={view.firstDay} threshold={threshold} streak={streak} />}

          <Scoreboard board={board} workMinutes={workMinutes} workTargetHours={profile.workTargetHours} />
          {isToday && <WeekGlance momentum={view.momentum} boss={boss} weekStart={view.weekStart} />}
          {view.memory && !locked && <MemoryNote date={date} card={view.memory} />}
        </>
      )}

      <WorkSection
        date={date}
        isToday={isToday}
        readOnly={readOnly}
        timeZone={tz}
        dayStartHour={profile.dayStartHour}
        targetHours={profile.workTargetHours}
        minutes={workMinutes}
        byArea={byArea}
        blocks={blocks}
        sessions={sessions}
        running={running}
        noteFor={noteFor}
        conflict={conflict}
        onStart={(blockId, replace, area) => void start(blockId, replace, area)}
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

      {full && (
        <>
          <MorningCard habits={byCategory.morning} readOnly={readOnly} timeZone={tz} onToggle={toggleHabit} />

          <FaithCard
            date={date}
            habits={habits}
            bible={bible}
            reviewDone={reviewDone}
            readOnly={readOnly}
            timeZone={tz}
            onToggle={toggleHabit}
            onSetReading={changeReading}
            onSaveJournal={(value) => saveJournal({ date, value, reading: { book: bible.book, chapter: bible.chapter } })}
            onJournalSaved={(value) => setBible((b) => ({ ...b, journal: value, suggested: false }))}
          />

          <FitnessCard
            date={date}
            today={today}
            habits={byCategory.body}
            gymWeek={view.gymWeek}
            cardioWeek={{
              done: view.cardioWeek.done - (view.habits.find((h) => h.kind === "cardio")?.completedAt ? 1 : 0) + (habits.find((h) => h.kind === "cardio")?.completedAt ? 1 : 0),
              days: view.cardioWeek.days,
            }}
            cardio={counters.find((c) => c.area === "fitness" && c.key === "cardio_minutes") ?? null}
            readOnly={readOnly}
            timeZone={tz}
            onToggle={toggleHabit}
            onCounter={commitCounter}
          />

          <CountersCard id="imperium" title="Imperium" tab="imperium" counters={counters.filter((c) => c.area === "imperium")} tasks={areaTasks("imperium")} readOnly={readOnly} onCounter={commitCounter} />
          <CountersCard id="websites" title="Websites" tab="websites" counters={counters.filter((c) => c.area === "websites")} tasks={areaTasks("websites")} readOnly={readOnly} onCounter={commitCounter} />

          <BotCard
            milestone={milestone}
            minutes={byArea.trading ?? 0}
            targetHours={profile.hourTargets.trading ?? 0}
            tasks={areaTasks("trading")}
            readOnly={readOnly}
            isToday={isToday}
            running={Boolean(running)}
            onStep={toggleStep}
            onStart={(area) => void start(null, false, isWorkArea(area) ? area : "trading")}
          />

          <DisciplineCard habits={byCategory.discipline} readOnly={readOnly} timeZone={tz} onToggle={toggleHabit} />

          <GoalsCard ladders={view.ladders} weekStart={view.weekStart} />

          <ProofCard date={date} proofs={proofs} readOnly={readOnly} onAdd={(p) => setProofs((list) => [...list, p])} onRemove={(id) => setProofs((list) => list.filter((p) => p.id !== id))} />
        </>
      )}

      <ReviewSection
        date={date}
        isToday={isToday}
        review={review}
        word={word}
        threshold={threshold}
        timeZone={tz}
        locked={locked}
        timerRunningToday={Boolean(running && running.localDate === date)}
        onSave={(field: ReviewField, value: string) => saveReviewField({ date, field, value })}
        onSaved={(field, value) => setReview((r) => ({ ...r, [field]: value }))}
        onComplete={complete}
        onReopen={reopen}
        onReplay={() => void replayDay()}
      />

      <section aria-label="Last 30 days" className="surface rounded-[28px] border px-4 py-4 sm:px-5">
        <DayStrip days={strip} threshold={threshold} selected={date} today={today} firstDay={view.firstDay} />
      </section>

      <TaskSheet
        task={openTask}
        date={date}
        readOnly={readOnly}
        onClose={() => setOpenTask(null)}
        onSave={saveTask}
        onStatus={setStatus}
        onRank={rankTask}
        onMove={(t, to) => void move(t, to)}
        onDelete={(t) => void removeTask(t)}
        onProof={(p) => {
          setProofs((list) => [...list, p]);
          if (p.taskId) patchTask(p.taskId, { proofCount: (tasks.find((t) => t.id === p.taskId)?.proofCount ?? 0) + 1 });
        }}
      />

      <PlanSheet
        date={date}
        plan={plan}
        habitsLine={habitsLine}
        onClose={() => setPlan(null)}
        onApplied={() => {
          setPlan(null);
          router.refresh();
        }}
      />

      <MinimumSwitch open={askMinimum} preview={minState} busy={switching} onConfirm={() => void switchMinimum(true)} onClose={() => setAskMinimum(false)} />

      <DayComplete data={closing?.data ?? null} heading={closing?.heading} threshold={threshold} timeZone={tz} onClose={() => setClosing(null)} />
    </div>
  );
}
