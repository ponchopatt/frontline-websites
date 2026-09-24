import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FaithToday, type FaithTick } from "@/components/faith/faith-today";
import { Group, PageHeader } from "@/components/os";
import { PLANS, formatReading, nextInPlan } from "@/lib/bible";
import { firstDayOf, getViewer } from "@/lib/data";
import { dayMonth, isLocalDate, relativeDayLabel, weekdayName } from "@/lib/day";

export const metadata: Metadata = { title: "Faith" };

const TICKS: Record<string, string> = { bible: "Read", journal: "Journal", prayer: "Pray", evening_prayer: "Evening prayer" };

/** Faith: today's chapter, the day's three ticks, the journal, and the readings before. */
export default async function FaithPage({ searchParams }: PageProps<"/faith">) {
  const { d, all } = await searchParams;
  const viewer = await getViewer();
  const { supabase, today } = viewer;
  const requested = typeof d === "string" ? d : undefined;
  if (requested !== undefined && (!isLocalDate(requested) || requested > today || requested < firstDayOf(viewer))) {
    redirect("/faith");
  }
  const date = requested ?? today;

  const [readingRes, lastRes, historyRes, planRes, habitsRes, doneRes] = await Promise.all([
    supabase.from("bible_readings").select("*, bible_entries(*)").eq("local_date", date).maybeSingle(),
    supabase.from("bible_readings").select("book,chapter").lt("local_date", date).order("local_date", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("bible_readings")
      .select("local_date,book,chapter,passage,is_completed,bible_entries(journal,obey_today,observation)")
      .lt("local_date", date)
      .order("local_date", { ascending: false })
      .limit(all === "1" ? 365 : 8),
    supabase.from("daily_plans").select("completed_at").eq("local_date", date).maybeSingle(),
    supabase.from("habits").select("id,kind,sort_order").eq("is_active", true).in("kind", Object.keys(TICKS)).order("sort_order"),
    supabase.from("habit_completions").select("habit_id").eq("local_date", date),
  ]);
  if (readingRes.error || historyRes.error || habitsRes.error || doneRes.error) {
    throw new Error("Your Bible entries couldn't be loaded. Refresh to try again.");
  }

  const reading = readingRes.data;
  const entryRaw = reading?.bible_entries ?? null;
  const entry = Array.isArray(entryRaw) ? entryRaw[0] ?? null : entryRaw;
  const suggested = nextInPlan(viewer.profile.biblePlan, lastRes.data);
  const done = new Set((doneRes.data ?? []).map((r) => r.habit_id));
  const order = Object.keys(TICKS);
  const ticks: FaithTick[] = (habitsRes.data ?? [])
    .filter((h) => h.kind)
    .sort((a, b) => order.indexOf(a.kind!) - order.indexOf(b.kind!))
    .map((h) => ({ id: h.id, label: TICKS[h.kind!], done: done.has(h.id) }));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <PageHeader eyebrow={date === today ? `${weekdayName(date)} · ${dayMonth(date)}` : relativeDayLabel(date, today)} title="Faith" back={date !== today ? { href: "/faith", label: "Today" } : undefined} />

      <FaithToday
        key={date}
        date={date}
        locked={Boolean(planRes.data?.completed_at)}
        reading={{
          book: reading?.book ?? suggested.book,
          chapter: reading?.chapter ?? suggested.chapter,
          passage: reading?.passage ?? null,
          suggested: !reading,
        }}
        planLabel={PLANS[viewer.profile.biblePlan].label}
        journal={entry?.journal ?? ""}
        ticks={ticks}
      />

      <Group
        id="bible-history"
        title="Past entries"
        action={
          all !== "1" && (historyRes.data ?? []).length === 8 ? (
            <Link href="/faith?all=1#bible-history" className="inline-flex min-h-11 items-center text-[15px] text-foreground">
              See all
            </Link>
          ) : undefined
        }
        footer={(historyRes.data ?? []).length === 0 ? "Your readings and notes will collect here, newest first." : undefined}
      >
        {(historyRes.data ?? []).length === 0 ? (
          <p className="px-4 py-4 text-[15px] text-muted-foreground">Nothing yet.</p>
        ) : (
          (historyRes.data ?? []).map((r) => {
            const e = Array.isArray(r.bible_entries) ? r.bible_entries[0] : r.bible_entries;
            const line = e?.journal || e?.obey_today || e?.observation;
            return (
              <Link key={r.local_date} href={`/faith?d=${r.local_date}`} className="grid gap-0.5 px-4 py-3 active:bg-accent">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[17px]">{formatReading(r, r.passage)}</span>
                  <span className="shrink-0 text-[14px] text-muted-foreground">{relativeDayLabel(r.local_date, today)}</span>
                </span>
                <span className={line ? "line-clamp-2 text-[15px] text-muted-foreground" : "text-[14px] text-muted-foreground"}>
                  {line || (r.is_completed ? "Read. No notes." : "Not marked read.")}
                </span>
              </Link>
            );
          })
        )}
      </Group>
    </div>
  );
}
