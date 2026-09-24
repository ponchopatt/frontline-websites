import { Timer } from "lucide-react";
import type { Metadata } from "next";
import { Group, PageHeader, Ring, Row } from "@/components/os";
import { fetchAll, getViewer, requestTime } from "@/lib/data";
import { addDays, clockTime, dateRange, formatHours, shortDate, startOfWeek, weekdayName, type LocalDate } from "@/lib/day";

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

/** Work: the week's hours day by day, today's blocks, and what each session got done. */
export default async function WorkPage() {
  const viewer = await getViewer();
  const { supabase, today, profile } = viewer;
  const weekStart = startOfWeek(today);
  const now = requestTime();

  const [blocks, sessions] = await Promise.all([
    fetchAll<Block>((from, to) =>
      supabase.from("work_blocks").select("id,local_date,task,planned_start,planned_end").gte("local_date", weekStart).order("planned_start").order("id").range(from, to),
    ),
    fetchAll<Session>((from, to) =>
      supabase.from("work_sessions").select("*").gte("local_date", weekStart).order("started_at").order("id").range(from, to),
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
  const notes = sessions.filter((s) => s.accomplishment_note).reverse();

  const figures = [
    { label: "Today", value: formatHours(t.actual), unit: `of ${profile.workTargetHours}h` },
    { label: "Planned today", value: formatHours(t.planned), unit: "" },
    { label: "Blocks done", value: `${loggedBlockIds.size}/${todayBlocks.length}`, unit: "" },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader back={{ href: "/you", label: "You" }} title="Work" subtitle="Where the hours went this week. The timer lives on Today." />

      <dl className="grid grid-cols-3 gap-3">
        {figures.map((f) => (
          <div key={f.label} className="grid gap-0.5">
            <dt className="text-[14px] text-muted-foreground">{f.label}</dt>
            <dd className="text-[30px] leading-none font-light tracking-tight tabular-nums">
              {f.value}
              {f.unit && <span className="ml-1 text-[15px] text-muted-foreground">{f.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <Group
        id="week"
        title="This week"
        action={
          <span className="text-[15px] text-muted-foreground">
            {formatHours(week.actual)} done · {formatHours(week.planned)} planned
          </span>
        }
        footer={target > 0 ? `The ring fills at your ${profile.workTargetHours}h target.` : undefined}
      >
        {[...perDay].reverse().map((d) => (
          <Row
            key={d.date}
            title={d.date === today ? "Today" : d.date === addDays(today, -1) ? "Yesterday" : weekdayName(d.date)}
            subtitle={d.planned > 0 ? `${formatHours(d.planned)} planned` : "Nothing planned"}
            value={formatHours(d.actual)}
            trailing={target > 0 ? <Ring value={d.actual / target} size={26} /> : undefined}
          />
        ))}
      </Group>

      <Group id="blocks" title="Today's blocks" action={<span className="text-[15px] text-muted-foreground">{todayBlocks.length} planned</span>}>
        {todayBlocks.length === 0 ? (
          <p className="px-4 py-4 text-[15px] text-muted-foreground">No blocks planned today.</p>
        ) : (
          todayBlocks.map((b) => {
            const logged = todaySessions.filter((s) => s.work_block_id === b.id).reduce((m, s) => m + sessionMinutes(s, now), 0);
            const planned = plannedMinutes(b);
            return (
              <Row
                key={b.id}
                title={b.task}
                subtitle={`${b.planned_start && b.planned_end ? `${b.planned_start.slice(0, 5)}–${b.planned_end.slice(0, 5)}` : "Any time"}${planned > 0 ? ` · ${formatHours(planned)} planned` : ""}`}
                value={<span className={logged > 0 ? "text-foreground" : undefined}>{formatHours(logged)}</span>}
              />
            );
          })
        )}
        <Row href="/#work" leading={<Timer className="size-[22px]" aria-hidden />} title="Start or plan blocks on Today" />
      </Group>

      <Group id="notes" title="Session notes" action={<span className="text-[15px] text-muted-foreground">This week</span>}>
        {notes.length === 0 ? (
          <p className="px-4 py-4 text-[15px] leading-snug text-muted-foreground">When you stop the timer, what you accomplished is kept here.</p>
        ) : (
          notes.map((s) => (
            <div key={s.id} className="grid min-h-14 gap-0.5 px-4 py-3">
              <span className="text-[14px] text-muted-foreground">
                {s.local_date === today ? "Today" : s.local_date === addDays(today, -1) ? "Yesterday" : shortDate(s.local_date)}, {clockTime(s.started_at, profile.timezone)} ·{" "}
                {formatHours(sessionMinutes(s, now))}
              </span>
              <span className="text-[17px] leading-snug break-words">{s.accomplishment_note}</span>
            </div>
          ))
        )}
      </Group>
    </div>
  );
}
