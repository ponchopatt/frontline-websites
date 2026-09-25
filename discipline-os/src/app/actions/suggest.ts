"use server";

import { z } from "zod";
import { AREAS, type Area } from "@/lib/areas";
import { dbFail, fail, invalid, ok, uuidSchema } from "@/lib/action-helpers";
import { fetchAll, firstDayOf, getViewer, loadCounterData, loadMilestone, type Viewer } from "@/lib/data";
import { addDays, daysBetween, startOfWeek } from "@/lib/day";
import { monthStartOf } from "@/lib/goals/periods";
import { aiConfigured, refineWithAI } from "@/lib/goals/suggest-ai";
import { suggestGoals, type GoalSuggestion, type HabitKind, type SuggestContext } from "@/lib/goals/suggest-goals";
import { totalOver } from "@/lib/metrics";
import type { ActionResult } from "@/lib/types";

const answersSchema = z.object({
  aims: z.partialRecord(z.enum(AREAS), z.string().trim().max(500, "Keep each answer under 500 characters.")),
  hoursPerWeek: z.number().min(0).max(120).nullable(),
  commitments: z.string().trim().max(1000, "Keep this under 1000 characters."),
});

/**
 * Whether this account may spend the AI key. Anyone can sign up to a public deploy, so
 * AI_ALLOWED_EMAILS (comma-separated) keeps it to the owner. Unset, every account may.
 */
