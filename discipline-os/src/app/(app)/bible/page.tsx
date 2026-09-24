import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BibleJournal } from "@/components/bible/bible-journal";
import { FIRST_READING, formatReading, nextReading } from "@/lib/bible";
import { firstDayOf, getViewer } from "@/lib/data";
import { isLocalDate, relativeDayLabel } from "@/lib/day";

export const metadata: Metadata = { title: "Bible" };

export default async function BiblePage({ searchParams }: PageProps<"/bible">) {
  const { d } = await searchParams;
  const viewer = await getViewer();
  const { supabase, today } = viewer;
  const requested = typeof d === "string" ? d : undefined;
  if (requested !== undefined && (!isLocalDate(requested) || requested > today || requested < firstDayOf(viewer))) {
    redirect("/bible");
  }
  const date = requested ?? today;

  const [readingRes, lastRes, historyRes, planRes] = await Promise.all([
    supabase.from("bible_readings").select("*, bible_entries(*)").eq("local_date", date).maybeSingle(),
    supabase.from("bible_readings").select("book,chapter").lt("local_date", date).order("local_date", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("bible_readings")
      .select("local_date,book,chapter,passage,is_completed,bible_entries(obey_today,observation,soap_done)")
      .lt("local_date", date)
      .order("local_date", { ascending: false })
      .limit(30),
    supabase.from("daily_plans").select("completed_at").eq("local_date", date).maybeSingle(),
  ]);
  if (readingRes.error || historyRes.error) {
    throw new Error("Your Bible entries couldn't be loaded. Refresh to try again.");
  }

  const reading = readingRes.data;
  const entryRaw = reading?.bible_entries ?? null;
  const entry = Array.isArray(entryRaw) ? entryRaw[0] ?? null : entryRaw;
  const suggested = lastRes.data ? nextReading(lastRes.data) : FIRST_READING;

  return (
    <div className="grid gap-10">
      <header className="grid gap-1">
        <p className="text-muted-foreground">{relativeDayLabel(date, today)}</p>
        <h1 className="text-[34px] leading-tight font-medium tracking-tight">Bible</h1>
      </header>

      <BibleJournal
        key={date}
        date={date}
        locked={Boolean(planRes.data?.completed_at)}
        reading={{
          book: reading?.book ?? suggested.book,
          chapter: reading?.chapter ?? suggested.chapter,
          passage: reading?.passage ?? null,
          suggested: !reading,
        }}
        entry={{
          scripture_notes: entry?.scripture_notes ?? "",
          observation: entry?.observation ?? "",
          application: entry?.application ?? "",
          prayer: entry?.prayer ?? "",
          obey_today: entry?.obey_today ?? "",
        }}
      />

      <section aria-labelledby="bible-history" className="border-t border-border pt-6">
        <h2 id="bible-history" className="mb-3 text-xl font-medium tracking-tight">
          Past entries
        </h2>
        {(historyRes.data ?? []).length === 0 ? (
          <p className="text-[15px] text-muted-foreground">Your past readings and notes will collect here, newest first.</p>
        ) : (
          <ol className="divide-y divide-border/70">
            {(historyRes.data ?? []).map((r) => {
              const e = Array.isArray(r.bible_entries) ? r.bible_entries[0] : r.bible_entries;
              const line = e?.obey_today || e?.observation;
              return (
                <li key={r.local_date}>
                  <Link href={`/bible?d=${r.local_date}`} className="grid gap-0.5 py-3 hover:bg-accent/40">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-[17px]">{formatReading(r, r.passage)}</span>
                      <span className="text-sm text-muted-foreground">{relativeDayLabel(r.local_date, today)}</span>
                    </span>
                    {line ? (
                      <span className="line-clamp-2 text-[15px] text-muted-foreground">{line}</span>
                    ) : (
                      <span className="text-sm text-faint">{r.is_completed ? "Read. No notes." : "Not marked read."}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
