/**
 * check — would this demo embarrass us if Pat sent it right now?
 *
 * Two tiers, because they mean different things:
 *
 *   BLOCKERS      things a prospect would see and judge us for. Placeholder
 *                 text, a missing photo, a phone number that will not dial,
 *                 a stat we cannot source. These always fail.
 *
 *   TO CONFIRM    values `npm run new` guessed off their website and nobody
 *                 has checked yet. These fail too, so a demo cannot go out on
 *                 autopilot — but `--draft` lets them through while you are
 *                 still filling the blanks.
 *
 * The design rule is the one this repo's own checker already states: every
 * check exists because the thing it looks for actually went wrong once.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findChecks, missingRequired, RATING_FLOOR } from './config.js';

/** Text a visitor should never read. */
const PLACEHOLDER_PATTERNS = [
  [/\[[^\]]{2,60}\]/, 'square-bracketed text'],
  [/\$?X{2,}(?:,X{3})*/, 'an X,XXX price stub'],
  [/lorem ipsum/i, 'lorem ipsum'],
  [/\bTODO\b|\bTBC\b|\bFIXME\b/i, 'a TODO or TBC'],
  [/\?{3,}/, '???'],
  [/\bundefined\b|\bnull\b|\[object Object\]|\bNaN\b/, 'a leaked JavaScript value'],
  [/{{\s*\w+\s*}}|\$\{\w+\}/, 'an unfilled template token'],
  [/(?:^|\s)#{2,}\s+\w/, 'raw markdown'],
];

/**
 * Stats that read as invented.
 *
 * A round number is the tell. Nobody has done exactly 500 jobs; they have done
 * 487 and rounded it, or somebody made it up. A demo that claims a suspiciously
 * tidy figure is the one a sceptical owner picks at first.
 */
function suspiciousStats(cfg) {
  const out = [];
  const s = cfg.stats ?? {};
  if (s.googleRating != null) {
    if (s.googleRating > 5 || s.googleRating < 1) out.push(`googleRating ${s.googleRating} is not a rating`);
    if (s.googleRating === 5) out.push('googleRating is exactly 5.0 — confirm it on their profile, and check there is no 1-star buried in there');
    if (s.reviewCount == null) out.push('googleRating is set but reviewCount is not; a rating with no count behind it invites the question');
  }
  if (s.reviewCount != null && s.googleRating == null) {
    out.push('reviewCount is set with no rating beside it, which reads as a rating being hidden');
  }
  if (s.yearsInBusiness != null && (s.yearsInBusiness > 70 || s.yearsInBusiness < 1)) {
    out.push(`yearsInBusiness ${s.yearsInBusiness} looks wrong`);
  }
  for (const key of ['jobsDone', 'reviewCount']) {
    const v = s[key];
    if (v == null) continue;
    if (v >= 100 && v % 100 === 0) out.push(`${key} is exactly ${v}, which reads as a guess — use their real figure`);
  }
  return out;
}

/** Everything that can be judged without opening a browser. */
export async function staticChecks(cfg, distDir) {
  const blockers = [];
  const confirm = [];
  const notes = [];

  for (const field of missingRequired(cfg)) blockers.push(`missing required field: ${field}`);

  for (const path of findChecks(cfg)) confirm.push(path);

  for (const problem of suspiciousStats(cfg)) blockers.push(problem);

  // Phone
  const phone = cfg.business?.phone ?? {};
  if (phone.display && !phone.e164) {
    blockers.push(`phone "${phone.display}" cannot be dialled — no E.164 form`);
  } else if (phone.e164 && !/^\+\d{8,15}$/.test(phone.e164)) {
    blockers.push(`phone e164 "${phone.e164}" is not a valid E.164 number`);
  }

  // Email
  if (cfg.business?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cfg.business.email)) {
    blockers.push(`email "${cfg.business.email}" does not look like an address`);
  }

  // Reviews: present but empty is the normal state until Pat pastes them in.
  if (!(cfg.reviews ?? []).length) {
    confirm.push('reviews (paste them from their Google profile, word for word)');
  }
  for (const r of cfg.reviews ?? []) {
    if (!r.name || !r.text) blockers.push('a review is missing its name or its text');
  }

  // Photos must exist and have alt text.
  const photos = [
    ['photos.hero', cfg.photos?.hero],
    ...(cfg.photos?.gallery ?? []).map((p, i) => [`photos.gallery[${i}]`, p]),
    ...(cfg.services ?? []).map((s, i) => [`services[${i}].photo`, s.photo]).filter(([, p]) => p),
  ];
  for (const [label, p] of photos) {
    if (!p?.src) continue;
    if (distDir && !existsSync(join(distDir, p.src))) blockers.push(`${label} points at a file that is not there: ${p.src}`);
    if (!p.alt) confirm.push(`${label}.alt (alt text)`);
  }

  // Demo safety
  if (cfg.live !== true) {
    if (!cfg.demo?.footerNote) blockers.push('demo.footerNote is empty, so the page would not say it is a demo');
  }

  // Google review links: both or neither.
  const hasOne = Boolean(cfg.googleReviewsUrl) !== Boolean(cfg.googleWriteReviewUrl);
  if (hasOne) blockers.push('only one of googleReviewsUrl / googleWriteReviewUrl is set — the pair shows together or not at all');

  // A quote demo with a calculator and no prices is not finished.
  if (cfg.template === 'quote') {
    const jobs = cfg.calculator?.jobs ?? [];
    if (!jobs.length) confirm.push('calculator.jobs (get the prices from the owner)');
  }

  if (cfg.stats?.googleRating == null) {
    notes.push(`no Google rating shown. Only add one at ${RATING_FLOOR} or above.`);
  }
  /**
   * Stock photos only matter if the page actually uses one. `npm run new`
   * records every stock-looking image it saw on their site, which is useful
   * intel for the call, but it is not a fault unless one ended up on the demo.
   */
  const stock = cfg._source?.stockLookingPhotos ?? [];
  if (stock.length) {
    const used = new Set(photos.map(([, p]) => p?.src).filter(Boolean));
    const onThePage = stock.filter((s) => used.has(s) || [...used].some((u) => s.endsWith(u) || u.endsWith(s)));
    if (onThePage.length) {
      blockers.push(`${onThePage.length} stock library photo(s) are on the page — a demo shows only their own work: ${onThePage[0]}`);
    } else {
      notes.push(`their current site uses ${stock.length} stock library photo(s); none are on this demo. Worth raising on the call.`);
    }
  }
  if (cfg.photos?.hero?.src) {
    // Filename and host detection cannot see a theme's stock photo. Only a
    // person can, and it is a thirty-second job that has already caught two
    // demos that would have gone out showing somebody else's roof.
    notes.push(`look at the hero photo yourself (${cfg.photos.hero.src}) and confirm it is their work`);
  }

  return { blockers, confirm, notes };
}

