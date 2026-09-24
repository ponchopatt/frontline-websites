import { Group, Ring } from "@/components/os";
import { cn } from "@/lib/utils";
import type { Boss, ScoreGroup } from "./scoreboard-data";

/**
 * The Weekly Boss: the week's targets as one number and one ring, then every line of the week
 * as a plain row, actual against target. Beaten when most targets are hit; never a verdict on
 * the person.
 */
export function WeekScoreboard({ groups, boss, meta }: { groups: ScoreGroup[]; boss: Boss | null; meta: string }) {
  return (
    <Group id="boss" title="Weekly boss" action={<span className="text-[15px] text-muted-foreground">{meta}</span>}>
      {boss && (
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="grid min-w-0 flex-1 gap-1">
            <p className="flex items-baseline gap-2">
              <span className={cn("text-[40px] leading-none font-light tracking-[-0.03em] tabular-nums", boss.hit === boss.total && "text-kept")}>{boss.hit}</span>
              <span className="text-[17px] text-muted-foreground">of {boss.total} targets hit</span>
            </p>
            <p className={cn("text-[15px] leading-snug", boss.state === "defeated" ? "font-medium text-kept" : "text-muted-foreground")} role="status">
              {boss.state === "defeated"
                ? "Week complete. Boss defeated."
                : boss.state === "survived"
                  ? `Week complete: ${boss.hit} of ${boss.total}. The boss survived this one. Next week starts from these numbers.`
                  : boss.total - boss.hit === 1
                    ? "One target left this week."
                    : `${boss.total - boss.hit} targets to go this week.`}
            </p>
          </div>
          <Ring value={boss.ratio} size={56} label={`Weekly boss, ${Math.round(boss.ratio * 100)}% of the way`} />
        </div>
      )}
      {groups.length === 0 ? (
        <p className="px-4 py-4 text-[15px] text-muted-foreground">Nothing to count yet.</p>
      ) : (
        groups.map((g) => (
          <div key={g.title} className="pt-2.5 pb-1">
            <h3 className="px-4 text-[14px] font-medium text-muted-foreground">{g.title}</h3>
            <ul>
              {g.rows.map((r) => (
                <li key={r.label} className="ml-4 flex min-h-12 items-center gap-3 border-t border-border py-2 pr-4 first:border-t-0">
                  <span className="grid min-w-0 flex-1">
                    <span className="text-[17px] leading-snug">{r.label}</span>
                    {r.note && <span className="text-[14px] leading-snug break-words text-muted-foreground">{r.note}</span>}
                  </span>
                  <span className="shrink-0 text-[17px] text-muted-foreground tabular-nums">
                    <span className={cn("text-foreground", r.ratio !== null && r.ratio >= 1 && "text-kept")}>{r.value}</span>
                    {r.of && (
                      <>
                        <span aria-hidden>/</span>
                        <span className="sr-only"> of </span>
                        {r.of}
                      </>
                    )}
                  </span>
                  {r.ratio !== null ? <Ring value={r.ratio} size={24} /> : <span aria-hidden className="w-6 shrink-0" />}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </Group>
  );
}
