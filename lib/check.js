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
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findChecks, missingRequired, googleRecord, RATING_FLOOR } from './config.js';
import { claimBlockers } from './claims.js';

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
 *
 * `google` is what data/google_reviews_top25.json says about this client, or
 * null. Where it has a figure, that figure is the truth and the config has to
 * agree with it. Where it does not, the old suspicion still applies.
 *
 * A 5.0 used to fail on its own, on the reasoning that it might be invented or
 * might be hiding a 1-star. The pull settles both questions, so a 5.0 the file
 * confirms now passes, and a 5.0 it has never heard of goes on the to-confirm
 * list instead of stopping the build.
 */
function suspiciousStats(cfg, google) {
  const out = [];
  const confirm = [];
  const notes = [];
  const s = cfg.stats ?? {};
  const rating = s.googleRating;

  if (rating != null) {
    if (rating > 5 || rating < 1) out.push(`googleRating ${rating} is not a rating`);
    if (s.reviewCount == null) out.push('googleRating is set but reviewCount is not; a rating with no count behind it invites the question');
  }
  if (s.reviewCount != null && rating == null) {
    out.push('reviewCount is set with no rating beside it, which reads as a rating being hidden');
  }

  /* Does the page agree with what Google actually showed? */
  if (rating != null && google) {
    const name = google.google_name ?? cfg.slug;
    if (google.rating == null) {
      out.push(`the page shows a ${rating} rating, but the pull found no rating at all for ${name}`);
    } else if (Math.abs(google.rating - rating) > 0.001) {
      out.push(`googleRating is ${rating}, but the pull has ${name} at ${google.rating} — a number that does not match their profile is the one thing an owner will check`);
    } else if (s.reviewCount != null && google.review_count != null && s.reviewCount !== google.review_count) {
      out.push(`reviewCount is ${s.reviewCount}, but the pull has ${name} at ${google.review_count}`);
    } else {
      notes.push(`rating ${rating} from ${s.reviewCount} verified against the ${google.review_count}-review pull for ${name}`);
      if (google.flag) notes.push(`read this before you call — ${google.flag}`);
    }
  } else if (rating === 5) {
    confirm.push(`stats.googleRating is 5.0 and "${cfg.slug}" is not in ${'data/google_reviews_top25.json'} — check their profile, including that no 1-star is buried in there`);
  }

  if (s.yearsInBusiness != null && (s.yearsInBusiness > 70 || s.yearsInBusiness < 1)) {
    out.push(`yearsInBusiness ${s.yearsInBusiness} looks wrong`);
  }
  for (const key of ['jobsDone', 'reviewCount']) {
    const v = s[key];
    if (v == null) continue;
    // A count the pull confirms is theirs, however round it happens to look.
    if (key === 'reviewCount' && google?.review_count === v) continue;
    if (v >= 100 && v % 100 === 0) out.push(`${key} is exactly ${v}, which reads as a guess — use their real figure`);
  }
  return { blockers: out, confirm, notes };
}

