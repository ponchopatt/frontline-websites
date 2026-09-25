"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveMinimumDay } from "@/app/actions/habits";
import { CheckChip } from "@/components/check-chip";
import { Group, PrimaryButton, Row } from "@/components/os";
import { Sheet } from "@/components/sheet";
import { Stepper } from "@/components/stepper";

interface MinimumFormProps {
  habits: Array<{ id: string; name: string; minimum: boolean }>;
  workMinutes: number;
  fitness: boolean;
}

interface Minimum {
  ids: Set<string>;
  minutes: number;
  fitness: boolean;
}

/** The Minimum Day's non-negotiables: which habits, how much work, and the gym or cardio. */
export function MinimumForm({ habits, workMinutes, fitness }: MinimumFormProps) {
  const [saved, setSaved] = useState<Minimum>(() => ({ ids: new Set(habits.filter((h) => h.minimum).map((h) => h.id)), minutes: workMinutes, fitness }));
  const [open, setOpen] = useState(false);
  const names = habits.filter((h) => saved.ids.has(h.id)).map((h) => h.name);

  return (
    <>
      <Group id="minimum" title="Minimum day" footer="For a bad day: the few things that keep the chain alive. Switch it on from Today.">
        <Row onClick={() => setOpen(true)} title="Habits" subtitle={names.length ? names.join(", ") : "None"} value={names.length} />
        <Row onClick={() => setOpen(true)} title="Focused work" value={saved.minutes > 0 ? `${saved.minutes} min` : "Left out"} />
        <Row onClick={() => setOpen(true)} title="Gym, or 20 minutes of cardio" value={saved.fitness ? "On" : "Off"} />
      </Group>
      <Sheet open={open} onClose={() => setOpen(false)} title="Minimum day" subtitle="The few things that keep the chain alive">
        {open && (
          <MinimumSheet
            habits={habits}
            saved={saved}
            onSaved={(next) => {
              setSaved(next);
              setOpen(false);
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function MinimumSheet({ habits, saved, onSaved }: { habits: MinimumFormProps["habits"]; saved: Minimum; onSaved: (next: Minimum) => void }) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(saved.ids));
  const [minutes, setMinutes] = useState(saved.minutes);
  const [fitness, setFitness] = useState(saved.fitness);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await saveMinimumDay({ habitIds: [...chosen], workMinutes: minutes, fitness });
      if (res.ok) {
        toast.success("Minimum day saved.");
        onSaved({ ids: chosen, minutes, fitness });
      } else toast.error(res.error);
    } catch {
      toast.error("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pt-2">
      <div className="grid gap-2">
        <p className="text-[15px] text-muted-foreground">Habits</p>
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
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="grid gap-0.5">
          <span className="text-[17px]">Minutes of focused work</span>
          <span className="text-[14px] text-muted-foreground">0 leaves work out</span>
        </span>
        <Stepper label="Minimum day work minutes" value={minutes} step={5} delay={0} onCommit={(v) => setMinutes(Math.max(0, Math.min(240, Math.round(v))))} />
      </div>
      <CheckChip label="Gym, or 20 minutes of cardio" done={fitness} onToggle={setFitness} />
      <PrimaryButton disabled={busy} onClick={() => void save()} className="w-full">
        {busy ? "Saving…" : "Save minimum day"}
      </PrimaryButton>
    </div>
  );
}
