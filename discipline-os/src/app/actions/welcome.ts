"use server";

import { z } from "zod";
import { dbFail, fail, invalid, ok } from "@/lib/action-helpers";
import { getViewer, recomputeBestStreak } from "@/lib/data";
import { GOAL_TEMPLATES, WELCOME_GOALS, goalsToAdd } from "@/lib/welcome";
import type { ActionResult } from "@/lib/types";

const days = z.array(z.number().int().min(1).max(7)).max(7);
const count = (max: number) => z.number().min(0).max(max).nullable();

const welcomeSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(40, "Keep your name under 40 characters."),
  /** The rest was skipped: the daily and weekly targets keep what they are. */
  skip: z.boolean().default(false),
  year: z.number().int().min(2000).max(2100),
  goals: z
    .array(
      z.object({
        key: z.enum(WELCOME_GOALS),
        title: z.string().trim().min(1, "Give each goal a name.").max(140, "Keep each goal under 140 characters."),
        target: z.number().min(0).max(100_000_000).nullable(),
      }),
    )
    .max(WELCOME_GOALS.length),
  becoming: z.string().trim().max(2000),
  why: z.string().trim().max(2000),
  workHours: z.number().min(0).max(16),
  workDays: days.min(1, "Pick at least one work day."),
  botHours: z.number().min(0).max(16),
  gymDays: days.min(1, "Pick at least one gym day."),
  cardioMinutes: z.number().int().min(0).max(240),
  streakLine: z.number().int().min(10).max(100),
  weekly: z.object({ leads: count(10_000), calls: count(10_000), demos: count(1000), reels: count(1000), revenue: count(10_000_000) }),
});

export type WelcomeInput = z.input<typeof welcomeSchema>;

/**
 * Finishes first-run setup in one go: the name, the year's goals (each tied to the counter,
 * habit or day score that measures it), who they're becoming and why, the daily targets and the
 * weekly numbers. With `skip`, the goals and why are saved as sent and the targets keep what
 * they are. Safe to send again after a lost reply: a goal the year already has is left alone
 * and the rest are updates. Returns how many of the goals sent the year now has.
 */
