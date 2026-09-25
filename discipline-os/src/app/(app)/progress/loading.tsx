import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton label="progress" back stats sections={2} rows={4} />;
}