async function aiAllowed(supabase: Viewer["supabase"]): Promise<boolean> {
  const allowed = (process.env.AI_ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (allowed.length === 0) return true;
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims.email?.trim().toLowerCase();
  return Boolean(email && allowed.includes(email));
}

/**
 * Suggests this week's goals from the last four weeks of real numbers (and, with an API key,
 * lets Claude refine them against what the user said they want). Nothing is saved here.
 */
export async function suggestMyGoals(
  input: z.input<typeof answersSchema>,
): Promise<ActionResult<{ source: "ai" | "rules"; suggestions: GoalSuggestion[] }>> {
  const parsed = answersSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  const { supabase, today, profile } = viewer;
  const weekStart = startOfWeek(today);
  const lastDay = addDays(weekStart, -1);
  const first = firstDayOf(viewer);
  const from = addDays(weekStart, -28) > first ? addDays(weekStart, -28) : first;
  const weeks = lastDay < from ? 0 : Math.min(4, Math.floor((daysBetween(from, lastDay) + 1) / 7));

  const [counterData, habitsRes, completions, milestone, weekGoals] = await Promise.all([
    loadCounterData(supabase, from, lastDay),
    supabase.from("habits").select("id,kind,days").eq("is_active", true).in("kind", ["bible", "prayer", "gym", "cardio"]),
    fetchAll<{ habit_id: string }>((a, b) => supabase.from("habit_completions").select("habit_id").gte("local_date", from).lte("local_date", lastDay).order("id").range(a, b)),
    loadMilestone(supabase),
    supabase.from("weekly_goals").select("metric_id,habit_id").eq("week_start", weekStart).neq("state", "cancelled"),
  ]);

  const doneCount = new Map<string, number>();
  for (const c of completions) doneCount.set(c.habit_id, (doneCount.get(c.habit_id) ?? 0) + 1);

  const ctx: SuggestContext = {
    weeks,
    workDays: profile.workDays.length,
    counters: counterData.metrics
      .filter((m) => m.aggregation === "sum" && (m.area === "imperium" || m.area === "websites"))
      .map((m) => {
        const total = totalOver(counterData.values.get(m.id), from, lastDay, "sum");
        return {
          metricId: m.id,
          area: m.area,
          key: m.key,
          label: m.label,
          unit: m.unit,
          weeklyAvg: weeks > 0 && total > 0 ? total / weeks : null,
          weeklyTarget: m.weeklyTarget,
        };
      }),
    habits: (habitsRes.data ?? []).map((h) => ({
      kind: h.kind as HabitKind,
      habitId: h.id,
      daysPerWeek: weeks > 0 && (doneCount.get(h.id) ?? 0) > 0 ? (doneCount.get(h.id) ?? 0) / weeks : null,
      // No days set means every day.
      dueDays: h.days?.length || 7,
    })),
    milestone: milestone ? { title: milestone.title, nextStep: milestone.steps.find((s) => !s.done)?.title ?? null } : null,
    weekShare: (daysBetween(first > weekStart ? first : weekStart, addDays(weekStart, 6)) + 1) / 7,
    taken: new Set((weekGoals.data ?? []).flatMap((g) => [g.metric_id ? `metric:${g.metric_id}` : "", g.habit_id ? `habit:${g.habit_id}` : ""]).filter(Boolean)),
  };

  const rules = suggestGoals(ctx, parsed.data);
  const refined = aiConfigured() && (await aiAllowed(supabase)) ? await refineWithAI(ctx, parsed.data, rules) : null;
  // Every suggestion starts ticked, and a number of zero can't be saved: leave those out.
  const usable = (list: GoalSuggestion[]) => list.filter((s) => s.target === null || s.target > 0);
  return ok(refined ? { source: "ai", suggestions: usable(refined) } : { source: "rules", suggestions: usable(rules) });
}

const itemSchema = z.object({
  area: z.enum(AREAS),
  title: z.string().trim().min(1, "Every goal needs a name.").max(140, "Keep each goal under 140 characters."),
  target: z.number().positive().max(99_999_999).nullable(),
  unit: z.string().max(20).nullable(),
  metricId: uuidSchema.nullable(),
  habitId: uuidSchema.nullable(),
  major: z.boolean(),
  reason: z.string().max(400).nullable(),
});

const addSchema = z.object({ items: z.array(itemSchema).min(1, "Pick at least one goal.").max(12) });

/**
 * Makes the approved suggestions this week's goals. Counter and habit goals track themselves;
 * a counter goal sits under this month's goal on the same counter when there is one.
 */
export async function addSuggestedGoals(input: z.input<typeof addSchema>): Promise<ActionResult<{ count: number }>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  const { supabase, today } = viewer;
  const weekStart = startOfWeek(today);

  const [areasRes, monthlyRes] = await Promise.all([
    supabase.from("life_areas").select("id,key"),
    supabase.from("monthly_goals").select("id,metric_id").eq("month_start", monthStartOf(today)).eq("state", "active").not("metric_id", "is", null),
  ]);
  const areaId = new Map((areasRes.data ?? []).filter((a) => a.key).map((a) => [a.key as Area, a.id]));
  const parentFor = new Map((monthlyRes.data ?? []).map((m) => [m.metric_id as string, m.id]));
  let majors = 0;

  const rows = parsed.data.items.map((s, i) => {
    const source = s.metricId ? "metric" : s.habitId ? "habit" : "manual";
    const major = s.major && (majors += 1) <= 3;
    return {
      week_start: weekStart,
      life_area_id: areaId.get(s.area) ?? null,
      parent_monthly_goal_id: s.metricId ? parentFor.get(s.metricId) ?? null : null,
      title: s.title,
      why: s.reason,
      goal_type: s.target === null ? ("binary" as const) : ("process" as const),
      unit: s.target === null ? null : s.unit,
      cadence: "total" as const,
      aggregation: "sum" as const,
      progress_source: source as "metric" | "habit" | "manual",
      metric_id: s.metricId,
      habit_id: s.habitId,
      target_value: s.target,
      is_major: major,
      sort_order: i,
    };
  });
  const { error } = await supabase.from("weekly_goals").insert(rows);
  if (error) return dbFail(error, "The goals weren't saved. Try again.");
  if (rows.length === 0) return fail("Pick at least one goal.");
  return ok({ count: rows.length });
}
