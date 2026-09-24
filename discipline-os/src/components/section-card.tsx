import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  id?: string;
  title: string;
  /** Right-aligned summary, e.g. "7 of 10". */
  meta?: ReactNode;
  description?: ReactNode;
  /** The one section that gets a panel instead of a hairline: Today's mission. */
  prominent?: boolean;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ id, title, meta, description, prominent, children, className }: SectionCardProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "scroll-mt-6",
        prominent
          ? "rounded-2xl border border-primary/25 bg-card px-4 pt-5 pb-3 shadow-[0_0_0_1px_var(--lamp-soft)] sm:px-5"
          : "border-t border-border pt-6",
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
}
