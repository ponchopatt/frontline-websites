#!/usr/bin/env node
/**
 * npm run check -- <slug>          one client
 * npm run check                    every client
 *
 *   --draft    let the "to confirm" list through, so you can check your work
 *              while you are still filling in the blanks
 *   --fast     skip Lighthouse (it is the slow part)
 *
 * Exits non-zero if anything failed, so this can gate a deploy.
 */
import { createServer } from 'node:http';
import { createGzip } from 'node:zlib';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { listClients, DIST_DIR } from '../lib/config.js';
import { buildClient } from '../lib/build.js';
import { staticChecks, pageChecks, lighthouseScores } from '../lib/check.js';
import { chromePath } from '../lib/browser.js';

const args = process.argv.slice(2);
const draft = args.includes('--draft');
const fast = args.includes('--fast');
const only = args.filter((a) => !a.startsWith('--'));

const all = await listClients();
if (!all.length) {
  console.log('\nNo clients yet. Add one with:  npm run new -- <slug> <url> <industry>\n');
  process.exit(0);
}
const slugs = only.length ? only : all;
for (const s of slugs) {
  if (!all.includes(s)) { console.error(`\nNo client "${s}". Available: ${all.join(', ')}\n`); process.exit(2); }
}

const exe = chromePath();
const port = 8930;
const server = await serve(DIST_DIR, port);
let failed = 0;

try {
  for (const slug of slugs) {
    console.log(`\n${'═'.repeat(66)}\n${slug}\n${'═'.repeat(66)}`);

    let built;
    try {
      built = await buildClient(slug, { quiet: true });
    } catch (err) {
      console.log(`  FAIL  could not build: ${err.message}`);
      failed++;
      continue;
    }

    const cfg = built.cfg;
    const blockers = [];
    const confirm = [];
    const notes = [];

    for (const b of built.broken) blockers.push(`broken link in the built page: ${b}`);

    const s = await staticChecks(cfg, built.dir);
    blockers.push(...s.blockers);
    confirm.push(...s.confirm);
    notes.push(...s.notes);

    const url = `http://127.0.0.1:${port}/${slug}/index.html`;
    const p = await pageChecks(url, { chromePath: exe });
    blockers.push(...p.blockers);
    notes.push(...p.notes);

    /* ------------------------------------------------------------- report */

    if (blockers.length) {
      console.log(`\n  BLOCKERS — do not send this until these are fixed (${blockers.length})`);
      for (const b of blockers) console.log(`    ✗ ${b}`);
    } else {
      console.log('\n  No blockers. Nothing on this page would embarrass us.');
    }

    if (confirm.length) {
      console.log(`\n  TO CONFIRM — guessed or not yet filled in (${confirm.length})`);
      for (const c of confirm) console.log(`    ? ${c}`);
    }

    if (notes.length) {
      console.log('\n  Notes');
      for (const n of notes) console.log(`    · ${n}`);
    }

    if (!fast) {
      const lh = await lighthouseScores(url, { chromePath: exe });
      if (lh?.error) {
        console.log(`\n  Lighthouse did not run: ${lh.error}`);
      } else if (lh) {
        console.log(`\n  Lighthouse mobile`);
        console.log(`    Performance ${lh.performance} · Accessibility ${lh.accessibility} · Best Practices ${lh.bestPractices} · SEO ${lh.seo}`);
        console.log(`    FCP ${lh.fcp} · LCP ${lh.lcp} · TBT ${lh.tbt} · CLS ${lh.cls}`);
        if (lh.performance < 90) notes.push(`performance is ${lh.performance}, under the 90 we aim for`);
        if (cfg.live !== true && lh.seo < 90) {
          console.log('    SEO is low because the page ships noindex. That is the point of a demo.');
        }
        if (lh.performance < 90) console.log(`    ! performance ${lh.performance} is under 90`);
      }
    }

    const bad = blockers.length > 0 || (!draft && confirm.length > 0);
    if (bad) failed++;
    console.log(`\n  ${bad ? 'NOT READY' : 'READY TO SEND'}${draft && confirm.length ? '  (--draft: ignoring the to-confirm list)' : ''}`);
  }
} finally {
  server.close();
}

console.log(`\n${slugs.length - failed} of ${slugs.length} ready${draft ? ' (draft mode)' : ''}\n`);
process.exit(failed ? 1 : 0);

/* --------------------------------------------------------------------- serve */

function serve(dir, port) {
  const TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.txt': 'text/plain; charset=utf-8',
  };
  return new Promise((resolve) => {
    const s = createServer((req, res) => {
      const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
      let path = join(dir, rel);
      if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
      if (!existsSync(path)) { res.writeHead(404); res.end('Not found'); return; }
      // Vercel serves text compressed, so measuring without it understates the
      // score a prospect will actually get.
      const type = TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
      const compressible = /^(text\/|application\/(json|javascript))/.test(type) || type.includes('svg');
      if (compressible && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
        res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
        createReadStream(path).pipe(createGzip()).pipe(res);
        return;
      }
      res.writeHead(200, { 'Content-Type': type });
      createReadStream(path).pipe(res);
    });
    s.listen(port, '127.0.0.1', () => resolve(s));
  });
}
