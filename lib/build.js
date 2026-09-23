/**
 * build — turn one client's config into a finished folder in dist/<slug>/.
 *
 * Steps, in order:
 *   1. load config (preset + client, merged and normalised)
 *   2. derive the accent palette, so a client only has to pick one colour
 *   3. render the template to HTML, with the CSS and JS inlined
 *   4. copy their assets and the vendored GSAP
 *   5. write robots.txt
 *   6. link-check the result and FAIL if anything points at nothing
 *
 * Step 6 is the one that earns its keep. It is lifted from this repo's own
 * generator (sites/crossroads-church/build.py), which re-reads every page it
 * wrote and refuses to finish on a broken link. A demo with a missing photo is
 * worse than no demo.
 */
import { mkdir, writeFile, readFile, cp, rm, readdir } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { loadConfig, ROOT, DIST_DIR } from './config.js';
import { present } from './render.js';
import { calculatorData } from './blocks/calculator.js';
import { beforeAfterScript } from './blocks/before-after.js';
import { heroVideoScript } from './blocks/hero-media.js';

const VENDOR_SRC = join(ROOT, 'demos/bondi-landscapes/vendor');

/** Build one client. Returns a report the CLI prints. */
export async function buildClient(slug, { outDir = DIST_DIR, quiet = false } = {}) {
  const cfg = await loadConfig(slug);
  const dir = join(outDir, slug);

  const templateDir = join(ROOT, 'templates', cfg.template);
  if (!existsSync(templateDir)) throw new Error(`Unknown template "${cfg.template}" for ${slug}`);

  const [styles, blockStyles, script] = await Promise.all([
    readFile(join(templateDir, 'styles.css'), 'utf8'),
    readFile(join(ROOT, 'lib/blocks/blocks.css'), 'utf8'),
    readFile(join(templateDir, 'page.js'), 'utf8'),
  ]);

  const { render } = await import(join(templateDir, 'template.js'));

  const prepared = withRuntime(withPalette(withFonts(cfg, templateDir)));
  const css = minifyCss(styles + '\n' + blockStyles + '\n' + accentOverride(prepared));
  const js = stripJsComments(script + '\n' + extraScripts(prepared));

  const htmlOut = render(prepared, { styles: css, script: js });

  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), htmlOut);

  // Service and suburb pages, one flat file per entry — see templates/quote/subpage.js
  // for why they're flat files rather than nested directories. Only the quote
  // template has a subpage renderer so far; a template without one is skipped,
  // not broken.
  const subpages = [...(prepared.servicePages ?? []), ...(prepared.suburbPages ?? [])];
  const subpageFiles = [];
  const subpagePath = join(templateDir, 'subpage.js');
  if (subpages.length && existsSync(subpagePath)) {
    const { renderSubpage } = await import(subpagePath);
    for (const page of subpages) {
      const out = renderSubpage(prepared, page, { styles: css, script: js });
      const file = `${page.slug}.html`;
      await writeFile(join(dir, file), out);
      subpageFiles.push(file);
    }
  }

  // Their own photos, logo and any video.
  const assets = join(ROOT, 'clients', slug, 'assets');
  if (existsSync(assets)) await cp(assets, join(dir, 'assets'), { recursive: true });

  // Fonts belong to the template, not the client.
  const fontsDir = join(templateDir, 'fonts');
  if (existsSync(fontsDir)) await cp(fontsDir, join(dir, 'fonts'), { recursive: true });

  // GSAP is vendored, not pulled from a CDN. A demo gets opened on a phone in a
  // paddock; it should not depend on cdnjs being reachable.
  if (existsSync(VENDOR_SRC)) await cp(VENDOR_SRC, join(dir, 'vendor'), { recursive: true });

  await writeFile(join(dir, 'robots.txt'), robotsTxt(prepared));

  const broken = [];
  for (const file of ['index.html', ...subpageFiles]) {
    for (const ref of await checkLinks(dir, file)) broken.push(subpageFiles.length ? `${file}: ${ref}` : ref);
  }
  if (!quiet && broken.length) {
    for (const b of broken) console.error(`  broken: ${b}`);
  }

  return { slug, dir, cfg: prepared, bytes: Buffer.byteLength(htmlOut), broken, subpageFiles };
}

export async function buildAll(slugs, opts = {}) {
  const results = [];
  for (const slug of slugs) results.push(await buildClient(slug, opts));
  return results;
}

/* ----------------------------------------------------------------- minifying */

/**
 * The CSS and JS are inlined, so every comment in them is shipped to every
 * visitor on a phone. The source files are heavily commented on purpose and
 * stay that way; this strips the comments out of the OUTPUT only.
 *
 * Deliberately conservative. A real minifier is another dependency and another
 * thing that can silently change behaviour, and the win here is almost entirely
 * comments and indentation.
 */
