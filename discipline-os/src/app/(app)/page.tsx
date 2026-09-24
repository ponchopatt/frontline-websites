import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { firstDayOf, getViewer, loadDay } from "@/lib/data";
import { isLocalDate } from "@/lib/day";

export const metadata: Metadata = { title: "Today" };

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
  // Remount when the goal plan changes (actions accepted), so local state starts fresh.
  const planKey = view.plan ? view.plan.actions.map((a) => a.id).join(".") : "";
  return <Dashboard key={`${date}:${planKey}:${view.priorities.map((p) => p.id ?? "").join(".")}`} view={view} />;
}
