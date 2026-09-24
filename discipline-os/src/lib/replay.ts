import { AREA_LABEL, isArea } from "./areas";
import { formatDuration } from "./day";
import { formatValue } from "./goals/format";

/**
 * The day's replay: everything already tracked with a time on it, in order. Ticks, work
 * sessions, finished tasks, business numbers, proof, the review and closing the day.
 * Nothing new is recorded for it.
 */

export type ReplayKind = "habit" | "work" | "task" | "counter" | "proof" | "review" | "minimum" | "close";

export interface ReplayEvent {
  at: string;
  /** Work sessions have an end. */
  end: string | null;
  kind: ReplayKind;
  title: string;
  detail: string | null;
  /** Ticked after the day was over. */
  later: boolean;
}

export interface ReplayRows {
  habits: Array<{ name: string; kind: string | null; completedAt: string; editedAt: string | null }>;
  sessions: Array<{ startedAt: string; endedAt: string | null; area: string | null; task: string | null; note: string | null }>;
  tasks: Array<{ title: string; completedAt: string }>;
  counters: Array<{ label: string; unit: string | null; value: number; updatedAt: string }>;
  proofs: Array<{ uploadedAt: string; label: string | null; topic: string }>;
  review: { updatedAt: string } | null;
  minimumAt: string | null;
  closedAt: string | null;
}

const HABIT_TITLE: Record<string, string> = { bible: "Bible", journal: "Journal", prayer: "Prayer", evening_prayer: "Evening prayer", gym: "Gym", cardio: "Cardio" };
const TOPIC: Record<string, string> = { faith: "Faith", gym: "Gym", imperium: "Imperium", websites: "Websites", work: "Work", other: "Proof" };

export function buildReplay(rows: ReplayRows, now: number): ReplayEvent[] {
  const out: ReplayEvent[] = [];
  for (const h of rows.habits) {
    out.push({ at: h.completedAt, end: null, kind: "habit", title: (h.kind && HABIT_TITLE[h.kind]) || h.name, detail: null, later: Boolean(h.editedAt) });
  }
  for (const s of rows.sessions) {
    const end = s.endedAt ?? new Date(now).toISOString();
    const minutes = Math.max(0, (new Date(end).getTime() - new Date(s.startedAt).getTime()) / 60000);
    const area = isArea(s.area) ? AREA_LABEL[s.area] : null;
    out.push({
      at: s.startedAt,
      end: s.endedAt,
      kind: "work",
      title: area && area !== "Other" ? `${area} work` : "Focused work",
      detail: [formatDuration(minutes), s.task, s.note].filter(Boolean).join(" · "),
      later: false,
    });
  }
  for (const t of rows.tasks) out.push({ at: t.completedAt, end: null, kind: "task", title: t.title, detail: "Task done", later: false });
  for (const c of rows.counters) {
    if (!(c.value > 0)) continue;
    out.push({ at: c.updatedAt, end: null, kind: "counter", title: `${c.label}: ${formatValue(c.value, c.unit === "$" ? "$" : null)}`, detail: null, later: false });
  }
  for (const p of rows.proofs) out.push({ at: p.uploadedAt, end: null, kind: "proof", title: "Proof photo", detail: p.label ?? TOPIC[p.topic] ?? null, later: false });
  if (rows.minimumAt) out.push({ at: rows.minimumAt, end: null, kind: "minimum", title: "Switched to minimum day", detail: null, later: false });
  if (rows.review) out.push({ at: rows.review.updatedAt, end: null, kind: "review", title: "Night review", detail: null, later: false });
  if (rows.closedAt) out.push({ at: rows.closedAt, end: null, kind: "close", title: "Day closed", detail: null, later: false });
  return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