function minifyCss(css) {
  return css
    // Block comments. CSS has no strings that can contain an unescaped "/*".
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

/**
 * Strip JS comments without touching anything that could be inside a string, a
 * template literal or a regex — so it walks the source rather than running a
 * regex over it. Whitespace is left alone; gzip handles that, and a mangled
 * runtime is far more expensive than a few kilobytes.
 */
function stripJsComments(src) {
  let out = '';
  let i = 0;
  let state = 'code';          // code | line | block | single | double | tpl | regex
  let depthTpl = 0;
  while (i < src.length) {
    const c = src[i], next = src[i + 1];
    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && next === '*') { state = 'block'; i += 2; continue; }
      if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') { state = 'tpl'; depthTpl++; }
      else if (c === '/' && isRegexStart(out)) state = 'regex';
      out += c; i++; continue;
    }
    if (state === 'line') { if (c === '\n') { state = 'code'; out += c; } i++; continue; }
    if (state === 'block') { if (c === '*' && next === '/') { state = 'code'; i += 2; } else i++; continue; }
    // Inside a literal: copy verbatim, honouring escapes.
    out += c;
    if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
    if ((state === 'single' && c === "'") || (state === 'double' && c === '"')
      || (state === 'tpl' && c === '`') || (state === 'regex' && c === '/')) state = 'code';
    i++;
  }
  return out;
}

/** A "/" starts a regex when the last meaningful character cannot end a value. */
function isRegexStart(before) {
  const prev = before.replace(/\s+$/, '').slice(-1);
  return prev === '' || '(,=:[!&|?{};+-*%~^<>'.includes(prev);
}

/* -------------------------------------------------------------------- fonts */

/**
 * Preload the template's fonts unless the client named their own.
 *
 * The fonts are copied into every build either way, but without a preload they
 * are not requested until the CSS that references them has parsed — so the
 * headline paints in a fallback face and then reflows when the real one
 * arrives. On a page whose headline is set at 9rem that reflow is most of the
 * page's cumulative layout shift. A scraped config never lists fonts, which is
 * exactly the case that was scoring 0.14-0.29 CLS.
 */
function withFonts(cfg, templateDir) {
  if (Array.isArray(cfg.fonts) && cfg.fonts.length) return cfg;
  const dir = join(templateDir, 'fonts');
  if (!existsSync(dir)) return cfg;
  const fonts = readdirSync(dir)
    .filter((f) => f.endsWith('.woff2'))
    // An italic face is rarely on the critical path; preloading it costs more
    // than it saves.
    .filter((f) => !/italic/i.test(f))
    .map((f) => `fonts/${f}`);
  return fonts.length ? { ...cfg, fonts } : cfg;
}

/* ------------------------------------------------------------------ palette */

/**
 * One brand colour in, four out.
 *
 * Asking Pat to pick an accent, a hover, a lifted version for dark grounds and
 * a lifted hover is asking him to do colour theory on a cold call. He picks
 * one; these are derived from it.
 */
export function withPalette(cfg) {
  const brand = cfg.business?.brand ?? {};
  const accent = brand.accent;
  if (!present(accent)) return cfg;
  const rgb = hexToRgb(accent);
  if (!rgb) return cfg;

  const derived = {
    accent: toHex(rgb),
    accentHover: toHex(shade(rgb, -0.16)),
    accentLift: toHex(lift(rgb)),
    accentLiftHover: toHex(shade(lift(rgb), 0.12)),
    accentMid: toHex(shade(lift(rgb), -0.18)),
  };

  // A client whose brand is already worked out can pin the exact shades; the
  // derivation is for the 24 others where all we have is one colour off a logo.
  for (const key of ['accentHover', 'accentLift', 'accentLiftHover', 'accentMid']) {
    if (present(brand[key]) && hexToRgb(brand[key])) derived[key] = toHex(hexToRgb(brand[key]));
  }

  const palette = { ...derived, accentLiftRgb: hexToRgb(derived.accentLift).join(',') };

  // The trust design uses a second brand colour alongside the first.
  const rgb2 = hexToRgb(brand.accent2);
  if (rgb2) {
    palette.accent2 = toHex(rgb2);
    palette.accent2Lt = toHex(lift(rgb2));
    palette.accentRgb = rgb.join(',');
    palette.accent2Rgb = rgb2.join(',');
  }
  return { ...cfg, palette };
}

function accentOverride(cfg) {
  const p = cfg.palette;
  if (!p) return '';
  return `
/* This client's accent, derived from the one colour in their config. */
:root{
  --accent:${p.accent};
  --accent-hover:${p.accentHover};
  --accent-lift:${p.accentLift};
  --accent-lift-hover:${p.accentLiftHover};
  --accent-mid:${p.accentMid};
  --accent-lift-rgb:${p.accentLiftRgb};
${p.accent2 ? `  --accent-lt:${p.accentLift};
  --accent-rgb:${p.accentRgb};
  --accent-2:${p.accent2};
  --accent-2-lt:${p.accent2Lt};
  --accent-2-rgb:${p.accent2Rgb};` : ''}
}`;
}

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const toHex = (rgb) => '#' + rgb.map((c) => clamp(c).toString(16).padStart(2, '0')).join('').toUpperCase();
const shade = (rgb, amount) =>
  rgb.map((c) => (amount < 0 ? c * (1 + amount) : c + (255 - c) * amount));
