/**
 * scrape — read a tradie's current website and pull out what we can stand behind.
 *
 * Every value this produces is a guess until a human confirms it, so every one
 * comes back with `_check: true`. The checker refuses to pass a demo that still
 * has flags on it. That is the whole safety model: the machine is allowed to be
 * wrong, it is not allowed to be quietly wrong.
 *
 * Two ways in:
 *   plain fetch    fast, and enough for most small-business sites
 *   headless page  for sites behind a bot challenge or rendered by JavaScript.
 *                  southcoastlandscapes.com.au sits behind a SiteGround captcha
 *                  and nulookpools.com.au is a Wix site whose content only
 *                  exists after its scripts run, so this path is not optional.
 *
 * Nothing is invented. If a field cannot be found it comes back empty and goes
 * on the checklist for Pat to fill in.
 */
import { chromium } from 'playwright';
import { launchOptions } from './browser.js';

const UA = 'Mozilla/5.0 (compatible; FrontlineSystems/1.0; +https://frontlinesystems.com.au) demo-site builder';

/** Pages worth reading, in the order we would look ourselves. */
const PAGE_HINTS = [
  { key: 'home', patterns: [/^\/?$/] },
  { key: 'services', patterns: [/service/i, /what-we-do/i, /products?/i] },
  { key: 'about', patterns: [/about/i, /our-story/i, /who-we-are/i, /team/i] },
  { key: 'gallery', patterns: [/gallery/i, /projects?/i, /our-work/i, /portfolio/i, /recent/i] },
  { key: 'contact', patterns: [/contact/i, /quote/i, /enquir/i] },
];

/* -------------------------------------------------------------------- fetch */

export async function fetchSite(startUrl, { verbose = false } = {}) {
  const origin = new URL(startUrl).origin;
  const home = await getPage(startUrl, { verbose });
  if (!home.ok) throw new Error(`Could not read ${startUrl}: ${home.error}`);

  const links = internalLinks(home.html, home.url);
  const pages = { home };
  const seen = new Set([normalise(home.url)]);

  for (const { key, patterns } of PAGE_HINTS.slice(1)) {
    const match = links.find((href) => {
      const path = new URL(href).pathname;
      return patterns.some((p) => p.test(path)) && !seen.has(normalise(href));
    });
    if (!match) continue;
    seen.add(normalise(match));
    const page = await getPage(match, { verbose, reuse: home.usedBrowser });
    if (page.ok) pages[key] = page;
    await pause(2500);         // be a polite visitor to someone else's server
  }

  return { origin, pages };
}

const normalise = (u) => new URL(u).href.replace(/\/$/, '').toLowerCase();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch first; fall back to a real browser when the response is a challenge or
 * looks like an empty JavaScript shell.
 */
async function getPage(url, { verbose = false } = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
    const html = await res.text();
    if (res.ok && !looksBlocked(html) && hasRealContent(html)) {
      if (verbose) console.log(`    fetched  ${url}`);
      return { ok: true, url: res.url, html, via: 'fetch' };
    }
    if (verbose) console.log(`    ${looksBlocked(html) ? 'challenge' : 'thin html'} at ${url}, opening a browser`);
  } catch (err) {
    if (verbose) console.log(`    fetch failed (${err.message}), opening a browser`);
  }
  return renderPage(url, { verbose });
}

/** A bot challenge, not a page. */
const looksBlocked = (html) =>
  /sgcaptcha|cf-browser-verification|just a moment|one moment,? please|checking your browser|enable javascript and cookies|ddos-guard|incapsula/i.test(html)
  || html.length < 400;

/** Enough prose to be a real page rather than a loading shell. */
function hasRealContent(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 600;
}

/**
 * An error page dressed up as a page. Writing "403" into config.json as the
 * business name is worse than failing, because it looks like it worked.
 */
function isErrorPage(html) {
  const t = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > 1200) return false;              // a real page, whatever it says
  return /\b(403|404|429|503)\b|forbidden|access denied|not acceptable|too many requests|temporarily unavailable/i.test(t);
}