export async function finishWelcome(input: WelcomeInput): Promise<ActionResult<{ goals: number }>> {
  const parsed = welcomeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const w = parsed.data;
  const viewer = await getViewer();
  const { supabase, userId } = viewer;
  const now = new Date().toISOString();

  const [areasRes, metricsRes, habitsRes, existingRes] = await Promise.all([
    supabase.from("life_areas").select("id,key"),
    supabase.from("metrics").select("id,area,key"),
    supabase.from("habits").select("id,kind").eq("is_active", true).in("kind", ["bible", "gym"]),
    supabase.from("yearly_goals").select("title,life_area_id").eq("year", w.year).neq("state", "cancelled"),
  ]);
  if (areasRes.error || metricsRes.error || habitsRes.error || existingRes.error) return fail("Setup couldn't load your account. Try again.");
  const areaId = (key: string) => areasRes.data?.find((a) => a.key === key)?.id ?? null;
  const metricId = (area: string, key: string) => metricsRes.data?.find((m) => m.area === area && m.key === key)?.id ?? null;
  const habitId = (kind: string) => habitsRes.data?.find((h) => h.kind === kind)?.id ?? null;

  // The year's goals, each measured by what the app already tracks where it can.
  const rows = w.goals.map((g, i) => {
    const t = GOAL_TEMPLATES.find((x) => x.key === g.key)!;
    const base = {
      year: w.year,
      title: g.title,
      life_area_id: areaId(t.area),
      why: w.why || null,
      deadline: `${w.year}-12-31`,
      priority: i < 3 ? 1 : 2,
      sort_order: i,
    };
    switch (g.key) {
      case "imperium":
      case "websites": {
        const id = t.counter ? metricId(t.area, t.counter) : null;
        return { ...base, goal_type: "outcome" as const, unit: t.unit, target_value: g.target, progress_source: id ? ("metric" as const) : ("manual" as const), metric_id: id };
      }
      case "faith":
      case "fitness": {
        const id = habitId(g.key === "faith" ? "bible" : "gym");
        return { ...base, goal_type: "habit" as const, unit: t.unit, target_value: g.target, progress_source: id ? ("habit" as const) : ("manual" as const), habit_id: id };
      }
      case "trading":
        return { ...base, goal_type: "binary" as const, unit: null, target_value: null, progress_source: "manual" as const };
      case "discipline":
        // The share of days kept, worked out from the days themselves.
        return { ...base, goal_type: "performance" as const, unit: "%", target_value: g.target, progress_source: "keep_word" as const };
      default:
        return { ...base, goal_type: "outcome" as const, unit: t.unit, target_value: g.target, progress_source: "manual" as const };
    }
  });
  // A goal the year already has (by area or by name) isn't added again.
  const fresh = goalsToAdd(rows, existingRes.data ?? []);
  if (fresh.length > 0) {
    const { error } = await supabase.from("yearly_goals").insert(fresh.map((r) => ({ ...r, current_value: r.progress_source === "manual" && r.target_value !== null ? 0 : null })));
    if (error) return dbFail(error, "Your goals weren't saved. Try again.");
  }

  // Who they're becoming, and why it matters.
  const vision = [
    { user_id: userId, kind: "becoming", content: w.becoming || null },
    { user_id: userId, kind: "why", content: w.why || null },
  ].filter((v) => v.content);
  if (vision.length > 0) {
    const { error } = await supabase.from("goals").upsert(vision, { onConflict: "user_id,kind" });
    if (error) return dbFail(error, "Your why wasn't saved. Try again.");
  }

  if (w.skip) {
    const { error } = await supabase.from("profiles").update({ display_name: w.name, onboarded_at: now }).eq("user_id", userId);
    if (error) return dbFail(error, "Setup wasn't saved. Try again.");
    return ok({ goals: rows.length });
  }

  // Daily targets.
  const gymId = habitId("gym");
  const cardioId = metricId("fitness", "cardio_minutes");
  const weekly: Array<[string, string, number | null]> = [
    ["imperium", "leads_called", w.weekly.leads],
    ["websites", "cold_calls", w.weekly.calls],
    ["websites", "demos_built", w.weekly.demos],
    ["imperium", "reels_posted", w.weekly.reels],
    ["imperium", "revenue", w.weekly.revenue],
  ];
  const updates = await Promise.all([
    supabase
      .from("profiles")
      .update({
        display_name: w.name,
        work_target_hours: w.workHours,
        work_days: [...new Set(w.workDays)].sort(),
        area_hour_targets: { ...viewer.profile.hourTargets, trading: w.botHours },
        streak_threshold: w.streakLine,
        onboarded_at: now,
      })
      .eq("user_id", userId),
    gymId ? supabase.from("habits").update({ days: w.gymDays.length === 7 ? null : [...new Set(w.gymDays)].sort() }).eq("id", gymId) : null,
    cardioId ? supabase.from("metrics").update({ daily_target: w.cardioMinutes > 0 ? w.cardioMinutes : null }).eq("id", cardioId) : null,
    ...weekly.map(([area, key, value]) => {
      const id = metricId(area, key);
      return id ? supabase.from("metrics").update({ weekly_target: value && value > 0 ? value : null }).eq("id", id) : null;
    }),
  ]);
  const failed = updates.find((u) => u && u.error);
  if (failed && failed.error) return dbFail(failed.error, "Some of your targets weren't saved. Check them in Settings.");

  // A new work target or streak line changes which past days count towards a streak.
  try {
    await recomputeBestStreak({ ...viewer, profile: { ...viewer.profile, workTargetHours: w.workHours, streakThreshold: w.streakLine } });
  } catch {
    // Everything is saved. The best streak is derived, and the next finished day works it out.
  }
  return ok({ goals: rows.length });
}
