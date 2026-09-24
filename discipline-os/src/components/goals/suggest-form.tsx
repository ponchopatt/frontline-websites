"use client";

import { Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { addSuggestedGoals, suggestMyGoals } from "@/app/actions/suggest";
import { AREA_LABEL, type Area } from "@/lib/areas";
import type { LocalDate } from "@/lib/day";
import type { GoalSuggestion } from "@/lib/goals/suggest-goals";
import { cn } from "@/lib/utils";

const ASK: Array<{ area: Area; placeholder: string }> = [
  { area: "imperium", placeholder: "More bookings before summer" },
  { area: "websites", placeholder: "Close my first three sites this month" },
  { area: "trading", placeholder: "Finish the TradingView comparison" },
  { area: "faith", placeholder: "Read every morning" },
  { area: "fitness", placeholder: "Back to five gym days" },
  { area: "discipline", placeholder: "No phone in bed" },
  { area: "money", placeholder: "Save $2,000 this month" },
];

const field = "w-full rounded-xl border border-input bg-transparent px-3 text-[16px] outline-none placeholder:text-faint focus-visible:border-primary/70";

/** Ask (optionally) what matters, suggest, then keep the ones worth keeping. */
export function SuggestForm({ weekStart, ai }: { weekStart: LocalDate; ai: boolean }) {
  const router = useRouter();
  const [aims, setAims] = useState<Partial<Record<Area, string>>>({});
  const [hours, setHours] = useState("");
  const [commitments, setCommitments] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ source: "ai" | "rules"; suggestions: GoalSuggestion[] } | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());

  async function suggest() {
    setBusy(true);
    try {
      const res = await suggestMyGoals({ aims, hoursPerWeek: hours.trim() ? Number(hours) : null, commitments });
      if (!res.ok) toast.error(res.error);
      else {
        setResult(res.data);
        setOff(new Set());
      }
    } catch {
      toast.error("The suggestions couldn't be made. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function keep() {
    if (!result) return;
    const items = result.suggestions.filter((s) => !off.has(s.key));
    setBusy(true);
    try {
      const res = await addSuggestedGoals({
        items: items.map((s) => ({ area: s.area, title: s.title, target: s.target, unit: s.unit, metricId: s.metricId, habitId: s.habitId, major: s.major, reason: s.reason })),
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`Added ${res.data.count} ${res.data.count === 1 ? "goal" : "goals"} to this week.`);
        router.push(`/goals/week/${weekStart}`);
      }
    } catch {
      toast.error("The goals weren't saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const count = result.suggestions.length - off.size;
    return (
      <div className="grid gap-5">
        <p className="text-sm text-muted-foreground">
          {result.source === "ai" ? "Suggested by Claude from your numbers and what you said." : "Worked out from your numbers over the last four weeks."}
        </p>
        {result.suggestions.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">Nothing new to suggest: this week already has goals for everything with numbers behind it.</p>
        ) : (
          <ul className="grid gap-1">
            {result.suggestions.map((s) => {
              const on = !off.has(s.key);
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={s.title}
                    onClick={() =>
                      setOff((set) => {
                        const next = new Set(set);
                        if (next.has(s.key)) next.delete(s.key);
                        else next.add(s.key);
                        return next;
                      })
                    }
                    className="flex w-full items-start gap-3 rounded-xl py-3 text-left"
                  >
                    <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="grid min-w-0 gap-1">
                      <span className="text-xs text-faint">
                        {AREA_LABEL[s.area]}
                        {s.major ? " · Major" : ""}
                      </span>
                      <span className={cn("text-[17px] leading-snug", !on && "text-muted-foreground line-through decoration-faint")}>{s.title}</span>
                      <span className="text-sm text-muted-foreground">{s.reason}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="grid gap-2">
          <button type="button" disabled={busy || count === 0} onClick={() => void keep()} className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-50">
            {busy ? "Adding…" : `Add ${count} ${count === 1 ? "goal" : "goals"} to this week`}
          </button>
          <button type="button" onClick={() => setResult(null)} className="min-h-11 text-sm text-muted-foreground hover:text-foreground">
            Change my answers
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void suggest();
      }}
    >
      <details className="group grid gap-3 rounded-2xl border border-border p-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[16px]">
          What do you want this week?
          <span className="text-sm text-muted-foreground">Optional</span>
        </summary>
        <div className="mt-3 grid gap-3">
          {ASK.map(({ area, placeholder }) => (
            <label key={area} className="grid gap-1.5 text-sm text-muted-foreground">
              {AREA_LABEL[area]}
              <input
                value={aims[area] ?? ""}
                maxLength={500}
                placeholder={placeholder}
                onChange={(e) => setAims((a) => ({ ...a, [area]: e.target.value }))}
                className={cn(field, "h-12")}
              />
            </label>
          ))}
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            Hours free for work this week
            <input inputMode="numeric" type="number" min={0} max={120} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="40" className={cn(field, "h-12")} />
          </label>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            Already booked in
            <textarea
              value={commitments}
              maxLength={1000}
              rows={2}
              onChange={(e) => setCommitments(e.target.value)}
              placeholder="Two full-day details on Tuesday and Friday"
              className={cn(field, "min-h-16 resize-none py-2.5 [field-sizing:content]")}
            />
          </label>
        </div>
      </details>
      <button type="submit" disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-60">
        <Sparkles className="size-4" aria-hidden />
        {busy ? "Thinking…" : "Suggest my goals"}
      </button>
      {!ai && <p className="-mt-3 text-xs text-faint">Suggestions come from your own numbers. Add an Anthropic API key on the server to have Claude refine them too.</p>}
    </form>
  );
}
