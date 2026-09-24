"use client";

import { Camera, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Group, TextAction } from "@/components/os";
import { Segmented } from "@/components/progress/sections";
import { Sheet } from "@/components/sheet";
import { clockTime, shortDate, type LocalDate } from "@/lib/day";
import type { ProofTopic } from "@/lib/types";
import { cn } from "@/lib/utils";

export const TOPIC_LABEL: Record<ProofTopic, string> = {
  faith: "Faith",
  gym: "Gym",
  imperium: "Imperium",
  websites: "Websites",
  work: "Work",
  other: "Other",
};

export type WallRange = "day" | "week" | "month" | "all";
/** Short, so four fit side by side on the smallest phone. */
export const RANGE_LABEL: Record<WallRange, string> = { day: "Today", week: "Week", month: "Month", all: "All" };

export interface WallPhoto {
  id: string;
  date: LocalDate;
  url: string | null;
  topic: ProofTopic;
  label: string | null;
  uploadedAt: string;
}

interface ProofWallProps {
  photos: WallPhoto[];
  range: WallRange;
  topic: ProofTopic | "all";
  timeZone: string;
  /** More than were shown. */
  more: boolean;
}

function href(range: WallRange, topic: ProofTopic | "all") {
  const q = new URLSearchParams({ tab: "proof" });
  if (range !== "month") q.set("range", range);
  if (topic !== "all") q.set("topic", topic);
  return `/progress?${q}`;
}

const TOPICS: Array<[ProofTopic | "all", string]> = [["all", "Everything"], ...(Object.entries(TOPIC_LABEL) as Array<[ProofTopic, string]>)];

/**
 * Proof, newest first, a day at a time. When is a segmented control; what it's proof of is one
 * quiet line that opens a sheet, so the wall itself stays in front.
 */
export function ProofWall({ photos, range, topic, timeZone, more }: ProofWallProps) {
  const [open, setOpen] = useState<WallPhoto | null>(null);
  const [picking, setPicking] = useState(false);
  const days = [...new Set(photos.map((p) => p.date))];
  const topicLabel = topic === "all" ? "Everything" : TOPIC_LABEL[topic];

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <Segmented label="When" scroll={false} quiet items={(Object.keys(RANGE_LABEL) as WallRange[]).map((r) => ({ href: href(r, topic), label: RANGE_LABEL[r], on: r === range }))} />
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-haspopup="dialog"
          className="inline-flex min-h-11 items-center gap-1.5 justify-self-start px-1 text-[15px] text-muted-foreground hover:text-foreground"
        >
          Proof of <span className="font-medium text-foreground">{topicLabel}</span>
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>

      {photos.length === 0 ? (
        <Group plain>
          <div className="grid justify-items-start gap-1.5 p-5">
            <Camera className="mb-1 size-6 text-muted-foreground" strokeWidth={1.8} aria-hidden />
            <p className="text-[17px]">No proof here yet.</p>
            <p className="text-[15px] leading-snug text-muted-foreground">Add a photo from Today&apos;s Proof card, or from any task. It lands on this wall.</p>
            <TextAction href="/#proof" className="text-foreground underline">
              Add proof on Today
            </TextAction>
          </div>
        </Group>
      ) : (
        <ol className="grid gap-7">
          {days.map((d) => {
            const list = photos.filter((p) => p.date === d);
            return (
              <li key={d} className="grid gap-2.5">
                <h2 className="flex items-baseline justify-between gap-3 px-1 text-[17px]">
                  <span>{shortDate(d)}</span>
                  <span className="text-[15px] text-muted-foreground">
                    {list.length} {list.length === 1 ? "photo" : "photos"}
                  </span>
                </h2>
                <ul className="grid grid-cols-3 gap-1.5">
                  {list.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setOpen(p)}
                        aria-label={`${TOPIC_LABEL[p.topic]} proof${p.label ? `: ${p.label}` : ""}, ${clockTime(p.uploadedAt, timeZone)}`}
                        className="relative block aspect-square w-full overflow-hidden rounded-[14px] bg-muted transition-transform active:scale-[0.98]"
                      >
                        {p.url && (
                          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed links, not optimisable
                          <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
                        )}
                        <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-full bg-background/80 px-2 py-0.5 text-[13px] text-foreground backdrop-blur">
                          {TOPIC_LABEL[p.topic]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
      {more && <p className="px-1 text-[14px] text-muted-foreground">Showing the latest 120. Narrow it down to see further back.</p>}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Proof of">
        <nav aria-label="Proof of" className="-mx-5 -mt-2 divide-y divide-border border-t border-border">
          {TOPICS.map(([t, label]) => {
            const on = t === topic;
            return (
              <Link
                key={t}
                href={href(range, t)}
                scroll={false}
                onClick={() => setPicking(false)}
                aria-current={on ? "page" : undefined}
                className="flex min-h-14 items-center justify-between gap-3 px-5 text-[17px] transition-colors active:bg-accent"
              >
                <span className={cn(on && "font-medium")}>{label}</span>
                {on && <Check className="size-5 text-kept" strokeWidth={2.5} aria-hidden />}
              </Link>
            );
          })}
        </nav>
      </Sheet>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? `${TOPIC_LABEL[open.topic]} · ${shortDate(open.date)}` : "Proof"}>
        {open && (
          <div className="grid gap-3">
            {open.url && (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed links, not optimisable
              <img src={open.url} alt={open.label ?? `${TOPIC_LABEL[open.topic]} proof`} className="max-h-[65dvh] w-full rounded-2xl object-contain" />
            )}
            <p className="text-[15px]">
              {open.label ?? TOPIC_LABEL[open.topic]} <span className="text-muted-foreground">· {clockTime(open.uploadedAt, timeZone)}</span>
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
