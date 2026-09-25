import { AREA_LABEL, isWorkArea, type Area, type WorkArea } from "./areas";
import { formatDuration, shortDate, type LocalDate } from "./day";
import { formatValue } from "./goals/format";

/**
 * "What should I do next?": the one action worth doing right now, with a plain reason.
 *
 * Every open commitment becomes a candidate with a weight; the heaviest wins. The weights
 * follow the day: the morning routine first thing, the Big 3 in order, a work target that's
 * nearly in before anything new, business numbers behind today's target, then the rest, and
 * the night review and Close Day as the evening comes. A running timer or Minimum Day comes
 * before all of it. Ask again ("Something else") for the next one down.
 */

export interface NextTask {
  id: string;
  title: string;
  area: Area | null;
  rank: 1 | 2 | 3 | null;
  status: "pending" | "done" | "dropped";
  metricId: string | null;
  quantity: number | null;
  dueDate: LocalDate | null;
  localDate: LocalDate | null;
}

export interface NextCounter {
  id: string;
  area: Area;
  key: string;
  label: string;
  unit: string | null;
  aggregation: "sum" | "latest";
  pinned: boolean;
  value: number;
  target: number | null;
  weekTotal: number;
  weekTarget: number | null;
}

export interface NextHabit {
  id: string;
  name: string;
  category: "morning" | "body" | "discipline" | "god";
  kind: string | null;
  due: boolean;
  done: boolean;
}

export interface MinimumItem {
  key: string;
  label: string;
  done: boolean;
  kind: "habit" | "work" | "fitness";
  habitId?: string;
}

export interface NextInput {
  today: LocalDate;
  /** Local time of day, in hours (13.5 = 1:30 pm). */
  hour: number;
  locked: boolean;
  tasks: NextTask[];
  /** Pending tasks from earlier days, and "later" tasks due by today. */
  overdue: NextTask[];
  counters: NextCounter[];
  habits: NextHabit[];
  workMinutes: number;
  workTargetMinutes: number;
  byArea: Partial<Record<WorkArea, number>>;
  hourTargets: Partial<Record<WorkArea, number>>;
  running: { area: WorkArea | null; minutes: number; task: string | null } | null;
  reviewDone: boolean;
  minimum: MinimumItem[] | null;
  milestone: { title: string; nextStep: string | null } | null;
}

export type NextDo =
  | { type: "task"; taskId: string; area: WorkArea | null }
  | { type: "move"; taskId: string }
  | { type: "habit"; habitId: string }
  | { type: "work"; area: WorkArea }
  | { type: "counter"; metricId: string; area: WorkArea }
  | { type: "open"; target: string }
  | { type: "close" }
  | { type: "none" };

