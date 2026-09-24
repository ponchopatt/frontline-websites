import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseEnvError, supabaseEnv } from "./env";

const jwt = (role: string) => `x.${btoa(JSON.stringify({ role })).replace(/=+$/, "")}.y`;

describe("supabaseEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("forgives a pasted /rest/v1/ and stray spaces", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " https://abcd.supabase.co/rest/v1/ ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ` ${jwt("anon")}${"a".repeat(20)} `);
    expect(supabaseEnv().url).toBe("https://abcd.supabase.co");
    expect(supabaseEnv().key.startsWith("x.")).toBe(true);
  });

  it("names what's missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    try {
      supabaseEnv();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SupabaseEnvError);
      expect((error as SupabaseEnvError).problems.join(" ")).toMatch(/NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    }
  });

  it("refuses a secret key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_secret_" + "a".repeat(30));
    expect(() => supabaseEnv()).toThrow(/secret key/);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", jwt("service_role") + "a".repeat(20));
    expect(() => supabaseEnv()).toThrow(/secret key/);
  });

  it("takes a publishable key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_" + "a".repeat(30));
    expect(supabaseEnv().key).toMatch(/^sb_publishable_/);
  });
});
