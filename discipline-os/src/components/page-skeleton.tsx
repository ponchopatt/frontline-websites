import { Skeleton } from "@/components/ui/skeleton";

/** The common page shape (title, figures, grouped rows) while data loads, so nothing shifts. */
export function PageSkeleton({ label, stats = true, sections = 2, rows = 4, back = false }: { label: string; stats?: boolean; sections?: number; rows?: number; back?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7" aria-busy="true" aria-label={`Loading ${label}`}>
      <div className="grid gap-2">
        {back && <Skeleton className="h-11 w-20" />}
        <Skeleton className="h-9 w-44" />
      </div>
      {stats && <Skeleton className="h-14 w-full rounded-2xl" />}
      {Array.from({ length: sections }, (_, i) => (
        <GroupSkeleton key={i} rows={rows} />
      ))}
    </div>
  );
}

/** A group's title and its panel of rows. */
export function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-2">
      <Skeleton className="h-5 w-28" />
      <div className="surface divide-y divide-border overflow-hidden rounded-[22px] border">
        {Array.from({ length: rows }, (_, j) => (
          <div key={j} className="flex min-h-14 items-center px-4">
            <Skeleton className="h-5 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
