import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreakdownPanel, GoalStateControls, LogProgress, Milestones } from "@/components/goals/goal-controls";
import { HealthBadge, ProgressBar } from "@/components/goals/health";
import { GoalRow } from "@/components/goals/goal-row";
import { SectionCard } from "@/components/section-card";
import { getViewer } from "@/lib/data";
import { yearToMonths } from "@/lib/goals/breakdown";
import { loadGoalYear, loadLifeAreas, mapYearly } from "@/lib/goals/data";
import { formatTarget, formatValue } from "@/lib/goals/format";
import { isNumeric } from "@/lib/goals/model";
import { monthLabel, monthStartOf, quarterOf } from "@/lib/goals/periods";

export const metadata: Metadata = { title: "Goal" };

export default async function YearlyGoalPage({ params }: PageProps<"/goals/year/[id]">) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: row } = await viewer.supabase.from("yearly_goals").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const goal = mapYearly(row);
  const [data, areas] = await Promise.all([loadGoalYear(viewer, goal.year), loadLifeAreas(viewer)]);
  const progress = data.progress.get(goal.id);
  const months = data.tree.monthly.filter((m) => m.parentYearlyId === goal.id && m.state !== "cancelled");
  const milestones = data.milestones.filter((m) => m.yearlyGoalId === goal.id);
  const area = areas.find((a) => a.id === goal.lifeAreaId)?.name ?? null;
  const covered = new Set(months.map((m) => m.monthStart));
  const drafts = yearToMonths(goal, viewer.today, milestones).filter((d) => !covered.has(d.periodStart));
  const currentMonth = months.find((m) => m.monthStart === monthStartOf(viewer.today));
  const manual = isNumeric(goal.goalType) && (goal.progressSource === "manual" || (goal.progressSource === "children" && months.length === 0));

  const next = months.length === 0
    ? "Break it down into months, below."
    : currentMonth
      ? `This month: ${currentMonth.title}. Plan the week for it.`
      : "Nothing is planned for this month yet.";

  const quarters = [1, 2, 3, 4]
    .map((q) => ({ q, items: months.filter((m) => quarterOf(m.monthStart) === q) }))
    .filter((x) => x.items.length > 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <header className="grid gap-4">
        <Link href={`/goals?year=${goal.year}`} className="inline-flex min-h-11 w-fit items-center text-sm text-muted-foreground hover:text-foreground">
          {goal.year}
          {area ? ` · ${area}` : ""}
        </Link>
        <h1 className="text-[30px] leading-tight font-medium tracking-tight">{goal.title}</h1>
        {progress && (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <HealthBadge status={progress.health} />
              <span className="text-sm text-muted-foreground">
                {progress.current !== null && goal.targetValue !== null ? (
                  <>
                    <span className="text-foreground">{formatValue(progress.current, goal.unit)}</span> of {formatTarget(goal)}
                  </>
                ) : (
                  formatTarget(goal)
                )}
              </span>
            </div>
            {progress.ratio !== null && <ProgressBar ratio={progress.ratio} expected={progress.expected} label="Progress this year" />}
            <p className="text-[15px] text-muted-foreground">{progress.explanation}</p>
          </div>
        )}
      </header>

      <dl className="grid gap-5 border-t border-border pt-6">
        <div className="grid gap-1">
          <dt className="text-sm text-muted-foreground">Why this matters</dt>
          <dd className="text-[16px]">{goal.why || <span className="text-faint">Not written yet.</span>}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-sm text-muted-foreground">What success looks like</dt>
          <dd className="text-[16px]">{goal.success || formatTarget(goal)}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-sm text-muted-foreground">What I need to do next</dt>
          <dd className="text-[16px] text-primary">
            {currentMonth ? <Link href={`/goals/month/${currentMonth.monthStart.slice(0, 7)}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{next}</Link> : next}
          </dd>
        </div>
      </dl>

      {manual && (
        <LogProgress level="yearly" id={goal.id} unit={goal.unit} current={goal.currentValue} />
      )}

      {goal.goalType === "milestone" && (
        <SectionCard title="Milestones">
          <Milestones yearlyGoalId={goal.id} milestones={milestones} />
        </SectionCard>
      )}

      <SectionCard title="Months" meta={months.length ? `${months.length} planned` : undefined} description={months.length === 0 ? "A year is too far away to act on. Break it into monthly targets that build towards it." : undefined}>
        {quarters.map(({ q, items }) => (
          <div key={q} className="mb-3">
            <h3 className="text-sm text-muted-foreground">Q{q}</h3>
            <ul className="divide-y divide-border/70">
              {items.map((m) => (
                <GoalRow key={m.id} goal={m} progress={data.progress.get(m.id)} href={`/goals/month/${m.monthStart.slice(0, 7)}`} meta={monthLabel(m.monthStart).split(" ")[0]} />
              ))}
            </ul>
          </div>
        ))}
        {goal.state === "active" && (
          <BreakdownPanel
            parentId={goal.id}
            level="monthly"
            drafts={drafts}
            groupLabels={Object.fromEntries(drafts.map((d) => [d.periodStart, monthLabel(d.periodStart)]))}
            buttonLabel={months.length ? "Plan the remaining months" : "Break down goal"}
            approveLabel="Save monthly plan"
          />
        )}
      </SectionCard>

      <div className="border-t border-border pt-6">
        <GoalStateControls level="yearly" id={goal.id} state={goal.state} />
      </div>
    </div>
  );
}
