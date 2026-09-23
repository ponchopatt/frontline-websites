/**
 * Service and suburb pages — one per entry in cfg.servicePages / cfg.suburbPages.
 *
 * Reuses the homepage's header, footer, sticky bar and runtime script exactly
 * (see template.js: every runtime section guards on its own root element and
 * no-ops when that section isn't on the page, so shipping the same
 * window.__CFG here is safe even though a subpage has no calculator or
 * gallery). Only the middle of the page — hero, intro, benefits, FAQ, quote
 * form, cross-links — is specific to the page being rendered.
 *
 * Lives as a flat file at dist/<slug>/<page.slug>.html, one directory level
 * up from services/ or areas/ subfolders would be — this is deliberate: it
 * keeps every "assets/…", "vendor/…" and "fonts/…" reference in the shared
 * header/footer/hero markup correct with zero path-rewriting. A prettier
 * nested URL is a hosting-level rewrite away once this goes live for real.
 */
import { html, raw, when, each, present, telHref, smsHref, headlineLines, sampleTag } from '../../lib/render.js';
import { heroMedia } from '../../lib/blocks/hero-media.js';
import { brands } from '../../lib/blocks/brands.js';
import { promise } from '../../lib/blocks/promise.js';
import { enquiryForm, thanksPanel, FORM_CLASSES } from '../../lib/blocks/form.js';
import { demoBanner, demoBannerHeadScript, demoFooterNote, robotsMeta } from '../../lib/blocks/demo.js';
import { headMeta, jsonLd, faviconLink } from '../../lib/blocks/schema.js';
import {
  ICON, header, footer, stickyBar, heroPreload, jsonScript, escText, escAttr, sitePageNav,
} from './template.js';

/**
 * @param page {{
 *   slug: string, kind: 'service'|'suburb', title: string, description: string,
 *   kicker: string, headline: string, sub: string, intro?: string,
 *   benefits?: string[], faq?: {q,a}[], defaultService?: string, defaultSuburb?: string,
 *   related?: {href:string,label:string}[]
 * }}
 */
export function renderSubpage(cfg, page, { styles, script }) {
  const b = cfg.business ?? {};
  const phone = b.phone ?? {};
  const tel = telHref(phone);
  const sms = smsHref(phone);
  const copy = cfg.copy ?? {};
  const ctaLabel = copy.ctaLabel ?? 'Get a quote';
  const ctaLabelShort = copy.ctaLabelShort ?? ctaLabel;

  const nav = [
    cfg.has.services && ['index.html#services', 'Services'],
    cfg.has.calculator && ['index.html#pricing', 'Pricing'],
    cfg.has.gallery && ['index.html#projects', 'Our work'],
    cfg.has.reviews && ['index.html#reviews', 'Reviews'],
    cfg.has.serviceAreas && ['index.html#areas', 'Areas'],
    cfg.has.faq && ['index.html#faq', 'FAQ'],
    ...sitePageNav(cfg),
  ].filter(Boolean);

  const title = page.title;
  const description = page.description;
  const canonical = cfg.siteUrl ? `${String(cfg.siteUrl).replace(/\/$/, '')}/${page.slug}.html` : undefined;
  // A page can name its own hero photo (page.heroPhoto); otherwise it falls
  // back to the same one every other page uses. Computed once here so the
  // preload, the og:image and the hero itself never disagree about which
  // photo is actually on the page.
  const heroCfg = page.heroPhoto ? { ...cfg, photos: { ...cfg.photos, hero: page.heroPhoto } } : cfg;

  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escText(title)}</title>
