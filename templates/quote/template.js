/**
 * quote template — for mid-size jobs bought on price and speed.
 * Fencing, roofing, concreting, air conditioning, solar, decks, glazing.
 *
 * The design is the Canberra to Coast Fencing page, unchanged. This file only
 * takes the content out of it. If a section has no data in config it emits
 * nothing at all — no empty heading, no stray "0", no button that goes nowhere.
 */
import { html, raw, when, each, present, telHref, smsHref, headlineLines, sentenceList } from '../../lib/render.js';
import { statsBar } from '../../lib/blocks/stats-bar.js';
import { promise } from '../../lib/blocks/promise.js';
import { heroMedia } from '../../lib/blocks/hero-media.js';
import { beforeAfter } from '../../lib/blocks/before-after.js';
import { reviews } from '../../lib/blocks/reviews.js';
import { enquiryForm, thanksPanel } from '../../lib/blocks/form.js';
import { calculator } from '../../lib/blocks/calculator.js';
import { demoBanner, demoFooterNote, robotsMeta } from '../../lib/blocks/demo.js';
import { headMeta, jsonLd } from '../../lib/blocks/schema.js';

const ICON = {
  phone: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>'),
  sms: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/></svg>'),
  arrow: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'),
  tick: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>'),
  check: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>'),
  chev: raw('<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'),
};

export function render(cfg, { styles, script }) {
  const b = cfg.business ?? {};
  const phone = b.phone ?? {};
  const tel = telHref(phone);
  const sms = smsHref(phone);
  const copy = cfg.copy ?? {};
  const title = copy.title ?? `${b.name} | ${cfg.tagline ?? ''}`.trim();
  const description = copy.description ?? cfg.tagline ?? '';

  // Only offer a nav link to a section that is actually on the page.
  const nav = [
    cfg.has.services && ['#services', 'Services'],
    cfg.has.calculator && ['#pricing', 'Pricing'],
    cfg.has.gallery && ['#projects', 'Our work'],
    cfg.has.reviews && ['#reviews', 'Reviews'],
    cfg.has.serviceAreas && ['#areas', 'Areas'],
    cfg.has.faq && ['#faq', 'FAQ'],
  ].filter(Boolean);

  const ctaLabel = copy.ctaLabel ?? 'Get a free quote';

  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escText(title)}</title>
<meta name="description" content="${escAttr(description)}">
${robotsMeta(cfg)}
${cfg.siteUrl ? `<link rel="canonical" href="${escAttr(cfg.siteUrl)}">` : ''}
${headMeta(cfg, { title, description, canonical: cfg.siteUrl })}
<meta name="theme-color" content="${escAttr(cfg.brand?.themeColor ?? '#22252A')}">
${cfg.icons?.favicon ? `<link rel="icon" href="${escAttr(cfg.icons.favicon)}">` : ''}
${cfg.icons?.apple ? `<link rel="apple-touch-icon" href="${escAttr(cfg.icons.apple)}">` : ''}
${(cfg.fonts ?? []).map((f) => `<link rel="preload" as="font" type="font/woff2" href="${escAttr(f)}" crossorigin>`).join('\n')}
${heroPreload(cfg)}
<style>${styles}</style>
</head>
<body>
<!-- Set before first paint. Anything that may only be hidden while JS can put
     it back is scoped to html[data-js], so a no-JS visitor never loses content. -->
<script>document.documentElement.dataset.js="1"</script>
<a class="skip" href="#quote">Skip to the quote form</a>
${demoBanner(cfg)}
${header(cfg, { nav, tel, phone, ctaLabel })}
<main>
${hero(cfg, { tel, sms, ctaLabel, copy })}
${statsBar(cfg, 'trust dark')}
${services(cfg)}
${calculator(cfg)}
${gallery(cfg)}
${colours(cfg)}
${beforeAfter(cfg, { title: copy.beforeAfterTitle ?? 'Before and after', intro: copy.beforeAfterIntro })}
${included(cfg)}
${reasons(cfg)}
${reviews(cfg, { title: copy.reviewsTitle ?? 'What customers say', intro: copy.reviewsIntro, className: 'dark' })}
${process(cfg)}
${areas(cfg)}
${faq(cfg)}
${quoteSection(cfg, { tel, sms, phone, copy })}
${finalCta(cfg, { tel, sms, ctaLabel, copy })}
</main>
${footer(cfg, { tel, phone })}
${stickyBar(cfg, { tel, sms })}
${lightbox(cfg)}
${jsonLd(cfg)}
<script>window.__CFG=${jsonScript(cfg)}</script>
<script defer src="vendor/gsap.min.js"></script>
<script defer src="vendor/ScrollTrigger.min.js"></script>
<script defer>${script}</script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ sections */

