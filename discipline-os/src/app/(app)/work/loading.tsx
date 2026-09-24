import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton label="work" back stats={true} sections={3} rows={3} />;
}
