/**
 * compare — screenshot two URLs at the same sizes, so a rebuilt page can be put
 * beside the hand-built original it came from. Any difference is either a fix
 * we can name or a bug.
 *
 *   node tools/compare.mjs <urlA> <urlB> <outDir>
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [a, b, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SIZES = [[1440, 900], [390, 844]];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
for (const [w, h] of SIZES) {
  for (const [label, url] of [['a', a], ['b', b]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(url + (url.includes('?') ? '&' : '?') + 'clean=1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${out}/${w}-${label}.png`, fullPage: true });
    const m = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      sections: [...document.querySelectorAll('main > section')].map((s) => s.id || s.className.split(' ')[0]),
      h2: [...document.querySelectorAll('h2')].map((x) => x.textContent.trim()).slice(0, 20),
    }));
    console.log(`${w}px ${label}: ${m.height}px tall · ${m.sections.length} sections [${m.sections.join(', ')}]`);
    await ctx.close();
  }
}
await browser.close();