function header(cfg, { nav, tel, phone, ctaLabel }) {
  const b = cfg.business ?? {};
  return html`
<header class="top" id="topbar">
  <div class="wrap nav">
    <a class="brand" href="#hero" aria-label="${b.name}, back to top">${
      when(b.logoMark, (m) => html`<img src="${m.src}" width="${m.width ?? 240}" height="${m.height ?? 87}" alt="">`)
    }<b>${raw(headlineLines(cfg.copy?.brandMark ?? b.name).join('<br>'))}</b></a>
    ${nav.length ? html`<nav class="menu" aria-label="Sections">${
      each(nav, ([href, label]) => html`<a href="${href}">${label}</a>`)
    }</nav>` : ''}
    ${tel ? html`<a class="phone" href="${tel}">${ICON.phone}${phone.display}</a>` : ''}
    <a class="btn small" href="#quote"><span class="long">${ctaLabel}</span><span class="short">Free quote</span></a>
  </div>
</header>`;
}

function hero(cfg, { tel, sms, ctaLabel, copy }) {
  const phone = cfg.business?.phone ?? {};
  const lines = headlineLines(copy.headline ?? cfg.business?.name);
  return html`
<section class="hero dark" id="hero">
  ${heroMedia(cfg)}
  <div class="wrap">
    <div class="hero-in">
      ${when(copy.kicker, (k) => html`<p class="kicker" data-hero>${k}</p>`)}
      <h1>${each(lines, (l) => html`<span class="line"><span>${l}</span></span>`)}</h1>
      <div class="rule" aria-hidden="true"></div>
      ${when(copy.sub, (s) => html`<p class="sub" data-hero>${s}</p>`)}
      ${when(copy.anchor, (a) => html`<p class="anchor" data-hero>${raw(a)}</p>`)}
      <div class="cta" data-hero>
        <a class="btn" href="#quote">${ctaLabel}</a>
        ${sms ? html`<a class="btn ghost" data-sms="hero" href="${sms}">${ICON.sms}${cfg.sms?.label ?? 'Text us a photo'}</a>` : ''}
        ${tel ? html`<a class="btn ghost" href="${tel}">${ICON.phone}Call ${phone.display}</a>` : ''}
      </div>
      ${promise(cfg, 'hero-promise')}
    </div>
  </div>
  <div class="ribs" aria-hidden="true"></div>
</section>`;
}

function services(cfg) {
  if (!cfg.has.services) return '';
  const copy = cfg.copy ?? {};
  return html`
<section class="services" id="services">
  <div class="wrap">
    <div class="head" data-reveal>
      <h2>${copy.servicesTitle ?? 'What we do'}</h2>
      ${when(copy.servicesIntro, (i) => html`<p class="lede">${i}</p>`)}
    </div>
    <div class="tiles" data-reveal="stagger">
      ${each(cfg.services, (s) => html`<a class="tile" href="${s.href ?? (cfg.has.calculator ? '#pricing' : '#quote')}">
        ${when(s.photo, (p) => html`<img src="${p.src}"${raw(p.width ? ` width="${p.width}"` : '')}${raw(p.height ? ` height="${p.height}"` : '')} loading="lazy" decoding="async" alt="${p.alt ?? ''}">`)}
        <span class="arrow" aria-hidden="true">${ICON.arrow}</span>
        <div class="cap">
          <h3>${s.title}</h3>
          ${when(s.blurb, (t) => html`<p>${t}</p>`)}
          ${when(s.from?.label, (f) => html`<span class="from">${f}</span>`)}
        </div>
      </a>`)}
    </div>
    ${when(copy.servicesAlso, (t) => html`<p class="also">${raw(t)}</p>`)}
  </div>
</section>`;
}

