import type { Metadata } from "next";
import Link from "next/link";
import { GoalForm } from "@/components/goals/goal-form";
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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <header className="grid gap-1">
        <Link href={`/goals?year=${year}`} className="inline-flex min-h-11 min-w-11 w-fit items-center text-sm text-muted-foreground hover:text-foreground">
          Goals
        </Link>
        <h1 className="text-[40px] leading-[1.05] font-light tracking-[-0.035em]">A {year} goal</h1>
        <p className="text-[15px] text-muted-foreground">Specific enough that you&apos;ll know when it&apos;s done, and tied to a reason you won&apos;t forget.</p>
      </header>
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
