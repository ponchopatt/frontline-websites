import type { Metadata } from "next";
import { HabitsManager } from "@/components/habits/habits-manager";
import { ScoreCalendar } from "@/components/score-calendar";
import { Stat, StatStrip } from "@/components/stat-strip";
import { firstDayOf, getViewer, loadHabitStats, loadHistory } from "@/lib/data";
import { shortDate } from "@/lib/day";

export const metadata: Metadata = { title: "Habits" };

export default async function HabitsPage() {
  const viewer = await getViewer();
  const [stats, history] = await Promise.all([loadHabitStats(viewer), loadHistory(viewer)]);
  const threshold = viewer.profile.streakThreshold;
  const last30 = history.scores.slice(-30);
  const onLine = last30.filter((d) => d.score >= threshold).length;
  const best = Math.max(history.best, viewer.profile.bestStreak);
  const firstDay = firstDayOf(viewer);

  return (
    <div className="grid gap-10">
      <header className="grid gap-6">
        <h1 className="text-[34px] leading-tight font-medium tracking-tight">Habits</h1>
        <StatStrip>
          <Stat label="Current streak" value={history.current} unit={history.current === 1 ? "day" : "days"} />
          <Stat label="Best streak" value={best} unit={best === 1 ? "day" : "days"} />
          <Stat label="Last 30 days" value={onLine} unit="on the line" />
        </StatStrip>
      </header>

      <section aria-labelledby="calendar-heading" className="grid gap-4">
        <div className="flex items-baseline justify-between">
          <h2 id="calendar-heading" className="text-xl font-medium tracking-tight">
            History
          </h2>
          <p className="text-sm text-muted-foreground">Streak line {threshold}</p>
        </div>
        <ScoreCalendar scores={history.scores} today={viewer.today} firstDay={firstDay} threshold={threshold} />
        <p className="text-sm text-muted-foreground">
          Since {shortDate(firstDay)}. Tap a day to open it. Missed days end a streak and nothing else.
        </p>
      </section>

      <HabitsManager initial={stats} />
    </div>
  );
}