<meta name="description" content="${escAttr(description)}">
${robotsMeta(cfg)}
${canonical ? `<link rel="canonical" href="${escAttr(canonical)}">` : ''}
${headMeta(heroCfg, { title, description, canonical })}
<meta name="theme-color" content="${escAttr(cfg.brand?.themeColor ?? '#22252A')}">
${faviconLink(cfg)}
${(cfg.fonts ?? []).map((f) => `<link rel="preload" as="font" type="font/woff2" href="${escAttr(f)}" crossorigin>`).join('\n')}
${heroPreload(heroCfg)}
<style>${styles}</style>
</head>
<body>
<script>document.documentElement.dataset.js="1"</script>
${demoBannerHeadScript(cfg)}
<a class="skip" href="#quote">Skip to the quote form</a>
${demoBanner(cfg)}
${header(cfg, { nav, tel, phone, ctaLabel, ctaLabelShort, homeHref: 'index.html' })}
<main>
${subHero(heroCfg, page, { tel, sms, ctaLabel })}
${page.kind === 'contact' ? contactInfo(cfg, page) : ''}
${introSection(page)}
${benefitsSection(page)}
${page.kind === 'about' ? photoGrid(cfg) : ''}
${brands(cfg)}
${faqSection(cfg, page)}
${quoteSection(cfg, page, { tel, sms, phone })}
${related(page)}
</main>
${footer(cfg, { tel, phone, homePrefix: 'index.html' })}
${stickyBar(cfg, { tel, sms })}
${jsonLd(cfg)}
<script>window.__CFG=${jsonScript(cfg)}</script>
<script defer src="vendor/gsap.min.js"></script>
<script defer src="vendor/ScrollTrigger.min.js"></script>
<script defer>${script}</script>
</body>
</html>
`;
}

function subHero(cfg, page, { tel, sms, ctaLabel }) {
  const phone = cfg.business?.phone ?? {};
  const lines = headlineLines(page.headline);
  return html`
<section class="hero dark" id="hero">
  ${heroMedia(cfg)}
  <div class="wrap">
    <div class="hero-in">
      ${when(page.kicker, (k) => html`<p class="kicker" data-hero>${k}</p>`)}
      <h1>${each(lines, (l) => html`<span class="line"><span>${l}</span></span>`)}</h1>
      <div class="rule" aria-hidden="true"></div>
      ${when(page.sub, (s) => html`<p class="sub" data-hero>${s}</p>`)}
      <div class="cta" data-hero>
        <a class="btn" href="#quote">${ctaLabel}</a>
        ${sms ? html`<a class="btn ghost" data-sms="hero" href="${sms}">${ICON.sms}${cfg.sms?.label ?? 'Text us a photo'}</a>` : ''}
        ${tel ? html`<a class="btn ghost" href="${tel}">${ICON.phone}Call ${phone.display}</a>` : ''}
      </div>
      ${promise(cfg, { className: 'hero-promise' })}
    </div>
  </div>
  <div class="ribs" aria-hidden="true"></div>
</section>`;
}

function introSection(page) {
  if (!present(page.intro)) return '';
  return html`
<section class="sub-intro">
  <div class="wrap">
    <div class="head" data-reveal><p class="lede">${raw(page.intro)}</p></div>
  </div>
</section>`;
}

function benefitsSection(page) {
  const list = page.benefits ?? [];
  if (list.length === 0) return '';
  return html`
<section class="sub-benefits dark">
  <div class="wrap">
    <ul class="benefits" data-reveal="stagger">
      ${each(list, (b) => html`<li>${ICON.tick}<span>${b}</span></li>`)}
    </ul>
  </div>
</section>`;
}

function faqSection(cfg, page) {
  // About and Contact are about the business, not a sales objection to answer
  // — falling back to the whole site FAQ there just repeated the homepage.
  const fallback = page.kind === 'about' || page.kind === 'contact' ? [] : cfg.faq ?? [];
  const list = page.faq ?? fallback;
  if (list.length === 0) return '';
  return html`
<section class="faqs" id="faq">
  <div class="wrap">
    <div class="head" data-reveal><h2>${cfg.copy?.faqTitle ?? 'Good to know'}</h2></div>
    <div class="faq" data-reveal>${each(list, (f) => html`<details><summary>${f.q}</summary><div class="a">${raw(f.a)}</div></details>`)}</div>
  </div>