function errorReason(html) {
  const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (/\b403\b|forbidden|access denied/i.test(t)) {
    return 'the site refused us (403). Its bot protection is tied to the IP that solved the challenge, and ours rotates';
  }
  return `the site served an error page: "${t}"`;
}

/** The interstitial a bot challenge shows while it decides about you. */
const isChallengePage = (html) =>
  /robot challenge screen|sgcaptcha|just a moment|one moment,? please|checking (?:if the site connection is secure|your browser)|cf-browser-verification|attention required|ddos-guard|incapsula/i.test(html);

async function renderPage(url, { verbose = false } = {}) {
  let browser;
  try {
    browser = await chromium.launch(launchOptions());
    const ctx = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1400, height: 1000 },
      locale: 'en-AU',
      timezoneId: 'Australia/Sydney',
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // A challenge sets a cookie and sends you back, but it takes its time and
    // may bounce more than once. Wait it out rather than screenshotting the
    // "Robot Challenge Screen" and calling it their website. Reading content
    // mid-navigation throws, which here means it is working — so that is a
    // reason to wait again, not to give up.
    const content = async () => {
      try { return await page.content(); } catch { return null; }
    };
    for (let attempt = 0; attempt < 8; attempt++) {
      const html = await content();
      if (html && !isChallengePage(html)) break;
      if (verbose && attempt === 0) console.log('    challenge screen, waiting for it to clear');
      await page.waitForTimeout(3000);
      // Some challenges need a second request once the cookie is set.
      if (attempt === 3) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    }

    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    const html = (await content()) ?? '';
    const finalUrl = page.url();
    await browser.close();

    if (isChallengePage(html)) {
      if (verbose) console.log('    challenge did not clear');
      return { ok: false, error: 'the site is behind a bot challenge that did not clear', url: finalUrl };
    }
    if (isErrorPage(html)) {
      if (verbose) console.log('    served an error page');
      return { ok: false, error: errorReason(html), url: finalUrl };
    }
    if (verbose) console.log(`    rendered ${finalUrl}`);
    return { ok: true, url: finalUrl, html, via: 'browser' };
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return { ok: false, error: err.message, url };
  }
}

/* ---------------------------------------------------------------- extraction */

const text = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#0?39;|&rsquo;|&apos;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

function internalLinks(html, base) {
  const origin = new URL(base).origin;
  const out = new Set();
  for (const m of html.matchAll(/href="([^"#?]+)"/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.origin === origin && /^\/[^.]*$/.test(u.pathname)) out.add(u.href);
    } catch { /* not a URL we can use */ }
  }
  return [...out];
}

/** Everything we could work out, each piece flagged as unconfirmed. */
export function extract({ origin, pages }) {
  const all = Object.values(pages).map((p) => p.html).join('\n');
  const allText = text(all);
  const homeHtml = pages.home.html;

  return {
    name: businessName(homeHtml, origin),
    phone: phone(all),
    email: email(all),
    abn: abn(allText),
    yearsInBusiness: years(allText),
    suburbs: suburbs(allText),
    services: services(pages),
    about: about(pages),
    credentials: credentials(allText),
    photos: photos(all, pages.home.url),
    logo: logo(homeHtml, pages.home.url),
    brandColour: brandColour(all),
    socials: socials(all),
    platform: platform(all),
  };
}

/**
 * The business name.
 *
 * A title is usually "Something | Something else" and the name can be either
 * half. Picking the shorter one gets it wrong often enough to matter —
 * "Home Building & Renovation Services | Bomaderry, NSW" yields the suburb.
 * The domain is the tie-breaker, because horganbuildingandrenovations.com.au
 * tells you plainly which half is the name.
 */
