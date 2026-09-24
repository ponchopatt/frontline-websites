import type { HealthStatus } from "@/lib/goals/progress";
import { HEALTH_LABEL } from "@/lib/goals/progress";
import { cn } from "@/lib/utils";

/**
 * Goal health in the app's three colours: filled lamplight for on track and complete, a half
 * ring for at risk, an open ring for behind, a faint dot for not started. Always with the word,
 * so colour is never the only signal.
 */
export function HealthBadge({ status, className }: { status: HealthStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm whitespace-nowrap", status === "behind" ? "text-foreground" : "text-muted-foreground", className)}>
      <HealthDot status={status} />
      {HEALTH_LABEL[status]}
    </span>
  );
}

export function HealthDot({ status }: { status: HealthStatus }) {
  const shared = "inline-block size-2.5 shrink-0 rounded-full";
  if (status === "complete") {
    return (
      <svg viewBox="0 0 12 12" className="size-3 shrink-0 text-primary" aria-hidden>
        <circle cx="6" cy="6" r="6" fill="currentColor" />
        <path d="M3.4 6.2 5.2 8 8.6 4.4" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "on_track") return <span aria-hidden className={cn(shared, "bg-primary")} />;
  if (status === "at_risk") {
    return <span aria-hidden className={cn(shared, "border-[1.5px] border-primary")} style={{ background: "linear-gradient(90deg, var(--primary) 50%, transparent 50%)" }} />;
  }
  if (status === "behind") return <span aria-hidden className={cn(shared, "border-[1.5px] border-foreground")} />;
  return <span aria-hidden className={cn(shared, "bg-faint/50")} />;
}

export function ProgressBar({ ratio, expected, label }: { ratio: number | null; expected?: number; label: string }) {
  const pct = Math.round((ratio ?? 0) * 100);
  return (
    <div
      className="relative h-1.5 overflow-hidden rounded-full bg-border"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-(--ease-out-quart)" style={{ width: `${pct}%` }} />
      {expected !== undefined && expected > 0 && expected < 1 && (
        <span aria-hidden className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${expected * 100}%` }} />
      )}
    </div>
  );
}
