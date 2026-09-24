import { cn } from "@/lib/utils";

/** A thin progress line. Full when done; never over. */
export function Meter({ value, label, className }: { value: number; label?: string; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)) * 100);
  return (
    <div
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? pct : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("h-1 overflow-hidden rounded-full bg-border", className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-(--ease-out-quart)" style={{ width: `${pct}%` }} />
    </div>
  );
}