function businessName(html, origin) {
  const og = /<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i.exec(html);
  if (og && clean(og[1])) return clean(og[1]);

  const host = new URL(origin).hostname.replace(/^www\./, '').split('.')[0].toLowerCase();

  // A logo's alt text is usually the business name written out properly, and it
  // beats guessing which half of a page title to take.
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/logo/i.test(m[0])) continue;
    const alt = clean(/\balt="([^"]+)"/i.exec(m[0])?.[1] ?? '');
    if (!alt || alt.length > 60 || /^logo$/i.test(alt)) continue;
    const words = alt.toLowerCase().match(/[a-z]{3,}/g) ?? [];
    if (words.some((w) => host.includes(w))) return alt;
  }
  const title = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  if (!title) return host;

  const parts = clean(title[1]).split(/\s*[|–—·]\s*|\s+-\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];

  // Score each half by how much of it the domain actually contains.
  const score = (part) => {
    const words = part.toLowerCase().match(/[a-z]{3,}/g) ?? [];
    if (!words.length) return 0;
    const hits = words.filter((w) => host.includes(w)).length;
    return hits / words.length;
  };
  const ranked = parts.map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s);
  if (ranked[0].s > 0) return ranked[0].p;

  // Nothing matched the domain, so fall back to the half that reads least like
  // a location or a list of services.
  const looksLikePlace = (p) => /,\s*(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i.test(p);
  const notPlace = parts.filter((p) => !looksLikePlace(p));
  return (notPlace[0] ?? parts[0]);
}

/** Australian numbers, preferring a mobile because that is who answers. */
function phone(html) {
  const found = new Set();
  for (const m of html.matchAll(/href="tel:([^"]+)"/gi)) found.add(m[1]);
  for (const m of text(html).matchAll(/(?:\+?61\s?|0)[2-478](?:[ \-().]?\d){8}/g)) found.add(m[0]);
  const list = [...found].map((s) => s.trim()).filter(Boolean);
  const mobile = list.find((n) => /^(\+?61\s?4|04)/.test(n.replace(/[^\d+]/g, '')));
  return mobile ?? list[0] ?? '';
}

function email(html) {
  const found = new Set();
  for (const m of html.matchAll(/href="mailto:([^"?]+)"/gi)) found.add(m[1].trim());
  for (const m of text(html).matchAll(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g)) found.add(m[0]);
  // Skip the addresses that belong to the people who built the site.
  const list = [...found].filter((e) => !/(example|sentry|wix|squarespace|godaddy|@2x)/i.test(e));
  return list[0] ?? '';
}

const abn = (t) => (/ABN[:\s]*((?:\d[ ]?){11})/i.exec(t)?.[1] ?? '').replace(/\s+/g, ' ').trim();

function years(t) {
  const since = /(?:since|established|est\.?|trading since)\s*(19|20)\d{2}/i.exec(t);
  if (since) {
    const year = Number(/(19|20)\d{2}/.exec(since[0])[0]);
    const age = new Date().getFullYear() - year;
    if (age > 0 && age < 90) return age;
  }
  const over = /(?:over|more than|almost|nearly)\s+(\d{1,2})\s*(?:\+\s*)?years/i.exec(t);
  if (over) return Number(over[1]);
  const plain = /(\d{1,2})\s*\+?\s*years(?:\s+of)?\s+(?:experience|in the (?:trade|business|industry))/i.exec(t);
  if (plain) return Number(plain[1]);
  return null;
}

/**
 * Suburbs named as places they work. Capitalised words near service-area
 * language. Deliberately conservative — a wrong suburb on a demo is noticed.
 */
function suburbs(t) {
  const out = new Set();
  const cues = /(?:servicing|we service|service areas?|areas we serve|proudly serving|covering|based in|throughout)\b([^.!?]{0,400})/gi;
  for (const m of t.matchAll(cues)) {
    for (const w of m[1].matchAll(/\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?)\b/g)) {
      const s = w[1].trim();
      if (!STOP_WORDS.has(s) && s.length > 3) out.add(s);
    }
  }
  return [...out].slice(0, 40);
}

