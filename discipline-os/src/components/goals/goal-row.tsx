import Link from "next/link";
import { formatValue, formatTarget } from "@/lib/goals/format";
import type { AnyGoal } from "@/lib/goals/model";
import type { GoalProgress } from "@/lib/goals/progress";
import { HealthBadge, ProgressBar } from "./health";

/** A goal in a list: name, health, progress against the target, and where it goes. */
export function GoalRow({ goal, progress, href, meta }: { goal: AnyGoal; progress: GoalProgress | undefined; href: string; meta?: string }) {
  const p = progress;
  const measured = p?.current !== null && p?.current !== undefined && goal.targetValue !== null;
  return (
    <li>
      <Link href={href} className="grid gap-2 rounded-lg py-3 hover:bg-accent/40">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 text-[17px] leading-snug">{goal.title}</span>
          {p && <HealthBadge status={p.health} className="shrink-0" />}
        </div>
        {p && p.ratio !== null && <ProgressBar ratio={p.ratio} expected={p.expected} label={`${goal.title} progress`} />}
        <p className="text-sm text-muted-foreground">
          {measured ? (
            <>
              <span className="text-foreground">{formatValue(p!.current, goal.unit)}</span> of {formatTarget(goal)}
            </>
          ) : (
            formatTarget(goal)
          )}
          {meta && <> · {meta}</>}
        </p>
      </Link>
    </li>
  );
}
