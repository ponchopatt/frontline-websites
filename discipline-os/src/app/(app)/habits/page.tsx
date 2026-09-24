import type { Metadata } from "next";
import { HabitsManager } from "@/components/habits/habits-manager";
import { ScoreCalendar } from "@/components/score-calendar";
import { firstDayOf, getViewer, loadHabitStats, loadHistory } from "@/lib/data";
import { isoWeekday, shortDate } from "@/lib/day";

export const metadata: Metadata = { title: "Habits" };

export default async function HabitsPage() {
  const viewer = await getViewer();
  const [stats, history, minimumRes] = await Promise.all([
    loadHabitStats(viewer),
    loadHistory(viewer),
    viewer.supabase.from("habits").select("id").eq("minimum", true),
  ]);
  // The minimum day is saved as a whole list, so a wrong one here would clear it.
  if (minimumRes.error) throw new Error(`Could not load your habits: ${minimumRes.error.message}`);
  const threshold = viewer.profile.streakThreshold;
  const last30 = history.scores.slice(-30);
  const onLine = last30.filter((d) => d.score >= threshold).length;
  const best = Math.max(history.best, viewer.profile.bestStreak);
  const firstDay = firstDayOf(viewer);

  const figures = [
    { label: "Current streak", value: history.current, unit: history.current === 1 ? "day" : "days" },
    { label: "Best streak", value: best, unit: best === 1 ? "day" : "days" },
    { label: "Last 30 days", value: onLine, unit: `of ${last30.length}` },
  ];

  return (
    <HabitsManager
      initial={stats}
      weekday={isoWeekday(viewer.today)}
      minimum={{ habitIds: (minimumRes.data ?? []).map((h) => h.id), workMinutes: viewer.profile.minimumWorkMinutes, fitness: viewer.profile.minimumFitness }}
    >
      <dl className="grid grid-cols-3 gap-3">
        {figures.map((f) => (
          <div key={f.label} className="grid gap-0.5">
            <dt className="text-[14px] text-muted-foreground">{f.label}</dt>
            <dd className="text-[30px] leading-none font-light tracking-tight tabular-nums">
              {f.value}
              <span className="ml-1 text-[15px] text-muted-foreground">{f.unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="calendar-heading" className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <div className="flex min-h-6 items-baseline justify-between gap-3 px-1">
          <h2 id="calendar-heading" className="text-[15px] font-medium text-muted-foreground">
            History
          </h2>
          <p className="text-[15px] text-muted-foreground">Streak line {threshold}%</p>
        </div>
        {/* The calendar's own labels are set smaller; nothing on this page reads under 13 points. */}
        <div>
          <ScoreCalendar scores={history.scores} today={viewer.today} firstDay={firstDay} threshold={threshold} />
        </div>
        <p className="px-1 text-[13px] leading-snug text-muted-foreground">
          Since {shortDate(firstDay)}. A filled day reached the line. Tap a day to open it. A missed day ends a streak and nothing else.
        </p>
      </section>
    </HabitsManager>
  );
}