const STOP_WORDS = new Set([
  'We', 'Our', 'The', 'This', 'That', 'They', 'Your', 'All', 'And', 'For', 'With',
  'Australia', 'Australian', 'Home', 'Contact', 'About', 'Services', 'Service',
  'Gallery', 'Quote', 'Free', 'Call', 'Email', 'Monday', 'Friday', 'Saturday',
  'Sunday', 'New South Wales', 'Victoria', 'Queensland', 'Western Australia',
]);

/**
 * Service names from headings.
 *
 * Headings on a small-business site are mostly not services — they are
 * "Follow Us", "See What Our Clients Are Saying?" and the name of whoever left
 * the last review. What a service heading looks like: a short noun phrase, not
 * a question, not about the visitor, not a person's name. Everything that gets
 * through is still flagged for a human, because this will keep being wrong.
 */
const NOT_A_SERVICE = [
  /\?$/,                                          // a question is never a service
  /^(contact|about|home|gallery|our work|portfolio|testimonials?|reviews?|faq|blog|news|menu|search)\b/i,
  /\b(follow|find|call|email|visit|subscribe|sign up|book now|get in touch|read more|learn more)\b/i,
  /\bus\b|\bwe\b|\byou(r)?\b|\bour (clients?|team|story|process|promise)\b/i,
  /^[A-Z][a-z]+ [A-Z]\.$/,                        // "David S." — a reviewer
  /^[A-Z][a-z]+ [A-Z][a-z]+$/u,                   // a plain two-word person name
  /^\d/,                                          // "5 star service", "24/7"
  /\b(hours?|address|location|phone|mobile|abn|copyright|privacy|terms)\b/i,
];

function services(pages) {
  const html = (pages.services ?? pages.home).html;
  const out = new Set();
  for (const m of html.matchAll(/<h[234][^>]*>([\s\S]{2,90}?)<\/h[234]>/gi)) {
    const t = clean(text(m[1]));
    if (!t || t.length < 5 || t.length > 55) continue;
    if (NOT_A_SERVICE.some((re) => re.test(t))) continue;
    if ((t.match(/\s/g) ?? []).length > 6) continue;     // a sentence, not a name
    out.add(t);
  }
  return [...out].slice(0, 10);
}

function about(pages) {
  const html = (pages.about ?? pages.home).html;
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]{80,700}?)<\/p>/gi)]
    .map((m) => clean(text(m[1])))
    .filter((t) => t.length > 90 && !/cookie|privacy|copyright|all rights reserved/i.test(t));
  return paras.slice(0, 3).join('\n\n');
}

