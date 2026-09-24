import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton label="settings" back stats={false} sections={3} rows={3} />;
}
