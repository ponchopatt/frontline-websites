import "server-only";
import { cache } from "react";
import { fetchAll, firstDayOf, loadSummaries, requestTime, type Viewer } from "./data";
import { localDateAt, type LocalDate } from "./day";
import type { HistoryFacts } from "./history";
import { buildReplay, type ReplayEvent } from "./replay";
import type { HabitCategory, HabitKind } from "./types";

/** Everything the progress numbers are worked out from, since the account started. */
export const loadFacts = cache(async (viewer: Viewer): Promise<HistoryFacts> => {
  const { supabase, profile, today } = viewer;
  const first = firstDayOf(viewer);
  const [days, habitsRes, ticks, countersRes, entries] = await Promise.all([
    loadSummaries(supabase, first, today),
    supabase.from("habits").select("id,name,category,kind,days,created_at,archived_at"),
    // Ordered by a unique key, so no page overlaps or skips another.
    fetchAll<{ habit_id: string; local_date: string }>((a, b) =>
      supabase
        .from("habit_completions")
        .select("habit_id,local_date", { count: "exact" })
        .gte("local_date", first)
        .order("local_date")
        .order("habit_id")
        .range(a, b),
    ),
    supabase.from("metrics").select("id,area,key,unit"),
    fetchAll<{ metric_id: string; local_date: string; value: number }>((a, b) =>
      supabase
        .from("metric_entries")
        .select("metric_id,local_date,value", { count: "exact" })
        .gte("local_date", first)
        .gt("value", 0)
        .order("local_date")
        .order("metric_id")
        .range(a, b),
    ),
  ]);
  if (habitsRes.error) throw new Error(`Your history couldn't be loaded: ${habitsRes.error.message}`);
  if (countersRes.error) throw new Error(`Your history couldn't be loaded: ${countersRes.error.message}`);
  const local = (at: string) => localDateAt(new Date(at), profile.timezone, profile.dayStartHour);
  return {
    today,
    firstDay: first,
    threshold: profile.streakThreshold,
    workTargetMinutes: profile.workTargetHours * 60,
    workDays: profile.workDays,
    days,
    habits: (habitsRes.data ?? []).map((h) => ({
      id: h.id,
      name: h.name,
      category: h.category as HabitCategory,
      kind: (h.kind as HabitKind | null) ?? null,
      days: h.days,
      from: local(h.created_at),
      to: h.archived_at ? local(h.archived_at) : null,
    })),
    ticks: ticks.map((t) => ({ habitId: t.habit_id, date: t.local_date })),
    counters: (countersRes.data ?? []).map((c) => ({ id: c.id, area: c.area, key: c.key, unit: c.unit })),
    entries: entries.map((e) => ({ metricId: e.metric_id, date: e.local_date, value: Number(e.value) })),
  };
});

/** The day's replay, from what was tracked through it. */
export async function loadReplay(viewer: Viewer, date: LocalDate): Promise<ReplayEvent[]> {
  const { supabase } = viewer;
  const [ticks, sessions, tasks, entries, proofs, review, plan] = await Promise.all([
    supabase.from("habit_completions").select("completed_at,edited_at,habits(name,kind)").eq("local_date", date),
    supabase.from("work_sessions").select("started_at,ended_at,area,accomplishment_note,work_blocks(task)").eq("local_date", date),
    supabase.from("daily_goals").select("title,completed_at").eq("local_date", date).eq("status", "done").not("completed_at", "is", null),
    supabase.from("metric_entries").select("value,updated_at,metrics(label,unit)").eq("local_date", date),
    supabase.from("proof_uploads").select("uploaded_at,note,topic").eq("local_date", date),
    supabase.from("daily_reviews").select("*").eq("local_date", date).maybeSingle(),
    supabase.from("daily_plans").select("completed_at,minimum_at").eq("local_date", date).maybeSingle(),
  ]);
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const r = review.data;
  const reviewDone = Boolean(r && [r.accomplished, r.wasted_time_on, r.broke_word_where, r.tomorrow_priority].every((x) => x?.trim()));
  return buildReplay(
    {
      habits: (ticks.data ?? []).map((t) => {
        const h = one(t.habits as unknown as { name: string; kind: string | null } | null);
        // A tick made on another day (filled in later) is marked as such.
        const otherDay = localDateAt(new Date(t.completed_at), viewer.profile.timezone, viewer.profile.dayStartHour) !== date;
        return { name: h?.name ?? "Habit", kind: h?.kind ?? null, completedAt: t.completed_at, editedAt: t.edited_at ?? (otherDay ? t.completed_at : null) };
      }),
      sessions: (sessions.data ?? []).map((s) => ({
        startedAt: s.started_at,
        endedAt: s.ended_at,
        area: s.area,
        task: one(s.work_blocks as unknown as { task: string } | null)?.task ?? null,
        note: s.accomplishment_note,
      })),
      tasks: (tasks.data ?? []).map((t) => ({ title: t.title, completedAt: t.completed_at as string })),
      counters: (entries.data ?? []).map((e) => {
        const m = one(e.metrics as unknown as { label: string; unit: string | null } | null);
        return { label: m?.label ?? "Counter", unit: m?.unit ?? null, value: Number(e.value), updatedAt: e.updated_at };
      }),
      proofs: (proofs.data ?? []).map((p) => ({ uploadedAt: p.uploaded_at, label: p.note, topic: p.topic })),
      review: reviewDone && r ? { updatedAt: r.updated_at } : null,
      minimumAt: plan.data?.minimum_at ?? null,
      closedAt: plan.data?.completed_at ?? null,
    },
    requestTime(),
  );
}
