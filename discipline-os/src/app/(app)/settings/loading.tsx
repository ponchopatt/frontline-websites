import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton label="settings" stats={false} sections={3} rows={3} />;
}
