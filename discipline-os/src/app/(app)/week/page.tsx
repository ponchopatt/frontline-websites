import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data";
import { startOfWeek } from "@/lib/day";

/** /week: this week's scoreboard and review, on the week's own page. */
export default async function ThisWeekPage() {
  const { today } = await getViewer();
  redirect(`/goals/week/${startOfWeek(today)}`);
}
