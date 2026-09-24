import { BookOpen, Camera, CheckCircle2, Hash, Lock, MoonStar, ShieldCheck, Timer } from "lucide-react";
import { clockTime } from "@/lib/day";
import type { ReplayEvent, ReplayKind } from "@/lib/replay";
import { cn } from "@/lib/utils";

const ICON: Record<ReplayKind, typeof Timer> = {
  habit: CheckCircle2,
  work: Timer,
  task: CheckCircle2,
  counter: Hash,
  proof: Camera,
  review: MoonStar,
  minimum: ShieldCheck,
  close: Lock,
};

/** The day, in order: a time down the left, what happened on the right. */
export function ReplayList({ events, timeZone, className }: { events: ReplayEvent[]; timeZone: string; className?: string }) {
  if (events.length === 0) {
    return <p className={cn("text-[15px] text-muted-foreground", className)}>Nothing was tracked with a time on this day.</p>;
  }
  return (
    <ol className={cn("relative grid", className)} aria-label="The day, in order">
      <span aria-hidden className="absolute top-3 bottom-3 left-[4.35rem] w-px bg-border" />
      {events.map((e, i) => {
        const Icon = e.kind === "habit" && /bible|journal/i.test(e.title) ? BookOpen : ICON[e.kind];
        const strong = e.kind === "work" || e.kind === "close";
        return (
          <li key={`${e.at}-${i}`} className="relative grid grid-cols-[3.6rem_1.5rem_minmax(0,1fr)] items-start gap-x-2 py-1.5">
            <span className="pt-0.5 text-right text-[13px] text-muted-foreground tabular-nums">
              {clockTime(e.at, timeZone)}
              {e.end && <span className="block text-faint">{clockTime(e.end, timeZone)}</span>}
            </span>
            <span aria-hidden className={cn("relative z-10 mt-0.5 grid size-6 place-items-center rounded-full bg-background", e.kind === "close" ? "text-kept" : "text-muted-foreground")}>
              <Icon className="size-3.5" />
            </span>
            <span className="grid min-w-0 leading-snug">
              <span className={cn("text-[15px]", strong && "font-medium")}>
                {e.title}
                {e.later && <span className="ml-2 text-[13px] text-muted-foreground">added later</span>}
              </span>
              {e.detail && <span className="text-[13px] break-words text-muted-foreground">{e.detail}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
