"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { saveSettings } from "@/app/actions/account";
import { SectionCard } from "@/components/section-card";
import { PLANS, type PlanKey } from "@/lib/bible";
import type { ProfileSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hourLabel(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function SettingsForm({ profile }: { profile: ProfileSettings }) {
  const router = useRouter();
  const zones = useMemo(() => {
    const list = Intl.supportedValuesOf("timeZone");
    return list.includes(profile.timezone) ? list : [profile.timezone, ...list];
  }, [profile.timezone]);
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [dayStartHour, setDayStartHour] = useState(profile.dayStartHour);
  const [workTarget, setWorkTarget] = useState(String(profile.workTargetHours));
  const [threshold, setThreshold] = useState(String(profile.streakThreshold));
  const [workDays, setWorkDays] = useState<number[]>(profile.workDays);
  const [botHours, setBotHours] = useState(String(profile.hourTargets.trading ?? 0));
  const [biblePlan, setBiblePlan] = useState<PlanKey>(profile.biblePlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = "h-12 w-full rounded-lg border border-input bg-background px-3 text-[16px] outline-none focus-visible:border-primary/70";

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-10"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await saveSettings({
            displayName,
            timezone,
            dayStartHour,
            workTargetHours: Number(workTarget),
            streakThreshold: Number(threshold),
            workDays,
            botHours: Number(botHours),
            biblePlan,
          });
          if (res.ok) {
            toast.success("Settings saved.");
            router.refresh();
          } else setError(res.error);
        } catch {
          setError("Your settings weren't saved. Check your connection and try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <SectionCard title="Your day">
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            Name
            <input value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} className={field} autoComplete="name" />
          </label>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            Timezone
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={field}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            A new day starts at
            <select value={dayStartHour} onChange={(e) => setDayStartHour(Number(e.target.value))} className={field} aria-describedby="day-start-hint">
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            <span id="day-start-hint" className="text-xs text-faint">
              Anything you log before {hourLabel(dayStartHour)} counts towards the day before.
            </span>
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Targets">
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            Work a day (hours)
            <input inputMode="decimal" type="number" min={0} max={16} step={0.5} value={workTarget} onChange={(e) => setWorkTarget(e.target.value)} className={field} />
          </label>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            AI bot a day (hours)
            <input inputMode="decimal" type="number" min={0} max={16} step={0.5} value={botHours} onChange={(e) => setBotHours(e.target.value)} className={field} />
          </label>
          <label className="col-span-2 grid gap-1.5 text-sm text-muted-foreground">
            Streak line (Keep My Word %)
            <input inputMode="numeric" type="number" min={1} max={100} step={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} className={field} />
          </label>
        </div>
        <fieldset className="mt-4 grid gap-1.5">
          <legend className="mb-1.5 text-sm text-muted-foreground">Work days</legend>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d, i) => {
              const day = i + 1;
              const on = workDays.includes(day);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setWorkDays((list) => (on ? list.filter((x) => x !== day) : [...list, day].sort()))}
                  className={cn("h-11 rounded-lg border text-[13px]", on ? "border-primary bg-lamp-soft" : "border-border text-muted-foreground")}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-faint">Weekly business targets are spread over these days. A 0h work target leaves work out of Keep My Word.</p>
        </fieldset>
      </SectionCard>

      <SectionCard title="Bible reading plan">
        <label className="grid gap-1.5 text-sm text-muted-foreground">
          Read a chapter a day from
          <select value={biblePlan} onChange={(e) => setBiblePlan(e.target.value as PlanKey)} className={field}>
            {(Object.keys(PLANS) as PlanKey[]).map((k) => (
              <option key={k} value={k}>
                {PLANS[k].label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-faint">Today&apos;s chapter follows on from the last one you read.</p>
      </SectionCard>

      <div className="grid gap-2">
        <p aria-live="polite" className="min-h-6 text-[15px] text-primary">
          {error}
        </p>
        <button type="submit" disabled={busy} className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
