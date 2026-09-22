#!/usr/bin/env node
/**
 * npm run build            — every client to dist/<slug>/
 * npm run build -- <slug>  — just one
 *
 * Fails on a broken link, so a demo can never go out with a missing photo.
 */
import { listClients, DIST_DIR } from '../lib/config.js';
import { buildClient, listFiles } from '../lib/build.js';
import { rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const all = await listClients();

if (all.length === 0) {
  console.log('\nNo clients yet. Add one with:  npm run new -- <slug> <url> <industry>\n');
  process.exit(0);
}

const slugs = args.length ? args : all;
for (const s of slugs) {
  if (!all.includes(s)) {
    console.error(`\nNo client "${s}". Available: ${all.join(', ')}\n`);
    process.exit(2);
  }
}

if (!args.length) await rm(DIST_DIR, { recursive: true, force: true });

let failed = 0;
const built = [];

for (const slug of slugs) {
  try {
    const res = await buildClient(slug);
    const files = await listFiles(res.dir);
    const kb = (res.bytes / 1024).toFixed(0);
    if (res.broken.length) {
      failed++;
      console.log(`  FAIL  ${slug.padEnd(24)} ${res.broken.length} broken link(s)`);
      for (const b of res.broken.slice(0, 8)) console.log(`          ${b}`);
    } else {
      console.log(`  ok    ${slug.padEnd(24)} ${String(kb).padStart(4)} KB html · ${files.length} files · ${res.cfg.template}`);
      built.push(slug);
    }
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${slug.padEnd(24)} ${err.message}`);
  }
}

// An index so Pat can find every demo from one link during a calling session.
if (!args.length && built.length) {
  await mkdir(DIST_DIR, { recursive: true });
  await writeFile(join(DIST_DIR, 'index.html'), indexPage(built));
}

console.log(`\n${built.length} built${failed ? `, ${failed} failed` : ''}\n`);
process.exit(failed ? 1 : 0);

function indexPage(slugs) {
  const rows = slugs.map((s) => `    <li><a href="/${s}/">${s}</a></li>`).join('\n');
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
</style>
</head>
<body>
  <main>
    <h1>Demos</h1>
    <p>Not indexed. Send a link directly to the owner, never post it.</p>
    <ul>
${rows}
    </ul>
  </main>
</body>
</html>
`;
}
