import { z } from "zod";

/** Supabase's Data API page shows the REST address; the app needs the project address. */
function projectUrl(raw: string | undefined): string | undefined {
  return raw?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

/** A secret key must never be the app's key: it skips every row-level rule. */
function isSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)))?.role === "service_role";
  } catch {
    return false;
  }
}

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL is missing or isn't a web address" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing" })
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing")
    .refine((key) => !isSecretKey(key), "NEXT_PUBLIC_SUPABASE_ANON_KEY is the secret key; use the anon or publishable key"),
});

/**
 * Read at call time, not import time, so a missing variable produces a clear message
 * where it is needed instead of crashing the build. Stray spaces and a pasted "/rest/v1/"
 * are forgiven.
 */
export function supabaseEnv() {
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: projectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim(),
  });
  if (!parsed.success) {
    throw new SupabaseEnvError(parsed.error.issues.map((i) => i.message));
  }
  return { url: parsed.data.NEXT_PUBLIC_SUPABASE_URL, key: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY };
}

export class SupabaseEnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Supabase is not configured: ${problems.join("; ")}. Copy .env.example to .env.local and fill it in.`);
    this.name = "SupabaseEnvError";
  }
}
