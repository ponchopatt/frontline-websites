import type { Metadata } from "next";
import { Suspense } from "react";
import { AreaHours } from "@/components/business/area-hours";
import { BotBoard } from "@/components/business/bot-board";
import { BUSINESS_TABS, BusinessTabs, isBusinessTab, type BusinessTab } from "@/components/business/business-tabs";
import { CounterBoard } from "@/components/business/counter-board";
import { TabSkeleton } from "@/components/business/tab-skeleton";
import type { BoardCounter, DoneMilestone, HoursData } from "@/components/business/types";
import { isWorkArea, type WorkArea } from "@/lib/areas";
import { countersFor, fetchAll, getViewer, loadCounterData, loadMilestone, requestTime, type Viewer } from "@/lib/data";
import { addDays, localDateAt, startOfWeek } from "@/lib/day";
import { loadGoalYear, yearOfWeek } from "@/lib/goals/data";
import { monthStartOf, yearStart } from "@/lib/goals/periods";
import { totalOver, workDaysBetween } from "@/lib/metrics";

export const metadata: Metadata = { title: "Business" };

/**
 * The businesses, one tab each: quick counters for Imperium and Websites, the current
 * milestone for the AI bot. The header and tabs paint at once; a tab's numbers stream in.
 */
export default async function BusinessPage({ searchParams }: PageProps<"/business">) {
  const { tab: requested } = await searchParams;
  const tab: BusinessTab = isBusinessTab(requested) ? requested : "imperium";
  const label = BUSINESS_TABS.find((t) => t.key === tab)?.label ?? "Business";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <header className="grid gap-5">
        <div className="grid gap-1">
          <h1 className="text-[40px] leading-[1.05] font-light tracking-[-0.035em]">Business</h1>
          <p className="text-[15px] text-muted-foreground">Quick counts for each business, and the bot&apos;s next step.</p>
        </div>
        <BusinessTabs active={tab} />
      </header>

      <Suspense key={tab} fallback={<TabSkeleton label={label} />}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10">{tab === "bot" ? <BotTab /> : <CounterTab area={tab} />}</div>
      </Suspense>
    </div>
  );
}

async function CounterTab({ area }: { area: "imperium" | "websites" }) {
  const viewer = await getViewer();
  const { supabase, profile, today } = viewer;
  const weekStart = startOfWeek(today);
  const monthStart = monthStartOf(today);
  const yearFrom = yearStart(Number(today.slice(0, 4)));
  const earliest = weekStart < yearFrom ? weekStart : yearFrom;
  const yesterday = addDays(today, -1);

  const [data, goals, hours] = await Promise.all([
    // Sixty days further back, so a level set before the year began still reads right.
    loadCounterData(supabase, addDays(earliest, -60), today),
    loadGoalYear(viewer, yearOfWeek(weekStart)),
    loadHours(viewer, area),
  ]);

  const metrics = new Map(data.metrics.map((m) => [m.id, m]));
  const weekEnd = addDays(weekStart, 6);
  const shareOfWeek = (createdAt: string | null) => {
    if (!createdAt) return 1;
    const since = localDateAt(new Date(createdAt), profile.timezone, profile.dayStartHour);
    if (since <= weekStart) return 1;
    const all = workDaysBetween(weekStart, weekEnd, profile.workDays);
    return all === 0 ? 1 : workDaysBetween(since, weekEnd, profile.workDays) / all;
  };
  const counters: BoardCounter[] = countersFor(data, today, profile, goals)
    .filter((c) => c.area === area)
    .map((c) => {
      const m = metrics.get(c.id);
      const values = data.values.get(c.id);
      // Same rule as countersFor: a weekly goal on the counter sets this week's target.
      const fromGoal = goals.tree.weekly.some(
        (w) => w.weekStart === weekStart && w.state !== "cancelled" && w.progressSource === "metric" && w.metricId === c.id,
      );
      return {
        id: c.id,
        label: c.label,
        grp: c.grp,
        unit: c.unit,
        aggregation: c.aggregation,
        pinned: c.pinned,
        value: c.value,
        fixedDaily: m?.dailyTarget ?? null,
        ownTarget: m?.weeklyTarget ?? null,
        goalTarget: fromGoal ? c.weekTarget : null,
        weekShare: shareOfWeek(m?.createdAt ?? null),
        weekBefore: totalOver(values, weekStart, yesterday, "sum"),
        monthBefore: totalOver(values, monthStart, yesterday, "sum"),
        yearBefore: totalOver(values, yearFrom, yesterday, "sum"),
      };
    });

  return (
    <>
      <CounterBoard area={area} today={today} weekStart={weekStart} workDays={profile.workDays} counters={counters} />
      <AreaHours data={hours} />
    </>
  );
}

async function BotTab() {
  const viewer = await getViewer();
  const { supabase, profile, today } = viewer;

  const [milestone, doneRes, notesRes, hours] = await Promise.all([
    loadMilestone(supabase),
    supabase
      .from("project_milestones")
      .select("id,title,completed_at")
      .eq("area", "trading")
      .eq("state", "done")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase.from("goals").select("content").eq("kind", "notes:trading").maybeSingle(),
    loadHours(viewer, "trading"),
  ]);
  if (doneRes.error) throw new Error(`Your milestones couldn't be loaded: ${doneRes.error.message}`);
  // Failing here beats showing empty notes that would save over the real ones.
  if (notesRes.error) throw new Error(`Your notes couldn't be loaded: ${notesRes.error.message}`);

  const done: DoneMilestone[] = (doneRes.data ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    doneOn: m.completed_at ? localDateAt(new Date(m.completed_at), profile.timezone, profile.dayStartHour) : null,
  }));

  return <BotBoard milestone={milestone} done={done} notes={notesRes.data?.content ?? ""} today={today} hours={hours} />;
}

/** Time on one business since the week or the month began (whichever is earlier), and the running timer. */
async function loadHours(viewer: Viewer, area: WorkArea): Promise<HoursData> {
  const { supabase, profile, today } = viewer;
  const weekStart = startOfWeek(today);
  const monthStart = monthStartOf(today);
  const from = weekStart < monthStart ? weekStart : monthStart;

  const [sessions, openRes] = await Promise.all([
    fetchAll<{ id: string; local_date: string; started_at: string; ended_at: string | null }>((a, b) =>
      supabase
        .from("work_sessions")
        .select("id,local_date,started_at,ended_at")
        .eq("area", area)
        .gte("local_date", from)
        .order("started_at")
        .order("id")
        .range(a, b),
    ),
    supabase.from("work_sessions").select("id,area,local_date,started_at,work_blocks(task)").is("ended_at", null).maybeSingle(),
  ]);

  const open = openRes.data;
  const task = open ? ((open as unknown as { work_blocks: { task: string } | null }).work_blocks?.task ?? null) : null;
  return {
    area,
    today,
    weekStart,
    monthStart,
    sessions: sessions.map((s) => ({ id: s.id, localDate: s.local_date, startedAt: s.started_at, endedAt: s.ended_at })),
    running: open
      ? { id: open.id, area: isWorkArea(open.area) ? open.area : null, localDate: open.local_date, startedAt: open.started_at, task }
      : null,
    targetHours: profile.hourTargets[area] ?? null,
    serverNow: requestTime(),
  };
}
