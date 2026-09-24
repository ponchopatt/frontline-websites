"use client";

import { useState } from "react";
import { setCounter, updateCounter } from "@/app/actions/counters";
import { Group, Ring, Row } from "@/components/os";
import { Sheet } from "@/components/sheet";
import type { LocalDate } from "@/lib/day";
import { dailyTarget } from "@/lib/metrics";
import { CounterSheet } from "./counter-sheet";
import { amount, thisWeekTarget } from "./format";
import { run } from "./run";
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
  if (c.aggregation !== "sum") return null;
  return dailyTarget({
    metric: { aggregation: c.aggregation, dailyTarget: c.fixedDaily, unit: c.unit },
    weeklyTarget: thisWeekTarget(c),
    doneBeforeToday: c.weekBefore,
    today,
    workDays,
  });
}

/**
 * A business's counters as plain rows: today's number against today's target, with a ring.
 * Tap one to count it, see its week, month and year, and set its target. Every change shows at
 * once and saves in the background.
 */
export function CounterBoard({ area, today, weekStart, workDays, counters: initial }: CounterBoardProps) {
  const [counters, setCounters] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = counters.find((c) => c.id === openId) ?? null;

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
      <Group title="Today">
        <p className="px-4 py-4 text-[15px] text-muted-foreground">There are no counters for this business yet.</p>
      </Group>
    );
  }

  const order = GROUP_ORDER[area];
  const seen = [...new Set(counters.map((c) => c.grp ?? "other"))];
  const groups = [...order.filter((g) => seen.includes(g)), ...seen.filter((g) => !order.includes(g))].map((g) => ({
    key: g,
    label: GROUP_LABEL[g] ?? g.charAt(0).toUpperCase() + g.slice(1),
    counters: counters.filter((c) => (c.grp ?? "other") === g),
  }));

  const withTargets = counters
    .map((c) => ({ c, target: targetToday(c, today, workDays) }))
    .filter((x): x is { c: BoardCounter; target: number } => x.target !== null && x.target > 0);
  const hit = withTargets.filter((x) => x.c.value >= x.target).length;

  const money = counters.filter((c) => c.unit === "$" && c.aggregation === "sum");
  const sum = (f: (c: BoardCounter) => number) => money.reduce((s, c) => s + f(c), 0);
  const moneyTargets = money.map((c) => thisWeekTarget(c)).filter((t): t is number => t !== null && t > 0);
  const moneyWeek = sum((c) => c.weekBefore + c.value);
  const moneyTarget = moneyTargets.reduce((s, t) => s + t, 0);

  return (
    <>
      {groups.map((g, i) => (
        <Group
          key={g.key}
          title={i === 0 ? `Today · ${g.label}` : g.label}
          action={
            i === 0 && withTargets.length > 0 ? (
              <span className="text-[15px] text-muted-foreground">
                {hit} of {withTargets.length} done
              </span>
            ) : undefined
          }
        >
          {g.counters.map((c) => {
            const target = targetToday(c, today, workDays);
            const week = c.weekBefore + c.value;
            const weekTarget = thisWeekTarget(c);
            const value = target !== null && target > 0 ? `${amount(c.value, c.unit)}/${amount(target, c.unit)}` : amount(c.value, c.unit);
            const subtitle =
              c.aggregation === "latest"
                ? "How many now"
                : target === 0
                  ? "Week target hit"
                  : weekTarget !== null && weekTarget > 0
                    ? `This week ${amount(week, c.unit)} of ${amount(weekTarget, c.unit)}`
                    : `This week ${amount(week, c.unit)}`;
            return (
              <Row
                key={c.id}
                onClick={() => setOpenId(c.id)}
                ariaLabel={`${c.label}: ${target !== null && target > 0 ? `${amount(c.value, c.unit)} of ${amount(target, c.unit)} today` : amount(c.value, c.unit)}`}
                title={c.label}
                subtitle={subtitle}
                value={value}
                trailing={target !== null ? <Ring value={target === 0 ? 1 : c.value / target} size={26} /> : undefined}
              />
            );
          })}
        </Group>
      ))}

      {money.length > 0 && (
        <section aria-labelledby="revenue-heading" className="grid gap-2 px-1">
          <h2 id="revenue-heading" className="text-[15px] font-medium text-muted-foreground">
            Revenue totals
          </h2>
          <dl className="grid grid-cols-3 gap-3">
            <Figure label="This week" value={amount(moneyWeek, "$")} note={moneyTarget > 0 ? `of ${amount(moneyTarget, "$")}` : null} />
            <Figure label="This month" value={amount(sum((c) => c.monthBefore + c.value), "$")} />
            <Figure label="This year" value={amount(sum((c) => c.yearBefore + c.value), "$")} />
          </dl>
        </section>
      )}

      <Sheet open={open !== null} onClose={() => setOpenId(null)} title={open?.label ?? "Counter"}>
        {open && (
          <CounterSheet
            key={open.id}
            counter={open}
            target={targetToday(open, today, workDays)}
            weekStart={weekStart}
            onValue={(v) => void commitValue(open, v)}
            onTarget={(t) => void commitTarget(open, t)}
            onPinned={(p) => void commitPinned(open, p)}
          />
        )}
      </Sheet>
    </>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="grid min-w-0 content-start gap-0.5">
      <dt className="text-[14px] text-muted-foreground">{label}</dt>
      <dd className="text-[clamp(20px,6.2vw,28px)] leading-tight font-light tracking-tight break-words tabular-nums">{value}</dd>
      {note && <dd className="text-[14px] text-muted-foreground">{note}</dd>}
    </div>
  );
}
