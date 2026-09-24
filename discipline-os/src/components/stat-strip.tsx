import type { ReactNode } from "react";

/** A row of three figures between hairlines: the header of every page. */
export function StatStrip({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-3 border-y border-border py-3">{children}</dl>;
}

export function Stat({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="grid gap-0.5 border-l border-border pl-3 first:border-l-0 first:pl-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-xl leading-tight sm:text-2xl">
        {value}
        {unit && <span className="ml-1 text-sm text-muted-foreground">{unit}</span>}
      </dd>
    </div>
  );
}
