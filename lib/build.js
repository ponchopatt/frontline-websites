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

  const prepared = withRuntime(withPalette(cfg));
  const css = styles + '\n' + blockStyles + '\n' + accentOverride(prepared);
  const js = script + '\n' + extraScripts(prepared);

  const htmlOut = render(prepared, { styles: css, script: js });

  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), htmlOut);

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

  const broken = await checkLinks(dir);
  if (!quiet && broken.length) {
    for (const b of broken) console.error(`  broken: ${b}`);
  }

  return { slug, dir, cfg: prepared, bytes: Buffer.byteLength(htmlOut), broken };
}

export async function buildAll(slugs, opts = {}) {
  const results = [];
  for (const slug of slugs) results.push(await buildClient(slug, opts));
  return results;
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

  return {
    ...cfg,
    palette: { ...derived, accentLiftRgb: hexToRgb(derived.accentLift).join(',') },
  };
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
export async function checkLinks(dir) {
  const html = await readFile(join(dir, 'index.html'), 'utf8');
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
    const path = join(dir, ref.replace(/^\//, '').split('?')[0]);
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
