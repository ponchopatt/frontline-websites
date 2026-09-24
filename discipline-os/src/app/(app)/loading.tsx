import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the dashboard, so nothing jumps when it arrives. */
export default function Loading() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8" aria-busy="true" aria-label="Loading today">
      <div className="grid gap-5 pt-2">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-11 w-24" />
          </div>
          <Skeleton className="size-[104px] rounded-full" />
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      {[10, 4, 3].map((rows, i) => (
        <div key={i} className="grid gap-3 border-t border-border pt-6">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: Math.min(rows, 5) }, (_, j) => (
            <Skeleton key={j} className="h-10 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
