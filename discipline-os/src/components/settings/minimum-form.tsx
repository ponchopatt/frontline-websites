"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveMinimumDay } from "@/app/actions/habits";
import { CheckChip } from "@/components/check-chip";
import { SectionCard } from "@/components/section-card";
import { Stepper } from "@/components/stepper";

interface MinimumFormProps {
  habits: Array<{ id: string; name: string; minimum: boolean }>;
  workMinutes: number;
  fitness: boolean;
}

/** The Minimum Day's non-negotiables: which habits, how much work, and the gym or cardio. */
export function MinimumForm({ habits, workMinutes: initialMinutes, fitness: initialFitness }: MinimumFormProps) {
  const [chosen, setChosen] = useState<Set<string>>(new Set(habits.filter((h) => h.minimum).map((h) => h.id)));
  const [minutes, setMinutes] = useState(initialMinutes);
  const [fitness, setFitness] = useState(initialFitness);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await saveMinimumDay({ habitIds: [...chosen], workMinutes: minutes, fitness });
      if (res.ok) toast.success("Minimum day saved.");
      else toast.error(res.error);
    } catch {
      toast.error("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard id="minimum" title="Minimum day" description="For a bad day: the few things that keep the chain alive. Switch it on from Today.">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2">
          {habits.map((h) => (
            <CheckChip
              key={h.id}
              label={h.name}
              done={chosen.has(h.id)}
              onToggle={(on) =>
                setChosen((s) => {
                  const next = new Set(s);
                  if (on) next.add(h.id);
                  else next.delete(h.id);
                  return next;
                })
              }
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px]">
            Minutes of focused work
            <span className="block text-xs text-faint">0 leaves work out</span>
          </span>
          <Stepper label="Minimum day work minutes" value={minutes} step={5} onCommit={(v) => setMinutes(Math.max(0, Math.min(240, Math.round(v))))} />
        </div>
        <CheckChip label="Gym, or 20 minutes of cardio" done={fitness} onToggle={setFitness} />
        <button type="button" disabled={busy} onClick={() => void save()} className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : "Save minimum day"}
        </button>
      </div>
    </SectionCard>
  );
}
