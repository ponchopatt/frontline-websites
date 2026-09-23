/**
 * lh — Lighthouse mobile audit, printed as four numbers and the metrics that
 * actually move them. Used by `npm run check`.
 *
 *   node tools/lh.mjs <url> [--desktop]
 *
 * A demo scores SEO in the 60s on purpose: it ships noindex, and "Page is
 * blocked from indexing" is the only audit that fails. That is the point of a
 * demo carrying someone else's brand, so the SEO number is reported but never
 * treated as a failure.
 */
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const desktop = args.includes('--desktop');
if (!url) { console.error('usage: node tools/lh.mjs <url> [--desktop]'); process.exit(2); }

const chrome = await launch({
  chromePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const { lhr } = await lighthouse(url, {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    formFactor: desktop ? 'desktop' : 'mobile',
    screenEmulation: desktop
      ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
      : { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
    throttling: desktop
      ? { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 }
      : { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
  });

  const pct = (c) => (lhr.categories[c] ? Math.round(lhr.categories[c].score * 100) : null);
  const metric = (id) => lhr.audits[id]?.displayValue ?? '—';

  console.log(`\nLighthouse ${desktop ? 'desktop' : 'mobile'} — ${url}`);
  console.log(`  Performance ${pct('performance')} · Accessibility ${pct('accessibility')} · ` +
              `Best Practices ${pct('best-practices')} · SEO ${pct('seo')}`);
  console.log(`  FCP ${metric('first-contentful-paint')} · LCP ${metric('largest-contentful-paint')} · ` +
              `TBT ${metric('total-blocking-time')} · CLS ${metric('cumulative-layout-shift')}`);

  const failed = Object.values(lhr.audits)
    .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative')
    .map((a) => `${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`);
  if (failed.length) {
    console.log('  worth a look:');
    for (const f of failed.slice(0, 10)) console.log(`    · ${f}`);
  }
} finally {
  await chrome.kill();
}
