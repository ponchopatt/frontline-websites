"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createYearlyGoal } from "@/app/actions/goals";
import { daysBetween, type LocalDate } from "@/lib/day";
import { GOAL_TYPES, isNumeric, wordTargetProblem, type Cadence, type GoalType, type LifeArea, type ProgressSource } from "@/lib/goals/model";
import { checkGoal } from "@/lib/goals/quality";
import { cn } from "@/lib/utils";
import { Group, PrimaryButton } from "@/components/os";
import { area, field, fieldLabel, segItem, segTrack, SwitchRow } from "./form-bits";

const UNITS = ["$", "kg", "hours", "sessions", "days", "books"];
type Source = "log" | "timer" | "habit" | "counter" | "word";

interface GoalFormProps {
  year: number;
  today: LocalDate;
  areas: LifeArea[];
  habits: Array<{ id: string; name: string }>;
  /** Business counters a goal can be measured by (revenue, leads called…). */
  counters: Array<{ id: string; area: string; label: string; unit: string | null }>;
  defaultAreaId?: string | null;
}

export function GoalForm({ year, today, areas, habits, counters, defaultAreaId }: GoalFormProps) {
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
  const [counterId, setCounterId] = useState("");
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
  const areaKey = areas.find((a) => a.id === areaId)?.key ?? null;
  const areaCounters = counters.filter((c) => c.area === areaKey && c.unit !== null);
  const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const monthsLeft = Math.max(1, Math.round(daysBetween(today > `${year}-01-01` ? today : `${year}-01-01`, deadline || `${year}-12-31`) / 30.4));
  // A share of days is a level for the whole year from zero, not a total or a weekly rate.
  const word = numeric && source === "word";

  const quality = useMemo(
    () =>
      checkGoal({
        title: title || "",
        goalType,
        unit: numeric ? unit || null : null,
        metric: metric || null,
        startValue: numeric && !word ? num(start) : null,
        targetValue: numeric ? num(target) : null,
        cadence,
        deadline,
        year,
        why,
        success,
        areaName,
        monthsLeft,
      }),
    [title, goalType, numeric, word, unit, metric, start, target, cadence, deadline, year, why, success, areaName, monthsLeft],
  );

  const progressSource: ProgressSource = !numeric
    ? goalType === "milestone"
      ? "milestones"
      : "manual"
    : source === "timer"
      ? "work_hours"
      : source === "habit"
        ? "habit"
        : source === "counter" && counterId
          ? "metric"
          : source === "word"
            ? "keep_word"
            : "children";

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("Give the goal a name.");
    if (numeric && num(target) === null) return setError("Add a target number, so progress can be tracked.");
    if (source === "habit" && !habitId) return setError("Pick the habit that counts towards this.");
    if (source === "counter" && !counterId) return setError("Pick the counter that measures this.");
    const wordProblem = word ? wordTargetProblem(num(target)) : null;
    if (wordProblem) return setError(wordProblem);
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
        unit: word ? "%" : numeric ? unit || null : null,
        cadence: numeric && !word ? cadence : "total",
        aggregation: goalType === "performance" || word ? "latest" : "sum",
        progressSource,
        startValue: numeric && !word ? num(start) : null,
        targetValue: numeric ? num(target) : null,
        habitId: source === "habit" ? habitId || null : null,
        metricId: progressSource === "metric" ? counterId : null,
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
  const type = GOAL_TYPES.find((t) => t.value === goalType);

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
    >
      <Group title="The goal" plain>
        <div className="grid gap-4 p-4">
          <label className={fieldLabel}>
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
          <label className={fieldLabel}>
            Goal
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="$300,000 annual revenue" className={field} autoFocus />
          </label>

          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-[15px] text-muted-foreground">Type</legend>
            <div className={cn(segTrack, "grid-cols-2 sm:grid-cols-3")}>
              {GOAL_TYPES.map((t) => (
                <label key={t.value} className={segItem(goalType === t.value)}>
                  <input type="radio" name="goal-type" value={t.value} checked={goalType === t.value} onChange={() => setGoalType(t.value)} className="sr-only" />
                  {t.label}
                </label>
              ))}
            </div>
            {type && (
              <p className="px-1 text-[14px] leading-snug text-muted-foreground">
                {type.hint} For example, “{type.example}”.
              </p>
            )}
          </fieldset>
        </div>
      </Group>

      {numeric && (
        <Group title="How it's measured" plain>
          <div className="grid gap-4 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
              <label className={fieldLabel}>
                Measured as
                <input value={metric} onChange={(e) => setMetric(e.target.value)} maxLength={60} placeholder={goalType === "performance" ? "Bench press" : "Revenue"} className={field} />
              </label>
              <label className={fieldLabel}>
                Unit
                <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="$" className={field} list="goal-units" readOnly={word} />
                <datalist id="goal-units">
                  {UNITS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {!word && (
                <label className={fieldLabel}>
                  Starting at
                  <input inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} placeholder="0" className={field} />
                </label>
              )}
              <label className={fieldLabel}>
                Target
                <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={word ? "85" : "300000"} className={field} />
              </label>
            </div>
            {(goalType === "process" || goalType === "habit") && !word && (
              <label className={fieldLabel}>
                The target is
                <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)} className={field}>
                  <option value="total">A total for the year</option>
                  <option value="per_week">Per week</option>
                  <option value="per_month">Per month</option>
                </select>
              </label>
            )}
            <label className={fieldLabel}>
              Progress comes from
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as Source);
                  if (e.target.value === "word") setUnit("%");
                  else if (source === "word" && unit === "%") setUnit("");
                }}
                className={field}
              >
                <option value="log">What I log (it adds up from the months below)</option>
                <option value="timer">The work timer (focused hours)</option>
                <option value="habit">Ticks of a habit</option>
                <option value="word">Days I kept my word (% of days)</option>
                {areaCounters.length > 0 && <option value="counter">A business counter (fills in from Today)</option>}
              </select>
            </label>
            {source === "counter" && (
              <label className={fieldLabel}>
                Counter
                <select
                  value={counterId}
                  onChange={(e) => {
                    const c = counters.find((x) => x.id === e.target.value);
                    setCounterId(e.target.value);
                    if (c) {
                      setUnit(c.unit === "$" ? "$" : c.unit ?? "");
                      setMetric(c.label);
                    }
                  }}
                  className={field}
                >
                  <option value="">Choose a counter</option>
                  {areaCounters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {source === "habit" && (
              <label className={fieldLabel}>
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
        </Group>
      )}
      {goalType === "milestone" && <p className="-mt-4 px-1 text-[15px] text-muted-foreground">You&apos;ll add the milestones on the next screen.</p>}

      <Group title="Why and when" plain>
        <div className="grid gap-4 p-4">
          <label className={fieldLabel}>
            Why it matters
            <textarea value={why} onChange={(e) => setWhy(e.target.value)} maxLength={2000} rows={2} placeholder="To provide for my family and give generously." className={area} />
          </label>
          <label className={fieldLabel}>
            What success looks like
            <input value={success} onChange={(e) => setSuccess(e.target.value)} maxLength={500} placeholder={goalType === "binary" ? "Received as a catechumen at the parish" : "$300k banked by 31 December"} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={fieldLabel}>
              Deadline
              <input type="date" value={deadline} min={`${year}-01-01`} max={`${year}-12-31`} onChange={(e) => setDeadline(e.target.value)} className={field} />
            </label>
            <label className={fieldLabel}>
              Priority
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={field}>
                <option value={1}>High</option>
                <option value={2}>Medium</option>
                <option value={3}>Low</option>
              </select>
            </label>
          </div>
          <label className={fieldLabel}>
            Notes (optional)
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} className={area} />
          </label>
        </div>
      </Group>

      <Group id="quality" title="Goal check" action={<span className="text-[15px] text-muted-foreground">{flagged.length === 0 ? "Looks solid" : `${flagged.length} to look at`}</span>}>
        <ul aria-live="polite" className="divide-y divide-border">
          {quality.flags.map((f) => (
            <li key={f.key} className="flex gap-3 px-4 py-3 text-[15px] leading-snug">
              {f.ok ? (
                <Check className="mt-0.5 size-[18px] shrink-0 text-kept" aria-label="OK" />
              ) : (
                <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" aria-label="Look at this" />
              )}
              <span className="min-w-0">
                <span className="text-foreground">{f.label}.</span> <span className="text-muted-foreground">{f.message}</span>
              </span>
            </li>
          ))}
        </ul>
        {quality.process && (
          <SwitchRow title="Also add the process goal that drives it:" subtitle={<span className="font-medium text-foreground">{quality.process.title}</span>} on={addProcess} onChange={setAddProcess} />
        )}
      </Group>

      <div className="grid gap-2">
        {error && (
          <p role="alert" className="px-1 text-[15px] font-medium text-foreground">
            {error}
          </p>
        )}
        <PrimaryButton type="submit" disabled={busy} className="w-full">
          {busy ? "Saving…" : "Save goal"}
        </PrimaryButton>
      </div>
    </form>
  );
}
