"use client";

import { Check, ChevronDown, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { addSuggestedGoals, suggestMyGoals } from "@/app/actions/suggest";
import { Group, PrimaryButton, TextAction } from "@/components/os";
import { AREA_LABEL, type Area } from "@/lib/areas";
import type { LocalDate } from "@/lib/day";
import type { GoalSuggestion } from "@/lib/goals/suggest-goals";
import { cn } from "@/lib/utils";
import { area as fieldArea, field, fieldLabel } from "./form-bits";

const ASK: Array<{ area: Area; placeholder: string }> = [
  { area: "imperium", placeholder: "More bookings before summer" },
  { area: "websites", placeholder: "Close my first three sites this month" },
  { area: "trading", placeholder: "Finish the TradingView comparison" },
  { area: "faith", placeholder: "Read every morning" },
  { area: "fitness", placeholder: "Back to five gym days" },
  { area: "discipline", placeholder: "No phone in bed" },
  { area: "money", placeholder: "Save $2,000 this month" },
];

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
      <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
        <Group
          title="Suggested for this week"
          footer={result.source === "ai" ? "Suggested by Claude from your numbers and what you said." : "Worked out from your numbers over the last four weeks."}
        >
          {result.suggestions.length === 0 ? (
            <p className="px-4 py-4 text-[15px] leading-snug text-muted-foreground">Nothing new to suggest: this week already has goals for everything with numbers behind it.</p>
          ) : (
            <ul className="divide-y divide-border">
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
                      className="flex min-h-14 w-full items-start gap-3 px-4 py-3.5 text-left transition-colors active:bg-accent"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 grid size-[26px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-200",
                          on ? "border-kept bg-kept text-white" : "border-input",
                        )}
                      >
                        {on && <Check className="size-4" strokeWidth={3} />}
                      </span>
                      <span className="grid min-w-0 gap-0.5">
                        <span className="text-[13px] text-muted-foreground">
                          {AREA_LABEL[s.area]}
                          {s.major ? " · Major" : ""}
                        </span>
                        <span className={cn("text-[17px] leading-snug break-words", !on && "text-muted-foreground line-through decoration-faint")}>{s.title}</span>
                        <span className="text-[14px] leading-snug break-words text-muted-foreground">{s.reason}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Group>
        <div className="grid gap-1">
          <PrimaryButton disabled={busy || count === 0} onClick={() => void keep()} className="w-full">
            {busy ? "Adding…" : `Add ${count} ${count === 1 ? "goal" : "goals"} to this week`}
          </PrimaryButton>
          <TextAction onClick={() => setResult(null)} className="justify-self-center">
            Change my answers
          </TextAction>
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        void suggest();
      }}
    >
      <Group plain footer={ai ? undefined : "Suggestions come from your own numbers. Add an Anthropic API key on the server to have Claude refine them too."}>
        <details className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5 transition-colors active:bg-accent [&::-webkit-details-marker]:hidden">
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="text-[17px] leading-snug">What do you want this week?</span>
              <span className="text-[14px] text-muted-foreground">Optional. Aims, free hours, what&apos;s booked in</span>
            </span>
            <ChevronDown className="size-[18px] shrink-0 text-faint transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="grid gap-4 border-t border-border p-4">
            {ASK.map(({ area, placeholder }) => (
              <label key={area} className={fieldLabel}>
                {AREA_LABEL[area]}
                <input value={aims[area] ?? ""} maxLength={500} placeholder={placeholder} onChange={(e) => setAims((a) => ({ ...a, [area]: e.target.value }))} className={field} />
              </label>
            ))}
            <label className={fieldLabel}>
              Hours free for work this week
              <input inputMode="numeric" type="number" min={0} max={120} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="40" className={field} />
            </label>
            <label className={fieldLabel}>
              Already booked in
              <textarea
                value={commitments}
                maxLength={1000}
                rows={2}
                onChange={(e) => setCommitments(e.target.value)}
                placeholder="Two full-day details on Tuesday and Friday"
                className={fieldArea}
              />
            </label>
          </div>
        </details>
      </Group>
      <PrimaryButton type="submit" disabled={busy} className="w-full">
        <Sparkles className="size-[18px]" aria-hidden />
        {busy ? "Thinking…" : "Suggest my goals"}
      </PrimaryButton>
    </form>
  );
}
