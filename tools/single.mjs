/**
 * single — fold a built demo into ONE html file you can open by double-clicking.
 *
 *   node tools/single.mjs            every demo in dist/
 *   node tools/single.mjs <slug>     just one
 *
 * Why this exists: dist/<slug>/ is a folder — index.html plus assets, fonts and
 * vendor. That deploys beautifully and travels badly. You cannot text it to
 * yourself, open it on a phone, or attach it to anything. This inlines every
 * local file as a data URI, so the result is a single self-contained page that
 * works with no server, no network and no unzipping.
 *
 * It is a VIEWING copy. dist/<slug>/ is still what goes to Vercel, because a
 * real host serves separate cacheable files and a data URI cannot be cached,
 * shared between pages, or fetched only when needed.
 *
 * THE ONE THING THAT IS NOT A STRAIGHT COPY: responsive images.
 *
 * A data URI is inlined per *reference*, not per file, and the templates point
 * at the same photo from several places at once — `src`, three or four `srcset`
 * candidates, `data-src` for the aperture, and a preload. Substituting each one
 * embedded Horgan's 3.7 MB of photographs as a 13.8 MB file: every picture in
 * there three times over.
 *
 * So each image element gets exactly one file, `srcset` dropped: the smallest
 * size that is still at least TARGET_WIDTH across, or the biggest there is if
 * none reaches it. Bandwidth is the thing srcset exists to save and there is no
 * network here, so what is left is only the quality question, and 1200px covers
 * a full-bleed photo on a laptop and is more than a phone can show. Layout does
 * not move: every size of one photo has the same aspect ratio, and the width and
 * height attributes are untouched.
 *
 * If no size on disk is close to that, one is made. Horgan's photos exist only
 * at 800 and 1800, so every one of them embedded at 1800 and the file came to
 * 10.5 MB for pictures nothing on screen could show at that size. A 1200 is
 * rendered once into a cache and reused.
 *
 * A photo the page shows twice still costs twice, because a data URI cannot be
 * shared between two elements without JavaScript, and the page has to work
 * without it. The printed size is the honest total.
 *
 * Two things are dropped rather than inlined:
 *
 *   the font preloads   the @font-face rules are already inline in the page's
 *                       one <style> block, so the font is there with zero
 *                       network. Preloading a data URI would embed the same
 *                       woff2 a second time for no gain.
 *   the hero preload    same reasoning. The hero <img> carries the bytes.
 *
 * Everything else — markup, CSS, both GSAP files, the runtime, the demo banner,
 * the JSON-LD — is byte-for-byte what deploys.
 *
 * Not every path is in an attribute. The quote template ships its Colorbond
 * colour list as JSON inside a <script> and the picker assigns `img.src` from
 * it, so eleven swatches stayed as `assets/gate-*.webp` and failed to load the
 * moment the page was off its server. Quoted paths in script data are rewritten
 * too.
 *
 * ONE TRAP, worth the paragraph: every substitution here uses a replacer
 * FUNCTION, never a replacement string. In a replacement string `$&` means the
 * whole match and `` $` `` means everything before it, and minified GSAP is full of
 * both. Passing it as a string spliced a `<script>` tag into the middle of the
 * library, which broke parsing and dumped the rest of GSAP onto the page as
 * visible text. It looked like a page that had loaded.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

/** Where rendered-down sizes live, so a second run does no work. */
const CACHE = join('dist-single', '.cache');

const MIME = {
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
};

/** Only these prefixes are ours to inline. Anything else is left exactly as it is. */
const LOCAL = /^(?:\.\/)?(?:assets|fonts|vendor)\//;

/**
 * Wide enough for a full-bleed photo on a laptop, and past what any phone can
 * resolve. Going higher buys nothing you can see and costs megabytes.
 */
const TARGET_WIDTH = 1200;

/**
 * How far past the target a size may be before it is worth rendering a new one.
 * 1.25 lets a 1400 through and catches an 1800, which is the case that matters.
 */
const TOO_BIG = 1.25;

/** "assets/hero-terrace-800.webp" -> { family: "assets/hero-terrace.webp", width: 800 } */
const variant = (path) => {
  const m = /^(.*)-(\d{2,5})(\.[a-z0-9]+)$/i.exec(path);
  return m ? { family: m[1] + m[3], width: Number(m[2]) } : null;
};

