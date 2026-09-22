import { chromium } from 'playwright';
import { launchOptions } from '../lib/browser.js';
// launchOptions() finds the Chromium this machine actually has; a bare
// launch looks for the build matching Playwright's own version.
const b = await chromium.launch(launchOptions());
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.goto(process.argv[2] + '?clean=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
console.log((await p.evaluate(() => [...document.querySelectorAll('a,button')].filter((el) => {
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.height < 44;
}).map((el) => {
  const r = el.getBoundingClientRect();
  const parent = el.closest('section,footer,header,nav');
  return `${Math.round(r.height)}px  ${el.tagName.toLowerCase()}.${(el.className || '(none)').toString().split(' ')[0]}  in ${parent ? (parent.id || parent.tagName.toLowerCase()) : '?'}  "${el.textContent.trim().slice(0, 30)}"`;
}))).join('\n'));
await b.close();
