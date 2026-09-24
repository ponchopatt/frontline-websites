import { cn } from "@/lib/utils";

/**
 * A progress line. It fills in lamplight and turns sage the moment it's full; never over.
 * The fill eases in, so ticking something visibly moves the day forward.
 */
export function Meter({ value, label, size = "sm", className }: { value: number; label?: string; size?: "sm" | "md"; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)) * 100);
  const full = pct >= 100;
  return (
    <div
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? pct : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("overflow-hidden rounded-full bg-border", size === "md" ? "h-1.5" : "h-1", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width,background-color] duration-700 ease-(--ease-out-quart)",
          full ? "bg-kept" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