function gallery(cfg) {
  if (!cfg.has.gallery) return '';
  const copy = cfg.copy ?? {};
  return html`
<section class="projects dark" id="projects">
  <div class="wrap"><div class="head" data-reveal>
    <h2>${copy.galleryTitle ?? 'Recent jobs'}</h2>
    ${when(copy.galleryIntro, (i) => html`<p class="lede">${i}</p>`)}
  </div></div>
  <div class="gallery" data-reveal="stagger">
    ${each(cfg.photos.gallery, (p) => html`<figure>
      <button type="button" data-src="${p.full ?? p.src}" data-cap="${p.caption ?? p.alt ?? ''}">
        <img src="${p.src}"${raw(p.width ? ` width="${p.width}"` : '')}${raw(p.height ? ` height="${p.height}"` : '')} loading="lazy" decoding="async" alt="${p.alt ?? ''}">
      </button>
      ${when(p.caption, (c) => html`<figcaption>${c}</figcaption>`)}
    </figure>`)}
  </div>
  <p class="swipe">Swipe for more</p>
</section>`;
}

/** Colour picker. Only trades that sell a colour range have one. */
function colours(cfg) {
  const list = cfg.colours ?? [];
  if (list.length === 0) return '';
  const copy = cfg.copy ?? {};
  const first = list[0];
  return html`
<section class="colours" id="colours">
  <div class="wrap">
    <div class="head" data-reveal>
      <h2>${copy.coloursTitle ?? 'Pick your colour'}</h2>
      ${when(copy.coloursIntro, (i) => html`<p class="lede">${i}</p>`)}
    </div>
    <div class="colour-grid" data-reveal>
      <div class="swatch-wrap">
        <div class="swatch-photo">
          <img id="swatchA" src="${first.small ?? first.src}"${
            raw(first.small ? ` srcset="${first.small} 700w, ${first.src} 1100w" sizes="(min-width:900px) 560px, 92vw"` : '')
          } width="${first.width ?? 1100}" height="${first.height ?? 825}" alt="${(cfg.colourAltPrefix ?? 'Shown in ') + first.name}" decoding="async">
          <img id="swatchB" alt="" aria-hidden="true" decoding="async">
        </div>
        <div class="swatch-name"><b id="swatchName">${first.name}</b><span id="swatchHint">${first.hint ?? ''}</span></div>
      </div>
      <div>
        <div class="swatches" id="swatches" role="group" aria-label="${copy.coloursTitle ?? 'Colours'}"></div>
        ${when(copy.coloursNote, (n) => html`<p class="colour-note">${n}</p>`)}
      </div>
    </div>
  </div>
</section>`;
}

/** "What's in every job we do" — the parts explainer with its line drawing. */
function included(cfg) {
  const parts = cfg.included?.parts ?? [];
  const list = cfg.included?.list ?? [];
  if (parts.length === 0 && list.length === 0) return '';
  const copy = cfg.copy ?? {};
  return html`
<section class="anatomy dark" id="anatomy">
  <div class="wrap">
    <div class="head" data-reveal>
      <h2>${cfg.included?.title ?? "What's in every job"}</h2>
      ${when(cfg.included?.intro, (i) => html`<p class="lede">${i}</p>`)}
    </div>
    <div class="anat" data-reveal>
      ${when(cfg.included?.drawing, (svg) => html`<div class="swatch-wrap">${raw(svg)}</div>`)}
      <div>
        ${parts.length ? html`<ul class="parts" id="parts">
          ${each(parts, (p, i) => html`<li${raw(i === 0 ? ' class="open"' : '')} data-part="${p.id}">
            <button type="button" aria-expanded="${i === 0 ? 'true' : 'false'}"><span class="num">${i + 1}</span>${p.title}${ICON.chev}</button>
            <div class="body">${p.body}</div>
          </li>`)}
        </ul>` : ''}
        ${list.length ? html`<div class="incl">
          <h3>${cfg.included?.listTitle ?? 'Included in every quote'}</h3>
          <ul>${each(list, (x) => html`<li>${ICON.tick}${x}</li>`)}</ul>
        </div>` : ''}
      </div>
    </div>
  </div>
</section>`;
}

function reasons(cfg) {
  if (!present(cfg.reasons)) return '';
  const copy = cfg.copy ?? {};
  return html`
<section class="why" id="why">
  <div class="wrap split">
    <div class="split-head head" data-reveal>
      <h2>${copy.reasonsTitle ?? `Why people pick ${cfg.business?.ownerFirstName ?? 'us'}`}</h2>
      ${when(copy.reasonsIntro, (i) => html`<p class="lede">${i}</p>`)}
    </div>
    <ul class="reasons" data-reveal="stagger">
      ${each(cfg.reasons, (r) => html`<li>${ICON.check}<div><h3>${r.title}</h3><p>${r.body}</p></div></li>`)}
    </ul>
  </div>
</section>`;
}

