"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createYearlyGoal } from "@/app/actions/goals";
import { daysBetween, type LocalDate } from "@/lib/day";
import { GOAL_TYPES, isNumeric, type Cadence, type GoalType, type LifeArea, type ProgressSource } from "@/lib/goals/model";
import { checkGoal } from "@/lib/goals/quality";
import { cn } from "@/lib/utils";

const UNITS = ["$", "kg", "hours", "sessions", "days", "books"];
type Source = "log" | "timer" | "habit";

interface GoalFormProps {
  year: number;
  today: LocalDate;
  areas: LifeArea[];
  habits: Array<{ id: string; name: string }>;
  defaultAreaId?: string | null;
}

const field = "h-12 w-full rounded-lg border border-input bg-background px-3 text-[16px] outline-none placeholder:text-faint focus-visible:border-primary/70";
const labelCls = "grid gap-1.5 text-sm text-muted-foreground";

export function GoalForm({ year, today, areas, habits, defaultAreaId }: GoalFormProps) {
  const router = useRouter();
  const [areaId, setAreaId] = useState(defaultAreaId ?? areas.find((a) => a.isActive)?.id ?? "");
  const [title, setTitle] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("outcome");
  const [metric, setMetric] = useState("");
  const [unit, setUnit] = useState("");
  const [start, setStart] = useState("");
  const [target, setTarget] = useState("");
  const [cadence, setCadence] = useState<Cadence>("total");
  const [source, setSource] = useState<Source>("log");
  const [habitId, setHabitId] = useState("");
  const [why, setWhy] = useState("");
  const [success, setSuccess] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState(`${year}-12-31`);
  const [priority, setPriority] = useState(2);
  const [addProcess, setAddProcess] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numeric = isNumeric(goalType);
  const areaName = areas.find((a) => a.id === areaId)?.name ?? null;
  const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const monthsLeft = Math.max(1, Math.round(daysBetween(today > `${year}-01-01` ? today : `${year}-01-01`, deadline || `${year}-12-31`) / 30.4));

  const quality = useMemo(
    () =>
      checkGoal({
        title: title || "",
        goalType,
        unit: numeric ? unit || null : null,
        metric: metric || null,
        startValue: numeric ? num(start) : null,
        targetValue: numeric ? num(target) : null,
        cadence,
        deadline,
        year,
        why,
        success,
        areaName,
        monthsLeft,
      }),
    [title, goalType, numeric, unit, metric, start, target, cadence, deadline, year, why, success, areaName, monthsLeft],
  );

  const progressSource: ProgressSource = !numeric
    ? goalType === "milestone"
      ? "milestones"
      : "manual"
    : source === "timer"
      ? "work_hours"
      : source === "habit"
        ? "habit"
        : "children";

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("Give the goal a name.");
    if (numeric && num(target) === null) return setError("Add a target number, so progress can be tracked.");
    if (source === "habit" && !habitId) return setError("Pick the habit that counts towards this.");
    setBusy(true);
    try {
      const process = quality.process;
      const res = await createYearlyGoal({
        year,
        title: title.trim(),
        description: description || null,
        why: why || null,
        success: success || null,
        lifeAreaId: areaId || null,
        goalType,
        metric: numeric ? metric || null : null,
        unit: numeric ? unit || null : null,
        cadence: numeric ? cadence : "total",
        aggregation: goalType === "performance" ? "latest" : "sum",
        progressSource,
        startValue: numeric ? num(start) : null,
        targetValue: numeric ? num(target) : null,
        habitId: source === "habit" ? habitId || null : null,
        priority,
        deadline: deadline || null,
        process:
          process && addProcess
            ? {
                title: process.title,
                goalType: process.goalType,
                metric: process.metric,
                unit: process.unit,
                cadence: process.cadence,
                aggregation: "sum",
                progressSource: process.progressSource === "manual" ? "children" : process.progressSource,
                startValue: null,
                targetValue: process.targetValue,
                priority,
                deadline: deadline || null,
                lifeAreaId: areaId || null,
                why: why || null,
              }
            : null,
      });
      if (!res.ok) return setError(res.error);
      toast.success("Goal saved. Break it down next.");
      router.push(`/goals/year/${res.data.id}`);
    } catch {
      setError("The goal wasn't saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const flagged = quality.flags.filter((f) => !f.ok);

  return (
    <form
      className="grid gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
    >
      <div className="grid gap-4">
        <label className={labelCls}>
          Area of life
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className={field}>
            {areas
              .filter((a) => a.isActive)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </label>
        <label className={labelCls}>
          Goal
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="$300,000 annual revenue" className={field} autoFocus />
        </label>

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm text-muted-foreground">Type</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {GOAL_TYPES.map((t) => (
              <label
                key={t.value}
                className={cn(
                  "grid min-h-14 cursor-pointer content-center rounded-xl border px-3 py-2 transition-colors",
                  goalType === t.value ? "border-primary bg-lamp-soft" : "border-input hover:bg-accent",
                )}
              >
                <input type="radio" name="goal-type" value={t.value} checked={goalType === t.value} onChange={() => setGoalType(t.value)} className="sr-only" />
                <span className="text-[15px] text-foreground">{t.label}</span>
                <span className="text-xs text-muted-foreground">{t.example}</span>
              </label>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{GOAL_TYPES.find((t) => t.value === goalType)?.hint}</p>
        </fieldset>
      </div>

      {numeric && (
        <div className="grid gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <label className={labelCls}>
              Measured as
              <input value={metric} onChange={(e) => setMetric(e.target.value)} maxLength={60} placeholder={goalType === "performance" ? "Bench press" : "Revenue"} className={field} />
            </label>
            <label className={labelCls}>
              Unit
              <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="$" className={field} list="goal-units" />
              <datalist id="goal-units">
                {UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className={labelCls}>
              Starting at
              <input inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} placeholder="0" className={field} />
            </label>
            <label className={labelCls}>
              Target
              <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="300000" className={field} />
            </label>
          </div>
          {(goalType === "process" || goalType === "habit") && (
            <label className={labelCls}>
              The target is
              <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)} className={field}>
                <option value="total">A total for the year</option>
                <option value="per_week">Per week</option>
                <option value="per_month">Per month</option>
              </select>
            </label>
          )}
          <label className={labelCls}>
            Progress comes from
            <select value={source} onChange={(e) => setSource(e.target.value as Source)} className={field}>
              <option value="log">What I log (it adds up from the months below)</option>
              <option value="timer">The work timer (focused hours)</option>
              <option value="habit">Ticks of a habit</option>
            </select>
          </label>
          {source === "habit" && (
            <label className={labelCls}>
              Habit
              <select value={habitId} onChange={(e) => setHabitId(e.target.value)} className={field}>
                <option value="">Choose a habit</option>
                {habits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {goalType === "milestone" && <p className="-mt-4 text-sm text-muted-foreground">You&apos;ll add the milestones on the next screen.</p>}

      <div className="grid gap-4">
        <label className={labelCls}>
          Why it matters
          <textarea value={why} onChange={(e) => setWhy(e.target.value)} maxLength={2000} rows={2} placeholder="To provide for my family and give generously." className={cn(field, "h-auto min-h-[4.5rem] resize-none py-2.5 [field-sizing:content]")} />
        </label>
        <label className={labelCls}>
          What success looks like
          <input value={success} onChange={(e) => setSuccess(e.target.value)} maxLength={500} placeholder={goalType === "binary" ? "Received as a catechumen at the parish" : "$300k banked by 31 December"} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={labelCls}>
            Deadline
            <input type="date" value={deadline} min={`${year}-01-01`} max={`${year}-12-31`} onChange={(e) => setDeadline(e.target.value)} className={field} />
          </label>
          <label className={labelCls}>
            Priority
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={field}>
              <option value={1}>High</option>
              <option value={2}>Medium</option>
              <option value={3}>Low</option>
            </select>
          </label>
        </div>
        <label className={labelCls}>
          Notes (optional)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} className={cn(field, "h-auto min-h-[4.5rem] resize-none py-2.5 [field-sizing:content]")} />
        </label>
      </div>

      <section aria-labelledby="quality-heading" className="grid gap-3 rounded-2xl border border-border p-4" aria-live="polite">
        <h2 id="quality-heading" className="text-lg font-medium tracking-tight">
          Goal check
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {flagged.length === 0 ? "Looks solid" : `${flagged.length} to look at`}
          </span>
        </h2>
        <ul className="grid gap-2.5">
          {quality.flags.map((f) => (
            <li key={f.key} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 text-[15px]">
              {f.ok ? <Check className="mt-0.5 size-4 text-primary" aria-label="OK" /> : <AlertTriangle className="mt-0.5 size-4 text-primary" aria-label="Look at this" />}
              <span>
                <span className="text-foreground">{f.label}.</span> <span className="text-muted-foreground">{f.message}</span>
              </span>
            </li>
          ))}
        </ul>
        {quality.process && (
          <label className="mt-1 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-lamp-soft p-3">
            <input type="checkbox" checked={addProcess} onChange={(e) => setAddProcess(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" />
            <span className="text-[15px]">
              Also add the process goal that drives it:
              <span className="block font-medium text-foreground">{quality.process.title}</span>
            </span>
          </label>
        )}
      </section>

      <div className="grid gap-2">
        <p aria-live="polite" className="min-h-6 text-[15px] text-primary">
          {error}
        </p>
        <button type="submit" disabled={busy} className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : "Save goal"}
        </button>
      </div>
    </form>
  );
}
