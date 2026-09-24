import "server-only";
import type { LocalDate } from "./day";
import type { Viewer } from "./data";

/** The day's reading row, created from `ref` if the day has none yet. */
export async function ensureReading(
  viewer: Viewer,
  date: LocalDate,
  ref: { book: string; chapter: number },
): Promise<{ id: string } | { error: { code?: string; hint?: string | null } }> {
  const { data: existing } = await viewer.supabase.from("bible_readings").select("id").eq("local_date", date).maybeSingle();
  if (existing) return existing;
  const { data, error } = await viewer.supabase
    .from("bible_readings")
    .insert({ local_date: date, book: ref.book, chapter: ref.chapter })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: again } = await viewer.supabase.from("bible_readings").select("id").eq("local_date", date).maybeSingle();
    if (again) return again;
  }
  if (error || !data) return { error: error ?? {} };
  return data;
}
