import { Skeleton } from "@/components/ui/skeleton";

/** A tab's sections while its numbers load, the same shape so nothing jumps. */
export function TabSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10" aria-busy="true" aria-label={`Loading ${label}`}>
      {[4, 2, 3].map((rows, i) => (
        <div key={i} className="grid gap-3 border-t border-border pt-6">
          <Skeleton className="h-6 w-32" />
          {Array.from({ length: rows }, (_, j) => (
            <Skeleton key={j} className="h-12 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
