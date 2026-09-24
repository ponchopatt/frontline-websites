import { GroupSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as Today, so nothing jumps when it arrives. */
export default function Loading() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6" aria-busy="true" aria-label="Loading today">
      <div className="grid gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-64 max-w-full" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-[76px] rounded-full" />
          <div className="grid gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-[26px]" />
      <GroupSkeleton rows={3} />
      <GroupSkeleton rows={5} />
    </div>
  );
}
