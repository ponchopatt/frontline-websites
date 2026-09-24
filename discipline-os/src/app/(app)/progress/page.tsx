import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProofWall, type WallPhoto, type WallRange } from "@/components/progress/proof-wall";
import { MomentumCard, RecordList, StatList, StreakList, WordCard } from "@/components/progress/sections";
import { YearView } from "@/components/progress/year-view";
import { SectionCard } from "@/components/section-card";
import { getViewer, proofTopic, type Viewer } from "@/lib/data";
import { startOfWeek } from "@/lib/day";
import { indexHistory, momentum, progressStats, records, streaks, wordTrend, yearDays } from "@/lib/history";
import { loadFacts } from "@/lib/history-server";
import { PROOF_TOPICS, type ProofTopic } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Progress" };

const WALL_LIMIT = 120;

/**
 * My progress: Keep My Word over time, momentum, the year in squares, streaks, personal
 * records and plain facts from the history. The proof wall is the second tab.
 */
export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const { tab, year: yearParam, range: rangeParam, topic: topicParam } = await searchParams;
  const viewer = await getViewer();
  const proof = tab === "proof";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <header className="grid gap-5">
        <div className="grid gap-1">
          <h1 className="text-[40px] leading-[1.05] font-light tracking-[-0.035em]">My progress</h1>
          <p className="text-[15px] text-muted-foreground">What I said I&apos;d do, what I did, and how it&apos;s adding up.</p>
        </div>
        <nav aria-label="Progress" className="grid grid-cols-2 gap-1 rounded-full border border-border p-1">
          <Tab href="/progress" on={!proof}>
            Scoreboard
          </Tab>
          <Tab href="/progress?tab=proof" on={proof}>
            Proof wall
          </Tab>
        </nav>
      </header>

      {proof ? (
        <WallTab viewer={viewer} range={isRange(rangeParam) ? rangeParam : "month"} topic={isTopic(topicParam) ? topicParam : "all"} />
      ) : (
        <ScoreTab viewer={viewer} year={typeof yearParam === "string" && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null} />
      )}
    </div>
  );
}

async function ScoreTab({ viewer, year: requested }: { viewer: Viewer; year: number | null }) {
  const [facts, proofCount] = await Promise.all([
    loadFacts(viewer),
    viewer.supabase.from("proof_uploads").select("id", { count: "exact", head: true }),
  ]);
  const ix = indexHistory(facts);
  const thisYear = Number(viewer.today.slice(0, 4));
  const firstYear = Number(facts.firstDay.slice(0, 4));
  const year = requested && requested >= firstYear && requested <= thisYear ? requested : thisYear;
  const today = ix.score.get(viewer.today);

  return (
    <>
      <WordCard trend={wordTrend(ix)} today={today?.score ?? null} />
      <MomentumCard momentum={momentum(ix)} />

      <SectionCard
        id="year"
        title={String(year)}
        meta={
          <span className="-mr-2 flex">
            <YearLink year={year - 1} enabled={year > firstYear} label="Previous year">
              <ChevronLeft className="size-5" />
            </YearLink>
            <YearLink year={year + 1} enabled={year < thisYear} label="Next year">
              <ChevronRight className="size-5" />
            </YearLink>
          </span>
        }
      >
        <YearView days={yearDays(ix, year)} today={viewer.today} threshold={facts.threshold} timeZone={viewer.profile.timezone} />
      </SectionCard>

      <StreakList rows={streaks(ix)} />
      <RecordList rows={records(ix)} />
      <StatList stats={progressStats(ix, proofCount.count ?? 0)} />
    </>
  );
}

async function WallTab({ viewer, range, topic }: { viewer: Viewer; range: WallRange; topic: ProofTopic | "all" }) {
  const { supabase, today } = viewer;
  const from = range === "day" ? today : range === "week" ? startOfWeek(today) : range === "month" ? `${today.slice(0, 7)}-01` : null;
  let query = supabase
    .from("proof_uploads")
    .select("id,local_date,storage_path,note,topic,uploaded_at")
    .order("local_date", { ascending: false })
    .order("uploaded_at", { ascending: false })
    .limit(WALL_LIMIT + 1);
  if (from) query = query.gte("local_date", from);
  if (topic !== "all") query = query.eq("topic", topic);
  const { data, error } = await query;
  if (error) throw new Error(`The proof wall couldn't be loaded: ${error.message}`);
  const rows = (data ?? []).slice(0, WALL_LIMIT);
  const { data: signed } = rows.length ? await supabase.storage.from("proof").createSignedUrls(rows.map((r) => r.storage_path), 60 * 60) : { data: [] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const photos: WallPhoto[] = rows.map((r) => ({
    id: r.id,
    date: r.local_date,
    url: urlFor.get(r.storage_path) ?? null,
    topic: proofTopic(r.topic),
    label: r.note,
    uploadedAt: r.uploaded_at,
  }));
  return <ProofWall photos={photos} range={range} topic={topic} timeZone={viewer.profile.timezone} more={(data ?? []).length > WALL_LIMIT} />;
}

function isRange(v: unknown): v is WallRange {
  return v === "day" || v === "week" || v === "month" || v === "all";
}

function isTopic(v: unknown): v is ProofTopic {
  return typeof v === "string" && (PROOF_TOPICS as readonly string[]).includes(v);
}

function Tab({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex h-11 items-center justify-center rounded-full text-[15px] transition-colors",
        on ? "bg-lamp-soft font-medium text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function YearLink({ year, enabled, label, children }: { year: number; enabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "grid size-10 place-items-center rounded-full";
  if (!enabled) {
    return (
      <span aria-disabled="true" aria-label={label} className={cn(cls, "text-faint/50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={`/progress?year=${year}#year`} aria-label={label} className={cn(cls, "text-muted-foreground hover:bg-accent hover:text-foreground")}>
      {children}
    </Link>
  );
}