function credentials(t) {
  const out = [];
  const licence = /(?:licen[cs]e(?:d)?(?:\s+(?:no\.?|number))?[:\s#]*)([A-Z0-9][A-Z0-9\-/]{3,14})/i.exec(t);
  if (licence) out.push({ kind: 'licence', label: 'Licence', number: licence[1] });
  for (const body of ['HIA', 'Master Builders', 'MBA', 'Housing Industry Association', 'Landscape Association', 'SPASA', 'Clean Energy Council']) {
    if (new RegExp(`\\b${body}\\b`, 'i').test(t)) out.push({ kind: 'membership', label: body });
  }
  if (/\bfully insured\b|\bpublic liability\b/i.test(t)) out.push({ kind: 'claim', label: 'Fully insured' });
  return out;
}

/**
 * Their own project photos.
 *
 * Skipped: logos, icons, sprites, avatars, badges, anything obviously small,
 * and anything served from a stock library. A stock photo on a demo is the one
 * thing an owner spots immediately, so a suspected one is flagged loudly rather
 * than quietly used.
 */
const SKIP_PATTERNS = /logo|icon|favicon|sprite|avatar|badge|placeholder|spacer|pixel|arrow|chevron|button|banner-ad|loader|spinner|swatch|thumb(?:nail)?-?\d*x|emoji|flag/i;
/**
 * Stock library images, by host AND by filename.
 *
 * Filenames matter more than hosts in practice: a site downloads the picture
 * and re-uploads it to its own server, so the host is theirs but the name still
 * says istock-1156523427 or gettyimages-1270237767. Nulook Pools' three usable
 * photos were all iStock, and the hostname check alone let every one through as
 * their own work.
 */
const STOCK_HOSTS = /shutterstock|istockphoto|gettyimages|unsplash|pexels|adobestock|stock\.adobe|depositphotos|dreamstime|123rf|freepik/i;
const STOCK_NAMES = /(?:^|[/\-_])(?:istock|shutterstock|getty ?images|gettyimages|adobestock|depositphotos|dreamstime|unsplash|pexels|freepik|stock[-_]?photo|123rf)[-_\d]/i;
const looksLikeStock = (url) => STOCK_HOSTS.test(url) || STOCK_NAMES.test(url);

function photos(html, baseUrl) {
  const found = new Map();

  const add = (rawSrc, alt = '') => {
    if (!rawSrc) return;
    let url;
    try { url = new URL(rawSrc.trim(), baseUrl).href; } catch { return; }
    if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(url)) return;
    if (SKIP_PATTERNS.test(url)) return;
    const stock = looksLikeStock(url);
    if (!found.has(url)) found.set(url, { url, alt: clean(alt), stock });
  };

  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = /\bsrc="([^"]+)"/i.exec(tag)?.[1]
      ?? /\bdata-src="([^"]+)"/i.exec(tag)?.[1]
      ?? /\bdata-lazy-src="([^"]+)"/i.exec(tag)?.[1];
    const alt = /\balt="([^"]*)"/i.exec(tag)?.[1] ?? '';
    // Take the widest candidate a srcset offers.
    const srcset = /\bsrcset="([^"]+)"/i.exec(tag)?.[1] ?? /\bdata-srcset="([^"]+)"/i.exec(tag)?.[1];
    if (srcset) {
      const widest = srcset.split(',')
        .map((p) => p.trim().split(/\s+/))
        .map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 }))
        .sort((a, b) => b.w - a.w)[0];
      if (widest) add(widest.u, alt);
    }
    add(src, alt);
  }
  for (const m of html.matchAll(/background-image:\s*url\((['"]?)([^'")]+)\1\)/gi)) add(m[2]);

  return [...found.values()];
}

function logo(html, baseUrl) {
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(tag)) continue;
    const src = /\bsrc="([^"]+)"/i.exec(tag)?.[1];
    if (!src) continue;
    try { return new URL(src, baseUrl).href; } catch { return ''; }
  }
  return '';
}

/** The colour the site itself leans on, as a starting point for their accent. */
function brandColour(html) {
  const counts = new Map();
  for (const m of html.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const hex = '#' + m[1].toUpperCase();
    if (/^#(FFFFFF|000000|F{6}|0{6})$/i.test(hex)) continue;
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const max = Math.max(...rgb), min = Math.min(...rgb);
    if (max - min < 28) continue;                 // a grey is not a brand colour
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? '';
}

function socials(html) {
  const out = {};
  for (const [key, re] of [
    ['facebook', /https?:\/\/(?:www\.)?facebook\.com\/[\w.\-/]+/i],
    ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/[\w.\-/]+/i],
    ['google', /https?:\/\/(?:g\.page|maps\.app\.goo\.gl|search\.google\.com)\/[\w.\-/?=]+/i],
  ]) {
    const m = re.exec(html);
    if (m) out[key] = m[0];
  }
  return out;
}

function platform(html) {
  if (/wp-content|wp-json|wordpress/i.test(html)) return 'WordPress';
  if (/wix\.com|wixstatic/i.test(html)) return 'Wix';
  if (/squarespace/i.test(html)) return 'Squarespace';
  if (/shopify/i.test(html)) return 'Shopify';
  if (/duda|dudamobile/i.test(html)) return 'Duda';
  if (/webflow/i.test(html)) return 'Webflow';
  return 'unknown';
}

const clean = (s) => String(s ?? '')
  .replace(/&amp;/g, '&')
  .replace(/&#0?39;|&rsquo;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
