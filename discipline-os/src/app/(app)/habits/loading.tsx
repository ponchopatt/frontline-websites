import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton label="habits" back stats={true} sections={3} rows={5} />;
}
