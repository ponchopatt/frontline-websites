/**
 * previews — three reviewer screenshots for one built client: mobile hero,
 * mobile full page (scaled down to a readable contact sheet), desktop hero.
 *
 *   node tools/previews.mjs <slug> [port]
 *
 * Writes to clients/<slug>/shots/ (gitignored — regenerate any time):
 *   mobile-hero.png          390×844, top of page
 *   mobile-full.png          390 wide, whole page, full resolution
 *   mobile-full-scaled.png   same, resized to 500px wide for a quick look
 *   desktop-hero.png         1440×900, top of page
 *
 * Two real bugs bit early versions of this script and are worth knowing
 * about if screenshots ever look wrong again:
 *
 * 1. Reduced motion, not manual waits, for anything scroll-triggered.
 *    Every template here skips its whole GSAP motion() function under
 *    prefers-reduced-motion (see templates/trust/page.js: "if(...||reduce)
 *    return" — CSS defaults are each element's final state). Emulating that
 *    instead of guessing animation/ScrollTrigger timing is what actually
 *    made count-up stat numbers render — no wait duration, however long,
 *    fixed it, because the element's DOM state was already correct
 *    (confirmed by direct inspection) but Chromium's paint under
 *    Playwright's own fullPage capture (see next point) was still wrong.
 *
 * 2. Never use page.screenshot({fullPage:true}) in this environment. It has
 *    a confirmed rendering bug: some elements paint blank in the fullPage
 *    capture despite correct DOM state (right text, opacity:1) both before
 *    and after the call, and render fine in an ordinary small-viewport
 *    screenshot. Tile-and-stitch instead (below) — and when you do, read
 *    back the ACTUAL scroll position after each scrollTo (the browser
 *    clamps at max-scrollable, which can be less than requested, e.g. on
 *    the last tile) rather than trusting the requested y. Compositing at
 *    the requested-but-unclamped offset duplicated whole sections (a
 *    footer "Explore" list showed up twice) in early runs of this script.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromePath } from '../lib/browser.js';

const slug = process.argv[2];
const port = process.argv[3] || 8901;
if (!slug) {
  console.error('usage: node tools/previews.mjs <slug> [port]');
  process.exit(1);
}

const outDir = `clients/${slug}/shots`;
mkdirSync(outDir, { recursive: true });

const server = spawn('node', ['tools/serve.mjs', 'dist', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const exe = chromePath();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
try {
  const url = `http://localhost:${port}/${slug}/`;

  async function fullPageScreenshot(page, outPath) {
    const { width, height } = page.viewportSize();
    const total = await page.evaluate(() => document.body.scrollHeight);
    const tiles = [];
    let y = 0;
    while (true) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(150);
      const actualY = await page.evaluate(() => window.scrollY);
      const buf = await page.screenshot();
      tiles.push({ input: buf, top: actualY, left: 0 });
      if (actualY + height >= total) break;
      y += height;
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await sharp({ create: { width, height: total, channels: 3, background: '#000' } })
      .composite(tiles)
      .png()
      .toFile(outPath);
    return total;
  }

  async function settleImages(page) {
    // scroll through once so native loading="lazy" images fire, then back to top
    const step = await page.evaluate(() => window.innerHeight);
    const max = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < max; y += step) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page
      .waitForFunction(
        () => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
        { timeout: 15000 },
      )
      .catch(() => {});
    await page.waitForTimeout(300);
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await mobile.goto(url, { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: `${outDir}/mobile-hero.png` });
  await settleImages(mobile);
  const fullHeight = await fullPageScreenshot(mobile, `${outDir}/mobile-full.png`);
  await mobile.close();

  await sharp(`${outDir}/mobile-full.png`)
    .resize({ width: 500 })
    .toFile(`${outDir}/mobile-full-scaled.png`);

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await desktop.goto(url, { waitUntil: 'networkidle' });
  await desktop.screenshot({ path: `${outDir}/desktop-hero.png` });
  await desktop.close();

  console.log(`ok    ${slug}    mobile ${fullHeight}px tall -> ${outDir}/`);
} finally {
  await browser.close();
  server.kill();
}
