import { chromium } from 'playwright';
const [url, ...sels] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.goto(url + '?clean=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
console.log(await p.evaluate((sels) => sels.map((s) => {
  const el = document.querySelector(s);
  if (!el) return `${s}: MISSING`;
  const r = el.getBoundingClientRect(), c = getComputedStyle(el);
  return `${s}: ${Math.round(r.width)}x${Math.round(r.height)} @ top ${Math.round(r.top)} · display=${c.display} pos=${c.position} z=${c.zIndex} opacity=${c.opacity} vis=${c.visibility}`;
}).join('\n'), sels));
await b.close();
