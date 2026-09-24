"use client";

import { useState } from "react";
import { setCounter, updateCounter } from "@/app/actions/counters";
import { SectionCard } from "@/components/section-card";
import { Stepper } from "@/components/stepper";
import type { LocalDate } from "@/lib/day";
import { dailyTarget } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { amount, thisWeekTarget } from "./format";
import { run } from "./run";
import { TotalsRow } from "./totals-row";
import type { BoardCounter } from "./types";

const GROUP_LABEL: Record<string, string> = {
  sales: "Sales",
  marketing: "Marketing",
  revenue: "Revenue",
  demos: "Demos",
  outreach: "Outreach",
  delivery: "Delivery",
  other: "Other",
};

/** The order each business's groups sit in. Any others follow, as they come. */
const GROUP_ORDER: Record<CounterBoardProps["area"], string[]> = {
  imperium: ["sales", "marketing", "revenue"],
  websites: ["demos", "outreach", "sales", "delivery"],
};

interface CounterBoardProps {
  area: "imperium" | "websites";
  today: LocalDate;
  weekStart: LocalDate;
  workDays: number[];
  counters: BoardCounter[];
}

/** Today's target: a fixed daily one, else what's left of the week over the work days left. */
function targetToday(c: BoardCounter, today: LocalDate, workDays: number[]): number | null {
  return dailyTarget({
    metric: { aggregation: c.aggregation, dailyTarget: c.fixedDaily, unit: c.unit },
    weeklyTarget: thisWeekTarget(c),
    doneBeforeToday: c.weekBefore,
    today,
    workDays,
  });
}

/**
 * A business's counters: today's numbers to tap in, revenue at a glance, and the totals they
 * add up to. Every change shows at once and saves in the background.
 */
export function CounterBoard({ area, today, weekStart, workDays, counters: initial }: CounterBoardProps) {
  const [counters, setCounters] = useState(initial);

  function patch(id: string, p: Partial<BoardCounter>) {
    setCounters((list) => list.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  async function commitValue(c: BoardCounter, value: number) {
    const prev = c.value;
    patch(c.id, { value });
    const res = await run(() => setCounter({ metricId: c.id, date: today, value }));
    if (!res.ok) patch(c.id, { value: prev });
  }

  async function commitTarget(c: BoardCounter, weeklyTarget: number | null) {
    const prev = c.ownTarget;
    patch(c.id, { ownTarget: weeklyTarget });
    const res = await run(() => updateCounter({ metricId: c.id, weeklyTarget }));
    if (!res.ok) patch(c.id, { ownTarget: prev });
  }

  async function commitPinned(c: BoardCounter, pinned: boolean) {
    patch(c.id, { pinned });
    const res = await run(() => updateCounter({ metricId: c.id, pinned }));
    if (!res.ok) patch(c.id, { pinned: !pinned });
  }

  if (counters.length === 0) {
    return (
      <SectionCard title="Today">
        <p className="text-[15px] text-muted-foreground">There are no counters for this business yet.</p>
      </SectionCard>
    );
  }

  const order = GROUP_ORDER[area];
  const seen = [...new Set(counters.map((c) => c.grp ?? "other"))];
  const groups = [...order.filter((g) => seen.includes(g)), ...seen.filter((g) => !order.includes(g))].map((g) => ({
    key: g,
    label: GROUP_LABEL[g] ?? g.charAt(0).toUpperCase() + g.slice(1),
    counters: counters.filter((c) => (c.grp ?? "other") === g),
  }));
  const ordered = groups.flatMap((g) => g.counters);

  const withTargets = counters
    .filter((c) => c.aggregation === "sum")
    .map((c) => ({ c, target: targetToday(c, today, workDays) }))
    .filter((x): x is { c: BoardCounter; target: number } => x.target !== null && x.target > 0);
  const hit = withTargets.filter((x) => x.c.value >= x.target).length;

  const money = counters.filter((c) => c.unit === "$" && c.aggregation === "sum");
  const sum = (f: (c: BoardCounter) => number) => money.reduce((s, c) => s + f(c), 0);
  const moneyTargets = money.map((c) => thisWeekTarget(c)).filter((t): t is number => t !== null && t > 0);

  return (
    <>
      <SectionCard
        title="Today"
        meta={
          withTargets.length > 0 ? (
            <span>
              <span className="text-foreground">{hit}</span> of {withTargets.length} done
            </span>
          ) : undefined
        }
      >
        <div className="grid gap-5">
          {groups.map((g) => (
            <div key={g.key}>
              <h3 className="text-sm text-muted-foreground">{g.label}</h3>
              <ul className="divide-y divide-border/70">
                {g.counters.map((c) => {
                  const target = c.aggregation === "sum" ? targetToday(c, today, workDays) : null;
                  const met = target !== null && target > 0 && c.value >= target;
                  const hint =
                    c.aggregation === "latest" ? "How many now" : target === null ? null : target === 0 ? "Week target hit" : `of ${amount(target, c.unit)}`;
                  return (
                    <li key={c.id} className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-[17px]">{c.label}</p>
                        {hint && <p className={cn("text-sm", met || target === 0 ? "text-primary" : "text-muted-foreground")}>{hint}</p>}
                      </div>
                      <Stepper label={c.label} value={c.value} unit={c.unit} onCommit={(v) => void commitValue(c, v)} />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      {money.length > 0 && (
        <SectionCard title="Revenue">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
            <Figure label="Today" value={amount(sum((c) => c.value), "$")} />
            <Figure
              label="This week"
              value={amount(sum((c) => c.weekBefore + c.value), "$")}
              note={moneyTargets.length > 0 ? `of ${amount(moneyTargets.reduce((s, t) => s + t, 0), "$")}` : null}
            />
            <Figure label="This month" value={amount(sum((c) => c.monthBefore + c.value), "$")} />
            <Figure label="This year" value={amount(sum((c) => c.yearBefore + c.value), "$")} />
          </dl>
        </SectionCard>
      )}

      <SectionCard title="Totals" description="Tap a weekly target to change it.">
        <ul className="divide-y divide-border/70">
          {ordered.map((c) => (
            <TotalsRow
              key={c.id}
              counter={c}
              weekStart={weekStart}
              onTarget={(t) => void commitTarget(c, t)}
              onPinned={(p) => void commitPinned(c, p)}
            />
          ))}
        </ul>
      </SectionCard>
    </>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="grid min-w-0 content-start gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate text-[30px] leading-tight tracking-tight">{value}</dd>
      {note && <dd className="text-sm text-muted-foreground">{note}</dd>}
    </div>
  );
}
