import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GoalRow } from "@/components/goals/goal-row";
import { Group, PageHeader, Row } from "@/components/os";
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
      { label: "Today", title: "Your Big 3 and supporting tasks", href: "/", next: null },
    );
  }

  const byArea = areas
    .map((a) => ({ area: a, goals: live.filter((g) => g.lifeAreaId === a.id) }))
    .filter((x) => x.goals.length > 0);
  const noArea = live.filter((g) => !g.lifeAreaId || !areas.some((a) => a.id === g.lifeAreaId));
  const groups = [...byArea, ...(noArea.length ? [{ area: { id: "none", name: "Other", key: null, sortOrder: 99, isActive: true }, goals: noArea }] : [])];

  // The parts of life, each with where its goals stand. The businesses open their numbers.
  const goalsIn = (keys: string[]) => live.filter((g) => areas.some((a) => a.id === g.lifeAreaId && a.key && keys.includes(a.key)));
  const standing = (goals: typeof live) => {
    if (goals.length === 0) return "No goals yet";
    const behind = goals.filter((g) => ["behind", "at_risk"].includes(progress.get(g.id)?.health ?? "")).length;
    return `${goals.length} ${goals.length === 1 ? "goal" : "goals"}${behind ? ` · ${behind} need attention` : ""}`;
  };
  const firstGroup = (keys: string[]) => {
    const g = groups.find((x) => x.area.key && keys.includes(x.area.key));
    return g ? `#goals-${g.area.id}` : `/goals/new?year=${year}`;
  };
  const lifeRows = [
    { title: "Imperium", href: "/business?tab=imperium", sub: standing(goalsIn(["imperium"])) },
    { title: "Websites", href: "/business?tab=websites", sub: standing(goalsIn(["websites"])) },
    { title: "AI Bot", href: "/business?tab=bot", sub: standing(goalsIn(["trading"])) },
    { title: "Fitness", href: firstGroup(["fitness"]), sub: standing(goalsIn(["fitness"])) },
    { title: "Faith", href: firstGroup(["faith"]), sub: standing(goalsIn(["faith"])) },
    { title: "Personal", href: firstGroup(["discipline", "money", "other"]), sub: standing(goalsIn(["discipline", "money", "other"])) },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader
        title="Goals"
        subtitle="Where you're headed, down to today."
        trailing={
          <nav aria-label="Year" className="-mr-1 flex items-center">
            <Link href={`/goals?year=${year - 1}`} aria-label={`${year - 1}`} className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronLeft className="size-5" />
            </Link>
            <span className="w-12 text-center text-[17px]">{year}</span>
            <Link href={`/goals?year=${year + 1}`} aria-label={`${year + 1}`} className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronRight className="size-5" />
            </Link>
          </nav>
        }
      />

      <Group id="ladder" title="From your life to today">
        {rungs.map((r) => (
          <Row
            key={r.label}
            href={r.next?.href ?? r.href}
            title={r.label}
            subtitle={
              <>
                <span className="block">{r.title}</span>
                {r.next && <span className="block font-medium text-foreground">Next: {r.next.text}</span>}
              </>
            }
          />
        ))}
      </Group>

      <Group title="Areas">
        {lifeRows.map((r) => (
          <Row key={r.title} href={r.href} title={r.title} subtitle={r.sub} />
        ))}
      </Group>

      <Group>
        <Row href="/goals/suggest" leading={<Sparkles className="size-[22px]" />} title="Suggest my goals" subtitle="Concrete goals for this week, from your own numbers" />
      </Group>

      {live.length === 0 ? (
        <Group title={`${year} goals`} plain>
          <div className="grid gap-3 p-5">
            <p className="text-[17px]">What has to be true by the end of {year}?</p>
            <p className="text-[15px] text-muted-foreground">Start with one goal in the area that matters most. You&apos;ll break it into months, weeks and today&apos;s actions.</p>
            <Link href={`/goals/new?year=${year}`} className="inline-flex h-12 w-fit items-center rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground">
              Set a {year} goal
            </Link>
          </div>
        </Group>
      ) : (
        <>
          {groups.map(({ area, goals }, i) => (
            <Group
              key={area.id}
              id={`goals-${area.id}`}
              title={i === 0 ? `${year} goals · ${area.name}` : area.name}
              action={
                i === 0 ? (
                  <Link href={`/goals/new?year=${year}`} className="inline-flex min-h-11 items-center gap-1 text-[15px] text-foreground">
                    <Plus className="size-4" aria-hidden /> Add a goal
                  </Link>
                ) : undefined
              }
            >
              <ul className="divide-y divide-border px-4">
                {goals.map((g) => (
                  <GoalRow key={g.id} goal={g} progress={progress.get(g.id)} href={`/goals/year/${g.id}`} />
                ))}
              </ul>
            </Group>
          ))}
        </>
      )}
    </div>
  );
}
