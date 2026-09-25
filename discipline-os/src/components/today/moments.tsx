"use client";

import { History, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { LocalDate } from "@/lib/day";
import type { MemoryCard, RecordEvent } from "@/lib/history";

function remembered(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function remember(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Private mode or storage off: it just shows again next time.
  }
}

/**
 * A personal record the moment it's broken: the new number and the one it beat. Each shows
 * once; dismissing it (or seeing it) is remembered on this device for the day. It floats over
 * the top of the screen rather than pushing the day down after it has drawn, and goes by itself.
 */
export function RecordBanner({ date, events }: { date: LocalDate; events: RecordEvent[] }) {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Read what's been seen once the page is in the browser (storage isn't there on the server).
    const t = setTimeout(() => {
      setSeen(new Set(events.filter((e) => remembered(`pr:${date}:${e.key}`)).map((e) => e.key)));
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
    // Only on mount and when the day changes; new events are checked as they arrive below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const event = ready ? events.find((e) => !seen.has(e.key)) : undefined;
  const close = (key: string) => {
    remember(`pr:${date}:${key}`);
    setSeen((s) => new Set(s).add(key));
  };
  const key = event?.key;
  useEffect(() => {
    if (!key) return;
    const t = setTimeout(() => close(key), 9000);
    return () => clearTimeout(t);
    // close only writes storage and state for this day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!event) return null;
  return (
    <section
      role="status"
      aria-label="New personal record"
      className="surface-strong fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-40 mx-auto flex w-[calc(100%-2rem)] max-w-md gap-3 rounded-[24px] border p-4 shadow-lg animate-in fade-in-0 slide-in-from-top-2 duration-300"
    >
      <Trophy className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-sm text-primary">New personal record</p>
        <p className="text-[17px] leading-snug font-medium">{event.text}</p>
        <p className="text-sm text-muted-foreground">Previous record: {event.previous}</p>
      </div>
      <button type="button" onClick={() => close(event.key)} aria-label="Dismiss" className="-mt-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent">
        <X className="size-4" aria-hidden />
      </button>
    </section>
  );
}

/** Now and then: one comparison from the history, on the days the history offers one. */
export function MemoryNote({ date, card }: { date: LocalDate; card: MemoryCard }) {
  const key = `memory:${date}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHidden(remembered(key)), 0);
    return () => clearTimeout(t);
  }, [key]);
  if (hidden) return null;
  return (
    <aside aria-label="Now and then" className="surface flex gap-3 rounded-[24px] border p-4">
      <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1 text-[15px] leading-snug">
        <span className="text-muted-foreground">{card.then}</span> <span>{card.now}</span>
      </p>
      <button
        type="button"
        onClick={() => {
          remember(key);
          setHidden(true);
        }}
        aria-label="Dismiss"
        className="-mt-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent"
      >
        <X className="size-4" aria-hidden />
      </button>
    </aside>
  );
}
