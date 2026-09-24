"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { saveSettings } from "@/app/actions/account";
import { daysLabel, WEEKDAY_NAMES, WEEKDAY_SHORT } from "@/components/habits/days";
import { Group, PrimaryButton, Row } from "@/components/os";
import { Sheet } from "@/components/sheet";
import { PLANS, type PlanKey } from "@/lib/bible";
import type { ProfileSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Values {
  displayName: string;
  timezone: string;
  dayStartHour: number;
  workTargetHours: number;
  streakThreshold: number;
  workDays: number[];
  botHours: number;
  biblePlan: PlanKey;
}

type Editing = "day" | "targets" | "bible" | null;

const field = "h-12 w-full rounded-xl border border-input bg-transparent px-3 text-[17px] text-foreground outline-none focus-visible:border-primary/70";
const labelCls = "grid gap-1.5 text-[15px] text-muted-foreground";

function hourLabel(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

/** "Australia/Sydney" reads as "Sydney" on its row; the sheet has the full name. */
function zoneLabel(zone: string) {
  return (zone.split("/").pop() ?? zone).replaceAll("_", " ");
}

function fromProfile(profile: ProfileSettings): Values {
  return {
    displayName: profile.displayName ?? "",
    timezone: profile.timezone,
    dayStartHour: profile.dayStartHour,
    workTargetHours: profile.workTargetHours,
    streakThreshold: profile.streakThreshold,
    workDays: profile.workDays,
    botHours: profile.hourTargets.trading ?? 0,
    biblePlan: profile.biblePlan,
  };
}

/**
 * Your day, your targets and the reading plan as rows. Tap one to change it in a sheet; each
 * sheet saves everything at once, with what the others last saved.
 */
export function SettingsForm({ profile }: { profile: ProfileSettings }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Values>(() => fromProfile(profile));
  const [editing, setEditing] = useState<Editing>(null);
  const close = () => setEditing(null);

  /** Returns the error to show, or null once it's saved. */
  async function save(patch: Partial<Values>): Promise<string | null> {
    const next = { ...saved, ...patch };
    try {
      const res = await saveSettings(next);
      if (!res.ok) return res.error;
      setSaved(next);
      toast.success("Settings saved.");
      router.refresh();
      return null;
    } catch {
      return "Your settings weren't saved. Check your connection and try again.";
    }
  }

  return (
    <>
      <Group id="your-day" title="Your day" footer={`Anything you log before ${hourLabel(saved.dayStartHour)} counts towards the day before.`}>
        <Row onClick={() => setEditing("day")} title="Name" value={<span className="block max-w-[11rem] truncate">{saved.displayName || "Not set"}</span>} />
        <Row onClick={() => setEditing("day")} title="Timezone" value={<span className="block max-w-[11rem] truncate">{zoneLabel(saved.timezone)}</span>} />
        <Row onClick={() => setEditing("day")} title="A new day starts at" value={hourLabel(saved.dayStartHour)} />
      </Group>

      <Group id="targets" title="Targets" footer="Weekly business targets are spread over your work days. A 0h work target leaves work out of Keep My Word.">
        <Row onClick={() => setEditing("targets")} title="Work a day" value={`${saved.workTargetHours}h`} />
        <Row onClick={() => setEditing("targets")} title="AI bot a day" value={`${saved.botHours}h`} />
        <Row onClick={() => setEditing("targets")} title="Streak line" subtitle="The Keep My Word % that extends a streak" value={`${saved.streakThreshold}%`} />
        <Row onClick={() => setEditing("targets")} title="Work days" value={daysLabel(saved.workDays)} />
      </Group>

      <Group id="bible-plan" title="Bible reading plan">
        <Row onClick={() => setEditing("bible")} title={PLANS[saved.biblePlan].label} subtitle="A chapter a day, on from the last one you read" />
      </Group>

      <Sheet open={editing === "day"} onClose={close} title="Your day">
        {editing === "day" && <DayForm values={saved} onSave={save} onDone={close} />}
      </Sheet>
      <Sheet open={editing === "targets"} onClose={close} title="Targets">
        {editing === "targets" && <TargetsForm values={saved} onSave={save} onDone={close} />}
      </Sheet>
      <Sheet open={editing === "bible"} onClose={close} title="Bible reading plan" subtitle="Read a chapter a day from">
        {editing === "bible" && <PlanChoice value={saved.biblePlan} onSave={save} onDone={close} />}
      </Sheet>
    </>
  );
}

interface FormProps {
  values: Values;
  onSave: (patch: Partial<Values>) => Promise<string | null>;
  onDone: () => void;
}

/** A sheet's form: its fields, the error if saving failed, and one Save button. */
function SheetForm({ onSubmit, children }: { onSubmit: () => Promise<string | null>; children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-5 pt-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        const err = await onSubmit();
        setBusy(false);
        setError(err);
      }}
    >
      {children}
      <p aria-live="polite" className={cn("text-[15px] text-destructive", !error && "sr-only")}>
        {error}
      </p>
      <PrimaryButton type="submit" disabled={busy} className="w-full">
        {busy ? "Saving…" : "Save"}
      </PrimaryButton>
    </form>
  );
}

