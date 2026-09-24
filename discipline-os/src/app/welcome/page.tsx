import type { Metadata } from "next";
import { WelcomeFlow, type WelcomeDefaults } from "@/components/welcome-flow";
import { getViewer } from "@/lib/data";
import { firstName } from "@/lib/names";
import { GOAL_TEMPLATES } from "@/lib/welcome";

export const metadata: Metadata = { title: "Welcome" };

/**
 * First-run setup, and "Redo setup" from Settings: name, passcode, the year's goals, why they
 * matter, and the daily and weekly numbers the dashboard measures against.
 */
export default async function WelcomePage() {
  const viewer = await getViewer();
  const { supabase, profile, today } = viewer;
  const thisYear = Number(today.slice(0, 4));
  const counters = GOAL_TEMPLATES.filter((t) => t.counter);
  const [metricsRes, gymRes, cardioRes, goalsRes, entriesRes] = await Promise.all([
    supabase.from("metrics").select("area,key,weekly_target").in("key", ["leads_called", "cold_calls", "demos_built", "reels_posted", "revenue"]),
    supabase.from("habits").select("days").eq("kind", "gym").eq("is_active", true).maybeSingle(),
    supabase.from("metrics").select("daily_target").eq("area", "fitness").eq("key", "cardio_minutes").maybeSingle(),
    supabase.from("yearly_goals").select("title,year,life_areas(key)").in("year", [thisYear, thisYear + 1]).neq("state", "cancelled"),
    supabase
      .from("metric_entries")
      .select("value,metrics!inner(area,key)")
      .in("metrics.key", counters.map((t) => t.counter!))
      .gte("local_date", `${thisYear}-01-01`)
      .lte("local_date", today),
  ]);
  const weekly = (area: string, key: string) => {
    const v = metricsRes.data?.find((m) => m.area === area && m.key === key)?.weekly_target;
    return v === null || v === undefined ? null : Number(v);
  };
  // What each counter goal's counter already holds this year. The goal counts it from 1 January,
  // so once there's something logged it's offered the full year's number.
  const soFar = (area: string, key: string) =>
    (entriesRes.data ?? []).filter((e) => e.metrics.area === area && e.metrics.key === key).reduce((sum, e) => sum + Number(e.value), 0);
  const defaults: WelcomeDefaults = {
    name: firstName(profile.displayName) ?? "Angus",
    passcodeSet: viewer.passcodeSet,
    redo: viewer.onboardedAt !== null,
    today,
    thisYear,
    existingGoals: (goalsRes.data ?? []).map((g) => ({ title: g.title, year: g.year, area: g.life_areas?.key ?? null })),
    counterSoFar: Object.fromEntries(counters.map((t) => [t.key, soFar(t.area, t.counter!)])),
    workHours: profile.workTargetHours,
    workDays: profile.workDays,
    botHours: profile.hourTargets.trading ?? 0,
    gymDays: gymRes.data?.days?.length ? gymRes.data.days.map(Number) : [1, 2, 3, 4, 5],
    cardioMinutes: cardioRes.data?.daily_target === null || cardioRes.data?.daily_target === undefined ? 20 : Number(cardioRes.data.daily_target),
    streakLine: profile.streakThreshold,
    weekly: {
      leads: weekly("imperium", "leads_called"),
      calls: weekly("websites", "cold_calls"),
      demos: weekly("websites", "demos_built"),
      reels: weekly("imperium", "reels_posted"),
      revenue: weekly("imperium", "revenue"),
    },
  };
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10 sm:px-6">
      <WelcomeFlow defaults={defaults} />
    </main>
  );
}
