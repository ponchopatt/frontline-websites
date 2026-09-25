import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GoalBreadcrumb } from "@/components/goals/breadcrumb";
import { BreakdownPanel, LogProgress } from "@/components/goals/goal-controls";
import { HealthBadge, ProgressBar } from "@/components/goals/health";
import { AddMonthlyGoal } from "@/components/goals/add-goal";
import { Group, PageHeader, Row } from "@/components/os";
import { getViewer } from "@/lib/data";
import { startOfWeek } from "@/lib/day";
import { monthToWeeks } from "@/lib/goals/breakdown";
import { loadGoalYear, loadLifeAreas } from "@/lib/goals/data";
import { formatTarget, formatValue } from "@/lib/goals/format";
import { isNumeric } from "@/lib/goals/model";
import { addMonths, monthEndOf, monthLabel, weekNumberInMonth, weekRangeLabel, weeksOfMonth } from "@/lib/goals/periods";
import { withProgress } from "@/lib/goals/progress";

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

  const thisYear = Number(viewer.today.slice(0, 4));
  const monthShortName = monthLabel(monthStart).split(" ")[0].slice(0, 3);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader
        back={{ href: year === thisYear ? "/goals" : `/goals?year=${year}`, label: "Goals" }}
        trailing={
          <nav aria-label="Month" className="-mr-1 flex">
            <Link href={`/goals/month/${addMonths(monthStart, -1).slice(0, 7)}`} aria-label="Previous month" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronLeft className="size-5" />
            </Link>
            <Link href={`/goals/month/${addMonths(monthStart, 1).slice(0, 7)}`} aria-label="Next month" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronRight className="size-5" />
            </Link>
          </nav>
        }
        title={monthLabel(monthStart)}
        subtitle={
          objectives.length === 0
            ? "No objectives this month."
            : unplanned.length > 0 && !isPast
              ? `Next: plan the weeks for “${unplanned[0].title}”.`
              : weeks.includes(thisWeek)
                ? "Next: work this week's plan."
                : `${objectives.length} ${objectives.length === 1 ? "objective" : "objectives"}.`
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h2 id="objectives-heading" className="px-1 text-[15px] font-medium text-muted-foreground">
          Primary objectives
        </h2>
        {objectives.length === 0 && (
          <Group>
            <p className="px-4 py-4 text-[15px] leading-snug text-muted-foreground">
              Monthly objectives come from breaking down a yearly goal{isPast ? "." : ", or add one by hand below."}
            </p>
            <Row href={`/goals?year=${year}`} title={`Open your ${year} goals`} />
          </Group>
        )}
        {objectives.map((o, i) => {
          const p = data.progress.get(o.id);
          const parent = o.parentYearlyId ? data.tree.yearly.find((y) => y.id === o.parentYearlyId) ?? null : null;
          const children = data.tree.weekly.filter((w) => w.parentMonthlyId === o.id && w.state !== "cancelled");
          const covered = new Set(children.map((c) => c.weekStart));
          const areaName = areas.find((a) => a.id === (o.lifeAreaId ?? parent?.lifeAreaId))?.name ?? null;
          const drafts = monthToWeeks(withProgress(o, p), areaName, viewer.today).filter((d) => !covered.has(d.periodStart));
          const manual = isNumeric(o.goalType) && (o.progressSource === "manual" || (o.progressSource === "children" && !children.some((c) => (c.unit ?? "") === (o.unit ?? ""))));
          // "$500 of $3,000" from the start ("$0 of $3,000"), never a bare "0% of $3,000".
          const soFar =
            p?.current !== null && p?.current !== undefined
              ? formatValue(p.current, o.unit)
              : p && p.ratio !== null
                ? o.targetValue !== null
                  ? formatValue(Math.round(p.ratio * o.targetValue), o.unit)
                  : `${Math.round(p.ratio * 100)}%`
                : null;
          return (
            <Group key={o.id} className={i > 0 ? "mt-3" : undefined}>
              <div className="grid gap-2.5 px-4 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="min-w-0 text-[19px] leading-snug font-medium tracking-tight">
                    <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}</span>
                    {o.title}
                  </h3>
                  {p && <HealthBadge status={p.health} className="shrink-0" />}
                </div>
                {p && p.ratio !== null && <ProgressBar ratio={p.ratio} expected={p.expected} label={`${o.title} progress`} />}
                <p className="text-[15px] text-muted-foreground">
                  {soFar !== null && o.targetValue !== null ? (
                    <>
                      <span className="text-foreground">{soFar}</span> of {formatTarget(o)}
                    </>
                  ) : (
                    formatTarget(o)
                  )}
                  {" · "}Due {(o.deadline ?? monthEndOf(monthStart)).slice(8)} {monthShortName}
                </p>
                {p && <p className="text-[14px] leading-snug text-muted-foreground">{p.explanation}</p>}
                {parent && <GoalBreadcrumb chain={{ weekly: null, monthly: null, yearly: parent }} />}
              </div>
              {manual && (
                <div className="px-4 py-4">
                  <LogProgress level="monthly" id={o.id} unit={o.unit} current={o.currentValue} label="So far this month" />
                </div>
              )}
              {weeks.map((w) => {
                const inWeek = children.filter((c) => c.weekStart === w);
                if (inWeek.length === 0) return null;
                const major = inWeek.find((c) => c.isMajor) ?? inWeek[0];
                const wp = data.progress.get(major.id);
                return (
                  <Row
                    key={w}
                    href={`/goals/week/${w}`}
                    title={`Week ${weekNumberInMonth(w)}`}
                    subtitle={`${major.title}${inWeek.length > 1 ? ` + ${inWeek.length - 1}` : ""}`}
                    trailing={wp ? <HealthBadge status={wp.health} className="shrink-0" /> : undefined}
                  />
                );
              })}
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
            </Group>
          );
        })}
      </div>

      {!isPast && (
        <Group>
          <AddMonthlyGoal monthStart={monthStart} yearlyGoals={data.tree.yearly.filter((y) => y.state === "active").map((y) => ({ id: y.id, title: y.title }))} />
        </Group>
      )}
    </div>
  );
}
