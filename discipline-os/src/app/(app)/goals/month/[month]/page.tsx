import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GoalBreadcrumb } from "@/components/goals/breadcrumb";
import { BreakdownPanel, LogProgress } from "@/components/goals/goal-controls";
import { HealthBadge, ProgressBar } from "@/components/goals/health";
import { AddMonthlyGoal } from "@/components/goals/add-goal";
import { getViewer } from "@/lib/data";
import { startOfWeek } from "@/lib/day";
import { monthToWeeks } from "@/lib/goals/breakdown";
import { loadGoalYear, loadLifeAreas } from "@/lib/goals/data";
import { formatTarget, formatValue } from "@/lib/goals/format";
import { isNumeric } from "@/lib/goals/model";
import { addMonths, monthEndOf, monthLabel, weekNumberInMonth, weekRangeLabel, weeksOfMonth } from "@/lib/goals/periods";

export const metadata: Metadata = { title: "Month" };

export default async function MonthPage({ params }: PageProps<"/goals/month/[month]">) {
  const { month } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();
  const monthStart = `${month}-01`;
  const viewer = await getViewer();
  const year = Number(month.slice(0, 4));
  const [data, areas] = await Promise.all([loadGoalYear(viewer, year), loadLifeAreas(viewer)]);
  const objectives = data.tree.monthly.filter((m) => m.monthStart === monthStart && m.state !== "cancelled");
  const weeks = weeksOfMonth(monthStart);
  const thisWeek = startOfWeek(viewer.today);
  const unplanned = objectives.filter((o) => !data.tree.weekly.some((w) => w.parentMonthlyId === o.id));
  const isPast = monthEndOf(monthStart) < viewer.today;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <header className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/goals?year=${year}`} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">
            {year} goals
          </Link>
          <nav aria-label="Month" className="flex">
            <Link href={`/goals/month/${addMonths(monthStart, -1).slice(0, 7)}`} aria-label="Previous month" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronLeft className="size-5" />
            </Link>
            <Link href={`/goals/month/${addMonths(monthStart, 1).slice(0, 7)}`} aria-label="Next month" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronRight className="size-5" />
            </Link>
          </nav>
        </div>
        <h1 className="text-[40px] leading-[1.05] font-light tracking-[-0.035em]">{monthLabel(monthStart)}</h1>
        <p className="text-[15px] text-muted-foreground">
          {objectives.length === 0
            ? "No objectives this month."
            : unplanned.length > 0 && !isPast
              ? `Next: plan the weeks for “${unplanned[0].title}”.`
              : weeks.includes(thisWeek)
                ? "Next: work this week's plan."
                : `${objectives.length} ${objectives.length === 1 ? "objective" : "objectives"}.`}
        </p>
      </header>

      <section aria-labelledby="objectives-heading" className="grid gap-6">
        <h2 id="objectives-heading" className="text-xl font-medium tracking-tight">
          Primary objectives
        </h2>
        {objectives.length === 0 && (
          <p className="text-[15px] text-muted-foreground">
            Monthly objectives come from breaking down a yearly goal. <Link href={`/goals?year=${year}`} className="text-foreground underline underline-offset-4">Open your {year} goals</Link>, or add one below.
          </p>
        )}
        <ol className="grid gap-6">
          {objectives.map((o, i) => {
            const p = data.progress.get(o.id);
            const parent = o.parentYearlyId ? data.tree.yearly.find((y) => y.id === o.parentYearlyId) ?? null : null;
            const children = data.tree.weekly.filter((w) => w.parentMonthlyId === o.id && w.state !== "cancelled");
            const covered = new Set(children.map((c) => c.weekStart));
            const areaName = areas.find((a) => a.id === (o.lifeAreaId ?? parent?.lifeAreaId))?.name ?? null;
            const drafts = monthToWeeks(o, areaName, viewer.today).filter((d) => !covered.has(d.periodStart));
            const manual = isNumeric(o.goalType) && (o.progressSource === "manual" || (o.progressSource === "children" && !children.some((c) => (c.unit ?? "") === (o.unit ?? ""))));
            return (
              <li key={o.id} className="grid gap-3 rounded-2xl border border-border p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[19px] leading-snug font-medium tracking-tight">
                    <span className="mr-2 text-muted-foreground">{i + 1}</span>
                    {o.title}
                  </h3>
                  {p && <HealthBadge status={p.health} className="shrink-0" />}
                </div>
                {p && p.ratio !== null && <ProgressBar ratio={p.ratio} expected={p.expected} label={`${o.title} progress`} />}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Target</dt>
                  <dd className="text-right">{formatTarget(o)}</dd>
                  <dt className="text-muted-foreground">Progress</dt>
                  <dd className="text-right">{p?.current !== null && p?.current !== undefined ? formatValue(p.current, o.unit) : p?.ratio !== null && p ? `${Math.round((p.ratio ?? 0) * 100)}%` : "–"}</dd>
                  <dt className="text-muted-foreground">Deadline</dt>
                  <dd className="text-right">{(o.deadline ?? monthEndOf(monthStart)).slice(8)} {monthLabel(monthStart).split(" ")[0].slice(0, 3)}</dd>
                </dl>
                {p && <p className="text-sm text-muted-foreground">{p.explanation}</p>}
                {parent && <GoalBreadcrumb chain={{ weekly: null, monthly: null, yearly: parent }} />}
                {manual && <LogProgress level="monthly" id={o.id} unit={o.unit} current={o.currentValue} label="So far this month" />}

                {children.length > 0 && (
                  <div className="grid gap-1 border-t border-border pt-3">
                    <p className="text-sm text-muted-foreground">Weekly breakdown</p>
                    <ul className="grid gap-1">
                      {weeks.map((w) => {
                        const inWeek = children.filter((c) => c.weekStart === w);
                        if (inWeek.length === 0) return null;
                        const major = inWeek.find((c) => c.isMajor) ?? inWeek[0];
                        const wp = data.progress.get(major.id);
                        return (
                          <li key={w}>
                            <Link href={`/goals/week/${w}`} className="flex min-h-11 items-center justify-between gap-3 rounded-md hover:bg-accent/40">
                              <span className="min-w-0 truncate text-[15px]">
                                <span className="text-muted-foreground">Week {weekNumberInMonth(w)}</span> {major.title}
                                {inWeek.length > 1 && <span className="text-faint"> + {inWeek.length - 1}</span>}
                              </span>
                              {wp && <HealthBadge status={wp.health} className="shrink-0" />}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {o.state === "active" && !isPast && (
                  <BreakdownPanel
                    parentId={o.id}
                    level="weekly"
                    drafts={drafts}
                    groupLabels={Object.fromEntries(drafts.map((d) => [d.periodStart, `Week ${weekNumberInMonth(d.periodStart)} · ${weekRangeLabel(d.periodStart)}`]))}
                    buttonLabel={children.length ? "Plan the remaining weeks" : "Generate weekly plan"}
                    approveLabel="Save weekly plan"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {!isPast && (
        <section className="border-t border-border pt-6">
          <AddMonthlyGoal monthStart={monthStart} yearlyGoals={data.tree.yearly.filter((y) => y.state === "active").map((y) => ({ id: y.id, title: y.title }))} />
        </section>
      )}
    </div>
  );
}
