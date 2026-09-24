import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { monthShort } from "@/lib/goals/periods";
import type { GoalChain } from "@/lib/types";

/** Today → Week → Month → Year: what this action is for, all the way up. */
export function GoalBreadcrumb({ chain, className }: { chain: GoalChain; className?: string }) {
  const steps: Array<{ key: string; label: string; title: string; href: string }> = [];
  if (chain.weekly) steps.push({ key: "w", label: "Week", title: chain.weekly.title, href: `/goals/week/${chain.weekly.weekStart}` });
  if (chain.monthly) steps.push({ key: "m", label: monthShort(chain.monthly.monthStart), title: chain.monthly.title, href: `/goals/month/${chain.monthly.monthStart.slice(0, 7)}` });
  if (chain.yearly) steps.push({ key: "y", label: String(chain.yearly.year), title: chain.yearly.title, href: `/goals/year/${chain.yearly.id}` });
  if (steps.length === 0) return null;

  return (
    <nav aria-label="Supports" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px] leading-snug text-muted-foreground">
        {steps.map((s, i) => (
          <li key={s.key} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3 shrink-0 text-faint" aria-hidden />}
            <Link href={s.href} className="min-w-0 truncate rounded-sm hover:text-foreground">
              <span className="text-faint">{s.label}</span> {s.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
