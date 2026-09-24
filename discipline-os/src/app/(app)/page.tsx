import { formatInTimeZone } from "date-fns-tz";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Today } from "@/components/today/today";
import { bossOf, loadScoreboard, scoreboardGroups } from "@/components/week/scoreboard-data";
import { firstDayOf, getViewer, loadDay } from "@/lib/data";
import { isLocalDate, startOfWeek } from "@/lib/day";
import { loadGoalYear, yearOfWeek } from "@/lib/goals/data";
import { loadFacts } from "@/lib/history-server";
import type { BossSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Today" };

function greetingFor(hour: number, name: string | null): string {
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

export default async function TodayPage({ searchParams }: PageProps<"/">) {
  const { d } = await searchParams;
  const viewer = await getViewer();
  const requested = typeof d === "string" ? d : undefined;

  if (requested !== undefined) {
    // Tomorrow can't be opened; neither can a day before the account existed.
    if (!isLocalDate(requested) || requested >= viewer.today || requested < firstDayOf(viewer)) redirect("/");
  }
  const date = requested ?? viewer.today;
  const isToday = date === viewer.today;
  const [view, boss] = await Promise.all([loadDay(viewer, date, loadFacts(viewer)), isToday ? loadBoss(viewer) : Promise.resolve(null)]);
  const [h, m] = formatInTimeZone(new Date(), viewer.profile.timezone, "H:mm").split(":").map(Number);
  const hour = h + m / 60;
  const name = viewer.profile.displayName?.split(" ")[0] ?? null;
  // A new day starts fresh; within a day, Today takes the server's lists as they change.
  return <Today key={date} view={view} greeting={greetingFor(hour, name)} hour={hour} boss={boss} />;
}

/** This week's Weekly Boss, in one line. */
async function loadBoss(viewer: Awaited<ReturnType<typeof getViewer>>): Promise<BossSummary | null> {
  const week = startOfWeek(viewer.today);
  const [board, goals] = await Promise.all([loadScoreboard(viewer, week), loadGoalYear(viewer, yearOfWeek(week))]);
  const boss = bossOf(scoreboardGroups(board, goals), false);
  return boss ? { hit: boss.hit, total: boss.total, ratio: boss.ratio, state: boss.state } : null;
}
