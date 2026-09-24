import { Award, BriefcaseBusiness, Check, Crown, Dumbbell, Flame, Gem, Lock, Medal, Star, Timer, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { Meter } from "@/components/meter";
import { Group } from "@/components/os";
import type { DotState, Momentum, RecordGroup, RecordRow, Stat, StreakRow, TrophyShelf, WordTrend } from "@/lib/history";
import { cn } from "@/lib/utils";

interface SegmentedProps {
  label: string;
  items: Array<{ href: string; label: string; on: boolean }>;
  scroll?: boolean;
  /** A filter under the page's own switch: no track, the chosen one softly tinted. */
  quiet?: boolean;
}

/**
 * A segmented control, after iOS: links in one quiet track, the chosen one raised. Every
 * segment is 44 points tall, so it's easy to hit with a thumb.
 */
export function Segmented({ label, items, scroll = true, quiet = false }: SegmentedProps) {
  return (
    <nav aria-label={label} className={cn("grid auto-cols-fr grid-flow-col", quiet ? "gap-1" : "gap-0.5 rounded-full bg-accent p-[3px]")}>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          scroll={scroll}
          aria-current={it.on ? "page" : undefined}
          className={cn(
            "flex h-11 min-w-0 items-center justify-center rounded-full px-1 text-[15px] whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
            it.on
              ? quiet
                ? "bg-accent font-medium text-foreground"
                : "surface-light bg-popover font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.1),0_6px_16px_-8px_rgb(0_0_0/0.4)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** Keep My Word over time: today, this week and month, what was made, kept and broken, and the trend. */
export function WordCard({ trend, today }: { trend: WordTrend; today: number | null }) {
  const week = trend.weeks[trend.weeks.length - 1]?.average ?? null;
  const month = trend.months[trend.months.length - 1]?.average ?? null;
  const top = Math.max(100, ...trend.weeks.map((w) => w.average ?? 0));
  return (
    <Group id="word" title="Keep my word" plain>
      <div className="grid gap-4 p-4">
        <dl className="grid grid-cols-3 gap-3">
          <Big label="Today" value={today} />
          <Big label="This week" value={week} />
          <Big label="This month" value={month} />
        </dl>
        <p className="text-[15px] leading-snug text-muted-foreground">
          This month: <span className="text-foreground">{trend.month.made.toLocaleString("en-AU")}</span> made ·{" "}
          <span className="text-kept">{trend.month.kept.toLocaleString("en-AU")}</span> kept ·{" "}
          <span className="text-foreground">{trend.month.broken.toLocaleString("en-AU")}</span> broken
        </p>
      </div>

      <div className="grid gap-3 border-t border-border p-4">
        <p className="text-[15px] text-muted-foreground">Week by week</p>
        <ol className="flex h-[118px] items-end gap-1.5" aria-label="Keep my word, week by week">
          {trend.weeks.map((w, i) => (
            <li key={w.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" aria-label={`Week of ${w.label}: ${w.average === null ? "no days" : `${w.average}%`}`}>
              <span className="text-[13px] leading-none text-muted-foreground tabular-nums">{w.average ?? ""}</span>
              <span
                className={cn("w-full rounded-[6px]", w.average === null ? "h-0.5 bg-border" : i === trend.weeks.length - 1 ? "bg-kept" : "bg-kept/55")}
                style={w.average === null ? undefined : { height: `${Math.max(4, (w.average / top) * 68)}px` }}
              />
              <span className="text-[13px] leading-none text-muted-foreground tabular-nums">{w.label.split(" ")[0]}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-3 border-t border-border p-4">
        <p className="text-[15px] text-muted-foreground">Month by month</p>
        <ul className="grid grid-cols-6 gap-1 text-center">
          {trend.months.map((m) => (
            <li key={m.key} className="grid gap-1">
              <span className="text-[13px] text-muted-foreground">{m.label}</span>
              <span className="text-[15px] tabular-nums">{m.average === null ? "–" : `${m.average}%`}</span>
            </li>
          ))}
        </ul>
      </div>
    </Group>
  );
}

function Big({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="grid gap-1">
      <dt className="text-[14px] text-muted-foreground">{label}</dt>
      <dd className="text-[34px] leading-none font-light tracking-tight tabular-nums">
        {value === null ? "–" : value}
        {value !== null && <span className="text-[15px] text-muted-foreground">%</span>}
      </dd>
    </div>
  );
}

const MOMENTUM_NOTE = "The average of these, over the last seven finished days. Rising or falling means 5 points or more against the week before.";

/** Momentum: one number from the last seven days, and exactly what it's made of. */
export function MomentumCard({ momentum }: { momentum: Momentum | null }) {
  if (!momentum) {
    return (
      <Group id="momentum" title="Momentum" plain>
        <p className="p-4 text-[15px] leading-snug text-muted-foreground">Momentum starts after three finished days. It&apos;s the average of the last seven.</p>
      </Group>
    );
  }
  const Trend = momentum.trend === "falling" ? TrendingDown : TrendingUp;
  return (
    <Group id="momentum" title="Momentum" action={<span className="text-[15px] text-muted-foreground">Last {momentum.days} days</span>} footer={MOMENTUM_NOTE} plain>
      <div className="grid gap-4 p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-2 text-[44px] leading-none font-light tracking-tight tabular-nums">
            <Flame className="size-7 text-kept" strokeWidth={1.8} aria-hidden />
            {momentum.score}
          </span>
          {momentum.trend && (
            <span className={cn("inline-flex items-center gap-1 text-[15px]", momentum.trend === "rising" ? "text-kept" : "text-foreground")}>
              {momentum.trend !== "stable" && <Trend className="size-4" aria-hidden />}
              {momentum.trend === "rising" ? "Rising" : momentum.trend === "falling" ? "Falling" : "Stable"}
              {momentum.previous !== null && <span className="text-muted-foreground"> from {momentum.previous}</span>}
            </span>
          )}
        </div>
        <ul className="grid gap-3">
          {momentum.parts.map((p) => (
            <li key={p.key} className="grid gap-1.5">
              <div className="flex justify-between gap-3 text-[15px]">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="tabular-nums">{p.value}</span>
              </div>
              <Meter value={p.value / 100} />
            </li>
          ))}
        </ul>
      </div>
    </Group>
  );
}

/**
 * Every streak on one line: the run, how many of the last six weeks' due days were kept, and
 * those six weeks as dots, so one miss never wipes the picture.
 */
export function StreakList({ rows }: { rows: StreakRow[] }) {
  const shown = rows.filter((r) => r.key !== "fitness");
  return (
    <Group id="streaks" title="Streaks" plain>
      <ul className="divide-y divide-border">
        {shown.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5">
            <div className="grid min-w-0 content-center gap-1">
              <p className="flex items-center gap-2">
                <span className="text-[17px] leading-snug font-medium">{r.label}</span>
                {r.doneToday ? (
                  <span role="img" aria-label="Done today" className="grid size-5 shrink-0 place-items-center rounded-full bg-kept text-background">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                ) : (
                  <span className="sr-only">Not done today</span>
                )}
              </p>
              <p className="flex flex-wrap items-center gap-x-1.5 text-[15px]">
                <Flame className={cn("size-4 shrink-0", r.current > 0 ? "text-kept" : "text-muted-foreground")} aria-hidden />
                <span className={r.current > 0 ? "text-kept" : "text-muted-foreground"}>{r.current > 0 ? `${r.current}-day streak` : "No streak yet"}</span>
                <span className="text-muted-foreground">· best {r.best}</span>
              </p>
              <p className="text-[14px] leading-snug text-muted-foreground">{r.recentDue > 0 ? `${r.recentDone}/${r.recentDue} days kept, last 6 weeks` : "Nothing due yet"}</p>
            </div>
            <Dots dots={r.recent} label={`${r.label}, last 6 weeks`} />
          </li>
        ))}
      </ul>
    </Group>
  );
}

/** Six weeks as a grid of dots: filled for kept, pale for missed, faint for days it wasn't due. */
function Dots({ dots, label }: { dots: DotState[]; label: string }) {
  return (
    <span role="img" aria-label={label} className="grid grid-cols-7 gap-1">
      {dots.map((d, i) => (
        <span
          key={i}
          className={cn(
            "size-[11px] rounded-[3px]",
            d === "done" && "bg-kept",
            d === "missed" && "bg-kept/20",
            d === "off" && "bg-border",
            d === "open" && "ring-[1.5px] ring-kept ring-inset",
          )}
        />
      ))}
    </span>
  );
}

const MILESTONE_ICON: Record<number, typeof Trophy> = { 3: Flame, 7: Star, 14: Medal, 30: Award, 60: Trophy, 100: Crown, 365: Gem };

/**
 * Trophies for streaks kept: each milestone the best run reached, and the next one, locked,
 * showing how far there is to go. Nothing is given for opening the app. One shelf per streak,
 * all on one panel.
 */
export function TrophyShelves({ shelves }: { shelves: TrophyShelf[] }) {
  return (
    <Group id="streak-trophies" title="Streak trophies" footer="One for each streak you've reached, and the next one to go for." plain>
      {shelves.map((shelf, i) => (
        <div key={shelf.key} role="region" aria-labelledby={`shelf-${shelf.key}`} className={cn("grid gap-3 px-4 py-4", i > 0 && "border-t border-border")}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 id={`shelf-${shelf.key}`} className="text-[17px] leading-snug font-medium">
              {shelf.label}
            </h3>
            <span className="shrink-0 text-[15px] text-muted-foreground tabular-nums">{shelf.unlocked === 0 ? "None yet" : `${shelf.unlocked} unlocked`}</span>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
            {shelf.items.map((t) => {
              const Icon = MILESTONE_ICON[t.days] ?? Trophy;
              return (
                <li key={t.days} className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn("grid size-10 shrink-0 place-items-center rounded-full", t.unlocked ? "bg-kept-soft text-kept" : "border border-dashed border-input text-faint")}
                  >
                    {t.unlocked ? <Icon className="size-5" strokeWidth={1.8} /> : <Lock className="size-4" strokeWidth={1.8} />}
                  </span>
                  <span className="grid min-w-0 gap-0.5 leading-tight">
                    <span className={cn("text-[15px]", !t.unlocked && "text-muted-foreground")}>
                      {t.days}-day streak
                      {!t.unlocked && <span className="sr-only">, locked</span>}
                    </span>
                    <span className="text-[13px] text-muted-foreground">{t.unlocked ? "Unlocked" : `Best so far ${shelf.best}`}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Group>
  );
}

const GROUP_ORDER: RecordGroup[] = ["work", "business", "fitness", "discipline"];
const GROUP_ICON: Record<RecordGroup, typeof Trophy> = { work: Timer, business: BriefcaseBusiness, fitness: Dumbbell, discipline: Flame };

/** Personal records, one line each: me against my own best, nothing else. */
export function RecordList({ rows }: { rows: RecordRow[] }) {
  return (
    <Group id="records" title="Personal records" plain>
      {rows.length === 0 ? (
        <p className="p-4 text-[15px] leading-snug text-muted-foreground">Records appear as you log work, business numbers and habits. Every one is you against your own best.</p>
      ) : (
        <ul className="divide-y divide-border">
          {[...rows]
            .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
            .map((r) => {
              const Icon = GROUP_ICON[r.group];
              return (
                <li key={r.key} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-kept-soft text-kept">
                    <Icon className="size-[18px]" strokeWidth={1.8} />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-[17px] leading-snug">{r.label}</span>
                    {r.when && <span className="text-[14px] leading-snug text-muted-foreground">{r.when}</span>}
                  </span>
                  <span className="shrink-0 text-right text-[17px] font-medium tabular-nums">{r.display}</span>
                </li>
              );
            })}
        </ul>
      )}
    </Group>
  );
}

/** Plain sentences from the history. */
export function StatList({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <Group id="history" title="What you've done" plain>
      <ul className="divide-y divide-border">
        {stats.map((s) => (
          <li key={s.key} className="px-4 py-3.5 text-[16px] leading-snug">
            {s.text}
          </li>
        ))}
      </ul>
    </Group>
  );
}
