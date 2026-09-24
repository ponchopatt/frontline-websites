import { describe, expect, it, vi } from "vitest";
import { fetchAll, loadSummaries } from "./data";
import { dateRange } from "./day";
import type { Supabase } from "./supabase/server";

// data.ts is server code: stand in for the parts that need a request (vi.mock runs first).
vi.mock("server-only", () => ({}));
vi.mock("./supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./lock", () => ({ readUnlockToken: vi.fn() }));

/**
 * A fake paged query over `rows`, that records each range asked for, whether it asked for a
 * count, and how many ran at once. Like PostgREST, a counted page past the end is an error.
 */
function pager(rows: number[], count: number | null) {
  const calls: Array<[number, number, boolean]> = [];
  let running = 0;
  let most = 0;
  const page = async (from: number, to: number, withCount: boolean) => {
    calls.push([from, to, withCount]);
    running += 1;
    most = Math.max(most, running);
    await new Promise((r) => setTimeout(r, 1));
    running -= 1;
    if (withCount && from > 0 && from >= rows.length) return { data: null, error: { message: "Requested range not satisfiable" }, count: null };
    return { data: rows.slice(from, to + 1), error: null, count: withCount ? count : null };
  };
  return { page, calls, most: () => most };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("fetching every row", () => {
  it("gets every row once, in order, and fetches the pages after the first together", async () => {
    const q = pager(range(2500), 2500);
    expect(await fetchAll(q.page)).toEqual(range(2500));
    // Only the first page asks for a count.
    expect(q.calls).toEqual([
      [0, 999, true],
      [1000, 1999, false],
      [2000, 2999, false],
    ]);
    expect(q.most()).toBe(2);
  });

  it("copes with rows removed after the count", async () => {
    const rows = range(2100);
    const q = pager(rows, 2100);
    // Removed once the first page is in, so the last page starts past the end.
    const page = (from: number, to: number, withCount: boolean) => {
      if (from > 0) rows.length = 1900;
      return q.page(from, to, withCount);
    };
    expect(await fetchAll(page)).toEqual(range(1900));
  });

  it("goes page by page without a count, until a short page", async () => {
    const q = pager(range(2000), null);
    expect(await fetchAll(q.page)).toHaveLength(2000);
    expect(q.calls.map(([from, , withCount]) => [from, withCount])).toEqual([
      [0, true],
      [1000, false],
      [2000, false],
    ]);
    expect(q.most()).toBe(1);
  });

  it("keeps going when rows were added after the count", async () => {
    const q = pager(range(2300), 1500);
    expect(await fetchAll(q.page)).toEqual(range(2300));
  });

  it("stops at one request for a short first page", async () => {
    const q = pager(range(40), 40);
    expect(await fetchAll(q.page)).toHaveLength(40);
    expect(q.calls).toHaveLength(1);
  });

  it("fails with the database's message", async () => {
    const page = async (from: number) => (from === 0 ? { data: range(1000), error: null, count: 1800 } : { data: null, error: { message: "timeout" }, count: null });
    await expect(fetchAll(page)).rejects.toThrow("timeout");
  });
});

describe("loading day summaries", () => {
  it("asks for every year-sized chunk at once and keeps the days in order", async () => {
    let running = 0;
    let most = 0;
    const asked: string[][] = [];
    const rpc = async (_: string, { p_from, p_to }: { p_from: string; p_to: string }) => {
      asked.push([p_from, p_to]);
      running += 1;
      most = Math.max(most, running);
      // Later chunks answer first.
      await new Promise((r) => setTimeout(r, 30 - asked.length * 10));
      running -= 1;
      return { data: dateRange(p_from, p_to).map((local_date) => ({ local_date })), error: null };
    };
    const days = await loadSummaries({ rpc } as unknown as Supabase, "2024-01-01", "2026-03-01");
    expect(asked).toEqual([
      ["2024-01-01", "2024-12-31"],
      ["2025-01-01", "2026-01-01"],
      ["2026-01-02", "2026-03-01"],
    ]);
    expect(most).toBe(3);
    expect(days.map((d) => d.local_date)).toEqual(dateRange("2024-01-01", "2026-03-01"));
  });
});
