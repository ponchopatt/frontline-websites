import { chromium } from 'playwright';
import { launchOptions } from '/home/user/frontline-websites/lib/browser.js';
const out = '/tmp/review-utopian3';
const url = 'http://localhost:8972/utopian-landscaping/';
const browser = await chromium.launch(launchOptions());
for (const w of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, deviceScaleFactor: w === 390 ? 2 : 1, isMobile: w===390, hasTouch: w===390 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.type()+': '+m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errs.push('reqfail: ' + r.url()));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/first-${w}.png` });
  // scroll through to trigger lazy/reveal
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 400) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(120); }
  await page.waitForTimeout(800);
  // sticky bar screenshot mid-page
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.45));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/mid-${w}.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/full-${w}.png`, fullPage: true });
  const info = await page.evaluate(() => {
    const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
    const imgs = [...document.images].map(i => ({ src: i.currentSrc.split('/').pop(), nat: i.naturalWidth + 'x' + i.naturalHeight, disp: Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height), alt: i.alt, complete: i.complete }));
    const bgs = [...document.querySelectorAll('*')].map(e => getComputedStyle(e).backgroundImage).filter(b => b && b !== 'none' && b.includes('url'));
    const links = [...document.querySelectorAll('a[href^="tel:"],a[href^="sms:"],a[href^="mailto:"]')].map(a => a.href + ' | ' + a.textContent.trim().replace(/\s+/g,' '));
    const fixed = [...document.querySelectorAll('*')].filter(e => ['fixed','sticky'].includes(getComputedStyle(e).position)).map(e => e.tagName + '.' + e.className + ' ' + JSON.stringify(e.getBoundingClientRect()));
    return { sw, cw, imgs, bgs: [...new Set(bgs)], links, fixed, h: document.documentElement.scrollHeight };
  });
  console.log('=== width', w, JSON.stringify(info, null, 1));
  console.log('errors', errs);
  if (w === 390) {
    const txt = await page.evaluate(() => document.body.innerText);
    (await import('fs')).writeFileSync(`${out}/text-390.txt`, txt);
  }
  await ctx.close();
}
await browser.close();
