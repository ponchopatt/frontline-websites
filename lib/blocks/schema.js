/**
 * <head> metadata: Open Graph, Twitter, and LocalBusiness JSON-LD.
 *
 * Open Graph matters more than usual here. These links get sent to a tradie as
 * a text message, and a link with no picture reads as spam. So og:image is
 * absolute (a relative one does not unfurl), carries width, height and alt, and
 * is checked by `npm run check`.
 *
 * The JSON-LD is generated from the same config the visible page uses, so the
 * two cannot drift. Deliberately absent: aggregateRating. Google ignores a
 * rating a business publishes about itself, so it buys nothing, and asserting
 * one we have not confirmed breaks the first rule of the whole project.
 */
import { html, raw, present } from '../render.js';

/**
 * Every page declares a favicon, even when the client has not supplied one.
 *
 * Without a <link rel="icon"> the browser requests /favicon.ico on its own and
 * logs a 404 — which shows up in the console of a demo we are asking someone to
 * take seriously. The fallback is an inline SVG of their initials on their
 * accent colour: no extra file, no extra request, and it reads as deliberate in
 * a browser tab beside their name.
 */
export function faviconLink(cfg) {
  const supplied = cfg.icons?.favicon;
  if (present(supplied)) {
    const type = /\.svg$/i.test(supplied) ? ' type="image/svg+xml"' : '';
    return raw(`<link rel="icon" href="${escAttr(supplied)}"${type}>`);
  }
  const accent = cfg.palette?.accent ?? cfg.business?.brand?.accent ?? '#1C1F23';
  const initials = String(cfg.business?.name ?? '')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'F';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<rect width="64" height="64" rx="12" fill="${accent}"/>`
    + `<text x="32" y="43" font-family="system-ui,sans-serif" font-size="30" font-weight="700"`
    + ` text-anchor="middle" fill="#fff">${initials}</text></svg>`;
  return raw(`<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`);
}

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function headMeta(cfg, { title, description, canonical }) {
  const hero = cfg.photos?.hero;
  const ogImage = absolute(cfg, cfg.share?.image ?? hero?.src);
  const alt = cfg.share?.alt ?? hero?.alt ?? cfg.business?.name ?? '';

  return html`<meta property="og:type" content="website">
<meta property="og:site_name" content="${cfg.business?.name ?? ''}">
<meta property="og:locale" content="en_AU">
<meta property="og:title" content="${cfg.share?.title ?? title}">
<meta property="og:description" content="${cfg.share?.description ?? description}">
${canonical ? html`<meta property="og:url" content="${canonical}">` : ''}
${ogImage ? html`<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="${cfg.share?.width ?? 1200}">
<meta property="og:image:height" content="${cfg.share?.height ?? 630}">
<meta property="og:image:alt" content="${alt}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${cfg.share?.title ?? title}">
<meta name="twitter:description" content="${cfg.share?.description ?? description}">
${ogImage ? html`<meta name="twitter:image" content="${ogImage}">
<meta name="twitter:image:alt" content="${alt}">` : ''}`;
}

function absolute(cfg, path) {
  if (!present(path)) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = (cfg.siteUrl ?? '').replace(/\/$/, '');
  return base ? `${base}/${String(path).replace(/^\//, '')}` : '';
}

/** LocalBusiness, built only from values we actually hold. */
export function jsonLd(cfg) {
  const b = cfg.business ?? {};
  const node = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', cfg.schemaType].filter(Boolean),
    name: b.name,
    description: cfg.share?.description ?? cfg.tagline,
    telephone: b.phone?.e164 || undefined,
    email: b.email || undefined,
    url: cfg.siteUrl || undefined,
    image: absolute(cfg, cfg.share?.image ?? cfg.photos?.hero?.src) || undefined,
    taxID: b.abn ? String(b.abn).replace(/\s/g, '') : undefined,
    priceRange: cfg.priceRange || undefined,
  };

  if (b.baseSuburb) {
    node.address = {
      '@type': 'PostalAddress',
      addressLocality: b.baseSuburb,
      addressRegion: b.region || undefined,
      addressCountry: 'AU',
    };
  }

  const suburbs = (cfg.serviceAreas ?? []).flatMap((g) => g.suburbs ?? []);
  if (suburbs.length) {
    node.areaServed = suburbs.map((s) => ({
      '@type': 'Place',
      name: b.region ? `${s}, ${b.region}` : s,
    }));
  }

  if (b.ownerName) {
    node.founder = { '@type': 'Person', name: b.ownerName, jobTitle: b.ownerTitle || undefined };
  }

  const awards = (cfg.credentials ?? [])
    .filter((c) => c.kind === 'award' && c.label)
    .map((c) => (c.year ? `${c.label}, ${c.year}` : c.label));
  if (awards.length) node.award = awards;

  const services = (cfg.services ?? []).map((s) => s.title).filter(present);
  if (services.length) node.knowsAbout = services;

  // No aggregateRating on purpose: Google ignores a self-published rating, so
  // it buys nothing, and we will not assert a number we cannot source.

  return raw(`<script type="application/ld+json">${JSON.stringify(prune(node))}</script>`);
}

function prune(obj) {
  if (Array.isArray(obj)) return obj.map(prune).filter((v) => v !== undefined);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const p = prune(v);
      if (p !== undefined && p !== '' && !(Array.isArray(p) && p.length === 0)) out[k] = p;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return obj;
}