/**
 * A copy of `src` at TARGET_WIDTH, rendered once and kept.
 *
 * Returns null on any failure — a missing sharp, an image it cannot read — and
 * the caller falls back to the oversized original. A viewing copy that is bigger
 * than it needs to be is a much smaller problem than one that will not build.
 */
async function narrowed(absSrc, slug, name) {
  const outDir = join(CACHE, slug);
  const out = join(outDir, name);
  if (existsSync(out)) return out;
  try {
    const { default: sharp } = await import('sharp');
    await mkdir(outDir, { recursive: true });
    await sharp(absSrc).resize({ width: TARGET_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
    return out;
  } catch {
    return null;
  }
}

export async function inlineDemo(distDir, slug) {
  const dir = join(distDir, slug);
  const file = join(dir, 'index.html');
  if (!existsSync(file)) throw new Error(`no built demo at ${file} — run npm run build first`);

  let html = await readFile(file, 'utf8');
  const missing = [];
  const embedded = [];        // one entry per data URI actually written into the file
  const cache = new Map();

  /* Every size of every photo on disk, grouped, so the right one can be found
   * even when the page never linked to it.
   *
   * Grouping is by real pixel width, not by filename. A `-800` suffix is only
   * treated as a size when the file really is 800 across — otherwise
   * `job-12.webp` and `job-34.webp` would be read as two sizes of one photo. It
   * also catches the case that broke the colour picker: the quote template's
   * swatches are `gate-monument.webp` at 1100 and `gate-monument-700.webp`, and
   * only a measured width puts those two in the same family. */
  const families = new Map();
  const widthOf = new Map();
  if (existsSync(join(dir, 'assets'))) {
    let sharp = null;
    try { sharp = (await import('sharp')).default; } catch { /* families stay one-deep */ }
    for (const name of await readdir(join(dir, 'assets'))) {
      const path = `assets/${name}`;
      if (!/\.(webp|jpe?g|png|avif)$/i.test(name)) continue;
      let width = null;
      try { width = sharp ? (await sharp(join(dir, path)).metadata()).width : null; } catch { /* unreadable */ }
      const v = variant(path);
      // The suffix counts as a size only if it is the truth.
      const family = v && width != null && Math.abs(v.width - width) <= 2 ? v.family : path;
      width ??= v?.width ?? 0;
      widthOf.set(path, width);
      families.set(family, [...(families.get(family) ?? []), { path, width }]);
    }
  }
  /** Which family a path belongs to, by the same rule. */
  const familyOf = (path) => {
    for (const [family, list] of families) if (list.some((c) => c.path === path)) return family;
    return null;
  };

  const swapped = [];
  const rendered = new Set();
  /** The one size of this photo worth embedding, as { key, abs }. */
  const pickSize = async (path) => {
    const bare = path.replace(/^\.\//, '');
    const list = families.get(familyOf(bare));
    if (!list?.length) return { key: bare };
    const big = list.filter((c) => c.width >= TARGET_WIDTH);
    const best = big.length
      ? big.reduce((a, b) => (b.width < a.width ? b : a))   // smallest that is big enough
      : list.reduce((a, b) => (b.width > a.width ? b : a)); // nothing is, so the biggest

    if (best.width > TARGET_WIDTH * TOO_BIG) {
      const name = `${basename(best.path).replace(/-\d+(\.\w+)$/, '')}-${TARGET_WIDTH}.webp`;
      const abs = await narrowed(join(dir, best.path), slug, name);
      if (abs) {
        rendered.add(name);
        if (bare !== best.path) swapped.push(`${basename(bare)} → ${name}`);
        return { key: `rendered:${name}`, abs };
      }
    }
    if (best.path !== bare) swapped.push(`${basename(bare)} → ${basename(best.path)}`);
    return { key: best.path };
  };

  const dataUri = async (key, absOverride) => {
    if (cache.has(key)) return cache.get(key).uri;
    const abs = absOverride ?? join(dir, key.replace(/^\.\//, ''));
    if (!existsSync(abs)) { missing.push(key); return null; }
    const buf = await readFile(abs);
    const mime = MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream';
    cache.set(key, { uri: `data:${mime};base64,${buf.toString('base64')}`, bytes: buf.length });
    return cache.get(key).uri;
  };

  /* ---------------------------------------------------------------- preloads */
  const before = html.length;
  html = html.replace(/[ \t]*<link\b[^>]*\brel="preload"[^>]*>\n?/g, (tag) =>
    LOCAL.test((/\b(?:href|imagesrcset)="([^" ,]+)/.exec(tag) ?? [])[1] ?? '') ? '' : tag);
  const preloadsDropped = before !== html.length;

  /* ------------------------------------------------------------------ srcset */
  // Dropped before src is rewritten, so the widths cannot end up describing a
  // data URI that is no longer the right size.
  let srcsetDropped = 0;
  html = html.replace(/\s\b(?:srcset|imagesrcset|imagesizes)="([^"]*)"/g, (whole, value) => {
    if (!value.split(',').some((p) => LOCAL.test(p.trim().split(/\s+/)[0]))) return whole;
    srcsetDropped++;
    return '';
  });

  /* ----------------------------------------------------------------- scripts */
  // Position and order are preserved exactly: gsap still runs before
  // ScrollTrigger, and all three sit just before </body> so the DOM is parsed.
  // `defer` is dropped because it does nothing on an inline script and leaving
  // it there would imply otherwise.
  const SCRIPT = /<script\b([^>]*?)\ssrc="([^"]+)"([^>]*)><\/script>/g;
  const code = new Map();
  for (const [, , src] of html.matchAll(SCRIPT)) {
    if (!LOCAL.test(src) || code.has(src)) continue;
    const abs = join(dir, src.replace(/^\.\//, ''));
    if (!existsSync(abs)) { missing.push(src); continue; }
    // A literal </script> inside the code would close the tag early.
    code.set(src, (await readFile(abs, 'utf8')).replace(/<\/script/gi, '<\\/script'));
  }
  html = html.replace(SCRIPT, (whole, pre, src, post) => {
    const js = code.get(src);
    if (js == null) return whole;
    embedded.push(Buffer.byteLength(js));
    const attrs = `${pre} ${post}`.replace(/\bdefer\b/g, '').replace(/\s+/g, ' ').trim();
    return `<script${attrs ? ' ' + attrs : ''}>${js}</script>`;
  });

  /* ---------------------------------------------------- everything with a url */
  // src, href, poster, the data-* the aperture and hero-video blocks read, and
  // CSS url() for @font-face. Resolved first, substituted second, so the async
  // work happens once per file and the rewrite is a single deterministic pass.
  const ATTRS = /\b(src|href|poster|data-src|data-mp4|data-webm|data-poster)="([^"]+)"/g;
  const CSS_URL = /url\((["']?)([^)"']+)\1\)/g;
  // A quoted path that is not an attribute value: the colour list and anything
  // else a script assigns at runtime. The lookbehind keeps it off attributes,
  // which the pass above has already turned into data URIs.
  const JS_PATH = /(?<!=)(["'])((?:assets|fonts|vendor)\/[^"']+)\1/g;

  const wanted = new Set();
  for (const [, , value] of html.matchAll(ATTRS)) if (LOCAL.test(value)) wanted.add(value);
  for (const [, , value] of html.matchAll(CSS_URL)) if (LOCAL.test(value)) wanted.add(value);
  for (const [, , value] of html.matchAll(JS_PATH)) wanted.add(value);

  const resolved = new Map();
  for (const path of wanted) {
    // Images resolve to one size first; fonts, svg and logos carry no size
    // suffix and pass through pickSize() untouched.
    const { key, abs } = await pickSize(path);
    const uri = await dataUri(key, abs);
    if (uri) resolved.set(path, { uri, bytes: cache.get(key).bytes });
  }

  /** Substitute, and count the bytes this particular reference costs. */
  const swap = (value) => {
    const hit = resolved.get(value);
    if (!hit) return null;
    embedded.push(hit.bytes);   // a photo used twice costs twice, and says so
    return hit.uri;
  };

  html = html.replace(ATTRS, (whole, name, value) => {
    const uri = swap(value);
    return uri ? `${name}="${uri}"` : whole;
  });
  html = html.replace(CSS_URL, (whole, _q, value) => {
    const uri = swap(value);
    return uri ? `url(${uri})` : whole;
  });
  html = html.replace(JS_PATH, (whole, q, value) => {
    const uri = swap(value);
    return uri ? `${q}${uri}${q}` : whole;
  });

  /* ------------------------------------------------------------------ report */
  const leftOver = [
    ...[...html.matchAll(/\b(?:src|href|srcset|poster|data-src)="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/(["'])((?:assets|fonts|vendor)\/[^"']+)\1/g)].map((m) => m[2]),
  ].filter((v) => LOCAL.test(v));

  return {
    html,
    files: cache.size,
    references: embedded.length,
    rawBytes: embedded.reduce((a, b) => a + b, 0),
    bytes: Buffer.byteLength(html),
    missing: [...new Set(missing)],
    leftOver: [...new Set(leftOver)],
    swapped: [...new Set(swapped)],
    rendered: [...rendered],
    srcsetDropped,
    preloadsDropped,
  };
}

/* ----------------------------------------------------------------------- cli */

if (import.meta.url === `file://${process.argv[1]}`) {
  const distDir = 'dist';
  const outDir = 'dist-single';
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

  if (!existsSync(distDir)) {
    console.error('\nNothing in dist/. Run:  npm run build\n');
    process.exit(2);
  }
  const all = (await readdir(distDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && existsSync(join(distDir, d.name, 'index.html')))
    .map((d) => d.name).sort();
  const slugs = only.length ? only : all;
  for (const s of slugs) {
    if (!all.includes(s)) { console.error(`\nNo built demo "${s}". Have: ${all.join(', ')}\n`); process.exit(2); }
  }

  await mkdir(outDir, { recursive: true });
  const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
  let failed = 0;
  const made = [];

  console.log('');
  for (const slug of slugs) {
    const r = await inlineDemo(distDir, slug);
    const out = join(outDir, `${slug}.html`);
    await writeFile(out, r.html);
    const title = ((/<title>([^<]*)</.exec(r.html) ?? [])[1] ?? slug).replace(/&amp;/g, '&');
    made.push({ slug, title, bytes: r.bytes });
    console.log(`  ${out}`);
    console.log(`    ${mb(r.bytes)} · ${r.files} files inlined at ${r.references} places · ${r.srcsetDropped} srcset dropped`);
    if (r.rendered.length) console.log(`    ${r.rendered.length} photo(s) rendered down to ${1200}px because only a much larger size existed`);
    if (r.missing.length) {
      failed++;
      console.log(`    MISSING (${r.missing.length}) — these would be broken images on the page:`);
      for (const p of r.missing) console.log(`      ✗ ${p}`);
    }
    if (r.leftOver.length) {
      failed++;
      console.log(`    STILL POINTS AT A FILE (${r.leftOver.length}) — not self-contained:`);
      for (const p of r.leftOver) console.log(`      ✗ ${p}`);
    }
  }

  /* An index, so the folder is browsable rather than a pile of files. */
  const rows = made.map((m) => `    <li><a href="./${m.slug}.html">${m.title}</a> <span>${mb(m.bytes)}</span></li>`).join('\n');
  await writeFile(join(outDir, 'index.html'), `<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Frontline demo previews</title>
<style>
  :root { color-scheme: light dark;
    --ink:#14130f; --bg:#faf8f4; --dim:#6b6558; --line:#e2dccf }
  @media (prefers-color-scheme: dark) { :root { --ink:#f2efe8; --bg:#14130f; --dim:#9a9384; --line:#2b2822 } }
  * { box-sizing:border-box }
  body { margin:0; padding:2.5rem 1.25rem; background:var(--bg); color:var(--ink);
    font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif }
  main { max-width:34rem; margin:0 auto }
  h1 { font-size:1.5rem; letter-spacing:-.02em; margin:0 0 .35rem }
  p.sub { color:var(--dim); margin:0 0 2rem }
  ul { list-style:none; padding:0; margin:0; border-top:1px solid var(--line) }
  li { border-bottom:1px solid var(--line) }
  li a { display:flex; justify-content:space-between; gap:1rem; align-items:baseline;
    min-height:44px; padding:.9rem .25rem; color:inherit; text-decoration:none }
  li a:hover, li a:focus-visible { background:color-mix(in srgb, currentColor 8%, transparent) }
  li span { color:var(--dim); font-size:.85rem; font-variant-numeric:tabular-nums; white-space:nowrap }
  footer { margin-top:2rem; color:var(--dim); font-size:.85rem }
</style></head>
<body><main>
  <h1>Demo previews</h1>
  <p class="sub">Each one is a single self-contained file — no server, no network.</p>
  <ul>
${rows}
  </ul>
  <footer>Viewing copies. <code>dist/&lt;slug&gt;/</code> is what deploys.</footer>
</main></body></html>
`);
  console.log(`\n  ${outDir}/index.html  (a menu of all ${made.length})`);
  console.log(`\n  Open any of them straight off disk — no server needed.\n`);
  process.exit(failed ? 1 : 0);
}
