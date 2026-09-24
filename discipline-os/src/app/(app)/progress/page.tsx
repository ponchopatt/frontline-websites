import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/os";
import { ProofWall, type WallPhoto, type WallRange } from "@/components/progress/proof-wall";
import { MomentumCard, RecordList, Segmented, StatList, StreakList, TrophyShelves, WordCard } from "@/components/progress/sections";
import { YearView } from "@/components/progress/year-view";
import { getViewer, proofTopic, type Viewer } from "@/lib/data";
import { startOfWeek } from "@/lib/day";
import { indexHistory, momentum, progressStats, records, streaks, trophyShelves, wordTrend, yearDays } from "@/lib/history";
import { loadFacts } from "@/lib/history-server";
import { PROOF_TOPICS, type ProofTopic } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Progress" };

const WALL_LIMIT = 120;

/**
 * My progress: Keep My Word over time, momentum, the year in squares, streaks and plain facts
 * from the history. Trophies (personal records and streak trophies) and the proof wall are the
 * other two views, one tap away in the switch at the top.
 */
export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const { tab, year: yearParam, range: rangeParam, topic: topicParam } = await searchParams;
  const viewer = await getViewer();
  const proof = tab === "proof";
  const trophies = tab === "trophies";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader back={{ href: "/you", label: "You" }} title="My progress" />
      <div className="-mt-3">
        <Segmented
          label="Progress"
          items={[
            { href: "/progress", label: "Scoreboard", on: !proof && !trophies },
            { href: "/progress?tab=trophies", label: "Trophies", on: trophies },
            { href: "/progress?tab=proof", label: "Proof", on: proof },
          ]}
        />
      </div>

      {proof ? (
        <WallTab viewer={viewer} range={isRange(rangeParam) ? rangeParam : "month"} topic={isTopic(topicParam) ? topicParam : "all"} />
      ) : trophies ? (
        <TrophyTab viewer={viewer} />
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
      <YearView
        key={year}
        year={year}
        days={yearDays(ix, year)}
        today={viewer.today}
        threshold={facts.threshold}
        timeZone={viewer.profile.timezone}
        nav={
          <span className="-my-2 -mr-2 flex self-center">
            <YearLink year={year - 1} enabled={year > firstYear} label="Previous year">
              <ChevronLeft className="size-5" />
            </YearLink>
            <YearLink year={year + 1} enabled={year < thisYear} label="Next year">
              <ChevronRight className="size-5" />
            </YearLink>
          </span>
        }
      />
      <StreakList rows={streaks(ix)} />
      <StatList stats={progressStats(ix, proofCount.count ?? 0)} />
    </>
  );
}

async function TrophyTab({ viewer }: { viewer: Viewer }) {
  const ix = indexHistory(await loadFacts(viewer));
  const rows = streaks(ix);
  return (
    <>
      <RecordList rows={records(ix)} />
      <TrophyShelves shelves={trophyShelves(rows)} />
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

function YearLink({ year, enabled, label, children }: { year: number; enabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "grid size-11 place-items-center rounded-full";
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