export interface NextAction {
  key: string;
  title: string;
  why: string;
  do: NextDo;
  score: number;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "Call the 8 Imperium leads you haven't called yet." for a counter task with `left` to go. */
function counterTaskTitle(key: string, area: Area, left: number, fallback: string): string {
  const n = Math.ceil(left);
  if (area === "imperium" && key === "leads_called") return `Call the ${n} Imperium ${plural(n, "lead", "leads")} you haven't called yet.`;
  if (area === "websites" && key === "cold_calls") return `Make the ${n} website ${plural(n, "call", "calls")} still to go.`;
  if (area === "websites" && key === "demos_built") return `Build the ${n} website ${plural(n, "demo", "demos")} still to go.`;
  if (key === "reels_posted") return `Post ${n} more ${plural(n, "reel", "reels")}.`;
  if (key === "follow_ups") return `Do the ${n} ${plural(n, "follow-up", "follow-ups")} still to go.`;
  return `${fallback} (${n} to go)`;
}

/** "Make 3 more website calls." for a counter behind today's target. */
function counterTitle(c: NextCounter, left: number): string {
  const n = Math.ceil(left);
  if (c.area === "imperium" && c.key === "leads_called") return `Call ${n} more Imperium ${plural(n, "lead", "leads")}.`;
  if (c.area === "websites" && c.key === "cold_calls") return `Make ${n} more website ${plural(n, "call", "calls")}.`;
  if (c.area === "websites" && c.key === "demos_built") return `Build ${n} more website ${plural(n, "demo", "demos")}.`;
  if (c.key === "reels_posted") return `Post ${n} more ${plural(n, "reel", "reels")}.`;
  return `${c.label}: ${formatValue(n, null)} more.`;
}

const RANK_WHY = { 1: "Today's #1, and it isn't done yet.", 2: "#2 of today's Big 3.", 3: "#3 of today's Big 3." } as const;

function workAreaOf(area: Area | null): WorkArea | null {
  return isWorkArea(area) && area !== "other" ? area : null;
}

export function nextActions(input: NextInput): NextAction[] {
  const { hour, locked } = input;
  const out: NextAction[] = [];
  const add = (a: NextAction) => out.push(a);

  if (locked) {
    return [{ key: "closed", title: "Day complete.", why: "Everything's saved. Rest, and start fresh tomorrow.", do: { type: "none" }, score: 0 }];
  }

  const pendingToday = input.tasks.filter((t) => t.status === "pending");
  const counterOf = new Map(input.counters.map((c) => [c.id, c]));
  const leftOn = (t: NextTask) => {
    const c = t.metricId ? counterOf.get(t.metricId) : undefined;
    return c && t.quantity ? { c, left: t.quantity - c.value } : null;
  };

  // A work area that still needs time: an hour target not met, then a Big 3 task's business,
  // then whichever business has had the least today.
  const bestArea = (): WorkArea => {
    for (const [a, h] of Object.entries(input.hourTargets) as Array<[WorkArea, number]>) {
      if (h > 0 && (input.byArea[a] ?? 0) < h * 60) return a;
    }
    const fromTask = pendingToday.filter((t) => t.rank !== null).map((t) => workAreaOf(t.area)).find((a): a is WorkArea => a !== null);
    if (fromTask) return fromTask;
    return (input.byArea.imperium ?? 0) <= (input.byArea.websites ?? 0) ? "imperium" : "websites";
  };

  /* ---- minimum day: the non-negotiables first */
  if (input.minimum) {
    const open = input.minimum.filter((m) => !m.done);
    const total = input.minimum.length;
    const done = total - open.length;
    open.forEach((m, i) =>
      add({
        key: `min-${m.key}`,
        title: m.label,
        why: `Minimum day: one of today's non-negotiables. ${done} of ${total} done.`,
        do: m.kind === "habit" && m.habitId ? { type: "habit", habitId: m.habitId } : m.kind === "work" ? { type: "work", area: bestArea() } : { type: "open", target: "fitness" },
        score: 1000 - i,
      }),
    );
  }

  /* ---- a running timer: stay on it */
  if (input.running) {
    const area = input.running.area;
    const task = area ? pendingToday.find((t) => workAreaOf(t.area) === area) : undefined;
    const label = area ? AREA_LABEL[area] : "work";
    if (task) {
      add({
        key: `run-${task.id}`,
        title: task.title,
        why: `Your timer's on ${label}, ${formatDuration(input.running.minutes)} in. This is its most important open task.`,
        do: { type: "task", taskId: task.id, area: null },
        score: 900,
      });
    } else {
      add({
        key: "run",
        title: `Keep going on ${input.running.task ?? label}.`,
        why: `${formatDuration(input.running.minutes)} in. Switching now costs the focus you've built.`,
        do: { type: "none" },
        score: 900,
      });
    }
  }

  /* ---- the morning routine, first thing */
  const morningLeft = input.habits.filter((h) => h.category === "morning" && h.due && !h.done);
  if (morningLeft.length > 0 && hour < 11) {
    const one = morningLeft.length === 1 ? morningLeft[0] : null;
    add({
      key: "morning",
      title: one ? `${one.name}.` : "Finish your morning routine.",
      why: one ? "The last item of your morning routine." : `${morningLeft.length} left: ${morningLeft.map((h) => h.name).join(", ")}.`,
      do: one ? { type: "habit", habitId: one.id } : { type: "open", target: "morning" },
      score: 800,
    });
  }

  /* ---- the evening */
  const late = hour >= 21;
  const evening = hour >= 19;
  if (!input.reviewDone) {
    add({ key: "review", title: "Do the night review.", why: "Four short questions, then close the day.", do: { type: "open", target: "review" }, score: late ? 850 : evening ? 520 : 150 });
  } else {
    add({ key: "close", title: "Close the day.", why: "The review's done. Lock the day in and see the replay.", do: { type: "close" }, score: late ? 860 : evening ? 530 : 140 });
  }

  /* ---- work nearly in */
  const workLeft = input.workTargetMinutes - input.workMinutes;
  if (input.workTargetMinutes > 0 && workLeft > 0 && workLeft <= 45 && !input.running) {
    const n = Math.ceil(workLeft);
    add({
      key: "work-finish",
      title: `Finish your final ${n} ${plural(n, "minute", "minutes")} of work.`,
      why: `That hits today's ${formatDuration(input.workTargetMinutes)} target.`,
      do: { type: "work", area: bestArea() },
      score: 780,
    });
  }

  /* ---- the Big 3, in order */
  const linkedCounters = new Set<string>();
  for (const t of pendingToday.filter((x) => x.rank !== null).sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9))) {
    const l = leftOn(t);
    if (l) linkedCounters.add(l.c.id);
    add({
      key: `task-${t.id}`,
      title: l && l.left > 0 ? counterTaskTitle(l.c.key, l.c.area, l.left, t.title) : t.title,
      why: RANK_WHY[t.rank as 1 | 2 | 3],
      do: { type: "task", taskId: t.id, area: input.running ? null : workAreaOf(t.area) },
      score: 780 - (t.rank ?? 3) * 20,
    });
  }

  /* ---- overdue and left over */
  input.overdue.slice(0, 3).forEach((t, i) =>
    add({
      key: `overdue-${t.id}`,
      title: t.title,
      why:
        t.localDate && t.localDate < input.today
          ? `Left over from ${shortDate(t.localDate)}.`
          : t.dueDate && t.dueDate < input.today
            ? `It was due ${shortDate(t.dueDate)}.`
            : "It's due today.",
      do: { type: "move", taskId: t.id },
      score: 700 - i,
    }),
  );

  /* ---- business numbers behind today's target */
  for (const c of input.counters) {
    if (!c.pinned || c.unit === "$" || c.aggregation === "latest" || linkedCounters.has(c.id)) continue;
    const area = workAreaOf(c.area);
    if (!area || c.target === null || c.target <= 0 || c.value >= c.target) continue;
    const left = c.target - c.value;
    const major = (c.area === "imperium" && c.key === "leads_called") || (c.area === "websites" && c.key === "cold_calls");
    add({
      key: `counter-${c.id}`,
      title: counterTitle(c, left),
      why: `Today's target is ${formatValue(c.target, null)}; you're at ${formatValue(c.value, null)}.`,
      do: { type: "counter", metricId: c.id, area },
      score: 600 + Math.round(60 * (left / c.target)) + (major ? 40 : 0),
    });
  }

  /* ---- the rest of the day's work */
  if (input.workTargetMinutes > 0 && workLeft > 45 && hour < 20 && !input.running) {
    const area = bestArea();
    const target = input.hourTargets[area];
    add({
      key: "work",
      title: `Start ${/^[AEIOU]/.test(AREA_LABEL[area]) ? "an" : "a"} ${AREA_LABEL[area]} work block.`,
      why:
        target && target > 0
          ? `${AREA_LABEL[area]} gets ${target}h a day; ${formatDuration(input.byArea[area] ?? 0)} so far.`
          : `${formatDuration(workLeft)} of work left today.`,
      do: { type: "work", area },
      score: 550,
    });
  }

  pendingToday
    .filter((t) => t.rank === null)
    .forEach((t, i) =>
      add({ key: `task-${t.id}`, title: t.title, why: "On today's list.", do: { type: "task", taskId: t.id, area: input.running ? null : workAreaOf(t.area) }, score: 500 - i }),
    );

  /* ---- habits still due */
  for (const h of input.habits) {
    if (!h.due || h.done || h.category === "morning") continue;
    if (h.kind === "gym") add({ key: `habit-${h.id}`, title: "Go to the gym.", why: "Gym is due today.", do: { type: "habit", habitId: h.id }, score: hour >= 10 ? 520 : 300 });
    else if (h.kind === "cardio") add({ key: `habit-${h.id}`, title: "Do your cardio.", why: "Cardio counts every day.", do: { type: "habit", habitId: h.id }, score: hour >= 10 ? 480 : 280 });
    else if (h.category === "god") add({ key: `habit-${h.id}`, title: `${h.name}.`, why: "Part of today's faith.", do: { type: "habit", habitId: h.id }, score: hour >= 18 ? 540 : 200 });
    else if (h.category === "body") add({ key: `habit-${h.id}`, title: `${h.name}.`, why: "One of today's fitness habits.", do: { type: "habit", habitId: h.id }, score: 250 });
    else if (h.category === "discipline" && hour >= 20) add({ key: `habit-${h.id}`, title: `${h.name}: kept it today?`, why: "Tick it if you held the line.", do: { type: "habit", habitId: h.id }, score: 300 });
  }

  /* ---- the AI bot's next step */
  const botHours = input.hourTargets.trading ?? 0;
  if (input.milestone?.nextStep && (botHours === 0 || (input.byArea.trading ?? 0) < botHours * 60)) {
    add({
      key: "bot",
      title: `AI bot: ${input.milestone.nextStep}.`,
      why: `The next step of "${input.milestone.title}".`,
      do: { type: "work", area: "trading" },
      score: 420,
    });
  }

  /* ---- nothing urgent: get ahead on the week */
  for (const c of input.counters) {
    const area = workAreaOf(c.area);
    if (!area || !c.pinned || c.unit === "$" || c.aggregation === "latest" || c.weekTarget === null || c.weekTarget <= 0 || c.weekTotal >= c.weekTarget) continue;
    const left = c.weekTarget - c.weekTotal;
    add({
      key: `week-${c.id}`,
      title: `Get ahead on the week: ${counterTitle(c, left).replace(/\.$/, "")}.`,
      why: `${formatValue(c.weekTotal, null)} of ${formatValue(c.weekTarget, null)} this week so far.`,
      do: { type: "counter", metricId: c.id, area },
      score: 200 + Math.round(40 * (left / c.weekTarget)),
    });
  }

  // One per key, heaviest first.
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((a) => {
      if (seen.has(a.key)) return false;
      seen.add(a.key);
      return true;
    });
}
