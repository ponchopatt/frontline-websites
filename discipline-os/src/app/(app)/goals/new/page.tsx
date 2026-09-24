import type { Metadata } from "next";
import { GoalForm } from "@/components/goals/goal-form";
import { PageHeader } from "@/components/os";
import { getViewer } from "@/lib/data";
import { loadLifeAreas } from "@/lib/goals/data";

export const metadata: Metadata = { title: "New goal" };

export default async function NewGoalPage({ searchParams }: PageProps<"/goals/new">) {
  const viewer = await getViewer();
  const { year: y, area } = await searchParams;
  const thisYear = Number(viewer.today.slice(0, 4));
  const year = typeof y === "string" && /^\d{4}$/.test(y) && Number(y) >= thisYear ? Number(y) : thisYear;
  const [areas, habitsRes, countersRes] = await Promise.all([
    loadLifeAreas(viewer),
    viewer.supabase.from("habits").select("id,name").eq("is_active", true).order("category").order("sort_order"),
    viewer.supabase.from("metrics").select("id,area,label,unit,aggregation").eq("is_active", true).eq("aggregation", "sum").order("sort_order"),
  ]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader
        back={{ href: year === thisYear ? "/goals" : `/goals?year=${year}`, label: "Goals" }}
        title={`A ${year} goal`}
        subtitle="Specific enough that you'll know when it's done, and tied to a reason you won't forget."
      />
      <GoalForm
        year={year}
        today={viewer.today}
        areas={areas}
        habits={habitsRes.data ?? []}
        counters={(countersRes.data ?? []).map((c) => ({ id: c.id, area: c.area, label: c.label, unit: c.unit }))}
        defaultAreaId={typeof area === "string" ? area : null}
      />
    </div>
  );
}
