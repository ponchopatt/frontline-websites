import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { isWorkArea, type Area, type WorkArea } from "./areas";
import { addDays, startOfWeek, type LocalDate } from "./day";
import { countersFor, loadCounterData, loadMilestone, type Viewer } from "./data";
import { lineageOf, loadGoalYear, loadLifeAreas, mapDaily, yearOfWeek } from "./goals/data";
import { rankSuggestions, type WeeklyContext } from "./goals/suggest";
import { minutesIntoDay, planDay, type DayPlan } from "./plan";

function minutesBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - sh * 60 - sm);
}

/** Gathers everything Plan my day weighs, and runs it. */
export async function buildPlan(viewer: Viewer, date: LocalDate): Promise<DayPlan> {
  const { supabase, profile } = viewer;
  const weekStart = startOfWeek(date);

  const [goals, areas, todayRes, unfinishedRes, laterRes, depsRes, sessionsRes, blocksRes, counterData, milestone] = await Promise.all([
    loadGoalYear(viewer, yearOfWeek(weekStart)),
    loadLifeAreas(viewer),
    supabase.from("daily_goals").select("*").eq("local_date", date),
    supabase.from("daily_goals").select("*").gte("local_date", addDays(date, -7)).lt("local_date", date).eq("status", "pending"),
    supabase.from("daily_goals").select("*").is("local_date", null).eq("status", "pending"),
    supabase.from("goal_dependencies").select("blocker_id,blocked_id").eq("level", "weekly"),
    supabase.from("work_sessions").select("area,started_at,ended_at").eq("local_date", date),
    supabase.from("work_blocks").select("area,planned_start,planned_end").eq("local_date", date),
    loadCounterData(supabase, addDays(weekStart, -60), date),
    loadMilestone(supabase),
  ]);

  const unfinishedRows = unfinishedRes.data ?? [];
  let carriedAway = new Set<string>();
  if (unfinishedRows.length > 0) {
    const { data } = await supabase.from("daily_goals").select("carried_from_id").in("carried_from_id", unfinishedRows.map((t) => t.id));
    carriedAway = new Set((data ?? []).map((c) => c.carried_from_id as string));
  }

  const todayTasks = (todayRes.data ?? []).map(mapDaily);
  const weekly = goals.tree.weekly.filter((w) => w.weekStart === weekStart && w.state === "active");
  const contexts: WeeklyContext[] = weekly.map((goal) => {
    const l = lineageOf(goals, goal.id);
    return {
      goal,
      progress: goals.progress.get(goal.id)!,
      monthly: l.monthly,
      monthlyProgress: l.monthly ? goals.progress.get(l.monthly.id) ?? null : null,
      yearly: l.yearly,
      unblocks: (depsRes.data ?? [])
        .filter((d) => d.blocker_id === goal.id)
        .map((d) => weekly.find((w) => w.id === d.blocked_id)?.title)
        .filter((t): t is string => Boolean(t)),
    };
  });
  const areaKey = new Map(areas.map((a) => [a.id, a.key]));
  const weeklyArea = new Map<string, Area | null>(weekly.map((w) => [w.id, w.lifeAreaId ? areaKey.get(w.lifeAreaId) ?? null : null]));

  const now = new Date();
  const worked: Partial<Record<WorkArea, number>> = {};
  for (const s of sessionsRes.data ?? []) {
    const area = isWorkArea(s.area) ? s.area : "other";
    const end = s.ended_at ? new Date(s.ended_at).getTime() : now.getTime();
    worked[area] = (worked[area] ?? 0) + Math.max(0, (end - new Date(s.started_at).getTime()) / 60000);
  }
  const planned: Partial<Record<WorkArea, number>> = {};
  for (const b of blocksRes.data ?? []) {
    const area = isWorkArea(b.area) ? b.area : "other";
    planned[area] = (planned[area] ?? 0) + minutesBetween(b.planned_start?.slice(0, 5) ?? null, b.planned_end?.slice(0, 5) ?? null);
  }

  const [h, m] = formatInTimeZone(now, profile.timezone, "HH:mm").split(":").map(Number);
  const nextStep = milestone?.steps.find((s) => !s.done)?.title ?? null;

  return planDay({
    today: date,
    nowMinutes: date === viewer.today ? minutesIntoDay(h * 60 + m, profile.dayStartHour) : 0,
    todayTasks,
    unfinished: unfinishedRows.filter((t) => !carriedAway.has(t.id)).map(mapDaily),
    later: (laterRes.data ?? []).map(mapDaily),
    weekly: rankSuggestions({ today: date, weekly: contexts, todayActions: todayTasks, unfinished: [], availableMinutes: 24 * 60 }),
    weeklyArea,
    counters: countersFor(counterData, date, profile, goals).map((c) => ({
      metric: counterData.metrics.find((x) => x.id === c.id)!,
      target: c.target,
      value: c.value,
    })),
    milestone: milestone ? { title: milestone.title, nextStep } : null,
    workTargetMinutes: profile.workTargetHours * 60,
    worked,
    planned,
    hourTargets: profile.hourTargets,
  });
}
