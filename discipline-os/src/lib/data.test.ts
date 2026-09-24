import { describe, expect, it, vi } from "vitest";
import { fetchAll, loadSummaries } from "./data";
import { dateRange } from "./day";
import type { Supabase } from "./supabase/server";

// data.ts is server code: stand in for the parts that need a request (vi.mock runs first).
vi.mock("server-only", () => ({}));
vi.mock("./supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./lock", () => ({ readUnlockToken: vi.fn() }));

/** A fake paged query over `rows`, that records each range asked for and how many ran at once. */
function pager(rows: number[], count: number | null) {
  const calls: Array<[number, number]> = [];
  let running = 0;
  let most = 0;
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    running += 1;
    most = Math.max(most, running);
    await new Promise((r) => setTimeout(r, 1));
    running -= 1;
    return { data: rows.slice(from, to + 1), error: null, count };
  };
  return { page, calls, most: () => most };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("fetching every row", () => {
  it("gets every row once, in order, and fetches the pages after the first together", async () => {
    const q = pager(range(2500), 2500);
    expect(await fetchAll(q.page)).toEqual(range(2500));
    expect(q.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(q.most()).toBe(2);
  });

  it("goes page by page without a count, until a short page", async () => {
    const q = pager(range(2000), null);
    expect(await fetchAll(q.page)).toHaveLength(2000);
    expect(q.calls.map(([from]) => from)).toEqual([0, 1000, 2000]);
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
