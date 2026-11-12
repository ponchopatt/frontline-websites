/*
  Builds the inner pages (services, suburbs, the privacy policy) and sitemap.xml.

    node build.mjs

  The words are in content.mjs. The header, footer and phone bar are copied from
  index.html (between its shared: comments) and the prices are read from app.js, so each
  lives in one place. Run it after changing any of those three files, and commit what it
  writes. Vercel serves the files as they are, with no build step.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import content from './content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const SITE = 'https://www.drivendetailing.com.au';

// ---- From index.html: the shared blocks, with its own #links pointed at the home page.
const home = read('index.html');
const shared = (name) => {
  const m = home.match(new RegExp(`<!-- shared:${name} -->\\n([\\s\\S]*?)<!-- /shared:${name} -->`));
  if (!m) throw new Error(`index.html has no shared:${name} block`);
  return m[1].replace(/href="#/g, 'href="/#');
};
const header = shared('header'), footer = shared('footer'), bar = shared('bar');
const icons = home.match(/<svg width="0" height="0"[\s\S]*?<\/svg>/)[0];

// ---- From app.js: the sizes, the condition range and the packages.
const app = read('app.js');
const grab = (re, what) => { const m = app.match(re); if (!m) throw new Error(`app.js: can't find ${what}`); return m[0]; };
const { SIZES, RANGE, PACKAGES } = new Function(
  `${grab(/const SIZES = \[[^\]]*\];/, 'SIZES')}\n${grab(/const RANGE = \d+;/, 'RANGE')}\n${grab(/const PACKAGES = \[[\s\S]*?\n\];/, 'PACKAGES')}\nreturn { SIZES, RANGE, PACKAGES };`,
)();
const job = (id) => { const p = PACKAGES.find((x) => x.id === id); if (!p) throw new Error(`no package ${id}`); return p; };
const $ = (n) => '$' + Number(n).toLocaleString('en-AU');
const LABELS = ['Hatch or sedan', 'SUV or ute', '4x4 or 7-seater'];

const P = {
  range: $(RANGE),
  from: (id) => $(job(id).prices[0]),
  inc: (id) => job(id).inc,
  // "$290 to $350" for a job with a condition range, "$140" for a set price.
  rangeText: (id, size) => { const p = job(id), n = p.prices[size]; return p.ranged ? `${$(n)} to ${$(n + RANGE)}` : $(n); },
  // "$140 for a hatch or sedan ($165 for an SUV or ute, $170 for a 4x4 or 7-seater)"
  trio: (id) => {
    const n = job(id).prices;
    return `${$(n[0])} for a ${SIZES[0]} (${$(n[1])} for an ${SIZES[1]}, ${$(n[2])} for a ${SIZES[2]})`;
  },
  table: (ids) => {
    const rows = ids.map((id) => {
      const p = job(id);
      const cells = p.prices.map((n, i) => n == null ? '<td>Quoted</td>'
        : `<td>${$(n)}${p.ranged ? `<small>to ${$(n + RANGE)}</small>` : p.twoStep ? `<small>two-step ${$(p.twoStep[i])}</small>` : p.tiers ? `<small>3 yrs. 5 yrs ${$(p.tiers[5][i])}, 7 yrs ${$(p.tiers[7][i])}</small>` : ''}</td>`).join('');
      return `<tr><td>${p.name}<small>${p.time || p.desc}</small></td>${cells}</tr>`;
    }).join('\n');
    const ranged = ids.some((id) => job(id).ranged);
    return `<div class="ptable"><table>
  <thead><tr><th scope="col">Detail</th>${LABELS.map((l) => `<th scope="col">${l}</th>`).join('')}</tr></thead>
  <tbody>
${rows}
  </tbody>
</table></div>${ranged ? `\n<p class="ptable-note">A full or interior detail can be up to ${$(RANGE)} more if the car needs extra work. Seb tells you before he starts.</p>` : ''}`;
  },
  // Ceramic coating: a row for each length of protection, a column for each car size.
  ceramicTable: () => {
    const p = job('cc');
    const rows = [[3, p.prices], [5, p.tiers[5]], [7, p.tiers[7]]]
      .map(([y, list]) => `<tr><td>${y} years</td>${list.map((n) => `<td>${$(n)}</td>`).join('')}</tr>`).join('\n');
    return `<div class="ptable"><table>
  <thead><tr><th scope="col">Protection</th>${LABELS.map((l) => `<th scope="col">${l}</th>`).join('')}</tr></thead>
  <tbody>
${rows}
  </tbody>
</table></div>`;
  },
  // "$997 for a hatch or sedan ($1,097 for an SUV or ute, $1,147 for a 4x4 or 7-seater)"
  ceramicLine: (years) => {
    const p = job('cc'), n = years === 3 ? p.prices : p.tiers[years];
    return `${$(n[0])} for a ${SIZES[0]} (${$(n[1])} for an ${SIZES[1]}, ${$(n[2])} for a ${SIZES[2]})`;
  },
  tierFrom: (years) => $(job('cc').tiers[years][0]),
  reviews: (list) => `<h2>What customers say</h2>
<div class="page-revs">
${list.map(([who, text]) => `  <figure class="rev">
    <svg class="rev-stars" viewBox="0 0 100 20" role="img" aria-label="5 stars"><use href="#star5"/></svg>
    <blockquote><p>${text}</p></blockquote>
    <figcaption>${who} <span>Google review</span></figcaption>
  </figure>`).join('\n')}
</div>`,
};

// ---- The page
const pic = (name, alt) => {
  // The hero files carry a version (-v2): browsers keep images for a year, so a new photo needs a new name.
  const big = name === 'hero' ? 'hero-v2-1400' : `${name}-1000`, small = name === 'hero' ? 'hero-v2-800' : `${name}-600`;
  const [w, h] = name === 'hero' ? [1400, 933] : [1000, 750];
  return `<figure class="page-pic"><img src="/assets/${big}.webp" srcset="/assets/${small}.webp ${small.split('-').pop()}w, /assets/${big}.webp ${big.split('-').pop()}w" sizes="(min-width: 960px) 46vw, 100vw" width="${w}" height="${h}" alt="${alt}" fetchpriority="high"></figure>`;
};

function page(pg, { legal = false } = {}) {
  const url = SITE + pg.path;
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: pg.crumb, item: url },
  ] };
  const ctas = legal ? '' : `
      <div class="hero-cta">
        <a class="btn" href="/#price">See your price</a>
        <a class="btn ghost" href="sms:+61404714415">Text Seb</a>
      </div>`;
  const band = legal ? '' : `
    <div class="cta-band">
      <div>
        <h2>Ready for a clean car?</h2>
        <p>Pick your car, see your price and book in a few taps.</p>
      </div>
      <div class="btns">
        <a class="btn" href="/#price">See your price</a>
        <a class="btn ghost" href="tel:+61404714415">Call 0404 714 415</a>
      </div>
    </div>`;
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<!-- Built by build.mjs from content.mjs. Edit those, not this file. -->
<title>${pg.title}</title>
<meta name="description" content="${pg.desc}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${pg.title}">
<meta property="og:description" content="${pg.desc}">
<meta property="og:image" content="${SITE}/assets/og-v2.jpg">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta name="theme-color" content="#05070c">
<link rel="preload" href="/fonts/archivo-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to the page</a>

${header}
<main id="main">

<section class="page-hero${legal ? ' legal-hero' : ''}">
  <div class="wrap${pg.pic ? ' page-hero-in' : ''}">
    <div>
      <p class="crumbs"><a href="/">Home</a> / ${pg.crumb}</p>
      <h1>${pg.h1}</h1>
      <p class="sub">${pg.intro}</p>${pg.quick ? `
      <p class="quick"><strong>Quick answer:</strong> ${pg.quick}</p>` : ''}${ctas}
    </div>${pg.pic ? `
    ${pic(pg.pic, pg.picAlt)}` : ''}
  </div>
</section>

<section class="sec${legal ? ' legal' : ''}">
  <div class="wrap">
${pg.blocks.map((b) => `    <div class="prose">\n${b.trim()}\n    </div>`).join('\n')}
${band}
  </div>
</section>

</main>

${footer}
${bar}
${icons}
</body>
</html>
`;
}

// ---- Write
const { pages, privacy } = content(P);
const written = [];
const out = (p, html) => {
  const file = p.endsWith('.html') ? p.slice(1) : p.slice(1) + 'index.html';
  fs.mkdirSync(path.join(here, path.dirname(file)), { recursive: true });
  fs.writeFileSync(path.join(here, file), html);
  written.push(file);
};
for (const pg of pages) out(pg.path, page(pg));
out(privacy.path, page(privacy, { legal: true }));

const today = new Date().toISOString().slice(0, 10);
const urls = ['/', ...pages.map((p) => p.path), privacy.path];
fs.writeFileSync(path.join(here, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
console.log('wrote', written.length, 'pages and sitemap.xml:\n ' + written.join('\n '));
