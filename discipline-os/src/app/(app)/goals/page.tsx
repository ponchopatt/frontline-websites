import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GoalRow } from "@/components/goals/goal-row";
import { getViewer } from "@/lib/data";
import { addDays, startOfWeek } from "@/lib/day";
import { loadGoalYear, loadLifeAreas, loadVision } from "@/lib/goals/data";
import { HEALTH_LABEL, type HealthStatus } from "@/lib/goals/progress";
import { monthLabel, monthStartOf, quarterOf, weekNumberInMonth, weekRangeLabel } from "@/lib/goals/periods";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage({ searchParams }: PageProps<"/goals">) {
  const viewer = await getViewer();
  const { year: yearParam } = await searchParams;
  const thisYear = Number(viewer.today.slice(0, 4));
  const year = typeof yearParam === "string" && /^\d{4}$/.test(yearParam) ? Math.min(2100, Math.max(2000, Number(yearParam))) : thisYear;

  const [data, areas, vision, lastReview] = await Promise.all([
    loadGoalYear(viewer, year),
    loadLifeAreas(viewer),
    loadVision(viewer),
    viewer.supabase.from("weekly_reviews").select("week_start_date,completed_at").order("week_start_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { tree, progress } = data;
  const live = tree.yearly.filter((g) => g.state !== "cancelled");

  // The current rungs of the ladder.
  const week = startOfWeek(viewer.today);
  const currentMonth = monthStartOf(viewer.today);
  const quarter = quarterOf(currentMonth);
  const quarterMonths = [0, 2].map((i) => monthLabel(`${year}-${String((quarter - 1) * 3 + 1 + i).padStart(2, "0")}-01`).split(" ")[0]);
  const monthGoals = tree.monthly.filter((m) => m.monthStart === currentMonth && m.state !== "cancelled");
  const weekGoals = tree.weekly.filter((w) => w.weekStart === week && w.state !== "cancelled");
  const majors = weekGoals.filter((w) => w.isMajor);
  const unbroken = live.filter((g) => !tree.monthly.some((m) => m.parentYearlyId === g.id));
  const monthUnplanned = monthGoals.filter((m) => !tree.weekly.some((w) => w.parentMonthlyId === m.id && w.weekStart === week));
  const lastWeek = addDays(week, -7);
  const reviewedLastWeek = lastReview.data?.week_start_date === lastWeek && Boolean(lastReview.data.completed_at);
  const hadLastWeek = tree.weekly.some((w) => w.weekStart === lastWeek);

  const counts = new Map<HealthStatus, number>();
  for (const g of live) {
    const h = progress.get(g.id)?.health ?? "not_started";
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  const summary = [...counts.entries()].map(([h, n]) => `${n} ${HEALTH_LABEL[h].toLowerCase()}`).join(", ");

  const rungs: Array<{ label: string; title: string; href: string; next: { text: string; href: string } | null }> = [
    {
      label: "My life",
      title: vision.becoming ? vision.becoming.split(/[.!?]/)[0] : "Who you're becoming, in your words",
      href: "/goals/life",
      next: vision.becoming ? null : { text: "Write who you're becoming", href: "/goals/life" },
    },
    {
      label: String(year),
      title: live.length ? `${live.length} ${live.length === 1 ? "goal" : "goals"}: ${summary}` : "No goals yet",
      href: `/goals?year=${year}`,
      next: live.length === 0 ? { text: "Set your first goal", href: `/goals/new?year=${year}` } : unbroken[0] ? { text: `Break down “${unbroken[0].title}”`, href: `/goals/year/${unbroken[0].id}` } : null,
    },
  ];
  if (year === thisYear) {
    rungs.push(
      {
        label: `Q${quarter}`,
        title: `${quarterMonths[0]} to ${quarterMonths[1]}`,
        href: `/goals/month/${currentMonth.slice(0, 7)}`,
        next: null,
      },
      {
        label: monthLabel(currentMonth).split(" ")[0],
        title: monthGoals.length ? `${monthGoals.length} ${monthGoals.length === 1 ? "objective" : "objectives"}` : "No objectives yet",
        href: `/goals/month/${currentMonth.slice(0, 7)}`,
        next: monthUnplanned[0] ? { text: `Plan this week for “${monthUnplanned[0].title}”`, href: `/goals/month/${currentMonth.slice(0, 7)}` } : null,
      },
      {
        label: `Week ${weekNumberInMonth(week)}`,
        title: majors.length ? `${majors.length} major ${majors.length === 1 ? "outcome" : "outcomes"} · ${weekRangeLabel(week)}` : `Not planned · ${weekRangeLabel(week)}`,
        href: `/goals/week/${week}`,
        next: hadLastWeek && !reviewedLastWeek ? { text: "Review last week", href: `/goals/week/${lastWeek}` } : majors.length === 0 ? { text: "Plan this week", href: `/goals/week/${week}` } : null,
      },
      { label: "Today", title: "Your Big 3 and supporting tasks", href: "/", next: { text: "Do the next thing", href: "/#mission" } },
    );
  }

  const byArea = areas
    .map((a) => ({ area: a, goals: live.filter((g) => g.lifeAreaId === a.id) }))
    .filter((x) => x.goals.length > 0);
  const noArea = live.filter((g) => !g.lifeAreaId || !areas.some((a) => a.id === g.lifeAreaId));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <header className="flex items-end justify-between gap-4">
        <h1 className="text-[40px] leading-[1.05] font-light tracking-[-0.035em]">Goals</h1>
        <nav aria-label="Year" className="flex items-center">
          <Link href={`/goals?year=${year - 1}`} aria-label={`${year - 1}`} className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
            <ChevronLeft className="size-5" />
          </Link>
          <span className="w-14 text-center text-xl">{year}</span>
          <Link href={`/goals?year=${year + 1}`} aria-label={`${year + 1}`} className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
            <ChevronRight className="size-5" />
          </Link>
        </nav>
      </header>

      <section aria-labelledby="ladder-heading" className="glow-ink">
        <h2 id="ladder-heading" className="sr-only">
          From your life to today
        </h2>
        <ol className="relative grid gap-0">
          {rungs.map((r, i) => (
            <li key={r.label} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
              {i < rungs.length - 1 && <span aria-hidden className="absolute top-4 bottom-0 left-[0.8125rem] w-px bg-border" />}
              <span aria-hidden className="relative mt-1.5 grid size-[1.75rem] place-items-center">
                <span className={i === rungs.length - 1 ? "size-2.5 rounded-full bg-primary" : "size-2 rounded-full border border-muted-foreground bg-background"} />
              </span>
              <div className="grid gap-0.5">
                <Link href={r.href} className="grid rounded-md hover:text-foreground">
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <span className="text-[17px] leading-snug">{r.title}</span>
                </Link>
                {r.next && (
                  <Link href={r.next.href} className="mt-1 inline-flex min-h-11 w-fit items-center text-[15px] text-primary underline-offset-4 hover:underline">
                    Next: {r.next.text}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Link
        href="/goals/suggest"
        className="-mt-4 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-lamp-soft px-4 py-3"
      >
        <span className="grid">
          <span className="inline-flex items-center gap-2 text-[16px]">
            <Sparkles className="size-4 text-primary" aria-hidden />
            Suggest my goals
          </span>
          <span className="text-sm text-muted-foreground">Concrete goals for this week, from your own numbers</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      <section aria-labelledby="year-heading" className="grid gap-4 border-t border-border pt-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="year-heading" className="text-xl font-medium tracking-tight">
            {year} goals
          </h2>
          <Link href={`/goals/new?year=${year}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary">
            <Plus className="size-4" aria-hidden /> Add a goal
          </Link>
        </div>
        {live.length === 0 ? (
          <div className="grid gap-3 rounded-2xl border border-dashed border-border p-5">
            <p className="text-[16px]">What has to be true by the end of {year}?</p>
            <p className="text-sm text-muted-foreground">
              Start with one goal in the area that matters most. You&apos;ll break it into months, weeks and today&apos;s actions.
            </p>
            <Link href={`/goals/new?year=${year}`} className="inline-flex h-12 w-fit items-center rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground">
              Set a {year} goal
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {[...byArea, ...(noArea.length ? [{ area: { id: "none", name: "Other", sortOrder: 99, isActive: true }, goals: noArea }] : [])].map(({ area, goals }) => (
              <div key={area.id}>
                <h3 className="text-sm text-muted-foreground">{area.name}</h3>
                <ul className="divide-y divide-border/70">
                  {goals.map((g) => (
                    <GoalRow key={g.id} goal={g} progress={progress.get(g.id)} href={`/goals/year/${g.id}`} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
