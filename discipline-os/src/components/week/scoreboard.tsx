import { Meter } from "@/components/meter";
import { SectionCard } from "@/components/section-card";
import { cn } from "@/lib/utils";
import type { ScoreGroup } from "./scoreboard-data";

/** The week in numbers: each line is what got done against the week's target. */
export function WeekScoreboard({ groups, meta }: { groups: ScoreGroup[]; meta: string }) {
  return (
    <SectionCard id="scoreboard" title="Scoreboard" meta={meta}>
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
                        <span className={cn(r.ratio !== null && r.ratio >= 1 && "text-primary")}>{r.value}</span>
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
