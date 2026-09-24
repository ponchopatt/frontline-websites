"use client";

import { Camera } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
export const RANGE_LABEL: Record<WallRange, string> = { day: "Today", week: "This week", month: "This month", all: "All" };

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

/** Proof, newest first, a day at a time. Filter by when and by what it's proof of. */
export function ProofWall({ photos, range, topic, timeZone, more }: ProofWallProps) {
  const [open, setOpen] = useState<WallPhoto | null>(null);
  const days = [...new Set(photos.map((p) => p.date))];

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <nav aria-label="When" className="flex flex-wrap gap-1.5">
          {(Object.keys(RANGE_LABEL) as WallRange[]).map((r) => (
            <Chip key={r} href={href(r, topic)} on={r === range}>
              {RANGE_LABEL[r]}
            </Chip>
          ))}
        </nav>
        <nav aria-label="Proof of" className="flex flex-wrap gap-1.5">
          <Chip href={href(range, "all")} on={topic === "all"}>
            Everything
          </Chip>
          {(Object.keys(TOPIC_LABEL) as ProofTopic[]).map((t) => (
            <Chip key={t} href={href(range, t)} on={t === topic}>
              {TOPIC_LABEL[t]}
            </Chip>
          ))}
        </nav>
      </div>

      {photos.length === 0 ? (
        <div className="grid justify-items-start gap-2 rounded-[26px] border border-glass-edge bg-glass p-5">
          <Camera className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-[15px]">No proof here yet.</p>
          <p className="text-sm text-muted-foreground">Add a photo from Today&apos;s Proof card, or from any task. It lands on this wall.</p>
          <Link href="/#proof" className="mt-1 inline-flex min-h-11 items-center text-sm text-foreground underline underline-offset-4">
            Add proof on Today
          </Link>
        </div>
      ) : (
        <ol className="grid gap-6">
          {days.map((d) => {
            const list = photos.filter((p) => p.date === d);
            return (
              <li key={d} className="grid gap-2">
                <h3 className="flex items-baseline justify-between text-[15px]">
                  <span>{shortDate(d)}</span>
                  <span className="text-sm text-muted-foreground">
                    {list.length} {list.length === 1 ? "photo" : "photos"}
                  </span>
                </h3>
                <ul className="grid grid-cols-3 gap-1.5">
                  {list.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setOpen(p)}
                        aria-label={`${TOPIC_LABEL[p.topic]} proof${p.label ? `: ${p.label}` : ""}, ${clockTime(p.uploadedAt, timeZone)}`}
                        className="relative block aspect-square w-full overflow-hidden rounded-xl bg-muted"
                      >
                        {p.url && (
                          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed links, not optimisable
                          <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
                        )}
                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[11px] backdrop-blur">{TOPIC_LABEL[p.topic]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
      {more && <p className="text-sm text-muted-foreground">Showing the latest 120. Narrow it down to see further back.</p>}

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

function Chip({ href: to, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={on ? "page" : undefined}
      scroll={false}
      className={cn(
        "inline-flex h-10 items-center rounded-full border px-3.5 text-sm transition-colors",
        on ? "border-primary/50 bg-lamp-soft text-primary" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
