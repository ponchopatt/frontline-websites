"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PrimaryButton } from "@/components/os";
import type { DraftGoal } from "@/lib/goals/breakdown";
import { formatValue } from "@/lib/goals/format";
import type { ActionResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PlanEditorProps {
  drafts: DraftGoal[];
  /** Heading for each period group ("January", "Week 1 · 5–11 Oct"). */
  groupLabel: (periodStart: string) => string;
  approveLabel: string;
  onApprove: (drafts: DraftGoal[]) => Promise<ActionResult<{ count: number }>>;
  onDone?: () => void;
}

/**
 * A suggested breakdown as editable rows. Untick what you don't want, change the words or the
 * numbers, then save. Nothing is created until you do.
 */
export function PlanEditor({ drafts: initial, groupLabel, approveLabel, onApprove, onDone }: PlanEditorProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(initial);
  const [included, setIncluded] = useState<Set<string>>(new Set(initial.filter((d) => !d.optional).map((d) => d.key)));
  const [busy, setBusy] = useState(false);
  const groups = [...new Set(drafts.map((d) => d.periodStart))];
  const count = drafts.filter((d) => included.has(d.key)).length;

  function update(key: string, patch: Partial<DraftGoal>) {
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  return (
    <div className="grid gap-5 pt-1">
      {groups.map((g) => (
        <fieldset key={g} className="grid min-w-0">
          <legend className="mb-1 text-[15px] font-medium text-muted-foreground">{groupLabel(g)}</legend>
          <div className="divide-y divide-border">
            {drafts
              .filter((d) => d.periodStart === g)
              .map((d) => {
                const on = included.has(d.key);
                return (
                  <div key={d.key} className="flex min-h-14 items-center gap-2 py-1.5">
                    <label className="-ml-2 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foreground/30">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setIncluded((s) => {
                            const next = new Set(s);
                            if (e.target.checked) next.add(d.key);
                            else next.delete(d.key);
                            return next;
                          })
                        }
                        className="sr-only"
                        aria-label={`Include ${d.title}`}
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-[26px] place-items-center rounded-full border-[1.5px] transition-colors duration-200",
                          on ? "border-kept bg-kept text-white" : "border-input",
                        )}
                      >
                        {on && <Check className="size-4" strokeWidth={3} />}
                      </span>
                    </label>
                    <div className={cn("min-w-0 flex-1 transition-opacity", !on && "opacity-50")}>
                      <textarea
                        value={d.title}
                        maxLength={140}
                        rows={1}
                        onChange={(e) => update(d.key, { title: e.target.value.replace(/\n/g, " ") })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        aria-label="Goal"
                        className="block min-h-11 w-full min-w-0 resize-none rounded-lg bg-transparent px-1.5 py-2.5 text-[17px] leading-snug outline-none [field-sizing:content] focus-visible:bg-accent"
                      />
                      {!d.isMajor && <span className="-mt-1 block px-1.5 pb-1 text-[13px] text-muted-foreground">Supporting task</span>}
                    </div>
                    {d.targetValue !== null ? (
                      <label className={cn("flex h-11 max-w-[8.5rem] min-w-[5.5rem] shrink-0 items-center justify-end gap-1 rounded-xl bg-accent px-2.5 transition-opacity focus-within:ring-2 focus-within:ring-foreground/20", !on && "opacity-50")}>
                        <span className="sr-only">Target for {d.title}</span>
                        {d.unit === "$" && <span className="text-[17px] text-muted-foreground">$</span>}
                        <TargetInput value={d.targetValue} onChange={(n) => update(d.key, { targetValue: n })} />
                        {d.unit && d.unit !== "$" && <span className="min-w-0 truncate text-[13px] text-muted-foreground">{d.unit}</span>}
                      </label>
                    ) : (
                      <span className={cn("shrink-0 text-right text-[14px] text-muted-foreground", !on && "opacity-50")}>Yes / no</span>
                    )}
                  </div>
                );
              })}
          </div>
        </fieldset>
      ))}
      <div className="grid gap-3">
        <p className="text-center text-[15px] text-muted-foreground">
          {count} of {drafts.length} selected
          {drafts.some((d) => d.targetValue !== null && d.isMajor && included.has(d.key)) &&
            ` · ${formatValue(
              drafts.filter((d) => d.isMajor && included.has(d.key) && d.targetValue !== null).reduce((s, d) => s + (d.targetValue ?? 0), 0),
              drafts.find((d) => d.isMajor)?.unit ?? null,
            )} in total`}
        </p>
        <PrimaryButton
          disabled={busy || count === 0}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await onApprove(drafts.filter((d) => included.has(d.key)).map((d) => ({ ...d, title: d.title.trim() })));
              if (!res.ok) toast.error(res.error);
              else {
                toast.success(`Saved ${res.data.count} ${res.data.count === 1 ? "goal" : "goals"}.`);
                onDone?.();
                router.refresh();
              }
            } catch {
              toast.error("The plan wasn't saved. Check your connection and try again.");
            } finally {
              setBusy(false);
            }
          }}
          className="w-full"
        >
          {busy ? "Saving…" : `${approveLabel} (${count})`}
        </PrimaryButton>
      </div>
    </div>
  );
}

/** A number typed as text: "1." stays on screen while typing, and the saved number shows on blur. */
function TargetInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? String(value) : "");
  return (
    <input
      inputMode="decimal"
      value={shown}
      onChange={(e) => {
        const text = e.target.value.replace(/[^0-9.]/g, "");
        setDraft(text);
        const n = Number(text);
        onChange(text !== "" && Number.isFinite(n) ? n : 0);
      }}
      onBlur={() => setDraft(null)}
      size={Math.max(2, shown.length)}
      className="min-w-0 bg-transparent text-right text-[17px] tabular-nums outline-none"
    />
  );
}
