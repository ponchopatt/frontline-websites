import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const OUT = '/tmp/claude-0/-home-user-frontline-websites/bc809aa7-8a10-5005-94f8-9f158a783c17/scratchpad/act';
const server = spawn('node', ['tools/serve.mjs', 'dist', '8972'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const url = 'http://localhost:8972/act-landscape-construction/';
const sels = (process.argv[2] || '#top,#aperture,#owner').split(',');
for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${OUT}/${tag}-top.png` });
  for (const s of sels) {
    const el = await p.$(s); if (!el) { console.log('missing', s); continue; }
    await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
    const box = await el.boundingBox();
    await p.evaluate(y => window.scrollTo(0, y), box.y + (await p.evaluate(() => scrollY)) - 0);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${tag}-${s.replace(/[#.]/g, '')}.png` });
  }
  await p.close();
}
await browser.close(); server.kill();
