import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { supabaseEnv } from "@/lib/env";
import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();
  const https = (await headers()).get("x-forwarded-proto") === "https";
  const { url, key } = supabaseEnv();

  return createServerClient<Database>(url, key, {
    // Only the server reads the session, so page scripts never can (the same rule as the unlock cookie).
    cookieOptions: { httpOnly: true, sameSite: "lax", path: "/", secure: https },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, which cannot set cookies. The proxy refreshes
          // the session on every request, so this is safe to ignore.
        }
      },
    },
  });
}

export type Supabase = Awaited<ReturnType<typeof createClient>>;
