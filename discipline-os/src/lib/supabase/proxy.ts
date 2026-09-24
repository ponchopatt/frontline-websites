import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SupabaseEnvError, supabaseEnv } from "@/lib/env";
import type { Database } from "./database.types";

const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * A plain page that says what to fix, instead of a bare "Internal Server Error". It names
 * settings and the deployment type only, never a value.
 */
function setupPage(heading: string, lines: string[]) {
  const where = process.env.VERCEL_ENV ? ` (this is a ${process.env.VERCEL_ENV} deployment)` : "";
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Discipline OS</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.4rem">${escape(heading)}</h1>
<ul>${lines.map((l) => `<li>${escape(l)}</li>`).join("")}</ul>
<p>In Vercel: Settings → Environment Variables. Tick every environment${escape(where)}, save, then Redeploy.</p>
</body></html>`;
  return new NextResponse(body, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

/** Refreshes the auth session on every request and keeps signed-out visitors on the auth pages. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let env: ReturnType<typeof supabaseEnv>;
  try {
    env = supabaseEnv();
  } catch (error) {
    if (error instanceof SupabaseEnvError) return setupPage("The app isn't connected to its database yet.", error.problems);
    throw error;
  }
  const { url, key } = env;
  const https = request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";

  const supabase = createServerClient<Database>(url, key, {
    // Only the server reads the session, so page scripts never can (the same rule as the unlock cookie).
    cookieOptions: { httpOnly: true, sameSite: "lax", path: "/", secure: https },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers ?? {})) response.headers.set(name, value);
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it refreshes the session.
  let data: Awaited<ReturnType<typeof supabase.auth.getClaims>>["data"];
  try {
    ({ data } = await supabase.auth.getClaims());
  } catch (error) {
    return setupPage("The app can't reach its database.", [
      "Check NEXT_PUBLIC_SUPABASE_URL is the Project URL, like https://abcd.supabase.co, and the project isn't paused.",
      error instanceof Error ? error.message : String(error),
    ]);
  }
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!signedIn && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "";
    return NextResponse.redirect(to);
  }
  if (signedIn && (path === "/login" || path === "/signup")) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}
