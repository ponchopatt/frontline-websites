import { Flame, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Meter } from "@/components/meter";
import { SectionCard } from "@/components/section-card";
import type { Momentum, RecordGroup, RecordRow, Stat, StreakRow, WordTrend } from "@/lib/history";
import { cn } from "@/lib/utils";

/** Keep My Word over time: this week and month, what was made, kept and broken, and the trend. */
export function WordCard({ trend, today }: { trend: WordTrend; today: number | null }) {
  const week = trend.weeks[trend.weeks.length - 1]?.average ?? null;
  const month = trend.months[trend.months.length - 1]?.average ?? null;
  const top = Math.max(100, ...trend.weeks.map((w) => w.average ?? 0));
  return (
    <SectionCard id="word" title="Keep my word" prominent>
      <dl className="grid grid-cols-3 gap-3">
        <Big label="Today" value={today} />
        <Big label="This week" value={week} />
        <Big label="This month" value={month} />
      </dl>

      <p className="mt-4 text-[15px] text-muted-foreground">
        This month: <span className="text-foreground">{trend.month.made.toLocaleString("en-AU")}</span> made ·{" "}
        <span className="text-kept">{trend.month.kept.toLocaleString("en-AU")}</span> kept ·{" "}
        <span className="text-foreground">{trend.month.broken.toLocaleString("en-AU")}</span> broken
      </p>

      <div className="mt-5 grid gap-2">
        <p className="text-sm text-muted-foreground">Week by week</p>
        <ol className="flex h-24 items-end gap-1.5" aria-label="Keep my word, week by week">
          {trend.weeks.map((w) => (
            <li key={w.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1" aria-label={`Week of ${w.label}: ${w.average === null ? "no days" : `${w.average}%`}`}>
              <span className="text-[11px] text-muted-foreground tabular-nums">{w.average ?? ""}</span>
              <span className={cn("w-full rounded-md", w.average === null ? "h-0.5 bg-border" : "bg-kept/70")} style={w.average === null ? undefined : { height: `${Math.max(4, (w.average / top) * 64)}px` }} />
              <span className="text-[10px] text-faint">{w.label.split(" ")[0]}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4 grid gap-1.5">
        <p className="text-sm text-muted-foreground">Month by month</p>
        <ul className="grid grid-cols-6 gap-1.5 text-center">
          {trend.months.map((m) => (
            <li key={m.key} className="grid gap-0.5 rounded-xl border border-border/70 py-2">
              <span className="text-[11px] text-muted-foreground">{m.label}</span>
              <span className="text-[15px] tabular-nums">{m.average === null ? "–" : `${m.average}%`}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}

function Big({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-[34px] leading-none tracking-tight tabular-nums">
        {value === null ? "–" : value}
        {value !== null && <span className="text-[15px] text-muted-foreground">%</span>}
      </dd>
    </div>
  );
}

/** Momentum: one number from the last seven days, and exactly what it's made of. */
export function MomentumCard({ momentum }: { momentum: Momentum | null }) {
  if (!momentum) {
    return (
      <SectionCard id="momentum" title="Momentum">
        <p className="text-[15px] text-muted-foreground">Momentum starts after three finished days. It&apos;s the average of the last seven.</p>
      </SectionCard>
    );
  }
  const Trend = momentum.trend === "falling" ? TrendingDown : TrendingUp;
  return (
    <SectionCard id="momentum" title="Momentum" meta={`Last ${momentum.days} days`}>
      <div className="flex items-baseline gap-3">
        <span className="inline-flex items-center gap-2 text-[44px] leading-none tracking-tight tabular-nums">
          <Flame className="size-7 text-primary" aria-hidden />
          {momentum.score}
        </span>
        {momentum.trend && (
          <span className={cn("inline-flex items-center gap-1 text-[15px]", momentum.trend === "rising" ? "text-kept" : momentum.trend === "falling" ? "text-primary" : "text-muted-foreground")}>
            {momentum.trend !== "stable" && <Trend className="size-4" aria-hidden />}
            {momentum.trend === "rising" ? "Rising" : momentum.trend === "falling" ? "Falling" : "Stable"}
            {momentum.previous !== null && <span className="text-muted-foreground"> from {momentum.previous}</span>}
          </span>
        )}
      </div>
      <ul className="mt-4 grid gap-3">
        {momentum.parts.map((p) => (
          <li key={p.key} className="grid gap-1">
            <div className="flex justify-between text-[15px]">
              <span className="text-muted-foreground">{p.label}</span>
              <span className="tabular-nums">{p.value}</span>
            </div>
            <Meter value={p.value / 100} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-faint">The average of these, over the last seven finished days. Rising or falling means 5 points or more against the week before.</p>
    </SectionCard>
  );
}

/** Every streak, with how often it's been kept lately, so one miss never wipes the picture. */
export function StreakList({ rows }: { rows: StreakRow[] }) {
  const shown = rows.filter((r) => r.key !== "fitness");
  return (
    <SectionCard id="streaks" title="Streaks" meta="Last 30 days">
      <ul className="divide-y divide-border/70">
        {shown.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2.5">
            <span className="text-[16px]">{r.label}</span>
            <span className={cn("inline-flex items-center gap-1 text-[17px] tabular-nums", r.current > 0 ? "text-foreground" : "text-muted-foreground")}>
              {r.current > 0 && <Flame className="size-4 text-primary" aria-hidden />}
              {r.current} {r.current === 1 ? "day" : "days"}
            </span>
            <span className="text-[13px] text-muted-foreground">
              Best {r.best} · {r.consistency === null ? "nothing due yet" : `${Math.round(r.consistency * 100)}% kept`}
            </span>
            <Meter value={r.consistency ?? 0} className="w-20" />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

const GROUPS: Array<{ key: RecordGroup; label: string }> = [
  { key: "work", label: "Work" },
  { key: "business", label: "Business" },
  { key: "fitness", label: "Fitness" },
  { key: "discipline", label: "Discipline" },
];

/** Personal records: me against my own best, nothing else. */
export function RecordList({ rows }: { rows: RecordRow[] }) {
  return (
    <SectionCard id="records" title="Personal records">
      {rows.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">Records appear as you log work, business numbers and habits. Every one is you against your own best.</p>
      ) : (
        <div className="grid gap-5">
          {GROUPS.map((g) => {
            const list = rows.filter((r) => r.group === g.key);
            if (list.length === 0) return null;
            return (
              <div key={g.key} className="grid gap-1">
                <h3 className="text-sm text-muted-foreground">{g.label}</h3>
                <ul className="divide-y divide-border/70">
                  {list.map((r) => (
                    <li key={r.key} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="grid min-w-0">
                        <span className="text-[15px]">{r.label}</span>
                        {r.when && <span className="text-[13px] text-faint">{r.when}</span>}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-[17px] tabular-nums">
                        <Trophy className="size-3.5 text-primary" aria-hidden />
                        {r.display}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

/** Plain sentences from the history. */
export function StatList({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <SectionCard id="history" title="What you've done">
      <ul className="grid gap-2.5">
        {stats.map((s) => (
          <li key={s.key} className="text-[16px] leading-snug">
            {s.text}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
