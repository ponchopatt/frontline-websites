import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "./proxy";

describe("updateSession without Supabase settings", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("says which settings are missing instead of a bare server error", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    const res = await updateSession(new NextRequest("https://example.com/"));
    expect(res.status).toBe(503);
    const html = await res.text();
    expect(html).toContain("isn't connected to its database yet");
    expect(html).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(html).toContain("this is a preview deployment");
  });
});
