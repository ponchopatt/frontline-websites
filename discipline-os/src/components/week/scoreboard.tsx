import { Swords } from "lucide-react";
import { Meter } from "@/components/meter";
import { SectionCard } from "@/components/section-card";
import { cn } from "@/lib/utils";
import type { Boss, ScoreGroup } from "./scoreboard-data";

/**
 * The Weekly Boss: the week's targets as one fight, then every line of the week in numbers,
 * actual against target. Beaten when most targets are hit; never a verdict on the person.
 */
export function WeekScoreboard({ groups, boss, meta }: { groups: ScoreGroup[]; boss: Boss | null; meta: string }) {
  return (
    <SectionCard id="boss" title="Weekly boss" meta={meta} prominent>
      {boss && (
        <div className="mb-5 grid gap-2">
          <div className="flex items-baseline gap-2">
            <Swords className={cn("size-5 self-center", boss.state === "defeated" ? "text-kept" : "text-primary")} aria-hidden />
            <span className={cn("text-[34px] leading-none tracking-tight tabular-nums", boss.hit === boss.total && "text-kept")}>{boss.hit}</span>
            <span className="text-[15px] text-muted-foreground">of {boss.total} targets hit</span>
          </div>
          <Meter value={boss.ratio} size="md" label="Weekly boss" />
          <p className={cn("text-[15px]", boss.state === "defeated" ? "font-medium text-kept" : "text-muted-foreground")} role="status">
            {boss.state === "defeated"
              ? "Week complete. Boss defeated."
              : boss.state === "survived"
                ? `Week complete: ${boss.hit} of ${boss.total}. The boss survived this one. Next week starts from these numbers.`
                : boss.total - boss.hit === 1
                  ? "One target left this week."
                  : `${boss.total - boss.hit} targets to go this week.`}
          </p>
        </div>
      )}
      {groups.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">Nothing to count yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-x-10">
          {groups.map((g) => (
            <div key={g.title} className="grid content-start gap-0.5">
              <h3 className="text-sm text-muted-foreground">{g.title}</h3>
              <ul>
                {g.rows.map((r) => (
                  <li key={r.label} className="grid gap-1.5 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="shrink-0 text-[16px]">{r.label}</span>
                        {r.note && <span className="truncate text-xs text-faint">{r.note}</span>}
                      </span>
                      <span className="shrink-0 text-[16px] tabular-nums">
                        <span className={cn(r.ratio !== null && r.ratio >= 1 && "text-kept")}>{r.value}</span>
                        {r.of && (
                          <span className="text-muted-foreground">
                            <span aria-hidden>/</span>
                            <span className="sr-only"> of </span>
                            {r.of}
                          </span>
                        )}
                      </span>
                    </div>
                    {r.ratio !== null && <Meter value={r.ratio} />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
