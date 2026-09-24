import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton label="bible" stats={false} sections={2} rows={4} />;
}
