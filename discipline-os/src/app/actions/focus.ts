"use server";

import { z } from "zod";
import { dbFail, fail, invalid, localDateSchema, ok } from "@/lib/action-helpers";
import { getViewer, loadFocusWeek } from "@/lib/data";
import { addDays, dateRange, startOfWeek, type LocalDate } from "@/lib/day";
import { FOCUS_AREAS, isFocusArea, suggestFocus, type FocusArea, type FocusDay, type FocusSuggestion, type KeepAlive } from "@/lib/focus";
import type { ActionResult } from "@/lib/types";

const weekSchema = z.object({ weekStart: localDateSchema });

/**
 * A week's focus as it stands, the keep-alive minutes, and which business to pick if none is:
 * the one that's had the least time in the two weeks before, leaving out last week's focus.
 */
export async function getWeekFocus(
  input: z.input<typeof weekSchema>,
): Promise<ActionResult<{ days: FocusDay[]; keepAlive: KeepAlive; suggestion: FocusSuggestion }>> {
  const parsed = weekSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const weekStart = startOfWeek(parsed.data.weekStart);
  const viewer = await getViewer();
  const { supabase, profile } = viewer;

  const [days, lastWeek, sessions] = await Promise.all([
    loadFocusWeek(supabase, weekStart),
    loadFocusWeek(supabase, addDays(weekStart, -7)),
    supabase.from("work_sessions").select("area,started_at,ended_at").gte("local_date", addDays(weekStart, -14)).lt("local_date", weekStart),
  ]);
  if (sessions.error) return dbFail(sessions.error);

  const minutes: Partial<Record<FocusArea, number>> = {};
  const now = Date.now();
  for (const s of sessions.data ?? []) {
    if (!isFocusArea(s.area)) continue;
    const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
    minutes[s.area] = (minutes[s.area] ?? 0) + Math.max(0, (end - new Date(s.started_at).getTime()) / 60000);
  }
  // Last week's focus: the business that had most of its days.
  const counts = new Map<FocusArea, number>();
  for (const d of lastWeek) if (d.area) counts.set(d.area, (counts.get(d.area) ?? 0) + 1);
  const lastFocus = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return ok({ days, keepAlive: profile.keepAlive, suggestion: suggestFocus(minutes, lastFocus) });
}

const areaSchema = z.enum(FOCUS_AREAS).nullable();
const minutesSchema = z.number().int().min(0).max(240);
const saveSchema = z.object({
  weekStart: localDateSchema,
  days: z.array(z.object({ date: localDateSchema, area: areaSchema })).max(7),
  keepAlive: z.object({ imperium: minutesSchema, websites: minutesSchema, trading: minutesSchema }),
});

/** Saves a week's focus, day by day (a day left empty has none), and the keep-alive minutes. */
export async function saveWeekFocus(input: z.input<typeof saveSchema>): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const weekStart = startOfWeek(parsed.data.weekStart);
  const week = new Set<LocalDate>(dateRange(weekStart, addDays(weekStart, 6)));
  const days = parsed.data.days.filter((d) => week.has(d.date));
  if (days.length !== parsed.data.days.length) return fail("Those days aren't in that week.");

  const viewer = await getViewer();
  const { supabase, userId } = viewer;
  const chosen = days.filter((d): d is { date: LocalDate; area: FocusArea } => d.area !== null);
  const cleared = days.filter((d) => d.area === null).map((d) => d.date);

  const [upsert, clear, profile] = await Promise.all([
    chosen.length
      ? supabase.from("focus_days").upsert(
          chosen.map((d) => ({ user_id: userId, local_date: d.date, area: d.area })),
          { onConflict: "user_id,local_date" },
        )
      : Promise.resolve({ error: null }),
    cleared.length ? supabase.from("focus_days").delete().in("local_date", cleared) : Promise.resolve({ error: null }),
    supabase.from("profiles").update({ keep_alive_minutes: parsed.data.keepAlive }).eq("user_id", userId),
  ]);
  const error = upsert.error ?? clear.error ?? profile.error;
  if (error) return dbFail(error, "Your focus wasn't saved. Try again.");
  return ok();
}
