import { formatInTimeZone } from "date-fns-tz";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Today } from "@/components/today/today";
import { firstDayOf, getViewer, loadDay } from "@/lib/data";
import { isLocalDate } from "@/lib/day";
import { loadFacts } from "@/lib/history-server";
import { firstName } from "@/lib/names";

export const metadata: Metadata = { title: "Today" };

function partOfDay(hour: number): string {
  return hour < 4 ? "night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
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
  const view = await loadDay(viewer, date, loadFacts(viewer));
  const [h, m] = formatInTimeZone(new Date(), viewer.profile.timezone, "H:mm").split(":").map(Number);
  const hour = h + m / 60;
  const name = firstName(viewer.profile.displayName);
  // A new day starts fresh; within a day, Today takes the server's lists as they change.
  return <Today key={date} view={view} partOfDay={partOfDay(hour)} name={name} hour={hour} />;
}