/** Everything that can be judged without opening a browser. */
export async function staticChecks(cfg, distDir) {
  const blockers = [];
  const confirm = [];
  const notes = [];

  for (const field of missingRequired(cfg)) blockers.push(`missing required field: ${field}`);

  for (const path of findChecks(cfg)) confirm.push(path);

  const google = await googleRecord(cfg.slug);
  const stats = suspiciousStats(cfg, google);
  blockers.push(...stats.blockers);
  confirm.push(...stats.confirm);
  notes.push(...stats.notes);

  // Every specific fact on the built page must be in _source or the review pull.
  blockers.push(...await claimBlockers(cfg, distDir, google));

  // Markup typed into a field the template escapes shows up as literal text —
  // Nulook's reviews heading read "Amazing to<br>deal with." on the page.
  // Checks every built page, not just the homepage.
  if (distDir && existsSync(distDir)) {
    for (const file of (await readdir(distDir)).filter((f) => f.endsWith('.html'))) {
      const page = await readFile(join(distDir, file), 'utf8').catch(() => '');
      const body = page.replace(/<script\b[\s\S]*?<\/script>/gi, '');
      const hit = body.match(/&lt;\/?(?:br|b|i|em|strong|span|a)\b[^&]{0,40}&gt;/i);
      if (hit) blockers.push(`${file} shows escaped HTML as text ("${hit[0]}") — that field doesn't accept markup; write it as plain text`);
      // A button that says "Call" has to ring. ProStyle, S&I and Pinczi all had
      // copy.ctaLabel set to "Call …" on links that jump to the form.
      const fakeCall = body.match(/<a\b[^>]*href="(?!tel:)[^"]*"[^>]*>\s*(Call\b[^<]{0,40})</i);
      if (fakeCall) blockers.push(`${file} has a "${fakeCall[1].trim()}" link that doesn't dial — "Call" labels must go to tel:. Set copy.ctaLabel to a form label like "Send the details"`);
    }
  }

  // A price-guide job hands its formService to the enquiry form's service
  // list. One that is not an option empties the dropdown, and the enquiry
  // goes out with no service (Arizona: 3 of 6 jobs, including the default).
  const jobs = cfg.calculator?.jobs ?? [];
  if (jobs.length) {
    const page = await readFile(join(distDir, 'index.html'), 'utf8').catch(() => '');
    const options = new Set([...page.matchAll(/<option(?:\s[^>]*)?>([^<]*)/g)].map((m) => m[1].trim()));
    for (const j of jobs) {
      if (j.formService && !options.has(j.formService)) {
        blockers.push(`calculator job "${j.label ?? j.id}" sends formService "${j.formService}", which is not an option in the enquiry form`);
      }
    }
  }

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
  // Where the pull already has them, say so and say how many — walking to the
  // Google profile for reviews that are sitting in a file is wasted work.
  // `noGoogleReviews: true` records that someone looked and there are none
  // (Meyers, Pinczi): the page just leaves the section out, and "no reviews
  // yet" becomes the pitch. It can't hide reviews that are sitting in the pull.
  if (!(cfg.reviews ?? []).length) {
    const ready = (await googleRecord(cfg.slug))?.best_for_demo ?? [];
    if (cfg.noGoogleReviews === true && !ready.length) {
      notes.push('no reviews section: their Google profile has none yet (noGoogleReviews) — that is the pitch');
    } else confirm.push(ready.length
      ? `reviews — ${ready.length} are ready in data/google_reviews_top25.json under "${cfg.slug}". Paste them in word for word.`
      : 'reviews (paste them from their Google profile, word for word)');
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

  /*
   * Sample photos — stock standing in for the client's own work.
   *
   * Allowed only when Pat has approved it in the config, only with the licence
   * and the page it came from recorded, and never on a live site. The page
   * itself tags each one "Sample photo" (sampleTag in lib/render.js), so the
   * owner can never take a stock roof for his.
   */
  const samples = [];
  const walkPhotos = (v, path) => {
    if (Array.isArray(v)) v.forEach((x, i) => walkPhotos(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') {
      if (v.src && v.sample) samples.push([path, v]);
      for (const [k, x] of Object.entries(v)) if (k !== 'sample' && typeof x === 'object') walkPhotos(x, `${path}.${k}`);
    }
  };
  walkPhotos(cfg.photos ?? {}, 'photos');
  (cfg.services ?? []).forEach((sv, i) => sv.photo?.sample && samples.push([`services[${i}].photo`, sv.photo]));
  if (samples.length) {
    const ok = cfg.photos?.stockApproved;
    if (!ok?.by) blockers.push(`${samples.length} sample (stock) photo(s) on the page, but photos.stockApproved is not set — only Pat approves stock, and he records who and when`);
    if (cfg.live === true) blockers.push(`${samples.length} sample (stock) photo(s) on a live site — a live site shows only the client's own work`);
    for (const [path, ph] of samples) {
      if (!ph.license || !ph.sourceUrl) blockers.push(`${path} is a sample photo with no licence or source recorded — add license and sourceUrl`);
    }
    notes.push(`${samples.length} SAMPLE (stock) photo(s), approved by ${ok?.by ?? 'nobody'}${ok?.on ? ` on ${ok.on}` : ''} — each is tagged "Sample photo" on the page. Replace with their own before this goes live.`);
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
    const google = await googleRecord(cfg.slug);
    if (google?.rating != null && google.rating < RATING_FLOOR) {
      notes.push(`no rating on the page on purpose: the pull has ${google.google_name} at ${google.rating}, under the ${RATING_FLOOR} floor, so the reviews carry it instead`);
    } else {
      notes.push(`no Google rating shown. Only add one at ${RATING_FLOOR} or above.`);
    }
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
          /**
           * Custom properties used with no fallback that resolve to nothing.
           *
           * CSS silently drops a declaration whose value is empty, so an
           * undefined token is a style that quietly did not apply. The shared
           * blocks are written against --fl-* tokens and the trust template
           * declared none of them, which stripped the background, border and
           * heading size off the review cards of a finished demo. Everything
           * else passed: the words were all present, so this checker was happy;
           * the elements were above the fold, so paint-check was happy;
           * Lighthouse gave it 94. Only a person looking at a screenshot saw it.
           *
           * A var() WITH a fallback is deliberate and not counted.
           */
          /**
           * Text nobody can read.
           *
           * A quote demo shipped a trust bar whose labels computed to #1C1F23
           * on a #22252A panel — 1.06:1, invisible — because the shared blocks
           * derive --fl-ink from --fg at :root, so inside a .dark section they
           * inherited the light theme's ink already resolved. Lighthouse missed
           * it because the bar ships opacity-0 until revealed, and the CSS
           * variable check misses it because the tokens do resolve; they
           * resolve to the wrong colour.
           *
           * WCAG AA: 4.5:1 for body text, 3:1 for large text (24px, or 18.66px
           * bold). Elements the page has deliberately hidden are skipped, but
           * one held at opacity 0 for an animation is not — that is exactly
           * where this hid.
           */
          lowContrast: (() => {
            const lum = (c) => {
              const m = c.match(/[\d.]+/g);
              if (!m) return null;
              const [r, g, b] = m.slice(0, 3).map((v) => {
                v = Number(v) / 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
              });
              return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            /**
             * The colour actually behind the text, composited.
             *
             * Taking the first background with any alpha at all was wrong: a
             * ghost button is rgba(243,240,233,.06) over a dark section, and
             * reading that as an opaque near-white made its own near-white
             * label look like 1.00:1 — a false blocker on every quote demo.
             * Translucent layers are collected and composited over the first
             * opaque one beneath them.
             */
            const parse = (c) => {
              const m = (c || '').match(/[\d.]+/g);
              if (!m) return null;
              return { r: +m[0], g: +m[1], b: +m[2], a: m[3] == null ? 1 : +m[3] };
            };
            const groundOf = (el) => {
              const layers = [];
              for (let n = el; n; n = n.parentElement) {
                const c = parse(getComputedStyle(n).backgroundColor);
                if (!c || c.a === 0) continue;
                layers.push(c);
                if (c.a >= 0.999) break;
              }
              let base = layers.pop() ?? { r: 255, g: 255, b: 255, a: 1 };
              // Back to front: each translucent layer over what is under it.
              while (layers.length) {
                const top = layers.pop();
                base = {
                  r: top.r * top.a + base.r * (1 - top.a),
                  g: top.g * top.a + base.g * (1 - top.a),
                  b: top.b * top.a + base.b * (1 - top.a),
                  a: 1,
                };
              }
              return `rgb(${base.r}, ${base.g}, ${base.b})`;
            };
            const out = [];
            for (const el of document.querySelectorAll('body *')) {
              const text = [...el.childNodes]
                .filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
              if (text.length < 2) continue;
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden') continue;
              if (el.closest('[hidden]')) continue;
              const r = el.getBoundingClientRect();
              if (r.width < 2 || r.height < 2) continue;
              const fg = lum(cs.color), bg = lum(groundOf(el));
              if (fg == null || bg == null) continue;
              const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
              const size = parseFloat(cs.fontSize);
              const bold = Number(cs.fontWeight) >= 700;
              const floor = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
              if (ratio < floor) out.push(`"${text.slice(0, 28)}" at ${ratio.toFixed(2)}:1`);
            }
            return [...new Set(out)].slice(0, 6);
          })(),
          unresolvedVars: (() => {
            const names = new Map();
            for (const sheet of document.styleSheets) {
              let rules;
              try { rules = sheet.cssRules; } catch { continue; }
              const walk = (list) => {
                for (const rule of list) {
                  if (rule.cssRules) walk(rule.cssRules);
                  if (!rule.style || !rule.selectorText) continue;
                  for (const m of rule.cssText.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
                    const set = names.get(m[1]) ?? new Set();
                    set.add(rule.selectorText);
                    names.set(m[1], set);
                  }
                }
              };
              walk(rules);
            }
            const dead = [];
            for (const [name, selectors] of names) {
              const targets = [document.documentElement, document.body];
              for (const sel of selectors) {
                try { targets.push(...document.querySelectorAll(sel)); } catch { /* :hover etc */ }
              }
              const resolves = targets.some((el) => el && getComputedStyle(el).getPropertyValue(name).trim() !== '');
              if (!resolves) dead.push(name);
            }
            return dead;
          })(),
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
      if (probe.lowContrast?.length) {
        blockers.push(`${label}: ${probe.lowContrast.length} piece(s) of text below the contrast floor — ${probe.lowContrast[0]}`);
      }
      if (probe.unresolvedVars?.length) {
        blockers.push(`${label}: ${probe.unresolvedVars.length} CSS custom propert${probe.unresolvedVars.length === 1 ? 'y' : 'ies'} resolve to nothing, so those styles silently did not apply — ${probe.unresolvedVars.slice(0, 4).join(', ')}`);
      }
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
