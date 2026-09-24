import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL must be the project URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing"),
});

/**
 * Read at call time, not import time, so a missing variable produces a clear message
 * where it is needed instead of crashing the build.
 */
export function supabaseEnv() {
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `Supabase is not configured: ${parsed.error.issues.map((i) => i.message).join("; ")}. ` +
        "Copy .env.example to .env.local and fill it in.",
    );
  }
  return { url: parsed.data.NEXT_PUBLIC_SUPABASE_URL, key: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY };
}