/** A version light enough to read on a near-black ground (aiming ~60% luma). */
function lift(rgb) {
  const luma = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  const want = 0.62;
  if (luma >= want) return rgb;
  return shade(rgb, Math.min(0.75, (want - luma) * 1.15));
}

/* ------------------------------------------------------------------ runtime */

/** The slice of config the browser needs. Kept small and free of anything private. */
function withRuntime(cfg) {
  const b = cfg.business ?? {};
  return {
    ...cfg,
    __runtime: {
      slug: cfg.slug,
      site: {
        name: b.name,
        ownerFirstName: b.ownerFirstName,
        phoneDisplay: b.phone?.display ?? '',
        phoneE164: b.phone?.e164 ?? '',
        email: b.email ?? '',
        smsBody: fill(cfg.sms?.body, { owner: b.ownerFirstName ?? 'there' }),
        googleReviewsUrl: cfg.has.googleReviews ? cfg.googleReviewsUrl : '',
        googleWriteReviewUrl: cfg.has.googleReviews ? cfg.googleWriteReviewUrl : '',
        formEndpoint: cfg.form?.endpoint ?? '',
        formAccessKey: cfg.form?.accessKey ?? '',
      },
      form: {
        submitLabel: cfg.form?.submitLabel,
        sendingLabel: cfg.form?.sendingLabel,
        successBody: cfg.form?.successBody,
        demoBody: cfg.form?.demoBody,
        errorHeading: cfg.form?.errorHeading,
        errorBody: cfg.form?.errorBody,
      },
      demo: { formNote: cfg.demo?.formNote },
      // A price nobody has confirmed is left empty, and the sentence that would
      // have carried it stays hidden. No stub, and no sentence with a hole in it.
      priceLines: Object.fromEntries(
        Object.entries(cfg.priceLines ?? {}).map(([k, v]) => [k, typeof v === 'string' ? v : v?.value ?? '']),
      ),
      // Same rule for a credential: no year, no card.
      credentialYears: Object.fromEntries(
        (cfg.credentials ?? []).filter((c) => c.yearKey && c.year).map((c) => [c.yearKey, String(c.year)]),
      ),
      calculator: calculatorData(cfg),
      colours: cfg.colours ?? [],
      reviews: (cfg.reviews ?? []).map((r) => ({ name: r.name, text: r.text, source: r.source })),
      colourAltPrefix: cfg.colourAltPrefix,
    },
  };
}

const fill = (text, vars) =>
  String(text ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));

/** Block runtimes, added only when that block is actually on the page. */
function extraScripts(cfg) {
  const parts = [];
  if (cfg.has.beforeAfter) parts.push(beforeAfterScript);
  if (cfg.has.heroVideo) parts.push(heroVideoScript);
  return parts.length ? `(function(){${parts.join('\n')}})();` : '';
}

/* -------------------------------------------------------------------- files */

function robotsTxt(cfg) {
  if (cfg.live) return 'User-agent: *\nAllow: /\n';
  return `# DEMO SITE — NOT FOR INDEXING
# An unsolicited demo built as a proposal for ${cfg.business?.name ?? 'this business'}.
# It carries their name, logo and photography. It must never appear in search
# results or be mistaken for their real site.
User-agent: *
Disallow: /
`;
}

/* --------------------------------------------------------------- link check */

/**
 * Re-read what we just wrote and confirm every local href, src and srcset
 * points at a file that exists. Copied from crossroads-church/build.py, which
 * does the same thing for the same reason.
 */
export async function checkLinks(dir, file = 'index.html') {
  const html = await readFile(join(dir, file), 'utf8');
  const refs = new Set();

  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (url) refs.add(url);
    }
  }
  for (const m of html.matchAll(/imagesrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (url) refs.add(url);
    }
  }
  // data-src carries the full-size image the lightbox opens.
  for (const m of html.matchAll(/data-src="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/data-(?:mp4|webm)="([^"]+)"/g)) refs.add(m[1]);

  const broken = [];
  for (const ref of refs) {
    if (!ref || ref.startsWith('#') || ref.startsWith('data:')) continue;
    if (/^(https?:|mailto:|tel:|sms:)/i.test(ref)) continue;
    // "page.html#section" points at a real file plus a fragment on it — only
    // the file part exists on disk. Subpages link back to the homepage's own
    // anchors this way (e.g. "index.html#services").
    const path = join(dir, ref.replace(/^\//, '').split('?')[0].split('#')[0]);
    if (!existsSync(path)) broken.push(ref);
  }
  return broken.sort();
}

/** Every file in dist/<slug>, for the build summary. */
export async function listFiles(dir) {
  const out = [];
  async function walk(d) {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) await walk(p);
      else out.push(relative(dir, p));
    }
  }
  await walk(dir);
  return out.sort();
}
