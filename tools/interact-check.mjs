/**
 * interact-check — drive the parts of a demo that only exist because of JS.
 *
 * The build inlines and strips comments from the runtime, so "it renders" is
 * not enough: the price guide, the colour picker and the form all have to still
 * work afterwards. This clicks them the way a visitor would.
 *
 *   node tools/interact-check.mjs <url>
 */
import { chromium } from 'playwright';
import { launchOptions } from '../lib/browser.js';

const url = process.argv[2];
if (!url) { console.error('usage: node tools/interact-check.mjs <url>'); process.exit(2); }

const browser = await chromium.launch(launchOptions());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(url + '?clean=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures++;
};

/* ------------------------------------------------------------ price guide */

if (await page.$('#pgPrice')) {
  const before = (await page.textContent('#pgPrice'))?.trim();
  check('price guide shows a price on load', /\$\d/.test(before ?? ''), before);

  // Bump the quantity and the number must move.
  if (await page.$('#pgPlus')) {
    for (let i = 0; i < 5; i++) await page.click('#pgPlus');
    await page.waitForTimeout(900);
    const after = (await page.textContent('#pgPrice'))?.trim();
    check('price changes when the quantity does', after !== before, `${before} -> ${after}`);
  }

  // Switching to a quote-only job must stop showing a number.
  const repair = await page.$('input[name=pgJob][value=repair]');
  if (repair) {
    await repair.click();
    await page.waitForTimeout(600);
    const txt = (await page.textContent('#pgPrice'))?.trim();
    check('a quote-only job shows no number', !/\$\d/.test(txt ?? ''), txt);
  }
}

/* --------------------------------------------------------- colour picker */

if (await page.$('#swatches')) {
  const count = await page.$$eval('#swatches .swatch', (n) => n.length);
  check('colour swatches rendered', count > 0, `${count} colours`);
  if (count > 1) {
    const before = await page.getAttribute('#swatchA', 'src');
    await page.click('#swatches .swatch:nth-child(3)');
    await page.waitForTimeout(1200);
    const name = (await page.textContent('#swatchName'))?.trim();
    const bSrc = await page.getAttribute('#swatchB', 'src');
    check('picking a colour swaps the photo and the name', Boolean(name) && bSrc !== before, `now ${name}`);
  }
}

/* ------------------------------------------------------------------ form */

if (await page.$('#quoteForm')) {
  // Empty submit must be refused, not sent.
  await page.click('#qSend');
  await page.waitForTimeout(400);
  const errShown = await page.$eval('#formErr', (el) => !el.hidden).catch(() => false);
  const stillOnForm = await page.$eval('#quoteForm', (el) => !el.hidden);
  check('an empty form is refused', errShown && stillOnForm);

  // Fill it properly and it must reach the demo-mode thank-you.
  await page.fill('#qName', 'Test Person');
  await page.fill('#qPhone', '0412 345 678');
  await page.fill('#qSuburb', 'Bomaderry');
  const requests = [];
  page.on('request', (r) => { if (r.method() === 'POST') requests.push(r.url()); });
  await page.click('#qSend');
  await page.waitForTimeout(900);

  const thanksShown = await page.$eval('#thanks', (el) => !el.hidden).catch(() => false);
  const head = (await page.textContent('#thanksHead'))?.trim();
  const note = await page.$eval('#thanksNote', (el) => (el.hidden ? '' : el.textContent.trim())).catch(() => '');
  check('a filled form reaches the thank-you', thanksShown, head);
  check('demo mode says so plainly', /demo mode/i.test(note), note.slice(0, 70));
  check('demo mode makes no network call', requests.length === 0, requests.join(', '));
}

/* --------------------------------------------------------- before/after */

if (await page.$('.fl-ba-range')) {
  await page.$eval('.fl-ba-range', (el) => { el.value = 20; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(300);
  const clip = await page.$eval('.fl-ba-after', (el) => el.style.clipPath);
  check('before/after slider clips to the input', /20%/.test(clip), clip);
}

check('no console errors', errors.length === 0, errors[0] ?? '');

await browser.close();
console.log(failures ? `\n${failures} problem(s)\n` : '\nall interactions work\n');
process.exit(failures ? 1 : 0);
