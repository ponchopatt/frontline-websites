import { Skeleton } from "@/components/ui/skeleton";

/** The common page shape (title, figures, sections) while data loads, so nothing shifts. */
export function PageSkeleton({ label, stats = true, sections = 2, rows = 4 }: { label: string; stats?: boolean; sections?: number; rows?: number }) {
  return (
    <div className="grid gap-10" aria-busy="true" aria-label={`Loading ${label}`}>
      <div className="grid gap-6">
        <Skeleton className="h-10 w-40" />
        {stats && <Skeleton className="h-16 w-full" />}
      </div>
      {Array.from({ length: sections }, (_, i) => (
        <div key={i} className="grid gap-3 border-t border-border pt-6">
          <Skeleton className="h-6 w-36" />
          {Array.from({ length: rows }, (_, j) => (
            <Skeleton key={j} className="h-11 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
