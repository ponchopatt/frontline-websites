import type { Metadata } from "next";
import { WelcomeFlow, type WelcomeDefaults } from "@/components/welcome-flow";
import { getViewer } from "@/lib/data";
import { firstName } from "@/lib/names";

export const metadata: Metadata = { title: "Welcome" };

/**
 * First-run setup, and "Redo setup" from Settings: name, passcode, the year's goals, why they
 * matter, and the daily and weekly numbers the dashboard measures against.
 */
export default async function WelcomePage() {
  const viewer = await getViewer();
  const { supabase, profile, today } = viewer;
  const thisYear = Number(today.slice(0, 4));
  const [metricsRes, gymRes, cardioRes, goalsRes] = await Promise.all([
    supabase.from("metrics").select("area,key,weekly_target").in("key", ["leads_called", "cold_calls", "demos_built", "reels_posted", "revenue"]),
    supabase.from("habits").select("days").eq("kind", "gym").eq("is_active", true).maybeSingle(),
    supabase.from("metrics").select("daily_target").eq("area", "fitness").eq("key", "cardio_minutes").maybeSingle(),
    supabase.from("yearly_goals").select("title,year").in("year", [thisYear, thisYear + 1]).neq("state", "cancelled"),
  ]);
  const weekly = (area: string, key: string) => {
    const v = metricsRes.data?.find((m) => m.area === area && m.key === key)?.weekly_target;
    return v === null || v === undefined ? null : Number(v);
  };
  const defaults: WelcomeDefaults = {
    name: firstName(profile.displayName) ?? "Angus",
    passcodeSet: viewer.passcodeSet,
    redo: viewer.onboardedAt !== null,
    today,
    thisYear,
    existingGoals: (goalsRes.data ?? []).map((g) => ({ title: g.title, year: g.year })),
    workHours: profile.workTargetHours,
    workDays: profile.workDays,
    botHours: profile.hourTargets.trading ?? 0,
    gymDays: gymRes.data?.days?.map(Number) ?? [1, 2, 3, 4, 5],
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
