import { Award, Check, Crown, Flame, Gem, Lock, Medal, Star, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Meter } from "@/components/meter";
import { SectionCard } from "@/components/section-card";
import type { DotState, Momentum, RecordGroup, RecordRow, Stat, StreakRow, TrophyShelf, WordTrend } from "@/lib/history";
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

/**
 * Every streak as its own card: the run, how many of the last six weeks' due days were kept,
 * and those six weeks as dots, so one miss never wipes the picture.
 */
export function StreakList({ rows }: { rows: StreakRow[] }) {
  const shown = rows.filter((r) => r.key !== "fitness");
  return (
    <section id="streaks" aria-labelledby="streaks-heading" className="grid gap-3">
      <h2 id="streaks-heading" className="text-xl font-medium tracking-tight">
        Streaks
      </h2>
      <ul className="grid gap-3">
        {shown.map((r) => (
          <li key={r.key} className="surface grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-[26px] border px-4 py-4 sm:px-5">
            <div className="grid min-w-0 content-start gap-1">
              <p className={cn("inline-flex items-center gap-1.5 text-[13px]", r.current > 0 ? "font-medium text-kept" : "text-muted-foreground")}>
                <Flame className="size-3.5" aria-hidden />
                {r.current > 0 ? `${r.current}-day streak` : "No streak yet"}
              </p>
              <p className="text-[19px] leading-snug font-medium tracking-tight">{r.label}</p>
              <p className="text-[13px] text-muted-foreground">
                {r.recentDue > 0 ? `${r.recentDone}/${r.recentDue} days kept, last 6 weeks` : "Nothing due yet"} · best {r.best}
              </p>
            </div>
            <div className="grid justify-items-end gap-2">
              <span
                role="img"
                aria-label={r.doneToday ? "Done today" : "Not done today"}
                className={cn("grid size-6 place-items-center rounded-md border", r.doneToday ? "border-kept bg-kept text-background" : "border-border bg-muted")}
              >
                {r.doneToday && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
              </span>
              <Dots dots={r.recent} label={`${r.label}, last 6 weeks`} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Six weeks as a grid of dots: filled for kept, pale for missed, faint for days it wasn't due. */
function Dots({ dots, label }: { dots: DotState[]; label: string }) {
  return (
    <ol role="img" aria-label={label} className="grid grid-cols-7 gap-[5px]">
      {dots.map((d, i) => (
        <li
          key={i}
          className={cn(
            "size-2.5 rounded-[3px]",
            d === "done" && "bg-kept",
            d === "missed" && "bg-kept/20",
            d === "off" && "bg-border",
            d === "open" && "ring-1 ring-kept ring-inset",
          )}
        />
      ))}
    </ol>
  );
}

const MILESTONE_ICON: Record<number, typeof Trophy> = { 3: Flame, 7: Star, 14: Medal, 30: Award, 60: Trophy, 100: Crown, 365: Gem };

/**
 * Trophies for streaks kept: each milestone the best run reached, and the next one, locked,
 * showing how far there is to go. Nothing is given for opening the app.
 */
export function TrophyShelves({ shelves }: { shelves: TrophyShelf[] }) {
  return (
    <div className="grid gap-6">
      {shelves.map((shelf) => (
        <section key={shelf.key} aria-labelledby={`shelf-${shelf.key}`} className="grid gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 id={`shelf-${shelf.key}`} className="text-[17px] font-medium">
              {shelf.label}
            </h2>
            <span className="surface inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm" aria-label={`${shelf.unlocked} unlocked`}>
              <Medal className="size-3.5 text-kept" aria-hidden />
              {String(shelf.unlocked).padStart(2, "0")}
            </span>
          </div>
          <ul className="-mx-4 -my-3 flex snap-x gap-3 overflow-x-auto px-4 py-3 sm:-mx-6 sm:px-6">
            {shelf.items.map((t) => {
              const Icon = MILESTONE_ICON[t.days] ?? Trophy;
              return (
                <li key={t.days} className="surface grid w-36 shrink-0 snap-start justify-items-center gap-2.5 rounded-[24px] border px-3 pt-5 pb-3.5 text-center">
                  <span aria-hidden className={cn("grid size-16 place-items-center rounded-full", t.unlocked ? "bg-kept-soft text-kept" : "bg-muted text-faint blur-[1.5px]")}>
                    <Icon className="size-8" strokeWidth={1.6} />
                  </span>
                  <span className={cn("inline-flex h-7 items-center gap-1 rounded-full px-3 text-[12px] font-medium", t.unlocked ? "bg-kept text-background" : "bg-muted text-muted-foreground")}>
                    {!t.unlocked && <Lock className="size-3" aria-hidden />}
                    {t.unlocked ? "Unlocked" : "Locked"}
                  </span>
                  <span className="text-[14px] leading-tight">
                    {t.days}-day streak
                    {!t.unlocked && <span className="block text-[12px] text-muted-foreground">Best so far {shelf.best}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const GROUP_ORDER: RecordGroup[] = ["work", "business", "fitness", "discipline"];

/** Personal records as trophy cards: me against my own best, nothing else. */
export function RecordList({ rows }: { rows: RecordRow[] }) {
  return (
    <section id="records" aria-labelledby="records-heading" className="grid gap-3">
      <h2 id="records-heading" className="text-xl font-medium tracking-tight">
        Personal records
      </h2>
      {rows.length === 0 ? (
        <p className="surface rounded-[24px] border p-4 text-[15px] text-muted-foreground">
          Records appear as you log work, business numbers and habits. Every one is you against your own best.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {[...rows]
            .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
            .map((r) => (
              <li key={r.key} className="surface grid content-start gap-1.5 rounded-[24px] border p-4">
                <span aria-hidden className="grid size-9 place-items-center rounded-full bg-kept-soft text-kept">
                  <Trophy className="size-[18px]" strokeWidth={1.8} />
                </span>
                <span className="text-[22px] leading-tight tracking-tight tabular-nums">{r.display}</span>
                <span className="text-[13px] leading-snug">{r.label}</span>
                {r.when && <span className="text-[12px] text-muted-foreground">{r.when}</span>}
              </li>
            ))}
        </ul>
      )}
    </section>
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
