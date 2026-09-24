import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BreakdownPanel, GoalStateControls, LogProgress, Milestones } from "@/components/goals/goal-controls";
import { HealthBadge, ProgressBar } from "@/components/goals/health";
import { GoalRow } from "@/components/goals/goal-row";
import { Group, PageHeader } from "@/components/os";
import { getViewer } from "@/lib/data";
import { yearToMonths } from "@/lib/goals/breakdown";
import { loadGoalYear, loadLifeAreas, mapYearly } from "@/lib/goals/data";
import { formatTarget, formatValue } from "@/lib/goals/format";
import { isNumeric } from "@/lib/goals/model";
import { monthLabel, monthStartOf, quarterOf } from "@/lib/goals/periods";
import { withProgress } from "@/lib/goals/progress";

export const metadata: Metadata = { title: "Goal" };

export default async function YearlyGoalPage({ params }: PageProps<"/goals/year/[id]">) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: row } = await viewer.supabase.from("yearly_goals").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const goal = mapYearly(row, viewer.profile);
  const [data, areas] = await Promise.all([loadGoalYear(viewer, goal.year), loadLifeAreas(viewer)]);
  const progress = data.progress.get(goal.id);
  const months = data.tree.monthly.filter((m) => m.parentYearlyId === goal.id && m.state !== "cancelled");
  const milestones = data.milestones.filter((m) => m.yearlyGoalId === goal.id);
  const area = areas.find((a) => a.id === goal.lifeAreaId)?.name ?? null;
  const covered = new Set(months.map((m) => m.monthStart));
  const drafts = yearToMonths(withProgress(goal, progress), viewer.today, milestones).filter((d) => !covered.has(d.periodStart));
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

  const thisYear = Number(viewer.today.slice(0, 4));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader back={{ href: goal.year === thisYear ? "/goals" : `/goals?year=${goal.year}`, label: "Goals" }} eyebrow={`${goal.year}${area ? ` · ${area}` : ""}`} title={goal.title} />

      {progress && (
        <section aria-label="Where it stands" className="grid gap-2.5 px-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <HealthBadge status={progress.health} className="text-[15px]" />
            <span className="text-[15px] text-muted-foreground">
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
          <p className="text-[15px] leading-snug text-muted-foreground">{progress.explanation}</p>
        </section>
      )}

      <Group title="About this goal">
        <Detail label="Why this matters">{goal.why || <span className="text-muted-foreground">Not written yet.</span>}</Detail>
        <Detail label="What success looks like">{goal.success || formatTarget(goal)}</Detail>
        {currentMonth ? (
          <Link href={`/goals/month/${currentMonth.monthStart.slice(0, 7)}`} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors active:bg-accent">
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="text-[14px] text-muted-foreground">What I need to do next</span>
              <span className="text-[17px] leading-snug font-medium">{next}</span>
            </span>
            <ChevronRight className="-mr-1 size-[18px] shrink-0 text-faint" aria-hidden />
          </Link>
        ) : (
          <Detail label="What I need to do next">
            <span className="font-medium">{next}</span>
          </Detail>
        )}
      </Group>

      {manual && (
        <Group title="Progress" plain>
          <div className="p-4">
            <LogProgress level="yearly" id={goal.id} unit={goal.unit} current={goal.currentValue} />
          </div>
        </Group>
      )}

      {goal.goalType === "milestone" && (
        <Group title="Milestones">
          <Milestones yearlyGoalId={goal.id} milestones={milestones} />
        </Group>
      )}

      <Group
        title="Months"
        action={months.length ? <span className="text-[15px] text-muted-foreground">{months.length} planned</span> : undefined}
        footer={months.length === 0 ? "A year is too far away to act on. Break it into monthly targets that build towards it." : undefined}
      >
        {quarters.map(({ q, items }) => (
          <div key={q} className="pt-2.5">
            <h3 className="px-4 text-[14px] font-medium text-muted-foreground">Q{q}</h3>
            <ul className="divide-y divide-border px-4">
              {items.map((m) => (
                <GoalRow key={m.id} goal={m} progress={data.progress.get(m.id)} href={`/goals/month/${m.monthStart.slice(0, 7)}`} meta={monthLabel(m.monthStart).split(" ")[0]} />
              ))}
            </ul>
          </div>
        ))}
        {goal.state === "active" ? (
          <BreakdownPanel
            parentId={goal.id}
            level="monthly"
            drafts={drafts}
            groupLabels={Object.fromEntries(drafts.map((d) => [d.periodStart, monthLabel(d.periodStart)]))}
            buttonLabel={months.length ? "Plan the remaining months" : "Break down goal"}
            approveLabel="Save monthly plan"
          />
        ) : null}
        {months.length === 0 && (goal.state !== "active" || drafts.length === 0) && <p className="px-4 py-4 text-[15px] text-muted-foreground">No months planned.</p>}
      </Group>

      <Group>
        <GoalStateControls level="yearly" id={goal.id} state={goal.state} />
      </Group>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-14 content-center gap-0.5 px-4 py-3">
      <span className="text-[14px] text-muted-foreground">{label}</span>
      <span className="text-[17px] leading-snug break-words">{children}</span>
    </div>
  );
}
