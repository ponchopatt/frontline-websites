"use client";

import { ArrowLeft, Check, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { setPasscode } from "@/app/actions/lock";
import { finishWelcome, type WelcomeInput } from "@/app/actions/welcome";
import { formatValue } from "@/lib/goals/format";
import { GOAL_TEMPLATES, suggestedTarget, type WelcomeGoalKey } from "@/lib/welcome";
import { cn } from "@/lib/utils";

export interface WelcomeDefaults {
  name: string;
  passcodeSet: boolean;
  /** Setup was done before: this is "Redo setup". */
  redo: boolean;
  today: string;
  thisYear: number;
  /** Goals already set for this year and next, with their area's key. */
  existingGoals: Array<{ title: string; year: number; area: string | null }>;
  /** What each counter-measured goal's counter already holds this year. */
  counterSoFar: Partial<Record<WelcomeGoalKey, number>>;
  workHours: number;
  workDays: number[];
  botHours: number;
  gymDays: number[];
  cardioMinutes: number;
  streakLine: number;
  weekly: { leads: number | null; calls: number | null; demos: number | null; reels: number | null; revenue: number | null };
}

type Step = "name" | "passcode" | "goals" | "why" | "daily" | "weekly" | "done";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface GoalDraft {
  key: WelcomeGoalKey;
  on: boolean;
  title: string;
  target: number | null;
  /** The title was typed by hand, so a new number doesn't rewrite it. */
  edited: boolean;
  /** The number was typed or stepped by hand, so a change of year keeps it. */
  targetEdited: boolean;
}

function draftsFor(year: number, today: string, soFar: WelcomeDefaults["counterSoFar"], prev?: GoalDraft[]): GoalDraft[] {
  return GOAL_TEMPLATES.map((t) => {
    const old = prev?.find((p) => p.key === t.key);
    const suggested = suggestedTarget(t, year, today, soFar[t.key]);
    if (!old) return { key: t.key, on: t.on, title: t.title(suggested), target: suggested, edited: false, targetEdited: false };
    const target = old.targetEdited ? old.target : suggested;
    return { ...old, target, title: old.edited ? old.title : t.title(target) };
  });
}

const areaOf = (key: WelcomeGoalKey) => GOAL_TEMPLATES.find((t) => t.key === key)!.area;

/**
 * First-run setup, one question a screen: what to call you, the passcode, what you want to
 * achieve this year, why, and the daily and weekly numbers. Nothing but the passcode is saved
 * until the end; "Skip the rest" keeps what's been answered and the defaults for the rest.
 */
export function WelcomeFlow({ defaults }: { defaults: WelcomeDefaults }) {
  const router = useRouter();
  // Decided once: saving the passcode refreshes the page, and the step mustn't vanish mid-setup.
  const [askPasscode] = useState(!defaults.passcodeSet);
  const steps: Step[] = ["name", ...(askPasscode ? (["passcode"] as Step[]) : []), "goals", "why", "daily", "weekly", "done"];
  const [step, setStep] = useState<Step>("name");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(defaults.name);
  const [pin, setPin] = useState("1906");
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [year, setYear] = useState(defaults.thisYear);
  const [goals, setGoals] = useState<GoalDraft[]>(() => draftsFor(defaults.thisYear, defaults.today, defaults.counterSoFar));
  const [becoming, setBecoming] = useState("");
  const [why, setWhy] = useState("");
  const [workHours, setWorkHours] = useState(defaults.workHours);
  const [workDays, setWorkDays] = useState<number[]>(defaults.workDays);
  const [botHours, setBotHours] = useState(defaults.botHours);
  const [gymDays, setGymDays] = useState<number[]>(defaults.gymDays);
  const [cardio, setCardio] = useState(defaults.cardioMinutes);
  const [streakLine, setStreakLine] = useState(defaults.streakLine);
  const [weekly, setWeekly] = useState(defaults.weekly);
  const [saved, setSaved] = useState<number>(0);

  const index = steps.indexOf(step);
  const next = () => setStep(steps[Math.min(steps.length - 1, index + 1)]);
  const back = () => setStep(steps[Math.max(0, index - 1)]);
  // An area that already has a goal for the chosen year is off here, so nothing is added twice.
  const taken = new Set(defaults.existingGoals.filter((g) => g.year === year).map((g) => g.area));

  async function savePasscode() {
    if (!/^[0-9]{4}$/.test(pin)) {
      toast.error("A passcode is four digits.");
      return;
    }
    // Back here after saving it: unchanged moves on, a new one replaces the one just saved.
    if (pin === savedPin) return next();
    setBusy(true);
    try {
      const res = await setPasscode({ pin, current: savedPin });
      if (!res.ok) toast.error(res.error);
      else {
        setSavedPin(pin);
        next();
      }
    } catch {
      toast.error("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function finish(skip: boolean) {
    if (!name.trim()) {
      setStep("name");
      toast.error("Tell us your name.");
      return;
    }
    setBusy(true);
    // Skipping keeps the steps already passed and sends the defaults for the rest. The targets
    // are saved once the day is answered; before that they keep what they are.
    const passed = (s: Step) => !skip || steps.indexOf(s) < index;
    const day = passed("daily");
    const input: WelcomeInput = {
      name: name.trim(),
      skip: !day,
      year,
      goals: passed("goals")
        ? goals
            .filter((g) => g.on && !taken.has(areaOf(g.key)))
            .map((g) => ({ key: g.key, title: g.title.trim() || GOAL_TEMPLATES.find((t) => t.key === g.key)!.title(g.target), target: g.target }))
        : [],
      becoming: passed("why") ? becoming : "",
      why: passed("why") ? why : "",
      workHours: day ? workHours : defaults.workHours,
      workDays: day ? workDays : defaults.workDays,
      botHours: day ? botHours : defaults.botHours,
      gymDays: day ? gymDays : defaults.gymDays,
      cardioMinutes: day ? cardio : defaults.cardioMinutes,
      streakLine: day ? streakLine : defaults.streakLine,
      weekly: passed("weekly") ? weekly : defaults.weekly,
    };
    try {
      const res = await finishWelcome(input);
      if (!res.ok) toast.error(res.error);
      else if (skip) {
        const n = res.data.goals;
        if (n > 0) toast.success(`${n} ${n === 1 ? "goal" : "goals"} saved for ${year}.`);
        router.replace("/");
        router.refresh();
      } else {
        setSaved(res.data.goals);
        setStep("done");
      }
    } catch {
      toast.error("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const skippable = step !== "name" && step !== "passcode" && step !== "done";
  const toggle = (list: number[], d: number) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort());

  return (
    <div className="grid min-h-[calc(100dvh-4rem)] grid-rows-[auto_1fr_auto] gap-6">
      <header className="flex items-center justify-between gap-3">
        {index > 0 && step !== "done" ? (
          <button type="button" onClick={back} aria-label="Back" className="grid size-11 place-items-center rounded-full border border-glass-edge bg-glass backdrop-blur-md">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        ) : (
          <span className="size-11" />
        )}
        <ol className="flex gap-1.5" aria-label={`Step ${index + 1} of ${steps.length}`}>
          {steps.map((s, i) => (
            <li key={s} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-foreground" : i < index ? "w-1.5 bg-foreground/70" : "w-1.5 bg-foreground/25")} />
          ))}
        </ol>
        {skippable ? (
          <button type="button" disabled={busy} onClick={() => void finish(true)} className="min-h-11 px-1 text-sm text-muted-foreground hover:text-foreground">
            Skip the rest
          </button>
        ) : (
          <span className="size-11" />
        )}
      </header>

      <section aria-live="polite" className="grid content-start gap-6">
        {step === "name" && (
          <>
            <Title small={defaults.redo ? "Redo setup" : "Welcome to Discipline OS"} big="What should we call you?" />
            <label className="grid gap-2">
              <span className="text-sm text-muted-foreground">Your first name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoComplete="given-name"
                className="h-14 rounded-2xl border border-glass-edge bg-glass px-4 text-[22px] backdrop-blur-md outline-none focus-visible:border-foreground/60"
              />
            </label>
          </>
        )}

        {step === "passcode" && (
          <>
            <Title small="Your passcode" big="Four digits to open the app." />
            <label className="grid gap-2">
              <span className="text-sm text-muted-foreground">Passcode</span>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                className="h-16 w-full min-w-0 rounded-2xl border border-glass-edge bg-glass px-4 text-center text-[34px] tracking-[0.6em] backdrop-blur-md outline-none focus-visible:border-foreground/60"
              />
            </label>
            <p className="text-[15px] text-muted-foreground">You&apos;ll enter it each time you open the app. Change it any time in Settings.</p>
          </>
        )}

        {step === "goals" && (
          <>
            <Title small="Your year" big="What do you want to achieve?" />
            <div role="radiogroup" aria-label="Year" className="grid grid-cols-2 gap-2">
              {[defaults.thisYear, defaults.thisYear + 1].map((y) => (
                <button
                  key={y}
                  type="button"
                  role="radio"
                  aria-checked={year === y}
                  onClick={() => {
                    setYear(y);
                    setGoals((g) => draftsFor(y, defaults.today, defaults.counterSoFar, g));
                  }}
                  className={cn("h-12 rounded-full border text-[15px] transition-colors", year === y ? "border-primary bg-primary text-primary-foreground" : "border-glass-edge bg-glass")}
                >
                  {y === defaults.thisYear ? `This year (${y})` : `Next year (${y})`}
                </button>
              ))}
            </div>
            {defaults.existingGoals.some((g) => g.year === year) && (
              <p className="text-sm text-muted-foreground">
                Already set for {year}: {defaults.existingGoals.filter((g) => g.year === year).map((g) => g.title).join("; ")}. Areas with a goal are switched off here.
              </p>
            )}
            <ul className="grid gap-3">
              {goals.map((g) => {
                const t = GOAL_TEMPLATES.find((x) => x.key === g.key)!;
                const set = (patch: Partial<GoalDraft>) => setGoals((list) => list.map((x) => (x.key === g.key ? { ...x, ...patch } : x)));
                const blocked = taken.has(t.area);
                const on = g.on && !blocked;
                const soFar = year === defaults.thisYear ? (defaults.counterSoFar[g.key] ?? 0) : 0;
                return (
                  <li key={g.key} className={cn("surface grid gap-3 rounded-[24px] border p-4 transition-opacity", !on && "opacity-70")}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">{t.label}</span>
                      {/* A 44px tap area around the 32px track. */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`${t.label} goal`}
                        disabled={blocked}
                        onClick={() => set({ on: !g.on })}
                        className="-my-1.5 grid h-11 w-14 shrink-0 place-items-center"
                      >
                        <span aria-hidden className={cn("relative h-8 w-14 rounded-full transition-colors", on ? "bg-primary" : "bg-foreground/15")}>
                          <span className={cn("absolute top-1 size-6 rounded-full bg-background shadow transition-[left]", on ? "left-7" : "left-1")} />
                        </span>
                      </button>
                    </div>
                    {on && (
                      <>
                        <label className="grid gap-1">
                          <span className="sr-only">{t.label} goal</span>
                          <input
                            value={g.title}
                            onChange={(e) => set({ title: e.target.value, edited: true })}
                            maxLength={140}
                            className="min-h-12 rounded-xl border border-border bg-transparent px-3 text-[17px] outline-none focus-visible:border-foreground/50"
                          />
                        </label>
                        {g.target !== null && (
                          <NumberField
                            label={t.unit === "$" ? "Target ($)" : t.unit === "%" ? "Target (%)" : `Target (${t.unit})`}
                            value={g.target}
                            step={t.unit === "$" ? 5000 : t.unit === "%" ? 5 : t.target !== null && t.target >= 100 ? 10 : 1}
                            max={t.unit === "%" ? 100 : 100_000_000}
                            onChange={(v) => set({ target: v, targetEdited: true, ...(g.edited ? {} : { title: t.title(v) }) })}
                          />
                        )}
                        {soFar > 0 && <p className="text-sm text-muted-foreground">Counts the {formatValue(soFar, t.unit)} already logged this year.</p>}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {step === "why" && (
          <>
            <Title small="Your why" big="Who are you becoming, and why?" />
            <Area label="Who am I becoming?" value={becoming} onChange={setBecoming} placeholder="A man who keeps his word, builds two businesses and puts God first." />
            <Area label="Why does it matter?" value={why} onChange={setWhy} placeholder="For my family, my future, and to prove to myself I can do it." />
            <p className="text-[15px] text-muted-foreground">It shows on your Goals page, next to every goal.</p>
          </>
        )}

        {step === "daily" && (
          <>
            <Title small="Your days" big="What does a good day look like?" />
            <div className="surface grid gap-4 rounded-[24px] border p-4">
              <NumberField label="Hours of focused work a day" value={workHours} step={1} max={16} onChange={setWorkHours} />
              <DayChips label="Work days" value={workDays} onToggle={(d) => setWorkDays((l) => toggle(l, d))} />
              <NumberField label="Hours a day on the AI bot" value={botHours} step={0.5} max={16} onChange={setBotHours} />
            </div>
            <div className="surface grid gap-4 rounded-[24px] border p-4">
              <DayChips label="Gym days" value={gymDays} onToggle={(d) => setGymDays((l) => toggle(l, d))} />
              <NumberField label="Cardio minutes a day" value={cardio} step={5} max={240} onChange={(v) => setCardio(Math.round(v))} />
              <NumberField label="Keep My Word streak line (%)" value={streakLine} step={5} max={100} min={10} onChange={(v) => setStreakLine(Math.round(v))} />
            </div>
          </>
        )}

        {step === "weekly" && (
          <>
            <Title small="Your week" big="What numbers will you hit each week?" />
            <div className="surface grid gap-4 rounded-[24px] border p-4">
              <NumberField label="Imperium leads called" value={weekly.leads ?? 0} step={5} max={10000} onChange={(v) => setWeekly((w) => ({ ...w, leads: v }))} />
              <NumberField label="Imperium reels posted" value={weekly.reels ?? 0} step={1} max={1000} onChange={(v) => setWeekly((w) => ({ ...w, reels: v }))} />
              <NumberField label="Imperium revenue ($)" value={weekly.revenue ?? 0} step={500} max={10_000_000} onChange={(v) => setWeekly((w) => ({ ...w, revenue: v }))} />
            </div>
            <div className="surface grid gap-4 rounded-[24px] border p-4">
              <NumberField label="Website cold calls" value={weekly.calls ?? 0} step={10} max={10000} onChange={(v) => setWeekly((w) => ({ ...w, calls: v }))} />
              <NumberField label="Website demos built" value={weekly.demos ?? 0} step={1} max={1000} onChange={(v) => setWeekly((w) => ({ ...w, demos: v }))} />
            </div>
            <p className="text-[15px] text-muted-foreground">Today splits these into a target for each work day.</p>
          </>
        )}

        {step === "done" && (
          <>
            <Title small="All set" big={`You're set, ${name.trim() || "friend"}.`} />
            <ul className="surface grid gap-2.5 rounded-[24px] border p-4 text-[16px]">
              {[
                saved > 0 ? `${saved} ${saved === 1 ? "goal" : "goals"} for ${year}` : null,
                `${formatValue(workHours, null)}h of focused work on ${workDays.map((d) => DAYS[d - 1]).join(", ")}`,
                weekly.leads ? `${weekly.leads} leads and ${weekly.calls ?? 0} website calls a week` : null,
                `Keep My Word streak line at ${streakLine}%`,
                "Passcode on",
              ]
                .filter(Boolean)
                .map((line) => (
                  <li key={line} className="flex items-center gap-2.5">
                    <span aria-hidden className="grid size-5 place-items-center rounded-full bg-kept-soft text-kept">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {line}
                  </li>
                ))}
            </ul>
            <p className="text-[15px] text-muted-foreground">Next: break each goal into months and weeks, so Today always knows what matters.</p>
          </>
        )}
      </section>

      <footer className="sticky bottom-0 grid gap-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {step === "passcode" ? (
          <Primary busy={busy} onClick={() => void savePasscode()}>
            Set passcode
          </Primary>
        ) : step === "weekly" ? (
          <Primary busy={busy} onClick={() => void finish(false)}>
            Finish setup
          </Primary>
        ) : step === "done" ? (
          <>
            <Primary
              busy={false}
              onClick={() => {
                router.replace("/");
                router.refresh();
              }}
            >
              Go to Today
            </Primary>
            <Link href="/goals" className="inline-flex h-12 items-center justify-center rounded-full border border-glass-edge bg-glass text-[15px] backdrop-blur-md">
              Break my goals into months
            </Link>
          </>
        ) : (
          <Primary busy={busy} onClick={next} disabled={(step === "name" && !name.trim()) || (step === "daily" && (workDays.length === 0 || gymDays.length === 0))}>
            Next
          </Primary>
        )}
      </footer>
    </div>
  );
}

function Title({ small, big }: { small: string; big: string }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-[15px] text-muted-foreground">{small}</p>
      <h1 className="text-[clamp(34px,9.5vw,46px)] leading-[1.04] font-light tracking-[-0.035em]">{big}</h1>
    </div>
  );
}

function Primary({ children, onClick, busy, disabled }: { children: React.ReactNode; onClick: () => void; busy: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="h-14 rounded-full bg-primary text-[16px] font-medium text-primary-foreground shadow-[0_14px_30px_-18px_rgb(0_0_0/0.6)] transition-opacity disabled:opacity-60"
    >
      {busy ? "Saving…" : children}
    </button>
  );
}

function Area({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={2000}
        className="rounded-2xl border border-glass-edge bg-glass px-4 py-3 text-[16px] leading-snug backdrop-blur-md outline-none placeholder:text-faint focus-visible:border-foreground/60"
      />
    </label>
  );
}

/**
 * A number with − and +, and typeable. Changes land straight away; the typed text stays as
 * typed ("1." on the way to 1.5) until the field is left, then shows the number kept.
 */
function NumberField({ label, value, onChange, step, max, min = 0 }: { label: string; value: number; onChange: (v: number) => void; step: number; max: number; min?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  const move = (n: number) => {
    setDraft(null);
    onChange(clamp(n));
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px]">{label}</span>
      <div className="flex shrink-0 items-center rounded-full border border-border">
        <button type="button" aria-label={`${label}: less`} onClick={() => move(value - step)} className="grid size-11 place-items-center rounded-full text-muted-foreground">
          <Minus className="size-4" aria-hidden />
        </button>
        <input
          aria-label={label}
          inputMode="decimal"
          value={draft ?? (Number.isFinite(value) ? String(value) : "")}
          onChange={(e) => {
            const text = e.target.value.replace(/[^0-9.]/g, "");
            setDraft(text);
            const n = Number(text);
            if (text !== "" && Number.isFinite(n)) onChange(clamp(n));
          }}
          onBlur={() => setDraft(null)}
          className="h-11 w-20 bg-transparent text-center text-[17px] font-medium tabular-nums outline-none"
        />
        <button type="button" aria-label={`${label}: more`} onClick={() => move(value + step)} className="grid size-11 place-items-center rounded-full text-muted-foreground">
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function DayChips({ label, value, onToggle }: { label: string; value: number[]; onToggle: (d: number) => void }) {
  return (
    <div className="grid gap-2">
      <span className="text-[15px]">{label}</span>
      <div role="group" aria-label={label} className="grid grid-cols-7 gap-1">
        {DAYS.map((d, i) => {
          const on = value.includes(i + 1);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={`${label}: ${d}`}
              onClick={() => onToggle(i + 1)}
              className={cn("h-11 rounded-full border text-[13px] transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}
            >
              {d.slice(0, 2)}
            </button>
          );
        })}
      </div>
      {value.length === 0 && <p className="text-sm text-muted-foreground">Pick at least one day.</p>}
    </div>
  );
}
