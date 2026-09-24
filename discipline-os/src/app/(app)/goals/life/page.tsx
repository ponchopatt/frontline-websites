import type { Metadata } from "next";
import { LifeEditor } from "@/components/goals/life-editor";
import { PageHeader } from "@/components/os";
import { getViewer } from "@/lib/data";
import { loadLifeAreas, loadVision } from "@/lib/goals/data";

export const metadata: Metadata = { title: "My Life" };

export default async function MyLifePage() {
  const viewer = await getViewer();
  const [vision, areas] = await Promise.all([loadVision(viewer), loadLifeAreas(viewer)]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader
        back={{ href: "/goals", label: "Goals" }}
        title="My Life"
        subtitle="Everything else hangs off this. Write it once, read it often, change it rarely."
      />
      <LifeEditor vision={vision} areas={areas} />
    </div>
  );
}
