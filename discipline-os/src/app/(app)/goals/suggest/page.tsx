import type { Metadata } from "next";
import { SuggestForm } from "@/components/goals/suggest-form";
import { PageHeader } from "@/components/os";
import { getViewer } from "@/lib/data";
import { startOfWeek } from "@/lib/day";
import { aiConfigured } from "@/lib/goals/suggest-ai";

export const metadata: Metadata = { title: "Suggest my goals" };

export default async function SuggestPage() {
  const viewer = await getViewer();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader
        back={{ href: "/goals", label: "Goals" }}
        title="Suggest my goals"
        subtitle="Concrete goals for this week, from what you actually did the last four weeks. You choose which ones to keep."
      />
      <SuggestForm weekStart={startOfWeek(viewer.today)} ai={aiConfigured()} />
    </div>
  );
}
