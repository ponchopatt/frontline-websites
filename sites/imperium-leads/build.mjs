// Build: the page is imperium-leads.html exactly as written, with the tags a phone app needs
// put in front of it; plus supabase-js copied in, and config.js with this project's public keys.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, "public");

const HEAD = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0B0E12">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Imperium Leads">
<meta name="robots" content="noindex, nofollow">
<link rel="manifest" href="/manifest.json">
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script src="/vendor/supabase.js"></script>
<script src="/config.js"></script>
<script src="/claude-shim.js"></script>
<script src="/reviews.js"></script>
<script src="/model.js"></script>
<script src="/texts.js"></script>
`;

writeFileSync(join(pub, "index.html"), HEAD + readFileSync(join(here, "imperium-leads.html"), "utf8"));

mkdirSync(join(pub, "vendor"), { recursive: true });
copyFileSync(join(here, "node_modules/@supabase/supabase-js/dist/umd/supabase.js"), join(pub, "vendor/supabase.js"));

// The URL and the publishable (anon) key are meant to be public; the service key never leaves the server.
const url = process.env.SUPABASE_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
if (!url || !anonKey) console.warn("SUPABASE_URL or SUPABASE_ANON_KEY is not set: the page will say it can't reach the list.");
writeFileSync(join(pub, "config.js"), `window.LEADS_CONFIG = ${JSON.stringify({ url, anonKey })};\n`);

console.log("Built public/: index.html, vendor/supabase.js, config.js");
