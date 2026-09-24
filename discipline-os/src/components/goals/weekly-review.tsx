"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { saveWeeklyReview } from "@/app/actions/goals";
import type { LocalDate } from "@/lib/day";
import { addDays } from "@/lib/day";
import { formatValue } from "@/lib/goals/format";
import { cn } from "@/lib/utils";

import { DECISIONS, REASONS, type Decision, type Outcome, type Reason } from "@/lib/goals/review";

export interface ReviewGoal {
  id: string;
  title: string;
  isMajor: boolean;
  unit: string | null;
  target: number | null;
  actual: number | null;
  suggested: Outcome;
}

interface ItemState {
  outcome: Outcome;
  reason: Reason | null;
  note: string;
  decision: Decision | null;
}

const field = "h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-[16px] outline-none focus-visible:border-primary/70";

export function WeeklyReview({ weekStart, goals }: { weekStart: LocalDate; goals: ReviewGoal[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(goals.map((g) => [g.id, { outcome: g.suggested, reason: null, note: "", decision: g.suggested === "completed" ? null : "carry_forward" }])),
  );
  const [wins, setWins] = useState("");
  const [lessons, setLessons] = useState("");
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set(id: string, patch: Partial<ItemState>) {
    setItems((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  if (done) {
    return (
      <div className="grid gap-3 rounded-2xl border border-primary/30 p-4" role="status">
        <p className="text-[16px]">Week reviewed.</p>
        <Link href={`/goals/week/${addDays(weekStart, 7)}`} className="inline-flex h-12 w-fit items-center rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground">
          Plan next week
        </Link>
      </div>
    );
  }

  return (
    <form
      className="grid gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const missing = goals.find((g) => items[g.id].outcome !== "completed" && !items[g.id].decision);
        if (missing) return setError(`Choose what happens to “${missing.title}”.`);
        setBusy(true);
        try {
          const res = await saveWeeklyReview({
            weekStart,
            wins,
            lessons,
            focus,
            items: goals.map((g) => ({
              weeklyGoalId: g.id,
              outcome: items[g.id].outcome,
              target: g.target,
              actual: g.actual,
              reason: items[g.id].outcome === "completed" ? null : items[g.id].reason,
              reasonNote: items[g.id].note || null,
              decision: items[g.id].outcome === "completed" ? null : items[g.id].decision,
            })),
          });
          if (!res.ok) return setError(res.error);
          toast.success(res.data.carried ? `Review saved. ${res.data.carried} carried to next week.` : "Review saved.");
          setDone(true);
          router.refresh();
        } catch {
          setError("The review wasn't saved. Check your connection and try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {goals.length === 0 && <p className="text-[15px] text-muted-foreground">No goals were set for this week. Write what you learned, then plan the next one.</p>}
      <ol className="grid gap-5">
        {goals.map((g) => {
          const s = items[g.id];
          const notDone = s.outcome !== "completed";
          return (
            <li key={g.id} className="grid gap-3 border-b border-border pb-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[17px] leading-snug">
                  {g.title}
                  {!g.isMajor && <span className="ml-2 text-xs text-faint">supporting</span>}
                </p>
                {g.target !== null && (
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {formatValue(g.actual ?? 0, g.unit)} / {formatValue(g.target, g.unit)}
                  </span>
                )}
              </div>
              <div role="radiogroup" aria-label={`How did “${g.title}” go?`} className="grid grid-cols-3 gap-2">
                {(["completed", "partial", "missed"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={s.outcome === o}
                    onClick={() => set(g.id, { outcome: o, decision: o === "completed" ? null : s.decision ?? "carry_forward" })}
                    className={cn("h-11 rounded-xl border text-sm capitalize", s.outcome === o ? "border-primary bg-primary text-primary-foreground" : "border-input")}
                  >
                    {o === "completed" ? "Done" : o}
                  </button>
                ))}
              </div>
              {notDone && (
                <div className="grid gap-2">
                  <label className="grid gap-1 text-sm text-muted-foreground">
                    Why wasn&apos;t this completed?
                    <select value={s.reason ?? ""} onChange={(e) => set(g.id, { reason: (e.target.value || null) as Reason | null })} className={field}>
                      <option value="">Choose a reason</option>
                      {REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {s.reason === "other" && (
                    <input aria-label="What happened" value={s.note} maxLength={1000} onChange={(e) => set(g.id, { note: e.target.value })} placeholder="What happened" className={field} />
                  )}
                  <fieldset className="grid gap-1.5">
                    <legend className="mb-1 text-sm text-muted-foreground">What should happen?</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {DECISIONS.map((d) => (
                        <label
                          key={d.value}
                          className={cn("grid min-h-14 cursor-pointer content-center rounded-xl border px-3 py-2", s.decision === d.value ? "border-primary bg-lamp-soft" : "border-input")}
                        >
                          <input type="radio" name={`decision-${g.id}`} value={d.value} checked={s.decision === d.value} onChange={() => set(g.id, { decision: d.value })} className="sr-only" />
                          <span className="text-[15px]">{d.label}</span>
                          <span className="text-xs text-muted-foreground">{d.hint}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4">
        <label className="grid gap-1.5 text-sm text-muted-foreground">
          What went well?
          <textarea value={wins} onChange={(e) => setWins(e.target.value)} maxLength={2000} rows={2} className={cn(field, "h-auto min-h-[4.5rem] resize-none py-2.5 [field-sizing:content]")} />
        </label>
        <label className="grid gap-1.5 text-sm text-muted-foreground">
          What did I learn?
          <textarea value={lessons} onChange={(e) => setLessons(e.target.value)} maxLength={2000} rows={2} className={cn(field, "h-auto min-h-[4.5rem] resize-none py-2.5 [field-sizing:content]")} />
        </label>
        <label className="grid gap-1.5 text-sm text-muted-foreground">
          Focus for next week
          <input value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={2000} className={field} />
        </label>
      </div>

      <div className="grid gap-2">
        <p aria-live="polite" className="min-h-6 text-[15px] text-primary">
          {error}
        </p>
        <button type="submit" disabled={busy} className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : "Complete review"}
        </button>
      </div>
    </form>
  );
}
