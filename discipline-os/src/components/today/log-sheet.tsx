"use client";

import { BriefcaseBusiness, ChevronLeft, CircleDollarSign, Dumbbell, Globe, HeartPulse, ListChecks, PenLine, Phone, Plus, Square, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { TAB_ACTION_SLOT } from "@/components/app-nav";
import { Row } from "@/components/os";
import { Sheet } from "@/components/sheet";
import { AREA_LABEL, WORK_AREAS, type WorkArea } from "@/lib/areas";
import type { LocalDate } from "@/lib/day";
import { formatValue } from "@/lib/goals/format";
import type { CounterItem, HabitItem, TaskItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuickAdd } from "./quick-add";

type Step = "work" | "revenue" | "cardio" | "habit" | "note";

interface LogSheetProps {
  date: LocalDate;
  counters: CounterItem[];
  habits: HabitItem[];
  running: { id: string; area: WorkArea | null } | null;
  big3Free: boolean;
  onCounter: (counter: CounterItem, value: number) => void;
  onHabit: (habit: HabitItem, done: boolean) => void;
  onStart: (area: WorkArea) => void;
  onStop: (sessionId: string) => void;
  onAdded: (task: TaskItem) => void;
}

const icon = "size-[22px]";

/**
 * Today's one contextual action: a + beside the tab bar that opens "Log something". Most things
 * log in one tap; revenue and cardio ask for the number first.
 */
export function LogSheet(props: LogSheetProps) {
  const { counters, habits, running } = props;
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step | null>(null);

  useEffect(() => {
    // The tab bar is rendered by the layout; its slot is there once the page is in the browser.
    const t = setTimeout(() => setSlot(document.getElementById(TAB_ACTION_SLOT)), 0);
    return () => clearTimeout(t);
  }, []);

  const counter = (area: string, key: string) => counters.find((c) => c.area === area && c.key === key) ?? null;
  const leads = counter("imperium", "leads_called");
  const calls = counter("websites", "cold_calls");
  const cardio = counter("fitness", "cardio_minutes");
  const revenue = [counter("imperium", "revenue"), counter("websites", "revenue")].filter((c): c is CounterItem => Boolean(c));
  const gym = habits.find((h) => h.kind === "gym") ?? null;
  const openHabits = habits.filter((h) => h.due && !h.completedAt).sort((a, b) => a.sortOrder - b.sortOrder);

  function close() {
    setOpen(false);
    setStep(null);
  }

  function bump(c: CounterItem, by: number, said: string) {
    props.onCounter(c, c.value + by);
    toast.success(said);
    close();
  }

  const button = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Log something"
      className="nav-glass grid size-16 shrink-0 place-items-center rounded-full border text-foreground shadow-[0_18px_40px_-22px_rgb(0_0_0/0.6)] backdrop-blur-xl transition-transform active:scale-95"
    >
      <Plus className="size-7" strokeWidth={1.8} aria-hidden />
    </button>
  );

  return (
    <>
      {slot && createPortal(button, slot)}
      <Sheet open={open} onClose={close} title={step ? STEP_TITLE[step] : "Log something"}>
        {step && (
          <button type="button" onClick={() => setStep(null)} className="-mt-1 mb-2 -ml-1 inline-flex min-h-11 items-center gap-0.5 text-[15px] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Log something
          </button>
        )}

        {!step && (
          <div className="-mx-5 divide-y divide-border border-y border-border">
            <Row
              leading={running ? <Square className={icon} /> : <Timer className={icon} />}
              title={running ? `Stop ${running.area ? AREA_LABEL[running.area] : "work"}` : "Work"}
              subtitle={running ? "The timer that's running" : "Start a timer"}
              onClick={() => {
                if (running) {
                  props.onStop(running.id);
                  close();
                } else setStep("work");
              }}
              chevron={!running}
            />
            {leads && (
              <Row
                leading={<Phone className={icon} />}
                title="Imperium call"
                subtitle={`${leads.value} today${leads.target ? ` of ${leads.target}` : ""}`}
                onClick={() => bump(leads, 1, `Imperium call logged. ${leads.value + 1} today.`)}
                chevron={false}
              />
            )}
            {calls && (
              <Row
                leading={<Globe className={icon} />}
                title="Website call"
                subtitle={`${calls.value} today${calls.target ? ` of ${calls.target}` : ""}`}
                onClick={() => bump(calls, 1, `Website call logged. ${calls.value + 1} today.`)}
                chevron={false}
              />
            )}
            {revenue.length > 0 && <Row leading={<CircleDollarSign className={icon} />} title="Revenue" subtitle="A sale or payment" onClick={() => setStep("revenue")} />}
            {cardio && <Row leading={<HeartPulse className={icon} />} title="Cardio" subtitle={`${cardio.value} minutes today`} onClick={() => setStep("cardio")} />}
            {gym && (
              <Row
                leading={<Dumbbell className={icon} />}
                title="Gym"
                subtitle={gym.completedAt ? "Done today" : gym.due ? "Due today" : "A rest day"}
                disabled={Boolean(gym.completedAt)}
                onClick={() => {
                  props.onHabit(gym, true);
                  toast.success("Gym logged.");
                  close();
                }}
                chevron={false}
              />
            )}
            <Row leading={<ListChecks className={icon} />} title="Habit" subtitle={openHabits.length ? `${openHabits.length} still to tick` : "All ticked"} onClick={() => setStep("habit")} />
            <Row leading={<PenLine className={icon} />} title="Note" subtitle="Kept for later, under your tasks" onClick={() => setStep("note")} />
          </div>
        )}

        {step === "work" && (
          <div className="-mx-5 divide-y divide-border border-y border-border">
            {WORK_AREAS.map((a) => (
              <Row
                key={a}
                leading={<BriefcaseBusiness className={icon} />}
                title={AREA_LABEL[a]}
                onClick={() => {
                  props.onStart(a);
                  close();
                }}
                chevron={false}
              />
            ))}
          </div>
        )}

        {step === "revenue" && (
          <AmountForm
            label="Amount"
            unit="$"
            choices={revenue.map((c) => ({ id: c.id, label: AREA_LABEL[c.area as WorkArea] ?? c.label }))}
            onSave={(amount, choice) => {
              const c = revenue.find((x) => x.id === choice) ?? revenue[0];
              bump(c, amount, `${formatValue(amount, "$")} logged for ${AREA_LABEL[c.area as WorkArea] ?? c.label}.`);
            }}
          />
        )}

        {step === "cardio" && cardio && (
          <AmountForm label="Minutes" presets={[20, 30, 45]} onSave={(mins) => bump(cardio, mins, `${mins} minutes of cardio logged.`)} />
        )}

        {step === "habit" &&
          (openHabits.length === 0 ? (
            <p className="py-4 text-[17px] text-muted-foreground">Everything due today is ticked.</p>
          ) : (
            <div className="-mx-5 divide-y divide-border border-y border-border">
              {openHabits.map((h) => (
                <Row
                  key={h.id}
                  leading={<span aria-hidden className="size-6 rounded-full border-[1.5px] border-input" />}
                  title={h.name}
                  onClick={() => {
                    props.onHabit(h, true);
                    toast.success(`${h.name} ticked.`);
                    close();
                  }}
                  chevron={false}
                />
              ))}
            </div>
          ))}

        {step === "note" && (
          <QuickAdd
            date={props.date}
            big3Free={props.big3Free}
            startLater
            autoFocus
            onAdded={(task) => {
              props.onAdded(task);
              toast.success(task.localDate ? "Added to today." : "Saved for later.");
              close();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

const STEP_TITLE: Record<Step, string> = { work: "Start work on", revenue: "Revenue", cardio: "Cardio", habit: "Tick a habit", note: "Note" };

function AmountForm({
  label,
  unit,
  presets,
  choices,
  onSave,
}: {
  label: string;
  unit?: string;
  presets?: number[];
  choices?: Array<{ id: string; label: string }>;
  onSave: (amount: number, choice: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<string | null>(choices?.[0]?.id ?? null);
  const amount = Number(text.replace(/[^0-9.]/g, ""));
  const valid = text.trim() !== "" && Number.isFinite(amount) && amount > 0;
  return (
    <form
      className="grid gap-4 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(amount, choice);
      }}
    >
      {choices && choices.length > 1 && (
        <div role="radiogroup" aria-label="For" className="grid grid-cols-2 gap-2">
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={choice === c.id}
              onClick={() => setChoice(c.id)}
              className={cn("h-12 rounded-2xl border text-[17px]", choice === c.id ? "border-primary bg-lamp-soft" : "border-border text-muted-foreground")}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <label className="grid gap-1.5 text-[15px] text-muted-foreground">
        {label}
        <span className="flex h-16 items-center gap-2 rounded-2xl border border-input px-4 focus-within:border-primary/70">
          {unit && <span className="text-[28px] text-muted-foreground">{unit}</span>}
          <input
            autoFocus
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
            className="min-w-0 flex-1 bg-transparent text-[32px] text-foreground outline-none"
            aria-label={label}
          />
        </span>
      </label>
      {presets && (
        <div className="grid grid-cols-3 gap-2">
          {presets.map((p) => (
            <button key={p} type="button" onClick={() => onSave(p, choice)} className="h-12 rounded-2xl border border-border text-[17px] hover:bg-accent">
              {p} min
            </button>
          ))}
        </div>
      )}
      <button type="submit" disabled={!valid} className="h-[52px] rounded-full bg-primary text-[17px] font-medium text-primary-foreground disabled:opacity-40">
        Log it
      </button>
    </form>
  );
}
