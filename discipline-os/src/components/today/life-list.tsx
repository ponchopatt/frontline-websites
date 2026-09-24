"use client";

import { Group, Ring, Row } from "@/components/os";

/** The parts of the day that open in a sheet from Today. */
export type AreaKey = "morning" | "faith" | "fitness" | "imperium" | "websites" | "trading" | "discipline" | "work" | "review";

export interface LifeRow {
  key: AreaKey;
  title: string;
  /** One short line: what's next, or where it stands. */
  subtitle: string | null;
  /** "3/5", "1h 35m", "Done". */
  value: string;
  /** 0–1 for the ring; null for no ring. */
  ratio: number | null;
}

/**
 * The day's scoreboard as a list: each part of life on one row with its number and a ring.
 * Tap a row for everything in it.
 */
export function LifeList({ rows, onOpen }: { rows: LifeRow[]; onOpen: (key: AreaKey) => void }) {
  return (
    <Group id="scoreboard" title="Your day">
      {rows.map((r) => (
        <Row
          key={r.key}
          onClick={() => onOpen(r.key)}
          ariaLabel={`${r.title}: ${r.value}`}
          title={r.title}
          subtitle={r.subtitle}
          value={r.value}
          trailing={r.ratio !== null ? <Ring value={r.ratio} size={26} /> : undefined}
        />
      ))}
    </Group>
  );
}
