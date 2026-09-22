/**
 * single-check — is the one-file copy the same page as the one that deploys?
 *
 *   node tools/single-check.mjs [slug ...]
 *
 * Opens dist-single/<slug>.html off disk with EVERY network request refused,
 * and the served dist/<slug>/ next to it, and compares them. The point is not
 * that the single file renders — it is that nothing quietly went missing when
 * forty files were folded into one.
 *
 * Network is blocked rather than merely absent so the result means something:
 * a file:// page makes no requests, so "it worked offline" proves nothing on
 * its own. An aborted request is loud.
 */
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';
import { chromePath } from '../lib/browser.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
};

/** What a page looks like, in the few numbers that would change if this broke. */
const PROBE = () => {
  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const imgs = [...document.images];
  const h1 = [...document.querySelectorAll('h1')].find(vis);
  const tel = [...document.querySelectorAll('a[href^="tel:"]')].find(vis);
  return {
    imgCount: imgs.length,
    imgLoaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    imgBroken: imgs.filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => (i.currentSrc || i.src || '').slice(0, 60)),
    // Every <img> the page shows, keyed by what it is, so a swapped size is
    // visible but a swapped PHOTO is too.
    imgBoxes: imgs.filter(vis).map((i) => `${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)}`).join('|'),
    text: document.body.innerText.replace(/\s+/g, ' ').trim(),
    h1Top: h1 ? Math.round(h1.getBoundingClientRect().top) : null,
    h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
    h1Size: h1 ? getComputedStyle(h1).fontSize : null,
    telTop: tel ? Math.round(tel.getBoundingClientRect().top) : null,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    height: document.documentElement.scrollHeight,
    sections: [...document.querySelectorAll('section, footer, header')].filter(vis).length,
    gsap: typeof window.gsap !== 'undefined',
    banner: Boolean(document.querySelector('.fl-demobar')) && vis(document.querySelector('.fl-demobar') ?? document.createElement('i')),
    fontsLoaded: document.fonts ? document.fonts.size : -1,
  };
};

async function open(browser, url, { width, height, js, blockNetwork }) {
  const ctx = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: js, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  const blocked = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  if (blockNetwork) {
    // file:// is served by the protocol handler, not the network stack, so this
    // only ever fires on something the page genuinely reached out for.
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('file://') || u.startsWith('data:') || u.startsWith('about:')) return route.continue();
      blocked.push(u.slice(0, 80));
      return route.abort();
    });
  }
  await page.goto(url, { waitUntil: js ? 'load' : 'domcontentloaded' });
  await page.waitForTimeout(js ? 2600 : 500);
  const probe = await page.evaluate(PROBE);
  await ctx.close();
  return { ...probe, errors, blocked };
}

function serve(dir, port) {
  return new Promise((ok) => {
    const s = createServer((req, res) => {
      const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
      let path = join(dir, rel);
      if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
      if (!existsSync(path)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream' });
      createReadStream(path).pipe(res);
    });
    s.listen(port, '127.0.0.1', () => ok(s));
  });
}

/* --------------------------------------------------------------------- main */

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const slugs = only.length ? only : (await readdir('dist-single'))
  .filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => f.replace(/\.html$/, '')).sort();

const { chromium } = await import('playwright');
const exe = chromePath();
const port = 8971;
const server = await serve('dist', port);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
let bad = 0;

const VIEWS = [
  ['375px', { width: 375, height: 812, js: true }],
  ['390px', { width: 390, height: 844, js: true }],
  ['1440px', { width: 1440, height: 900, js: true }],
  ['390px, no JS', { width: 390, height: 844, js: false }],
];

try {
  for (const slug of slugs) {
    console.log(`\n${'═'.repeat(64)}\n${slug}\n${'═'.repeat(64)}`);
    const fails = [];
    for (const [label, view] of VIEWS) {
      const one = await open(browser, `file://${resolve('dist-single', `${slug}.html`)}`, { ...view, blockNetwork: true });
      const real = await open(browser, `http://127.0.0.1:${port}/${slug}/index.html`, { ...view, blockNetwork: false });

      const say = [];
      const fail = (m) => { fails.push(`${label}: ${m}`); say.push(`    ✗ ${m}`); };

      if (one.blocked.length) fail(`reached for ${one.blocked.length} thing(s) off the page — ${one.blocked[0]}`);
      if (one.errors.length > real.errors.length) {
        fail(`${one.errors.length} error(s) against the real page's ${real.errors.length} — ${one.errors[0].slice(0, 90)}`);
      }
      if (one.imgCount !== real.imgCount) fail(`${one.imgCount} images, the real one has ${real.imgCount}`);
      // Compared, never asserted. Images below the fold are lazy and have not
      // loaded yet in either page, and the aperture ships one <img> with no src
      // for JS to fill — both are true of the deployed build too, so the only
      // thing that means anything is a difference.
      // Fewer is a fault. More is not: a data URI decodes instantly where the
      // real page is still fetching a lazy image when the clock runs out.
      if (one.imgLoaded < real.imgLoaded) {
        fail(`only ${one.imgLoaded} of ${one.imgCount} images loaded, the real one gets ${real.imgLoaded}`);
      }
      if (one.imgBroken.length !== real.imgBroken.length) {
        fail(`${one.imgBroken.length} image(s) did not decode against the real page's ${real.imgBroken.length} — ${one.imgBroken[0]}`);
      }
      if (one.text !== real.text) {
        const i = [...one.text].findIndex((c, n) => c !== real.text[n]);
        fail(`the words differ from the real page at character ${i}: "${one.text.slice(Math.max(0, i - 25), i + 35)}" vs "${real.text.slice(Math.max(0, i - 25), i + 35)}"`);
      }
      if (one.sections !== real.sections) fail(`${one.sections} visible sections, the real one has ${real.sections}`);
      if (one.h1Top === null) fail('no visible h1');
      if (one.h1Font !== real.h1Font) fail(`headline font is ${one.h1Font}, the real one is ${real.h1Font}`);
      if (one.h1Size !== real.h1Size) fail(`headline is ${one.h1Size}, the real one is ${real.h1Size}`);
      if (one.overflow > 1) fail(`horizontal scroll, ${one.overflow}px too wide`);
      if (view.js && !one.gsap) fail('gsap did not load, so the inlined vendor scripts are broken');
      if (one.imgBoxes !== real.imgBoxes) fail('an image is laid out at a different size than on the real page');
      const drift = real.height ? Math.abs(one.height - real.height) / real.height : 0;
      if (drift > 0.01) fail(`the page is ${one.height}px tall, the real one is ${real.height}px (${(drift * 100).toFixed(1)}% out)`);

      console.log(`  ${label.padEnd(14)} ${say.length ? '' : 'same as the real page'} · ${one.imgLoaded}/${one.imgCount} images (real: ${real.imgLoaded}) · ${one.height}px tall${view.js ? ` · gsap ${one.gsap ? 'yes' : 'NO'}` : ''}`);
      say.forEach((s) => console.log(s));
    }
    if (fails.length) bad++;
    console.log(`\n  ${fails.length ? `${fails.length} PROBLEM(S)` : 'identical to the deployed build, with the network switched off'}`);
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${slugs.length - bad} of ${slugs.length} single-file copies match\n`);
process.exit(bad ? 1 : 0);
