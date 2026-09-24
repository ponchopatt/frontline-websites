import { formatInTimeZone } from "date-fns-tz";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Today } from "@/components/today/today";
import { firstDayOf, getViewer, loadDay } from "@/lib/data";
import { isLocalDate } from "@/lib/day";

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
  const view = await loadDay(viewer, date);
  const hour = Number(formatInTimeZone(new Date(), viewer.profile.timezone, "H"));
  const name = viewer.profile.displayName?.split(" ")[0] ?? null;
  // Remount when the server's lists change (a plan applied, a task moved), so local state starts fresh.
  const key = [date, view.tasks.map((t) => t.id).join("."), view.blocks.map((b) => b.id).join("."), view.milestone?.id ?? ""].join(":");
  return <Today key={key} view={view} greeting={greetingFor(hour, name)} />;
}