</section>`;
}

function quoteSection(cfg, page, { tel, sms, phone }) {
  return html`
<section class="quote dark" id="quote">
  <div class="wrap quote-grid">
    <div class="qtext" data-reveal>
      <h2>${cfg.copy?.quoteTitle ?? 'Get a free quote'}</h2>
      ${when(cfg.copy?.quoteIntro, (i) => html`<p>${i}</p>`)}
      ${tel || sms ? html`<p>Prefer to talk?</p>` : ''}
      ${tel ? html`<a class="call" href="${tel}">${ICON.phone}${phone.display}</a>` : ''}
      ${sms ? html`<a class="btn ghost" data-sms="form" href="${sms}">${ICON.sms}${cfg.sms?.label ?? 'Or text us a photo'}</a>` : ''}
      ${promise(cfg)}
    </div>
    ${enquiryForm(cfg, FORM_CLASSES.quote, { defaultService: page.defaultService, defaultSuburb: page.defaultSuburb })}
    ${thanksPanel(cfg)}
  </div>
</section>`;
}

/** About page only: the same gallery photos the homepage uses, reused rather
 *  than re-sourced — see config.json's photos.stockApproved for why they're
 *  samples, not First Point's own work. */
function photoGrid(cfg) {
  const list = cfg.photos?.gallery ?? [];
  if (list.length === 0) return '';
  return html`
<section class="about-photos">
  <div class="wrap">
    <div class="head" data-reveal><h2>The work</h2></div>
    <div class="photo-grid" data-reveal="stagger">
      ${each(list, (p) => html`<figure>
        <img src="${p.src}"${raw(p.width ? ` width="${p.width}"` : '')}${raw(p.height ? ` height="${p.height}"` : '')} loading="lazy" decoding="async" alt="${p.alt ?? ''}">${sampleTag(p)}
        ${when(p.caption, (c) => html`<figcaption>${p.sample ? 'Sample photo · ' : ''}${c}</figcaption>`)}
      </figure>`)}
    </div>
  </div>
</section>`;
}

/** Contact page only: phone/email/address/hours plus a map — a plain Google
 *  Maps embed built from business.address, no API key required. */
function contactInfo(cfg, page) {
  const b = cfg.business ?? {};
  const tel = telHref(b.phone ?? {});
  const rows = [
    b.phone?.display && ['Phone', html`<a href="${tel}">${b.phone.display}</a>`],
    b.email && ['Email', html`<a href="mailto:${b.email}">${b.email}</a>`],
    b.address && ['Address', html`${b.address}`],
    (cfg.hours ?? []).length && ['Hours', html`${each(cfg.hours, (h, i) => html`${raw(i ? '<br>' : '')}${h}`)}`],
    b.abn && ['ABN', html`${b.abn}`],
  ].filter(Boolean);
  if (rows.length === 0 && !b.address) return '';
  return html`
<section class="contact-info dark">
  <div class="wrap contact-grid">
    <ul class="c-list" data-reveal>
      ${each(rows, ([label, value]) => html`<li><b>${label}</b>${value}</li>`)}
    </ul>
    ${when(b.address, (addr) => html`<div class="map-embed" data-reveal>
      <iframe src="https://www.google.com/maps?q=${encodeURIComponent(addr)}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map showing ${b.name ?? 'our location'}"></iframe>
    </div>`)}
  </div>
</section>`;
}

function related(page) {
  const list = page.related ?? [];
  if (list.length === 0) return '';
  return html`
<section class="sub-related">
  <div class="wrap">
    <div class="head" data-reveal><h2>${page.relatedTitle ?? 'More ways we can help'}</h2></div>
    <ul class="related-links" data-reveal="stagger">
      ${each(list, (r) => html`<li><a href="${r.href}">${r.label}${ICON.arrow}</a></li>`)}
    </ul>
  </div>
</section>`;
}
