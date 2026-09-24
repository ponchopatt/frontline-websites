import type { Metadata } from "next";
import { LifeEditor } from "@/components/goals/life-editor";
import { getViewer } from "@/lib/data";
import { loadLifeAreas, loadVision } from "@/lib/goals/data";

export const metadata: Metadata = { title: "My Life" };

export default async function MyLifePage() {
  const viewer = await getViewer();
  const [vision, areas] = await Promise.all([loadVision(viewer), loadLifeAreas(viewer)]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <header className="grid gap-2">
        <h1 className="text-[34px] leading-tight font-medium tracking-tight">My Life</h1>
        <p className="text-[15px] text-muted-foreground">Everything else hangs off this. Write it once, read it often, change it rarely.</p>
      </header>
      <LifeEditor vision={vision} areas={areas} />
    </div>
  );
}
