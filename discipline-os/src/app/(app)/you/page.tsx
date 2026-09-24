import { CalendarCheck, Camera, ChartNoAxesColumn, ListChecks, RotateCcw, Settings2, Timer, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { Group, PageHeader, Row } from "@/components/os";
import { getViewer } from "@/lib/data";
import { startOfWeek } from "@/lib/day";
import { indexHistory, momentum, streaks, wordTrend } from "@/lib/history";
import { loadFacts } from "@/lib/history-server";
import { firstName } from "@/lib/names";

export const metadata: Metadata = { title: "You" };

const icon = "size-[22px]";

/**
 * You: reflection and history. Who you are becoming in three numbers, then everything that
 * looks back or sets things up.
 */
export default async function YouPage() {
  const viewer = await getViewer();
  const facts = await loadFacts(viewer);
  const ix = indexHistory(facts);
  const word = streaks(ix).find((s) => s.key === "word");
  const trend = wordTrend(ix);
  const month = trend.months[trend.months.length - 1]?.average ?? null;
  const mom = momentum(ix);
  const name = firstName(viewer.profile.displayName);
  const week = startOfWeek(viewer.today);

  const stats = [
    { label: "Streak", value: String(word?.current ?? 0), unit: (word?.current ?? 0) === 1 ? "day" : "days" },
    { label: "Best", value: String(Math.max(word?.best ?? 0, viewer.profile.bestStreak)), unit: "days" },
    { label: "This month", value: month === null ? "–" : String(month), unit: month === null ? "" : "%" },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader eyebrow="You" title={name ?? "Your progress"} subtitle="What you said you'd do, what you did, and how it's adding up." />

      <dl className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="grid gap-0.5">
            <dt className="text-[14px] text-muted-foreground">{s.label}</dt>
            <dd className="text-[30px] leading-none font-light tracking-tight tabular-nums">
              {s.value}
              {s.unit && <span className={s.unit === "%" ? "text-[15px] text-muted-foreground" : "ml-1 text-[15px] text-muted-foreground"}>{s.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <Group title="Progress">
        <Row
          href="/progress"
          leading={<ChartNoAxesColumn className={icon} />}
          title="Keep my word"
          subtitle={mom ? `Momentum ${mom.score}${mom.trend ? `, ${mom.trend}` : ""}` : "The year in squares, week by week"}
        />
        <Row href="/progress?tab=trophies" leading={<Trophy className={icon} />} title="Records and streaks" subtitle="Personal bests and every streak" />
        <Row href="/progress?tab=proof" leading={<Camera className={icon} />} title="Proof" subtitle="Photos of the work, day by day" />
      </Group>

      <Group title="Looking back">
        <Row href={`/goals/week/${week}?review=now`} leading={<CalendarCheck className={icon} />} title="Weekly review" subtitle="This week's scoreboard and four questions" />
        <Row href="/work" leading={<Timer className={icon} />} title="Work log" subtitle="Every block and session" />
      </Group>

      <Group title="Setup">
        <Row href="/habits" leading={<ListChecks className={icon} />} title="Habits" subtitle="What you tick each day" />
        <Row href="/settings" leading={<Settings2 className={icon} />} title="Settings" subtitle="Targets, passcode, look" />
        <Row href="/welcome" leading={<RotateCcw className={icon} />} title="Redo setup" subtitle="Goals, targets and the week's numbers" />
      </Group>
    </div>
  );
}
