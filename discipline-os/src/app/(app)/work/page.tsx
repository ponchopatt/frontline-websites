import type { Metadata } from "next";
import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { Stat, StatStrip } from "@/components/stat-strip";
import { fetchAll, getViewer, requestTime } from "@/lib/data";
import { addDays, clockTime, dateRange, formatHours, shortDate, startOfWeek, weekdayName, type LocalDate } from "@/lib/day";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Work" };

interface Block {
  id: string;
  local_date: string;
  task: string;
  planned_start: string | null;
  planned_end: string | null;
}
interface Session {
  id: string;
  local_date: string;
  work_block_id: string | null;
  started_at: string;
  ended_at: string | null;
  accomplishment_note: string | null;
}

function plannedMinutes(b: Block): number {
  if (!b.planned_start || !b.planned_end) return 0;
  const [sh, sm] = b.planned_start.split(":").map(Number);
  const [eh, em] = b.planned_end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function sessionMinutes(s: Session, now: number): number {
  const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
  return Math.max(0, (end - new Date(s.started_at).getTime()) / 60000);
}

export default async function WorkPage() {
  const viewer = await getViewer();
  const { supabase, today, profile } = viewer;
  const weekStart = startOfWeek(today);
  const now = requestTime();

  const [blocks, sessions] = await Promise.all([
    fetchAll<Block>((from, to) =>
      supabase.from("work_blocks").select("id,local_date,task,planned_start,planned_end").gte("local_date", weekStart).order("planned_start").range(from, to),
    ),
    fetchAll<Session>((from, to) =>
      supabase.from("work_sessions").select("*").gte("local_date", weekStart).order("started_at").range(from, to),
    ),
  ]);

  const days: LocalDate[] = dateRange(weekStart, today);
  const perDay = days.map((d) => {
    const dayBlocks = blocks.filter((b) => b.local_date === d);
    const daySessions = sessions.filter((s) => s.local_date === d);
    return {
      date: d,
      planned: dayBlocks.reduce((m, b) => m + plannedMinutes(b), 0),
      actual: daySessions.reduce((m, s) => m + sessionMinutes(s, now), 0),
    };
  });
  const todayBlocks = blocks.filter((b) => b.local_date === today);
  const todaySessions = sessions.filter((s) => s.local_date === today);
  const loggedBlockIds = new Set(todaySessions.filter((s) => s.ended_at && s.work_block_id).map((s) => s.work_block_id));
  const t = perDay[perDay.length - 1];
  const week = perDay.reduce((acc, d) => ({ planned: acc.planned + d.planned, actual: acc.actual + d.actual }), { planned: 0, actual: 0 });
  const target = profile.workTargetHours * 60;
  const scale = Math.max(target, ...perDay.map((d) => Math.max(d.planned, d.actual)), 60);
  const notes = sessions.filter((s) => s.accomplishment_note).reverse();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <header className="grid gap-6">
        <h1 className="text-[34px] leading-tight font-medium tracking-tight">Work</h1>
        <StatStrip>
          <Stat label="Today" value={formatHours(t.actual)} unit={`of ${profile.workTargetHours}h`} />
          <Stat label="Planned today" value={formatHours(t.planned)} />
          <Stat label="Blocks done" value={`${loggedBlockIds.size}/${todayBlocks.length}`} />
        </StatStrip>
        <Link href="/#work" className="-mt-2 inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">
          Start or plan blocks on Today
        </Link>
      </header>

      <SectionCard
        title="This week"
        meta={
          <span>
            <span className="text-foreground">{formatHours(week.actual)}</span> done · {formatHours(week.planned)} planned
          </span>
        }
      >
        <ul className="grid gap-3" aria-label="Hours by day, planned and done">
          {perDay.map((d) => (
            <li key={d.date} className="grid grid-cols-[3.25rem_1fr_3.5rem] items-center gap-3 text-sm">
              <span className={cn(d.date === today ? "text-foreground" : "text-muted-foreground")}>{weekdayName(d.date).slice(0, 3)}</span>
              <span className="relative grid h-5 gap-1" aria-label={`${shortDate(d.date)}: ${formatHours(d.actual)} done of ${formatHours(d.planned)} planned`}>
                <span className="h-1.5 rounded-full bg-muted-foreground/30" style={{ width: `${(d.planned / scale) * 100}%` }} />
                <span className="h-1.5 rounded-full bg-primary" style={{ width: `${(d.actual / scale) * 100}%` }} />
                <span
                  aria-hidden
                  className="absolute inset-y-0 border-l border-dashed border-muted-foreground/50"
                  style={{ left: `${(target / scale) * 100}%` }}
                />
              </span>
              <span className="text-right">{formatHours(d.actual)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-muted-foreground/30" aria-hidden /> Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-primary" aria-hidden /> Done
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 border-l border-dashed border-muted-foreground/60" aria-hidden /> Target {profile.workTargetHours}h
          </span>
        </p>
      </SectionCard>

      <SectionCard title="Today's blocks" meta={`${todayBlocks.length} planned`}>
        {todayBlocks.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">No blocks planned today. Plan them on Today, where the timer is.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {todayBlocks.map((b) => {
              const logged = todaySessions.filter((s) => s.work_block_id === b.id).reduce((m, s) => m + sessionMinutes(s, now), 0);
              return (
                <li key={b.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-[17px]">{b.task}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.planned_start && b.planned_end ? `${b.planned_start.slice(0, 5)}–${b.planned_end.slice(0, 5)}` : "Any time"}
                      {plannedMinutes(b) > 0 && ` · ${formatHours(plannedMinutes(b))} planned`}
                    </p>
                  </div>
                  <span className={cn("text-[15px]", logged > 0 ? "text-foreground" : "text-faint")}>{formatHours(logged)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Session notes" meta="This week">
        {notes.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">When you stop the timer, what you accomplished is kept here.</p>
        ) : (
          <ol className="grid gap-4">
            {notes.map((s) => (
              <li key={s.id} className="grid gap-0.5 border-l border-primary/50 pl-3">
                <span className="text-sm text-muted-foreground">
                  {s.local_date === today ? "Today" : s.local_date === addDays(today, -1) ? "Yesterday" : shortDate(s.local_date)},{" "}
                  {clockTime(s.started_at, profile.timezone)} · {formatHours(sessionMinutes(s, now))}
                </span>
                <span className="text-[16px]">{s.accomplishment_note}</span>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}

