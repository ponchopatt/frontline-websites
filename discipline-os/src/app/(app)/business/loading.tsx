import { TabSkeleton } from "@/components/business/tab-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** The Business page's shape while it loads: the title is known, the tabs and numbers aren't yet. */
export default function Loading() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div className="grid gap-5">
        <div className="grid gap-1">
          <h1 className="text-[34px] leading-tight font-medium tracking-tight">Business</h1>
          <Skeleton className="h-5 w-64 max-w-full" />
        </div>
        <Skeleton className="h-[54px] w-full rounded-full" />
      </div>
      <TabSkeleton label="business" />
    </div>
  );
}
