import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  id?: string;
  title: string;
  /** Right-aligned summary, e.g. "7 of 10". */
  meta?: ReactNode;
  description?: ReactNode;
  /** The brighter card for what matters most: Today's Big 3, the Weekly Boss. */
  prominent?: boolean;
  /** Two paler cards peek out from behind it, like a stack of entries. */
  stacked?: boolean;
  children: ReactNode;
  className?: string;
}

/** A frosted card. Everything inside reads as dark ink on glass in the Sage look. */
export function SectionCard({ id, title, meta, description, prominent, stacked, children, className }: SectionCardProps) {
  const headingId = id ? `${id}-heading` : undefined;
  const card = (
    <section
      id={stacked ? undefined : id}
      aria-labelledby={headingId}
      className={cn(
        "relative scroll-mt-6 rounded-[28px] border px-4 sm:px-5",
        prominent ? "surface-strong pt-5 pb-3" : "surface pt-5 pb-4",
        className,
      )}
    >
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id={headingId} className={cn("font-medium tracking-tight", prominent ? "text-2xl" : "text-xl")}>
          {title}
        </h2>
        {meta !== undefined && <div className="text-sm text-muted-foreground">{meta}</div>}
      </header>
      {description && <p className="-mt-1 mb-3 text-sm text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
  if (!stacked) return card;
  return (
    <div id={id} className="relative scroll-mt-6 pt-3">
      <span aria-hidden className="stack-layer inset-x-6 top-0 h-10" />
      <span aria-hidden className="stack-layer inset-x-3 top-1.5 h-10" />
      {card}
    </div>
  );
}
