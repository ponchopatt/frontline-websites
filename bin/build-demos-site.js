#!/usr/bin/env node
/**
 * Build command for the "frontline-demos" Vercel project — a SEPARATE
 * project from any deploy of the full factory, and unrelated to the live
 * Bondi and Canberra to Coast projects, which this never touches.
 *
 * It builds only the clients that have shipped: those with a `demo/<slug>`
 * branch on origin. That branch is the actual proof a demo passed an
 * independent review and the check — nothing here re-decides that.
 *
 * Every demo keeps its own `live:false` config, so the demo banner, the
 * demo footer and the noindex meta tag stay on. The root vercel.json's
 * X-Robots-Tag header covers this project too, since both read the same
 * file from the same commit; this script does not touch that file.
 *
 * Runs from the `factory` branch (this project's Production Branch, set in
 * the Vercel dashboard — see the top of the repo's README for the import
 * steps). Whichever commit Vercel checks out is what gets built: a shipped
 * client's own files, plus whatever the shared templates look like on
 * factory right now. Push factory after shipping a client — the existing
 * habit throughout this repo's history — and the next deploy picks it up
 * with no other step.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { listClients, ROOT } from '../lib/config.js';
import { buildClient, listFiles } from '../lib/build.js';

const OUT_DIR = join(ROOT, 'dist-demos');

/** Every slug with a `demo/<slug>` branch on origin — the ship record. */
function shippedSlugs() {
  const prefix = 'refs/heads/demo/';
  const tryCmd = (cmd, args) => {
    try { return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }); }
    catch { return ''; }
  };
  // The live source of truth: ask origin what demo/* branches actually
  // exist right now, regardless of how deep this checkout's history is.
  let out = tryCmd('git', ['ls-remote', '--heads', 'origin', 'demo/*']);
  // A shallow or offline checkout may not reach origin. Fall back to
  // whatever remote-tracking refs this clone already has.
  if (!out.trim()) out = tryCmd('git', ['for-each-ref', '--format=%(refname)', 'refs/remotes/origin/demo/*']);
  const slugs = [...out.matchAll(/(?:refs\/heads\/|refs\/remotes\/origin\/)demo\/(\S+)/g)].map((m) => m[1]);
  return [...new Set(slugs)].sort();
}

const shipped = shippedSlugs();
const have = new Set(await listClients());
const slugs = shipped.filter((s) => have.has(s));

if (shipped.length && !slugs.length) {
  console.log(`\n${shipped.length} demo/* branch(es) found (${shipped.join(', ')}), but none has a clients/ folder in this checkout.\n`);
}

await rm(OUT_DIR, { recursive: true, force: true });

const built = [];
for (const slug of slugs) {
  try {
    const res = await buildClient(slug, { outDir: OUT_DIR });
    if (res.broken.length) {
      console.log(`  SKIP  ${slug.padEnd(24)} ${res.broken.length} broken link(s) — left out of this deploy`);
      for (const b of res.broken.slice(0, 8)) console.log(`          ${b}`);
    } else {
      const files = await listFiles(res.dir);
      console.log(`  ok    ${slug.padEnd(24)} ${files.length} files · ${res.cfg.template}`);
      built.push(slug);
    }
  } catch (err) {
    console.log(`  SKIP  ${slug.padEnd(24)} ${err.message}`);
  }
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, 'index.html'), indexPage(built, shipped.length));

console.log(`\n${built.length} of ${shipped.length} shipped demo(s) built to dist-demos/\n`);
// Never fail the deploy over one bad client — an empty or partial demos
// site is still useful; a broken Vercel deployment is not.
process.exit(0);

function indexPage(slugs, shippedCount) {
  const rows = slugs.length
    ? slugs.map((s) => `    <li><a href="/${s}/">${s}</a></li>`).join('\n')
    : '    <li class="empty">Nothing shipped yet.</li>';
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Frontline Systems — demos</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;padding:48px 24px;background:#141517;color:#c9ccc6;
    font:17px/1.55 ui-sans-serif,system-ui,sans-serif}
  main{max-width:640px;margin:0 auto}
  h1{color:#eff0ec;font-size:28px;margin:0 0 6px}
  p{color:#a0a49f;margin:0 0 28px}
  ul{list-style:none;margin:0;padding:0;display:grid;gap:2px}
  a{display:block;padding:14px 16px;color:#7e9bee;text-decoration:none;
    border:1px solid rgba(239,240,236,.10);border-radius:8px;min-height:44px}
  a:hover{background:#1c1e21;color:#eff0ec}
  .empty{padding:14px 16px;color:#7c8078}
</style>
</head>
<body>
  <main>
    <h1>Demos</h1>
    <p>${slugs.length} shipped${shippedCount !== slugs.length ? ` of ${shippedCount} on record` : ''}. Not indexed. Send a link directly to the owner, never post it.</p>
    <ul>
${rows}
    </ul>
  </main>
</body>
</html>
`;
}
