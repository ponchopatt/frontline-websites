import type { Metadata } from "next";
import Link from "next/link";
import { SuggestForm } from "@/components/goals/suggest-form";
import { getViewer } from "@/lib/data";
import { startOfWeek } from "@/lib/day";
import { aiConfigured } from "@/lib/goals/suggest-ai";

export const metadata: Metadata = { title: "Suggest my goals" };

export default async function SuggestPage() {
  const viewer = await getViewer();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <header className="grid gap-1">
        <Link href="/goals" className="inline-flex min-h-11 w-fit items-center text-sm text-muted-foreground hover:text-foreground">
          Goals
        </Link>
        <h1 className="text-[34px] leading-tight font-medium tracking-tight">Suggest my goals</h1>
        <p className="text-[15px] text-muted-foreground">Concrete goals for this week, from what you actually did the last four weeks. You choose which ones to keep.</p>
      </header>
      <SuggestForm weekStart={startOfWeek(viewer.today)} ai={aiConfigured()} />
    </div>
  );
}