function process(cfg) {
  if (!cfg.has.process) return '';
  const copy = cfg.copy ?? {};
  return html`
<section class="how" id="how">
  <div class="wrap">
    <div class="head" data-reveal>
      <h2>${copy.processTitle ?? 'How it works'}</h2>
      ${when(copy.processIntro, (i) => html`<p class="lede">${i}</p>`)}
    </div>
    <ol class="steps" data-reveal="stagger">
      <div class="trackbg" aria-hidden="true"></div><div class="track" aria-hidden="true"></div>
      ${each(cfg.process, (s, i) => html`<li><span class="n" aria-hidden="true">${i + 1}</span><h3>${s.step}</h3><p>${s.detail}</p></li>`)}
    </ol>
  </div>
</section>`;
}

function areas(cfg) {
  if (!cfg.has.serviceAreas) return '';
  const copy = cfg.copy ?? {};
  const groups = cfg.serviceAreas;
  const flat = groups.flatMap((g) => g.suburbs ?? []);
  const half = Math.ceil(flat.length / 2);
  const rows = [flat.slice(0, half), flat.slice(half)].filter((r) => r.length);
  return html`
<section class="areas dark" id="areas">
  <div class="wrap"><div class="head" data-reveal>
    <h2>${copy.areasTitle ?? 'Where we work'}</h2>
    ${when(copy.areasIntro, (i) => html`<p class="lede">${i}</p>`)}
  </div></div>
  ${rows.length ? html`<div class="ticker" aria-hidden="true">
    ${each(rows, (row, i) => html`<div class="row${raw(i === 1 ? ' rev' : '')}">${
      // Printed twice so the loop lands on an identical frame.
      each([...row, ...row], (s) => html`<span>${s}</span>`)
    }</div>`)}
  </div>` : ''}
  <div class="wrap">
    <div class="areagrid" data-reveal="stagger">
      ${each(groups, (g) => html`<div><h3>${g.region}</h3><p>${sentenceList(g.suburbs)}</p></div>`)}
    </div>
    ${when(copy.areasNote, (n) => html`<p class="note">${n}</p>`)}
  </div>
</section>`;
}

function faq(cfg) {
  if (!cfg.has.faq) return '';
  const copy = cfg.copy ?? {};
  return html`
<section class="faqs" id="faq">
  <div class="wrap">
    <div class="head" data-reveal>
      <h2>${copy.faqTitle ?? 'Good to know'}</h2>
      ${when(copy.faqIntro, (i) => html`<p class="lede">${i}</p>`)}
    </div>
    <div class="faq" data-reveal>
      ${each(cfg.faq, (f) => html`<details><summary>${f.q}</summary><div class="a">${raw(f.a)}</div></details>`)}
    </div>
  </div>
</section>`;
}

function quoteSection(cfg, { tel, sms, phone, copy }) {
  const b = cfg.business ?? {};
  return html`
<section class="quote dark" id="quote">
  ${when(cfg.photos?.quoteBackground, (p) => html`<img class="bgimg" src="${p.src}"${
    raw(p.width ? ` width="${p.width}"` : '')}${raw(p.height ? ` height="${p.height}"` : '')} loading="lazy" decoding="async" alt="">`)}
  <div class="wrap quote-grid">
    <div class="qtext" data-reveal>
      <h2>${copy.quoteTitle ?? 'Get a free quote'}</h2>
      ${when(copy.quoteIntro, (i) => html`<p>${i}</p>`)}
      ${when(cfg.quoteSteps, (steps) => html`<ol>${each(steps, (s) => html`<li>${raw(s)}</li>`)}</ol>`)}
      ${tel || sms ? html`<p>Prefer to talk?</p>` : ''}
      ${tel ? html`<a class="call" href="${tel}">${ICON.phone}${phone.display}</a>` : ''}
      ${sms ? html`<a class="btn ghost" data-sms="form" href="${sms}">${ICON.sms}${cfg.sms?.label ?? 'Or text us a photo'}</a>` : ''}
      ${promise(cfg)}
    </div>
    ${enquiryForm(cfg)}
    ${thanksPanel(cfg)}
  </div>
</section>`;
}

function finalCta(cfg, { tel, sms, ctaLabel, copy }) {
  const phone = cfg.business?.phone ?? {};
  return html`
<section class="final dark" id="ready">
  <div class="wrap" data-reveal>
    <h2>${copy.finalTitle ?? 'Ready when you are.'}</h2>
    ${when(copy.finalIntro, (i) => html`<p>${i}</p>`)}
    <div class="cta">
      <a class="btn" href="#quote">${ctaLabel}</a>
      ${tel ? html`<a class="btn ghost" href="${tel}">${ICON.phone}Call ${phone.display}</a>` : ''}
      ${sms ? html`<a class="btn ghost" data-sms="ready" href="${sms}">${ICON.sms}${cfg.sms?.label ?? 'Text us a photo'}</a>` : ''}
    </div>
    ${promise(cfg)}
  </div>
</section>`;
}

