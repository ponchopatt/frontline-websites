"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { saveWeeklyReview } from "@/app/actions/goals";
import type { LocalDate } from "@/lib/day";
import { addDays } from "@/lib/day";
import { Group, PrimaryButton } from "@/components/os";
import { formatValue } from "@/lib/goals/format";
import { DECISIONS, REASONS, type Decision, type Outcome, type Reason } from "@/lib/goals/review";
import { cn } from "@/lib/utils";
import { area, field, fieldLabel, segItem, segTrack } from "./form-bits";

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

/**
 * The week's review: how each goal went (and what happens to what's left), four questions, then
 * one button. Saving closes the week and carries what was chosen into the next.
 */
export function WeeklyReview({ weekStart, goals }: { weekStart: LocalDate; goals: ReviewGoal[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(goals.map((g) => [g.id, { outcome: g.suggested, reason: null, note: "", decision: g.suggested === "completed" ? null : "carry_forward" }])),
  );
  const [wins, setWins] = useState("");
  const [failure, setFailure] = useState("");
  const [bottleneck, setBottleneck] = useState("");
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set(id: string, patch: Partial<ItemState>) {
    setItems((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  if (done) {
    return (
      <Group id="review" title="Weekly review" action={<span className="text-[15px] text-muted-foreground">Done</span>} plain>
        <div className="grid gap-4 p-4" role="status">
          <p className="text-[17px]">Week reviewed.</p>
          <Link
            href={`/goals/week/${addDays(weekStart, 7)}`}
            className="inline-flex h-[52px] items-center justify-center rounded-full bg-primary px-6 text-[17px] font-medium text-primary-foreground transition-transform active:scale-[0.98]"
          >
            Plan next week
          </Link>
        </div>
      </Group>
    );
  }

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-7"
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
            failure,
            bottleneck,
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
      <Group id="review" title="Weekly review" footer={goals.length > 0 ? "How each goal went. What's left can carry into next week." : undefined}>
        {goals.length === 0 ? (
          <p className="px-4 py-4 text-[15px] text-muted-foreground">No goals were set for this week. Answer the four questions, then plan the next one.</p>
        ) : (
          <ol className="divide-y divide-border">
            {goals.map((g) => {
              const s = items[g.id];
              const notDone = s.outcome !== "completed";
              const decision = DECISIONS.find((d) => d.value === s.decision);
              return (
                <li key={g.id} className="grid gap-3 px-4 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-[17px] leading-snug">
                      {g.title}
                      {!g.isMajor && <span className="ml-2 text-[13px] text-muted-foreground">supporting</span>}
                    </p>
                    {g.target !== null && (
                      <span className="shrink-0 text-[15px] text-muted-foreground tabular-nums">
                        {formatValue(g.actual ?? 0, g.unit)} / {formatValue(g.target, g.unit)}
                      </span>
                    )}
                  </div>
                  <div role="radiogroup" aria-label={`How did “${g.title}” go?`} className={cn(segTrack, "grid-cols-3")}>
                    {(["completed", "partial", "missed"] as const).map((o) => (
                      <button
                        key={o}
                        type="button"
                        role="radio"
                        aria-checked={s.outcome === o}
                        onClick={() => set(g.id, { outcome: o, decision: o === "completed" ? null : s.decision ?? "carry_forward" })}
                        className={cn(segItem(s.outcome === o), "capitalize")}
                      >
                        {o === "completed" ? "Done" : o}
                      </button>
                    ))}
                  </div>
                  {notDone && (
                    <div className="grid gap-3">
                      <label className={fieldLabel}>
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
                        <legend className="mb-1.5 text-[15px] text-muted-foreground">What should happen?</legend>
                        <div className={cn(segTrack, "grid-cols-2")}>
                          {DECISIONS.map((d) => (
                            <label key={d.value} className={segItem(s.decision === d.value)}>
                              <input type="radio" name={`decision-${g.id}`} value={d.value} checked={s.decision === d.value} onChange={() => set(g.id, { decision: d.value })} className="sr-only" />
                              {d.label}
                            </label>
                          ))}
                        </div>
                        {decision && <p className="px-1 text-[14px] text-muted-foreground">{decision.hint}</p>}
                      </fieldset>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Group>

      <Group title="Four questions" plain>
        <div className="grid gap-4 p-4">
          <label className={fieldLabel}>
            Biggest win
            <textarea value={wins} onChange={(e) => setWins(e.target.value)} maxLength={2000} rows={2} className={area} />
          </label>
          <label className={fieldLabel}>
            Biggest failure
            <textarea value={failure} onChange={(e) => setFailure(e.target.value)} maxLength={2000} rows={2} className={area} />
          </label>
          <label className={fieldLabel}>
            Main bottleneck
            <textarea value={bottleneck} onChange={(e) => setBottleneck(e.target.value)} maxLength={2000} rows={2} className={area} />
          </label>
          <label className={fieldLabel}>
            Next week&apos;s #1 priority
            <input value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={2000} className={field} />
          </label>
        </div>
      </Group>

      <div className="grid gap-2">
        {error && (
          <p role="alert" className="px-1 text-[15px] font-medium text-foreground">
            {error}
          </p>
        )}
        <PrimaryButton type="submit" disabled={busy} className="w-full">
          {busy ? "Saving…" : "Complete review"}
        </PrimaryButton>
      </div>
    </form>
  );
}
