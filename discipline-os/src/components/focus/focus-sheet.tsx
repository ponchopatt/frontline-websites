"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getWeekFocus, saveWeekFocus } from "@/app/actions/focus";
import { PrimaryButton, TextAction } from "@/components/os";
import { Sheet } from "@/components/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/stepper";
import { AREA_SHORT } from "@/lib/areas";
import { addDays, shortDate, weekdayName, type LocalDate } from "@/lib/day";
import { FOCUS_AREAS, weekLine, type FocusArea, type FocusDay, type FocusSuggestion, type KeepAlive } from "@/lib/focus";
import { reloadIfStale } from "@/lib/stale";
import { cn } from "@/lib/utils";

const WHAT: Record<FocusArea, string> = {
  imperium: "Detailing: leads, bookings, content",
  websites: "Demos, calls and client builds",
  trading: "The AI bot's next milestone",
};

interface FocusSheetProps {
  open: boolean;
  onClose: () => void;
  weekStart: LocalDate;
}

/**
 * Picks the week's focus: one business for the whole week, or day by day, and how many minutes
 * the others get to stay alive. Loads what's saved (and a suggestion) when it opens.
 */
export function FocusSheet({ open, onClose, weekStart }: FocusSheetProps) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ days: FocusDay[]; keepAlive: KeepAlive; suggestion: FocusSuggestion } | null>(null);
  const [days, setDays] = useState<FocusDay[]>([]);
  const [keepAlive, setKeepAlive] = useState<KeepAlive | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    getWeekFocus({ weekStart })
      .then((res) => {
        if (!live) return;
        if (!res.ok) return void toast.error(res.error);
        setLoaded(res.data);
        setDays(res.data.days);
        setKeepAlive(res.data.keepAlive);
      })
      .catch((e) => {
        if (live && !reloadIfStale(e)) toast.error("Your focus couldn't be loaded. Check your connection and try again.");
      });
    return () => {
      live = false;
    };
  }, [open, weekStart]);

  const whole = days.length === 7 && days.every((d) => d.area && d.area === days[0].area) ? days[0].area : null;
  const setAll = (area: FocusArea | null) => setDays((list) => list.map((d) => ({ ...d, area })));
  const setDay = (date: LocalDate, area: FocusArea | null) => setDays((list) => list.map((d) => (d.date === date ? { ...d, area } : d)));

  async function save() {
    if (!keepAlive) return;
    setBusy(true);
    try {
      const res = await saveWeekFocus({ weekStart, days, keepAlive });
      if (!res.ok) return void toast.error(res.error);
      const line = weekLine(days);
      toast.success(line ? `Focus saved: ${line}.` : "Focus cleared for the week.");
      router.refresh();
      onClose();
    } catch (e) {
      if (!reloadIfStale(e)) toast.error("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Focus for the week" subtitle={`${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 6))}`}>
      {!loaded || !keepAlive ? (
        <div className="grid gap-3 pt-2" aria-busy="true" aria-label="Loading your focus">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-40 w-full rounded-[22px]" />
          <Skeleton className="h-64 w-full rounded-[22px]" />
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 pt-1">
          <p className="text-[15px] leading-snug text-muted-foreground">
            One business gets the deep work. The other two get a short keep-alive each day, so nothing goes cold while it waits.
          </p>

          <section aria-labelledby="focus-whole" className="grid gap-2">
            <h3 id="focus-whole" className="px-1 text-[15px] font-medium text-muted-foreground">
              The whole week
            </h3>
            <div role="radiogroup" aria-labelledby="focus-whole" className="surface-light divide-y divide-border overflow-hidden rounded-[22px] border">
              {FOCUS_AREAS.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={whole === a}
                  onClick={() => setAll(a)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 active:bg-accent"
                >
                  <span
                    aria-hidden
                    className={cn("grid size-6 shrink-0 place-items-center rounded-full border-[1.5px]", whole === a ? "border-primary" : "border-input")}
                  >
                    {whole === a && <span className="size-3 rounded-full bg-primary" />}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-[17px]">{AREA_SHORT[a]}</span>
                    <span className="text-[14px] text-muted-foreground">{WHAT[a]}</span>
                  </span>
                  {loaded.suggestion.area === a && <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[13px] text-muted-foreground">Suggested</span>}
                </button>
              ))}
            </div>
            <p className="px-1 text-[13px] leading-snug text-muted-foreground">{loaded.suggestion.why}</p>
          </section>

          <section aria-labelledby="focus-days" className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h3 id="focus-days" className="text-[15px] font-medium text-muted-foreground">
                Or day by day
              </h3>
              <TextAction onClick={() => setAll(null)}>Clear</TextAction>
            </div>
            <div className="surface-light divide-y divide-border overflow-hidden rounded-[22px] border">
              {days.map((d) => (
                <div key={d.date} role="radiogroup" aria-label={`${weekdayName(d.date)} focus`} className="flex items-center gap-1.5 py-1.5 pr-1.5 pl-4">
                  <span className="w-10 shrink-0 text-[15px]">{weekdayName(d.date).slice(0, 3)}</span>
                  <div className="grid flex-1 grid-cols-[1fr_1fr_1fr_2.75rem] gap-1">
                    {[...FOCUS_AREAS, null].map((a) => (
                      <button
                        key={a ?? "none"}
                        type="button"
                        role="radio"
                        aria-checked={d.area === a}
                        aria-label={a ? AREA_SHORT[a] : "No focus"}
                        onClick={() => setDay(d.date, a)}
                        className={cn(
                          "min-h-11 truncate rounded-xl text-[13px] transition-colors duration-150",
                          d.area === a ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground active:bg-accent",
                        )}
                      >
                        {a ? AREA_SHORT[a] : "–"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="px-1 text-[13px] leading-snug text-muted-foreground">Split it when one needs a few days: Imperium Monday to Wednesday, Websites after.</p>
          </section>

          <section aria-labelledby="focus-keep" className="grid gap-2">
            <h3 id="focus-keep" className="px-1 text-[15px] font-medium text-muted-foreground">
              Keep alive
            </h3>
            <div className="surface-light divide-y divide-border overflow-hidden rounded-[22px] border">
              {FOCUS_AREAS.map((a) => (
                <div key={a} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                  <span className="grid gap-0.5">
                    <span className="text-[17px]">{AREA_SHORT[a]}</span>
                    <span className="text-[14px] text-muted-foreground">{keepAlive[a] > 0 ? `${keepAlive[a]} min a day` : "Left alone"}</span>
                  </span>
                  <Stepper
                    label={`${AREA_SHORT[a]} keep-alive minutes`}
                    value={keepAlive[a]}
                    step={5}
                    delay={0}
                    onCommit={(v) => setKeepAlive((k) => (k ? { ...k, [a]: Math.max(0, Math.min(240, Math.round(v))) } : k))}
                  />
                </div>
              ))}
            </div>
            <p className="px-1 text-[13px] leading-snug text-muted-foreground">Minutes a day each gets when it isn&apos;t the focus. 0 leaves it alone.</p>
          </section>

          <PrimaryButton disabled={busy} onClick={() => void save()} className="w-full">
            {busy ? "Saving…" : "Save focus"}
          </PrimaryButton>
        </div>
      )}
    </Sheet>
  );
}
