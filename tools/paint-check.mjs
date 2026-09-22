/**
 * paint-check — does the page actually SHOW its content?
 *
 * Every demo has to survive four hostile conditions: no JavaScript, blocked
 * GSAP, reduced motion, and a 375px phone. This loads the page under each and
 * reports whether the things a visitor must see are on screen.
 *
 * It probes twice: once the moment the network settles (first paint, which is
 * what a no-JS or slow visitor gets) and again after animations have run, so a
 * tween caught mid-flight is not mistaken for content that never arrives.
 *
 *   node tools/paint-check.mjs <url> [--shots <dir>]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { launchOptions } from '../lib/browser.js';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--')) ?? 'http://127.0.0.1:8899/index.html';
const shotsAt = args.indexOf('--shots');
const shots = shotsAt !== -1 ? args[shotsAt + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });

/** The selectors every demo must render. Missing is as bad as hidden. */
const MUST_SHOW = {
  'hero headline': 'h1',
  'hero subhead': '.hero .sub, .hero-sub',
  'hero image': '.hero img, .hero video',
  'a call link': 'a[href^="tel:"]',
};

const CASES = [
  { name: 'desktop',        width: 1440, height: 900 },
  { name: 'phone-390',      width: 390,  height: 844 },
  { name: 'phone-375',      width: 375,  height: 812 },
  { name: 'phone-no-js',    width: 390,  height: 844, js: false },
  { name: 'phone-no-gsap',  width: 390,  height: 844, blockGsap: true },
  { name: 'phone-reduced',  width: 390,  height: 844, reduced: true },
];

/** Runs in the page. Returns one verdict per required selector, plus page-level facts. */
function probe(mustShow) {
  const verdict = (sel) => {
    // Any matching element counts: a call button may be duplicated per breakpoint.
    const els = [...document.querySelectorAll(sel)];
    if (!els.length) return 'MISSING';
    let best = 'hidden';
    for (const el of els) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (+s.opacity === 0) { best = 'transparent'; continue; }
      return Math.round(r.top) < window.innerHeight ? 'above-fold' : 'below-fold';
    }
    return best;
  };
  const out = { fields: {} };
  for (const [label, sel] of Object.entries(mustShow)) out.fields[label] = verdict(sel);
  out.overflowPx = document.documentElement.scrollWidth - window.innerWidth;
  out.textChars = document.body.innerText.trim().length;
  // Anything a visitor could read that looks unfinished.
  const text = document.body.innerText;
  out.placeholders = (text.match(/\$?X{2,}|\[[^\]]{2,40}\]|Lorem ipsum|TODO|TBC|\bXXX\b/gi) || []).slice(0, 6);
  // Tap targets smaller than 44px, which is the thumb minimum.
  // A link sitting inline inside a sentence is exempt (WCAG 2.5.8 says so, and
  // padding one out to 44px breaks the line it is written into), so only
  // standalone links and controls are counted.
  const inlineInProse = (el) => {
    if (el.tagName !== 'A') return false;
    const p = el.parentElement;
    if (!p) return false;
    if (!/^(P|LI|SPAN|SMALL|DIV|TD|SUMMARY)$/.test(p.tagName)) return false;
    // Text either side of it means it is part of a sentence, not a button.
    return (p.textContent || '').trim().length > (el.textContent || '').trim().length + 4;
  };
  out.smallTargets = [...document.querySelectorAll('a,button,[role="button"],input,select,textarea')]
    .filter((el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0 && r.height < 44)) return false;
      return !inlineInProse(el);
    })
    .map((el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ${Math.round(el.getBoundingClientRect().height)}px`)
    .slice(0, 6);
  return out;
}

// Through lib/browser.js, which finds whatever Chromium build is actually on
// disk. Launching bare made Playwright look for the headless-shell build
// matching its own npm version, which this box does not have, and the tool
// died before it could check anything.
const browser = await chromium.launch(launchOptions());
let failures = 0;

for (const c of CASES) {
  const ctx = await browser.newContext({
    viewport: { width: c.width, height: c.height },
    javaScriptEnabled: c.js !== false,
    reducedMotion: c.reduced ? 'reduce' : 'no-preference',
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  if (c.blockGsap) await page.route(/gsap|ScrollTrigger/i, (r) => r.abort());

  const consoleErrors = [];
  const failedReqs = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // When we block GSAP ourselves the browser logs the aborted fetch. That is
    // the test working, not the page failing.
    if (c.blockGsap && /ERR_FAILED|Failed to load resource/i.test(m.text())) return;
    consoleErrors.push(m.text());
  });
  page.on('requestfailed', (r) => { if (!c.blockGsap || !/gsap|ScrollTrigger/i.test(r.url())) failedReqs.push(r.url()); });

  await page.goto(url, { waitUntil: 'networkidle' });
  const atPaint = await page.evaluate(probe, MUST_SHOW);
  await page.waitForTimeout(2600); // let the intro timeline finish
  const settled = await page.evaluate(probe, MUST_SHOW);

  const label = `${c.name} ${c.width}x${c.height}`;
  const flags = [c.js === false && 'no-js', c.blockGsap && 'gsap-blocked', c.reduced && 'reduced-motion']
    .filter(Boolean).join(' ');
  console.log(`\n── ${label}${flags ? '  [' + flags + ']' : ''}`);

  for (const [name, verdict] of Object.entries(settled.fields)) {
    const first = atPaint.fields[name];
    const ok = verdict === 'above-fold' || verdict === 'below-fold';
    if (!ok) failures++;
    const note = first !== verdict ? `  (at first paint: ${first})` : '';
    console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${name}: ${verdict}${note}`);
  }
  if (settled.overflowPx > 1) { failures++; console.log(`   FAIL horizontal scroll: +${settled.overflowPx}px`); }
  else console.log('   ok   no horizontal scroll');
  if (settled.placeholders.length) { failures++; console.log(`   FAIL placeholder text visible: ${settled.placeholders.join(' · ')}`); }
  else console.log('   ok   no placeholder text');
  if (settled.smallTargets.length) console.log(`   note tap targets under 44px: ${settled.smallTargets.join(' · ')}`);
  console.log(`   text ${settled.textChars} chars · console errors ${consoleErrors.length} · failed requests ${failedReqs.length}`);
  if (consoleErrors.length) { failures++; console.log(`   FAIL console: ${consoleErrors.slice(0, 3).join(' | ')}`); }
  if (failedReqs.length) { failures++; console.log(`   FAIL requests: ${failedReqs.slice(0, 3).join(' | ')}`); }

  if (shots) await page.screenshot({ path: `${shots}/${c.name}.png` });
  await ctx.close();
}

await browser.close();
console.log(`\n${failures ? `${failures} problem(s)` : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