function footer(cfg, { tel, phone }) {
  const b = cfg.business ?? {};
  const links = [
    cfg.has.services && ['#services', 'Services'],
    cfg.has.calculator && ['#pricing', 'Price guide'],
    (cfg.colours ?? []).length && ['#colours', 'Colours'],
    cfg.has.reviews && ['#reviews', 'Reviews'],
    cfg.has.faq && ['#faq', 'Good to know'],
  ].filter(Boolean);

  return html`
<footer class="site dark">
  <div class="wrap">
    <div class="fgrid">
      ${when(b.logo, (l) => html`<div><div class="logo-tile"><img src="${l.src}" width="${l.width ?? 720}" height="${l.height ?? 235}" alt="${b.name}" loading="lazy" decoding="async"></div></div>`)}
      ${tel || b.email ? html`<div><h3>Call or email</h3><p>
        ${tel ? html`<a href="${tel}">${phone.display}</a>` : ''}
        ${tel && b.email ? raw('<br>') : ''}
        ${when(b.email, (e) => html`<a href="mailto:${e}">${e}</a>`)}
      </p></div>` : ''}
      ${links.length ? html`<div><h3>On this page</h3><p>${
        each(links, ([href, label], i) => html`${raw(i ? '<br>' : '')}<a href="${href}">${label}</a>`)
      }</p></div>` : ''}
      <div><h3>Business</h3><p>${b.name}${
        when(b.abn, (a) => html`${raw('<br>')}ABN ${a}`)
      }${when(cfg.copy?.footerArea, (t) => html`${raw('<br>')}${t}`)}</p></div>
    </div>
    ${demoFooterNote(cfg)}
    <div class="fine">
      <span>© ${cfg.year ?? new Date().getFullYear()} ${b.name}</span>
      ${when(cfg.copy?.trademarkNote, (t) => html`<span>${t}</span>`)}
      <span>Site by Frontline Systems</span>
    </div>
  </div>
</footer>`;
}

function stickyBar(cfg, { tel, sms }) {
  if (!tel && !sms) return '';
  return html`
<div class="stickybar" id="sticky">
  ${tel ? html`<a class="btn" href="${tel}">${ICON.phone}Call</a>` : ''}
  ${sms ? html`<a class="btn ghost" data-sms="bar" href="${sms}">${ICON.sms}Text</a>` : ''}
  <a class="btn ghost" href="#quote">Quote</a>
</div>`;
}

function lightbox(cfg) {
  if (!cfg.has.gallery) return '';
  return raw(`
<dialog class="lb" id="lb" aria-label="Photo">
  <figure><img id="lbImg" alt=""><figcaption id="lbCap"></figcaption></figure>
  <button type="button" class="prev" id="lbPrev" aria-label="Previous photo">&lsaquo;</button>
  <button type="button" class="next" id="lbNext" aria-label="Next photo">&rsaquo;</button>
  <button type="button" class="close" id="lbClose" aria-label="Close">&times;</button>
</dialog>`);
}

/* -------------------------------------------------------------------- pieces */

/**
 * Preload the hero at high priority, and make the preload agree exactly with
 * the <img>. A preload that disagrees fetches the picture twice — that bug cost
 * the Bondi demo 194KB and nine Lighthouse points.
 */
function heroPreload(cfg) {
  const hero = cfg.photos?.hero;
  if (!present(hero?.src)) return '';
  if (hero.srcset) {
    return `<link rel="preload" as="image" href="${escAttr(hero.src)}" imagesrcset="${escAttr(hero.srcset)}" imagesizes="100vw" fetchpriority="high">`;
  }
  return `<link rel="preload" as="image" href="${escAttr(hero.src)}" fetchpriority="high">`;
}

/** The slice of config the runtime needs, as a safe inline JSON literal. */
function jsonScript(cfg) {
  const data = cfg.__runtime ?? {};
  // A literal </script> inside a string would end the block early, and
  // U+2028/U+2029 are line terminators to a JS parser but legal inside JSON.
  return JSON.stringify(data).replace(/[<\u2028\u2029]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

const escText = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
