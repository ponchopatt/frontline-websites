import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton label="habits" stats={true} sections={3} rows={5} />;
}
