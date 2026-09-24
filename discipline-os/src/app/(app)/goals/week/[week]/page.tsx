import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddWeeklyGoal } from "@/components/goals/add-goal";
import { GoalBreadcrumb } from "@/components/goals/breadcrumb";
import { Note } from "@/components/goals/form-bits";
import { BreakdownPanel, LogProgress } from "@/components/goals/goal-controls";
import { HealthBadge, ProgressBar } from "@/components/goals/health";
import { WeeklyReview, type ReviewGoal } from "@/components/goals/weekly-review";
import { Group, PageHeader, Row } from "@/components/os";
import { WeekScoreboard } from "@/components/week/scoreboard";
import { bossOf, loadScoreboard, scoreboardGroups } from "@/components/week/scoreboard-data";
import { firstDayOf, getViewer, loadSummaries } from "@/lib/data";
import { addDays, formatHours, isLocalDate } from "@/lib/day";
import { monthToWeeks } from "@/lib/goals/breakdown";
import { loadGoalYear, loadLifeAreas, yearOfWeek } from "@/lib/goals/data";
import { formatTarget, formatValue } from "@/lib/goals/format";
import type { WeeklyGoal } from "@/lib/goals/model";
import { monthLabel, monthOfWeek, weekEndOf, weekNumberInMonth, weekRangeLabel } from "@/lib/goals/periods";
import { withProgress } from "@/lib/goals/progress";
import { DECISIONS, REASONS, suggestedOutcome } from "@/lib/goals/review";
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
  const [data, areas, reviewRes, goalReviewsRes, sessionsRes, summaries, board] = await Promise.all([
    loadGoalYear(viewer, yearOfWeek(week)),
    loadLifeAreas(viewer),
    supabase.from("weekly_reviews").select("*").eq("week_start_date", week).maybeSingle(),
    supabase.from("goal_reviews").select("*").eq("period", "week").eq("period_start", week),
    supabase.from("work_sessions").select("started_at,ended_at,work_block_id").gte("local_date", week).lte("local_date", end),
    // Only days since the account started count as days on (or off) the line.
    week <= today ? loadSummaries(supabase, week > firstDayOf(viewer) ? week : firstDayOf(viewer), end < today ? end : today) : Promise.resolve([]),
    loadScoreboard(viewer, week),
  ]);

  const goals = data.tree.weekly.filter((w) => w.weekStart === week && w.state !== "cancelled");
  const groups = scoreboardGroups(board, data);
  const majors = goals.filter((g) => g.isMajor);
  const supporting = goals.filter((g) => !g.isMajor);
  const monthly = data.tree.monthly.filter((mg) => mg.monthStart === monthStart && mg.state === "active");
  const review = reviewRes.data;
  const reviewed = Boolean(review?.completed_at);
  const weekOver = end < today;
  // The review opens at the weekend, when the week is over, or early on request.
  const reviewTime = weekOver || today >= addDays(week, 5) || (reviewParam === "now" && week <= today);
  const planning = !weekOver;

  // Monthly objectives with nothing planned for this week yet: suggest their share of it.
  const pullIn = monthly
    .filter((mg) => !goals.some((g) => g.parentMonthlyId === mg.id))
    .map((mg) => {
      const area = areas.find((a) => a.id === mg.lifeAreaId)?.name ?? null;
      return { goal: mg, drafts: monthToWeeks(withProgress(mg, data.progress.get(mg.id)), area, week > today ? week : today).filter((dr) => dr.periodStart === week) };
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
  const doneActions = data.daily.filter((dg) => dg.localDate !== null && dg.localDate >= week && dg.localDate <= end && dg.status === "done").length;

  const reviewGoals: ReviewGoal[] = goals
    .filter((g) => g.state === "active" || g.state === "completed")
    .map((g) => {
      const p = data.progress.get(g.id);
      return {
        id: g.id,
        title: g.title,
        isMajor: g.isMajor,
        unit: g.unit,
        target: g.targetValue,
        actual: p?.current ?? null,
        suggested: suggestedOutcome(g, p),
      };
    });
  const pastReviews = goalReviewsRes.data ?? [];
  // The four questions; older reviews also had "What did I learn?".
  const answers = (
    [
      ["Biggest win", review?.wins],
      ["Biggest failure", review?.failure],
      ["Main bottleneck", review?.bottleneck],
      ["Next week's #1 priority", review?.focus_for_next_week],
      ["What I learned", review?.lessons],
    ] satisfies Array<[string, string | null | undefined]>
  ).filter((a): a is [string, string] => Boolean(a[1]?.trim()));

  const row = (g: WeeklyGoal) => {
    const p = data.progress.get(g.id);
    const parent = g.parentMonthlyId ? data.tree.monthly.find((mg) => mg.id === g.parentMonthlyId) ?? null : null;
    const yearly = parent?.parentYearlyId ? data.tree.yearly.find((yg) => yg.id === parent.parentYearlyId) ?? null : null;
    return (
      <li key={g.id} className="grid gap-2 px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 text-[17px] leading-snug">
            {g.title}
            {g.carriedFromId && <span className="ml-2 text-[13px] text-muted-foreground">carried</span>}
          </span>
          {p && <HealthBadge status={p.health} className="shrink-0" />}
        </div>
        {p && p.ratio !== null && <ProgressBar ratio={p.ratio} expected={p.expected} label={`${g.title} progress`} />}
        <p className="text-[14px] leading-snug text-muted-foreground">
          {p?.current !== null && p?.current !== undefined && g.targetValue !== null ? (
            <>
              <span className="text-foreground">{formatValue(p.current, g.unit)}</span> of {formatTarget(g)}
            </>
          ) : (
            formatTarget(g)
          )}
          {g.progressSource === "actions" && " · counted from your daily actions"}
          {g.progressSource === "work_hours" && " · counted from the work timer"}
          {g.progressSource === "keep_word" && " · counted from the days you kept your word"}
        </p>
        <GoalBreadcrumb chain={{ weekly: null, monthly: parent, yearly }} />
        {g.progressSource === "manual" && g.targetValue !== null && g.state === "active" && (
          <div className="pt-1">
            <LogProgress level="weekly" id={g.id} unit={g.unit} current={g.currentValue} label="So far this week" />
          </div>
        )}
      </li>
    );
  };

  const meta = (text: string) => <span className="text-[15px] text-muted-foreground">{text}</span>;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader
        back={{ href: "/goals", label: "Goals" }}
        trailing={
          <nav aria-label="Week" className="-mr-1 flex">
            <Link href={`/goals/week/${addDays(week, -7)}`} aria-label="Previous week" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronLeft className="size-5" />
            </Link>
            <Link href={`/goals/week/${addDays(week, 7)}`} aria-label="Next week" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronRight className="size-5" />
            </Link>
          </nav>
        }
        eyebrow={
          <Link href={`/goals/month/${monthStart.slice(0, 7)}`} className="-my-3 inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline">
            {monthLabel(monthStart)}
          </Link>
        }
        title={`Week ${weekNumberInMonth(week)}`}
        subtitle={weekRangeLabel(week)}
      />

      <WeekScoreboard groups={groups} boss={week <= today ? bossOf(groups, weekOver) : null} meta={weekOver ? "Week closed" : week <= today ? "So far" : "Not started"} />

      <Group id="outcomes" title="What am I trying to accomplish this week?" footer="One to three major outcomes, with supporting tasks under them.">
        {majors.length > MAJOR_LIMIT && <Note>You have {majors.length} major goals this week. Consider reducing them to 1–3.</Note>}
        {majors.length > 0 ? (
          <ul className="divide-y divide-border">{majors.map(row)}</ul>
        ) : (
          <p className="px-4 py-4 text-[15px] text-muted-foreground">{goals.length === 0 ? "Nothing planned for this week yet." : "No major outcome yet."}</p>
        )}
        {planning && <AddWeeklyGoal weekStart={week} monthlyGoals={monthly.map((mg) => ({ id: mg.id, title: mg.title }))} />}
      </Group>

      {supporting.length > 0 && (
        <Group title="Supporting tasks">
          <ul className="divide-y divide-border">{supporting.map(row)}</ul>
        </Group>
      )}

      {planning && pullIn.length > 0 && (
        <Group title="From your monthly objectives">
          {pullIn.map(({ goal, drafts }) => (
            <BreakdownPanel
              key={goal.id}
              parentId={goal.id}
              level="weekly"
              drafts={drafts}
              groupLabels={{ [week]: `This week · ${goal.title}` }}
              buttonLabel={`Plan this week for “${goal.title}”`}
              approveLabel="Add to this week"
            />
          ))}
        </Group>
      )}

      {week <= today && (
        <Group
          title="Execution"
          action={meta(weekOver ? "Week closed" : "So far")}
          footer={
            alignment !== null ? (
              <>
                <span className="text-foreground">{Math.round(alignment * 100)}%</span> of tracked work was on blocks linked to a goal.
              </>
            ) : undefined
          }
        >
          <dl className="grid grid-cols-3 gap-3 px-4 py-4">
            <Figure label="Work" value={formatHours(totalMin)} />
            <Figure label="Actions done" value={String(doneActions)} />
            <Figure label="Days on the line" value={`${onLine}/${scores.length}`} />
          </dl>
          {alignment !== null && alignment < 0.5 && totalMin >= 120 && (
            <Note>
              <span className="font-medium">Goal alignment check.</span> A large portion of your tracked work this week isn&apos;t connected to one of your current priorities.
              Review your schedule?
            </Note>
          )}
        </Group>
      )}

      {!reviewTime && week <= today && (
        <Group>
          <Row href={`/goals/week/${week}?review=now#review`} leading={<CalendarCheck className="size-[22px]" />} title="Review this week now" />
        </Group>
      )}

      {reviewTime &&
        (reviewed ? (
          <Group id="review" title="Weekly review" action={meta("Done")}>
            {pastReviews.map((r) => {
              const g = goals.find((x) => x.id === r.weekly_goal_id) ?? data.tree.weekly.find((x) => x.id === r.weekly_goal_id);
              return (
                <div key={r.id} className="grid gap-0.5 px-4 py-3">
                  <span className="text-[17px] leading-snug">{g?.title ?? "A goal"}</span>
                  <span className={cn("text-[14px]", r.outcome === "completed" ? "font-medium text-kept" : "text-muted-foreground")}>
                    {r.outcome === "completed" ? "Done" : r.outcome === "partial" ? "Partly done" : "Not done"}
                    {r.reason && ` · ${REASONS.find((x) => x.value === r.reason)?.label}`}
                    {r.decision && ` · ${DECISIONS.find((x) => x.value === r.decision)?.label}`}
                  </span>
                </div>
              );
            })}
            {answers.map(([label, text]) => (
              <div key={label} className="grid gap-0.5 px-4 py-3">
                <span className="text-[14px] text-muted-foreground">{label}</span>
                <span className="text-[17px] leading-snug break-words whitespace-pre-line">{text}</span>
              </div>
            ))}
            <div className="p-4">
              <Link
                href={`/goals/week/${addDays(week, 7)}`}
                className="flex h-[52px] items-center justify-center rounded-full bg-primary px-6 text-[17px] font-medium text-primary-foreground transition-transform active:scale-[0.98]"
              >
                Plan next week
              </Link>
            </div>
          </Group>
        ) : (
          <WeeklyReview weekStart={week} goals={reviewGoals} />
        ))}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 content-start gap-0.5">
      <dt className="text-[14px] leading-snug text-muted-foreground">{label}</dt>
      <dd className="text-[24px] leading-tight font-light tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}
