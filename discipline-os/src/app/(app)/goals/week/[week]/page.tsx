import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddWeeklyGoal } from "@/components/goals/add-goal";
import { GoalBreadcrumb } from "@/components/goals/breadcrumb";
import { BreakdownPanel, LogProgress } from "@/components/goals/goal-controls";
import { HealthBadge, ProgressBar } from "@/components/goals/health";
import { WeeklyReview, type ReviewGoal } from "@/components/goals/weekly-review";
import { DECISIONS, REASONS } from "@/lib/goals/review";
import { SectionCard } from "@/components/section-card";
import { getViewer, loadSummaries } from "@/lib/data";
import { addDays, formatHours, isLocalDate } from "@/lib/day";
import { monthToWeeks } from "@/lib/goals/breakdown";
import { loadGoalYear, loadLifeAreas, yearOfWeek } from "@/lib/goals/data";
import { formatTarget, formatValue } from "@/lib/goals/format";
import type { WeeklyGoal } from "@/lib/goals/model";
import { monthLabel, monthOfWeek, weekEndOf, weekNumberInMonth, weekRangeLabel } from "@/lib/goals/periods";
import { scoreForSummary } from "@/lib/streak";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Week" };

const MAJOR_LIMIT = 3;

export default async function WeekPage({ params, searchParams }: PageProps<"/goals/week/[week]">) {
  const { week } = await params;
  const { review: reviewParam } = await searchParams;
  if (!isLocalDate(week)) notFound();
  const [y, m, d] = week.split("-").map(Number);
  if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 1) notFound();

  const viewer = await getViewer();
  const { supabase, today, profile } = viewer;
  const end = weekEndOf(week);
  const monthStart = monthOfWeek(week);
  const [data, areas, reviewRes, goalReviewsRes, sessionsRes, summaries] = await Promise.all([
    loadGoalYear(viewer, yearOfWeek(week)),
    loadLifeAreas(viewer),
    supabase.from("weekly_reviews").select("*").eq("week_start_date", week).maybeSingle(),
    supabase.from("goal_reviews").select("*").eq("period", "week").eq("period_start", week),
    supabase.from("work_sessions").select("started_at,ended_at,work_block_id").gte("local_date", week).lte("local_date", end),
    week <= today ? loadSummaries(supabase, week, end < today ? end : today) : Promise.resolve([]),
  ]);

  const goals = data.tree.weekly.filter((w) => w.weekStart === week && w.state !== "cancelled");
  const majors = goals.filter((g) => g.isMajor);
  const supporting = goals.filter((g) => !g.isMajor);
  const monthly = data.tree.monthly.filter((mg) => mg.monthStart === monthStart && mg.state === "active");
  const reviewed = Boolean(reviewRes.data?.completed_at);
  const weekOver = end < today;
  // The review opens at the weekend, when the week is over, or early on request.
  const reviewTime = weekOver || today >= addDays(week, 5) || (reviewParam === "now" && week <= today);
  const planning = !weekOver;

  // Monthly objectives with nothing planned for this week yet: suggest their share of it.
  const pullIn = monthly
    .filter((mg) => !goals.some((g) => g.parentMonthlyId === mg.id))
    .map((mg) => {
      const area = areas.find((a) => a.id === mg.lifeAreaId)?.name ?? null;
      return { goal: mg, drafts: monthToWeeks(mg, area, week > today ? week : today).filter((dr) => dr.periodStart === week) };
    })
    .filter((x) => x.drafts.length > 0);

  // Alignment: how much of this week's tracked work was on goal-linked blocks.
  const linkedBlocks = new Set(data.daily.filter((dg) => dg.workBlockId && dg.parentWeeklyId).map((dg) => dg.workBlockId));
  let totalMin = 0;
  let alignedMin = 0;
  for (const s of sessionsRes.data ?? []) {
    const mins = Math.max(0, ((s.ended_at ? new Date(s.ended_at).getTime() : new Date(s.started_at).getTime()) - new Date(s.started_at).getTime()) / 60000);
    totalMin += mins;
    if (s.work_block_id && linkedBlocks.has(s.work_block_id)) alignedMin += mins;
  }
  const alignment = totalMin > 0 ? alignedMin / totalMin : null;
  const scores = summaries.map((s) => scoreForSummary(s, profile.workTargetHours));
  const onLine = scores.filter((s) => s.score >= profile.streakThreshold).length;
  const doneActions = data.daily.filter((dg) => dg.localDate >= week && dg.localDate <= end && dg.status === "done").length;

  const reviewGoals: ReviewGoal[] = goals
    .filter((g) => g.state === "active" || g.state === "completed")
    .map((g) => {
      const p = data.progress.get(g.id);
      const ratio = p?.ratio ?? (g.state === "completed" ? 1 : 0);
      return {
        id: g.id,
        title: g.title,
        isMajor: g.isMajor,
        unit: g.unit,
        target: g.targetValue,
        actual: p?.current ?? null,
        suggested: g.state === "completed" || ratio >= 1 ? "completed" : ratio > 0 ? "partial" : "missed",
      };
    });
  const pastReviews = goalReviewsRes.data ?? [];

  const row = (g: WeeklyGoal) => {
    const p = data.progress.get(g.id);
    const parent = g.parentMonthlyId ? data.tree.monthly.find((mg) => mg.id === g.parentMonthlyId) ?? null : null;
    const yearly = parent?.parentYearlyId ? data.tree.yearly.find((yg) => yg.id === parent.parentYearlyId) ?? null : null;
    return (
      <li key={g.id} className="grid gap-2 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[17px] leading-snug">
            {g.title}
            {g.carriedFromId && <span className="ml-2 text-xs text-faint">carried</span>}
          </span>
          {p && <HealthBadge status={p.health} className="shrink-0" />}
        </div>
        {p && p.ratio !== null && <ProgressBar ratio={p.ratio} expected={p.expected} label={`${g.title} progress`} />}
        <p className="text-sm text-muted-foreground">
          {p?.current !== null && p?.current !== undefined && g.targetValue !== null ? (
            <>
              <span className="text-foreground">{formatValue(p.current, g.unit)}</span> of {formatTarget(g)}
            </>
          ) : (
            formatTarget(g)
          )}
          {g.progressSource === "actions" && " · counted from your daily actions"}
          {g.progressSource === "work_hours" && " · counted from the work timer"}
        </p>
        <GoalBreadcrumb chain={{ weekly: null, monthly: parent, yearly }} />
        {g.progressSource === "manual" && g.targetValue !== null && g.state === "active" && (
          <LogProgress level="weekly" id={g.id} unit={g.unit} current={g.currentValue} label="So far this week" />
        )}
      </li>
    );
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <header className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/goals/month/${monthStart.slice(0, 7)}`} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">
            {monthLabel(monthStart)}
          </Link>
          <nav aria-label="Week" className="flex">
            <Link href={`/goals/week/${addDays(week, -7)}`} aria-label="Previous week" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronLeft className="size-5" />
            </Link>
            <Link href={`/goals/week/${addDays(week, 7)}`} aria-label="Next week" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronRight className="size-5" />
            </Link>
          </nav>
        </div>
        <h1 className="text-[34px] leading-tight font-medium tracking-tight">Week {weekNumberInMonth(week)}</h1>
        <p className="text-[15px] text-muted-foreground">{weekRangeLabel(week)}</p>
      </header>

      <section aria-labelledby="outcomes-heading" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="outcomes-heading" className="text-xl font-medium tracking-tight">
            What am I trying to accomplish this week?
          </h2>
          <p className="text-sm text-muted-foreground">One to three major outcomes, with supporting tasks under them.</p>
        </div>

        {majors.length > MAJOR_LIMIT && (
          <p className="flex gap-2.5 rounded-xl border border-primary/40 bg-lamp-soft p-3 text-[15px]" role="note">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            You have {majors.length} major goals this week. Consider reducing them to 1–3.
          </p>
        )}

        {goals.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">Nothing planned for this week yet.</p>
        ) : (
          <>
            {majors.length > 0 && <ul className="divide-y divide-border/70">{majors.map(row)}</ul>}
            {supporting.length > 0 && (
              <div>
                <h3 className="text-sm text-muted-foreground">Supporting tasks</h3>
                <ul className="divide-y divide-border/70">{supporting.map(row)}</ul>
              </div>
            )}
          </>
        )}

        {planning && pullIn.length > 0 && (
          <div className="grid gap-4 rounded-2xl border border-border p-4">
            <h3 className="text-lg font-medium tracking-tight">From your monthly objectives</h3>
            {pullIn.map(({ goal, drafts }) => (
              <div key={goal.id} className="grid gap-2">
                <GoalBreadcrumb chain={{ weekly: null, monthly: goal, yearly: goal.parentYearlyId ? data.tree.yearly.find((yg) => yg.id === goal.parentYearlyId) ?? null : null }} />
                <BreakdownPanel
                  parentId={goal.id}
                  level="weekly"
                  drafts={drafts}
                  groupLabels={{ [week]: `This week · ${goal.title}` }}
                  buttonLabel={`Plan this week for “${goal.title}”`}
                  approveLabel="Add to this week"
                />
              </div>
            ))}
          </div>
        )}

        {planning && (
          <div className="border-t border-border pt-5">
            <AddWeeklyGoal weekStart={week} monthlyGoals={monthly.map((mg) => ({ id: mg.id, title: mg.title }))} />
          </div>
        )}
      </section>

      {week <= today && (
        <SectionCard title="Execution" meta={weekOver ? "Week closed" : "So far"}>
          <dl className="grid grid-cols-3 gap-3">
            <div className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">Work</dt>
              <dd className="text-xl">{formatHours(totalMin)}</dd>
            </div>
            <div className="grid gap-0.5 border-l border-border pl-3">
              <dt className="text-xs text-muted-foreground">Actions done</dt>
              <dd className="text-xl">{doneActions}</dd>
            </div>
            <div className="grid gap-0.5 border-l border-border pl-3">
              <dt className="text-xs text-muted-foreground">Days on the line</dt>
              <dd className="text-xl">
                {onLine}/{scores.length}
              </dd>
            </div>
          </dl>
          {alignment !== null && (
            <p className="mt-3 text-[15px] text-muted-foreground">
              <span className="text-foreground">{Math.round(alignment * 100)}%</span> of tracked work was on blocks linked to a goal.
            </p>
          )}
          {alignment !== null && alignment < 0.5 && totalMin >= 120 && (
            <p className="mt-3 flex gap-2.5 rounded-xl border border-primary/40 bg-lamp-soft p-3 text-[15px]" role="note">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium">Goal alignment check.</span> A large portion of your tracked work this week isn&apos;t connected to one of your current
                priorities. Review your schedule?
              </span>
            </p>
          )}
        </SectionCard>
      )}

      {!reviewTime && week <= today && (
        <Link href={`/goals/week/${week}?review=now`} className="-mt-4 inline-flex min-h-11 w-fit items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Review this week now
        </Link>
      )}

      {reviewTime && (
        <SectionCard title="Weekly review" meta={reviewed ? "Done" : undefined}>
          {reviewed ? (
            <div className="grid gap-4">
              <ul className="grid gap-3">
                {pastReviews.map((r) => {
                  const g = goals.find((x) => x.id === r.weekly_goal_id) ?? data.tree.weekly.find((x) => x.id === r.weekly_goal_id);
                  return (
                    <li key={r.id} className="grid gap-0.5 border-l border-border pl-3">
                      <span className="text-[16px]">{g?.title ?? "A goal"}</span>
                      <span className={cn("text-sm", r.outcome === "completed" ? "text-primary" : "text-muted-foreground")}>
                        {r.outcome === "completed" ? "Done" : r.outcome === "partial" ? "Partly done" : "Not done"}
                        {r.reason && ` · ${REASONS.find((x) => x.value === r.reason)?.label}`}
                        {r.decision && ` · ${DECISIONS.find((x) => x.value === r.decision)?.label}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {(reviewRes.data?.wins || reviewRes.data?.lessons) && (
                <dl className="grid gap-2 text-[15px]">
                  {reviewRes.data?.wins && (
                    <>
                      <dt className="text-sm text-muted-foreground">What went well</dt>
                      <dd>{reviewRes.data.wins}</dd>
                    </>
                  )}
                  {reviewRes.data?.lessons && (
                    <>
                      <dt className="text-sm text-muted-foreground">What I learned</dt>
                      <dd>{reviewRes.data.lessons}</dd>
                    </>
                  )}
                </dl>
              )}
              <Link href={`/goals/week/${addDays(week, 7)}`} className="inline-flex h-12 w-fit items-center rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground">
                Plan next week
              </Link>
            </div>
          ) : (
            <WeeklyReview weekStart={week} goals={reviewGoals} />
          )}
        </SectionCard>
      )}
    </div>
  );
}