function DayForm({ values, onSave, onDone }: FormProps) {
  const zones = useMemo(() => {
    const list = Intl.supportedValuesOf("timeZone");
    return list.includes(values.timezone) ? list : [values.timezone, ...list];
  }, [values.timezone]);
  const [displayName, setDisplayName] = useState(values.displayName);
  const [timezone, setTimezone] = useState(values.timezone);
  const [dayStartHour, setDayStartHour] = useState(values.dayStartHour);

  return (
    <SheetForm
      onSubmit={async () => {
        const err = await onSave({ displayName, timezone, dayStartHour });
        if (!err) onDone();
        return err;
      }}
    >
      <label className={labelCls}>
        Name
        <input value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} className={field} autoComplete="name" />
      </label>
      <label className={labelCls}>
        Timezone
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={field}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        A new day starts at
        <select value={dayStartHour} onChange={(e) => setDayStartHour(Number(e.target.value))} className={field} aria-describedby="day-start-hint">
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
        <span id="day-start-hint" className="text-[14px] leading-snug">
          Anything you log before {hourLabel(dayStartHour)} counts towards the day before.
        </span>
      </label>
    </SheetForm>
  );
}

function TargetsForm({ values, onSave, onDone }: FormProps) {
  const [workTarget, setWorkTarget] = useState(String(values.workTargetHours));
  const [botHours, setBotHours] = useState(String(values.botHours));
  const [threshold, setThreshold] = useState(String(values.streakThreshold));
  const [workDays, setWorkDays] = useState<number[]>(values.workDays);

  return (
    <SheetForm
      onSubmit={async () => {
        const err = await onSave({ workTargetHours: Number(workTarget), botHours: Number(botHours), streakThreshold: Number(threshold), workDays });
        if (!err) onDone();
        return err;
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls}>
          Work a day (hours)
          <input inputMode="decimal" type="number" min={0} max={16} step={0.5} value={workTarget} onChange={(e) => setWorkTarget(e.target.value)} className={field} />
        </label>
        <label className={labelCls}>
          AI bot a day (hours)
          <input inputMode="decimal" type="number" min={0} max={16} step={0.5} value={botHours} onChange={(e) => setBotHours(e.target.value)} className={field} />
        </label>
      </div>
      <label className={labelCls}>
        Streak line (Keep My Word %)
        <input inputMode="numeric" type="number" min={1} max={100} step={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} className={field} />
      </label>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[15px] text-muted-foreground">Work days</legend>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_SHORT.map((d, i) => {
            const day = i + 1;
            const on = workDays.includes(day);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAY_NAMES[i]}
                onClick={() => setWorkDays((list) => (on ? list.filter((x) => x !== day) : [...list, day].sort()))}
                className={cn("h-11 min-w-0 rounded-xl text-[14px] transition-colors", on ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground")}
              >
                {d}
              </button>
            );
          })}
        </div>
        <p className="text-[14px] leading-snug text-muted-foreground">Weekly business targets are spread over these days. A 0h work target leaves work out of Keep My Word.</p>
      </fieldset>
    </SheetForm>
  );
}

/** The plans as a list: tap one and it's saved. */
function PlanChoice({ value, onSave, onDone }: { value: PlanKey; onSave: FormProps["onSave"]; onDone: () => void }) {
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-3 pt-1">
      <div role="radiogroup" aria-label="Read a chapter a day from" className="-mx-5 divide-y divide-border border-y border-border">
        {(Object.keys(PLANS) as PlanKey[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            disabled={busy !== null}
            onClick={async () => {
              if (k === value) return onDone();
              setBusy(k);
              setError(null);
              const err = await onSave({ biblePlan: k });
              setBusy(null);
              if (err) setError(err);
              else onDone();
            }}
            className="flex min-h-14 w-full items-center justify-between gap-3 px-5 text-left text-[17px] transition-colors active:bg-accent disabled:cursor-default"
          >
            {PLANS[k].label}
            {busy === k ? (
              <span className="text-[15px] text-muted-foreground">Saving…</span>
            ) : (
              value === k && <Check className="size-5 text-foreground" aria-hidden />
            )}
          </button>
        ))}
      </div>
      <p aria-live="polite" className={cn("text-[15px] text-destructive", !error && "sr-only")}>
        {error}
      </p>
      <p className="text-[14px] leading-snug text-muted-foreground">Today&apos;s chapter follows on from the last one you read.</p>
    </div>
  );
}
