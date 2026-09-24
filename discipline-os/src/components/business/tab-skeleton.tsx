import { Skeleton } from "@/components/ui/skeleton";

/** A tab's groups while its numbers load, the same shape so nothing jumps. */
export function TabSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7" aria-busy="true" aria-label={`Loading ${label}`}>
      {[5, 3, 2].map((rows, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="mx-1 h-5 w-28" />
          <div className="surface divide-y divide-border overflow-hidden rounded-[22px] border">
            {Array.from({ length: rows }, (_, j) => (
              <div key={j} className="flex min-h-14 items-center justify-between gap-3 px-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