/** Everything that needs the page actually rendered. */
export async function pageChecks(url, { chromePath } = {}) {
  const { chromium } = await import('playwright');
  const blockers = [];
  const notes = [];

  const browser = await chromium.launch(chromePath ? { executablePath: chromePath } : {});
  try {
    for (const [label, width, height, js] of [
      ['375px', 375, 812, true],
      ['390px', 390, 844, true],
      ['390px with no JavaScript', 390, 844, false],
    ]) {
      const ctx = await browser.newContext({
        viewport: { width, height },
        javaScriptEnabled: js,
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(js ? 2600 : 400);

      const probe = await page.evaluate(() => {
        const visible = (el) => {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
          const r = el.getBoundingClientRect();
          return r.width > 1 && r.height > 1;
        };
        const firstVisible = (sel) => [...document.querySelectorAll(sel)].find(visible) ?? null;
        const h1 = firstVisible('h1');
        const call = firstVisible('a[href^="tel:"]');
        const heroImg = firstVisible('.hero img, .hero video');

        // Does the sticky bar sit on top of the form's send button?
        const bar = document.querySelector('.stickybar');
        const send = document.querySelector('#qSend');
        let barCoversSend = false;
        if (bar && send && getComputedStyle(bar).position === 'fixed') {
          send.scrollIntoView({ block: 'center' });
          const b = bar.getBoundingClientRect(), s = send.getBoundingClientRect();
          barCoversSend = visible(bar) && s.bottom > b.top && s.top < b.bottom;
        }

        return {
          h1: h1 ? Math.round(h1.getBoundingClientRect().top) : null,
          call: call ? Math.round(call.getBoundingClientRect().top) : null,
          heroImg: Boolean(heroImg),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          text: document.body.innerText,
          barCoversSend,
          // Only links a visitor can actually reach. A placeholder href inside a
          // panel that JS fills in before revealing is not a dead link.
          deadLinks: [...document.querySelectorAll('a[href="#"], a:not([href])')]
            .filter((el) => visible(el) && !el.closest('[hidden]')).length,
        };
      });

      if (probe.h1 === null) blockers.push(`${label}: no visible h1`);
      if (probe.call === null) blockers.push(`${label}: no visible call link`);
      else if (probe.call > height) blockers.push(`${label}: the call button is below the fold (${probe.call}px down)`);
      if (probe.h1 !== null && probe.h1 > height) blockers.push(`${label}: the headline is below the fold`);
      if (!probe.heroImg) blockers.push(`${label}: no hero image rendered`);
      if (probe.overflow > 1) blockers.push(`${label}: horizontal scroll, ${probe.overflow}px too wide`);
      if (probe.barCoversSend) blockers.push(`${label}: the sticky bar sits over the form's send button`);
      if (probe.deadLinks) notes.push(`${label}: ${probe.deadLinks} link(s) go nowhere`);
      if (consoleErrors.length) blockers.push(`${label}: ${consoleErrors.length} console error(s) — ${consoleErrors[0].slice(0, 90)}`);

      for (const [re, what] of PLACEHOLDER_PATTERNS) {
        const m = re.exec(probe.text);
        if (m) blockers.push(`${label}: ${what} is visible on the page — "${m[0].slice(0, 50)}"`);
      }

      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return { blockers, notes };
}

/** Lighthouse, mobile. Returns null if it cannot run rather than failing the check. */
export async function lighthouseScores(url, { chromePath } = {}) {
  try {
    const [{ default: lighthouse }, { launch }] = await Promise.all([
      import('lighthouse'),
      import('chrome-launcher'),
    ]);
    const chrome = await launch({
      chromePath,
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const { lhr } = await lighthouse(url, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
        throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
      });
      const pct = (c) => Math.round((lhr.categories[c]?.score ?? 0) * 100);
      return {
        performance: pct('performance'),
        accessibility: pct('accessibility'),
        bestPractices: pct('best-practices'),
        seo: pct('seo'),
        lcp: lhr.audits['largest-contentful-paint']?.displayValue,
        fcp: lhr.audits['first-contentful-paint']?.displayValue,
        tbt: lhr.audits['total-blocking-time']?.displayValue,
        cls: lhr.audits['cumulative-layout-shift']?.displayValue,
      };
    } finally {
      await chrome.kill();
    }
  } catch (err) {
    return { error: err.message };
  }
}
