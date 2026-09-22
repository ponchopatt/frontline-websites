/**
 * trust template — for big jobs bought on whether they believe you.
 * Pools, builders, extensions, granny flats, landscaping, kitchens, bathrooms.
 *
 * The design is the Bondi Landscapes page, unchanged. This file only takes the
 * content out of it. A section with no data in config emits nothing at all.
 */
import { html, raw, when, each, present, telHref, smsHref, headlineLines, sentenceList } from '../../lib/render.js';
import { statsBar } from '../../lib/blocks/stats-bar.js';
import { promise } from '../../lib/blocks/promise.js';
import { heroMedia } from '../../lib/blocks/hero-media.js';
import { beforeAfter } from '../../lib/blocks/before-after.js';
import { reviews } from '../../lib/blocks/reviews.js';
import { enquiryForm, thanksPanel, FORM_CLASSES } from '../../lib/blocks/form.js';
import { demoBanner, demoFooterNote, robotsMeta } from '../../lib/blocks/demo.js';
import { headMeta, jsonLd } from '../../lib/blocks/schema.js';

const ICON = {
  phone: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>'),
  mail: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>'),
  sms: raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/></svg>'),
};

export function render(cfg, { styles, script }) {
  const b = cfg.business ?? {};
  const phone = b.phone ?? {};
  const tel = telHref(phone);
  const sms = smsHref(phone);
  const copy = cfg.copy ?? {};
  const title = copy.title ?? `${b.name} | ${cfg.tagline ?? ''}`.trim();
  const description = copy.description ?? cfg.tagline ?? '';

  const nav = [
    present(copy.statementHeadline) && ['#approach', copy.navApproach ?? 'Approach'],
    cfg.has.services && ['#services', 'Services'],
    cfg.has.gallery && ['#work', 'Work'],
    cfg.has.process && ['#process', 'Process'],
    present(cfg.owner?.body) && ['#owner', b.ownerFirstName || 'About'],
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escText(title)}</title>
<meta name="description" content="${escAttr(description)}">
${robotsMeta(cfg)}
<meta name="theme-color" content="${escAttr(b.brand?.themeColor ?? '#0A1418')}">
<!-- Set before first paint. Anything that may only be hidden while JS can put
     it back is scoped to html[data-js], so a no-JS visitor never loses content. -->
<script>document.documentElement.dataset.js="1"</script>
${cfg.siteUrl ? `<link rel="canonical" href="${escAttr(cfg.siteUrl)}">` : ''}
${headMeta(cfg, { title, description, canonical: cfg.siteUrl })}
${cfg.icons?.favicon ? `<link rel="icon" href="${escAttr(cfg.icons.favicon)}"${/\.svg$/i.test(cfg.icons.favicon) ? ' type="image/svg+xml"' : ''}>` : ''}
${cfg.icons?.apple ? `<link rel="apple-touch-icon" href="${escAttr(cfg.icons.apple)}">` : ''}
${(cfg.fonts ?? []).map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${escAttr(f)}">`).join('\n')}
${heroPreload(cfg)}
<style>${styles}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${demoBanner(cfg)}
${header(cfg, { nav, tel, phone, copy })}
<main id="main">
${hero(cfg, { tel, sms, copy })}
${credentialStrip(cfg)}
${statsBar(cfg, 'fl-stats-trust')}
${statement(cfg, copy)}
${services(cfg, copy)}
${aperture(cfg, copy)}
${work(cfg, copy)}
${beforeAfter(cfg, { title: copy.beforeAfterTitle, intro: copy.beforeAfterIntro })}
${process(cfg, copy)}
${owner(cfg, copy)}
${reviews(cfg, { title: copy.reviewsTitle ?? 'What clients say.', intro: copy.reviewsIntro })}
${recognition(cfg, copy)}
${areas(cfg, copy)}
${faq(cfg, copy)}
${enquire(cfg, { tel, sms, phone, copy })}
</main>
${footer(cfg, { tel, phone, nav })}
${stickyBar(cfg, { tel, sms, phone })}
${callDock(cfg, { tel, phone })}
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

function header(cfg, { nav, tel, phone, copy }) {
  const b = cfg.business ?? {};
  return html`
<header class="top" id="topbar">
  <div class="wrap topin">
    <a class="brand" href="#hero" aria-label="${b.name}, home">
      ${when(b.logo, (l) => html`<img src="${l.src}" width="${l.width ?? 687}" height="${l.height ?? 255}" alt="${b.name}">`)}
    </a>
    ${nav.length ? html`<nav class="nav" aria-label="Main">${
      each(nav, ([href, label]) => html`<a href="${href}">${label}</a>`)
    }</nav>` : ''}
    ${tel ? html`<a class="tel" href="${tel}">${ICON.phone}${phone.display}</a>` : ''}
    <a class="btn" href="#enquire">${copy.ctaLabel ?? 'Start a conversation'}</a>
  </div>
</header>`;
}

function hero(cfg, { tel, sms, copy }) {
  const phone = cfg.business?.phone ?? {};
  const lines = headlineLines(copy.headline ?? cfg.business?.name);
  return html`
<section class="hero" id="hero">
  <div class="bgwrap">
    ${heroMedia(cfg)}
    <div class="veil"></div>
  </div>
  <div class="wrap">
    <div class="hero-in">
      ${when(copy.kicker, (k) => html`<p class="t-label hero-kicker" data-hero>${k}</p>`)}
      <h1 class="t-mega" data-lines>${raw(lines.join('<br>'))}</h1>
      ${when(copy.sub, (s) => html`<p class="sub hero-sub" data-hero>${raw(s)}</p>`)}
      <div class="ctas hero-cta" data-hero>
        ${tel ? html`<a class="btn" href="${tel}">${ICON.phone}${phone.display}</a>` : ''}
        <a class="link only-wide" href="#enquire">${copy.heroSecondary ?? 'Or send the details'}</a>
        ${sms ? html`<a class="link only-narrow" data-sms href="${sms}">${copy.heroSecondarySms ?? 'Or text us a photo'}</a>` : ''}
      </div>
      ${promise(cfg, 'hero-promise')}
    </div>
  </div>
</section>`;
}

/**
 * The credential strip is a short row of claims, not the whole list — the
 * recognition section further down carries the detail. A credential goes in the
 * strip when it says so, and by default when it is a bare claim with no
 * explanation behind it (a licence, a membership). Anything still waiting on a
 * year stays out of both.
 */
function credentialStrip(cfg) {
  const items = (cfg.credentials ?? [])
    .filter((c) => present(c?.label))
    .filter((c) => !(c.yearKey && !c.year))
    .filter((c) => (c.strip === undefined ? !present(c.body) : c.strip === true))
    .map((c) => (c.year ? `${c.label} ${c.year}` : c.label));
  if (items.length === 0) return '';
  return html`
<div class="strip">
  <div class="wrap">
    <ul class="creds">${each(items, (t) => html`<li>${t}</li>`)}</ul>
  </div>
</div>`;
}

function statement(cfg, copy) {
  if (!present(copy.statementHeadline)) return '';
  const pull = cfg.pullQuote;
  return html`
<section class="statement" id="approach">
  <div class="wrap above">
    <div data-reveal>
      ${when(copy.statementLabel, (l) => html`<p class="t-label">${l}</p>`)}
      <h2 class="t-d1" data-lines>${raw(headlineLines(copy.statementHeadline).join('<br>'))}</h2>
      ${when(copy.statementBody, (t) => html`<p class="t-lede" style="margin-top:var(--s32);max-width:34em">${t}</p>`)}
      ${when(pull?.text, () => html`<blockquote class="pull">
        <p>&ldquo;${pull.text}&rdquo;</p>
        ${when(pull.name, (n) => html`<p class="t-label mute" style="margin:var(--s20) 0 0">${n}</p>`)}
      </blockquote>`)}
    </div>
    ${when(cfg.photos?.statement, (p) => figure(p, '4/5', '(min-width:960px) 44vw, 92vw'))}
  </div>
</section>`;
}

function services(cfg, copy) {
  if (!cfg.has.services) return '';
  return html`
<section id="services">
  <div class="wrap">
    ${head(copy.servicesLabel, copy.servicesHeadline ?? 'What we do', copy.servicesIntro)}
    <div class="svc-grid" data-reveal="stagger">
      ${each(cfg.services, (s, i) => html`<article class="svc">
        ${when(s.photo, (p) => html`<div class="ph"><img src="${p.src}"${
          raw(p.srcset ? ` srcset="${p.srcset}" sizes="(min-width:820px) 31vw, 92vw"` : '')
        }${raw(p.width ? ` width="${p.width}"` : '')}${raw(p.height ? ` height="${p.height}"` : '')} loading="lazy" decoding="async" alt="${p.alt ?? ''}"></div>`)}
        <div class="cap">
          <span class="t-folio">${String(i + 1).padStart(2, '0')}</span>
          <h3 class="t-h3">${s.title}</h3>
          ${when(s.blurb, (t) => html`<p>${t}</p>`)}
        </div>
      </article>`)}
    </div>
  </div>
</section>`;
}

/** The signature full-bleed moment. Optional: it needs a photo worth it. */
function aperture(cfg, copy) {
  const p = cfg.photos?.aperture;
  if (!present(p?.src)) return '';
  return html`
<section class="ap bleed" id="aperture" aria-labelledby="apHead">
  <img src="${p.src}"${raw(p.srcset ? ` srcset="${p.srcset}" sizes="100vw"` : '')}${
    raw(p.width ? ` width="${p.width}"` : '')}${raw(p.height ? ` height="${p.height}"` : '')
  } decoding="async" alt="${p.alt ?? ''}">
  <div class="frame" aria-hidden="true"></div>
  <p class="t-label apLabel" id="apHead">${copy.apertureLabel ?? ''}</p>
  ${present(p.caption) || present(copy.apertureLine) ? html`<div class="plate">
    ${when(p.caption, (c) => html`<p class="t-label mute" style="margin:0">${c}</p>`)}
    ${when(copy.apertureLine, (l) => html`<p>${l}</p>`)}
  </div>` : ''}
</section>`;
}

function work(cfg, copy) {
  if (!cfg.has.gallery) return '';
  const items = cfg.photos.gallery;
  const intro = copy.workIntro ?? `${countWord(items.length)} recent ${items.length === 1 ? 'job' : 'jobs'}.`;
  return html`
<section id="work">
  <div class="wrap">
    ${head(copy.workLabel ?? 'Selected work', copy.workHeadline ?? 'Recent work.', intro)}
    <div class="plates" data-reveal="stagger">
      ${each(items, (p) => html`<figure class="plate-item">
        <button data-src="${p.full ?? p.src}" data-cap="${p.caption ?? p.alt ?? ''}" aria-label="View ${p.caption ?? 'this project'} larger">
          <span class="shot"><img src="${p.src}"${
            raw(p.srcset ? ` srcset="${p.srcset}" sizes="(min-width:900px) 46vw, 92vw"` : '')
          }${raw(p.width ? ` width="${p.width}"` : '')}${raw(p.height ? ` height="${p.height}"` : '')} loading="lazy" decoding="async" alt="${p.alt ?? ''}"></span>
        </button>
        ${present(p.caption) || present(p.detail) ? html`<figcaption>
          ${when(p.caption, (c) => html`<span class="nm">${c}</span>`)}
          ${when(p.detail, (d) => html`<span class="t-cap">${d}</span>`)}
        </figcaption>` : ''}
      </figure>`)}
    </div>
  </div>
</section>`;
}

/**
 * The count in the intro has to match the number of cards. Writing the number
 * by hand is how "eight named jobs" ended up above six of them.
 */
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const countWord = (n) => WORDS[n] ?? String(n);

function process(cfg, copy) {
  if (!cfg.has.process) return '';
  return html`
<section id="process">
  <div class="wrap above">
    ${head(copy.processLabel ?? 'How it runs', copy.processHeadline ?? `${countWord(cfg.process.length)} steps,<br>no surprises.`, copy.processIntro)}
    <div class="railwrap" aria-hidden="true"><div class="rail" data-draw></div></div>
    <div class="steps" data-reveal="stagger">
      ${each(cfg.process, (s, i) => html`<div class="step">
        <span class="t-folio">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="t-h3">${s.step}</h3>
        <p>${s.detail}</p>
        ${when(s.priceLine, (line) => html`<p class="anchor" style="margin-top:var(--s12)" data-priceline="${s.priceKey ?? 'fee'}" hidden>${
          raw(String(line).replace('{price}', '<b data-price-value></b>'))
        }</p>`)}
      </div>`)}
    </div>
  </div>
</section>`;
}

/** Who they are dealing with. The single strongest thing on a trust page. */
function owner(cfg, copy) {
  const o = cfg.owner ?? {};
  if (!present(o.body)) return '';
  const b = cfg.business ?? {};
  return html`
<section class="about" id="owner" style="background:var(--bg-card)">
  <div class="wrap">
    ${when(cfg.photos?.owner, (p) => figure(p, p.ratio ?? '1080/648', '(min-width:960px) 40vw, 92vw', p.caption))}
    <div data-reveal>
      ${when(copy.ownerLabel, (l) => html`<p class="t-label">${l}</p>`)}
      <h2 class="t-d1" data-lines>${b.ownerName ?? b.ownerFirstName}.</h2>
      <p class="t-lede" style="margin-top:var(--s32);max-width:36em">${raw(o.body)}</p>
      ${when(o.team, (t) => html`<p style="margin-top:var(--s24);color:var(--fg-mute);max-width:38em">${raw(t)}</p>`)}
      ${when(o.facts, (facts) => html`<div class="facts">${
        each(facts, (f) => html`<div><span class="n">${f.value}</span><span class="l">${f.label}</span></div>`)
      }</div>`)}
    </div>
  </div>
</section>`;
}

function recognition(cfg, copy) {
  const items = (cfg.credentials ?? []).filter((c) => present(c?.label) && present(c?.body));
  if (items.length === 0) return '';
  return html`
<section>
  <div class="wrap">
    ${head(copy.recognitionLabel ?? 'Recognition', copy.recognitionHeadline ?? 'Awarded, and accountable<br>to a body.', copy.recognitionIntro)}
    <div class="rec" data-reveal="stagger">
      ${each(items, (c) => {
        // A credential whose year we have not confirmed stays out entirely: the
        // claim does not stand on its own, and a year is never invented.
        const needsYear = c.yearKey && !c.year;
        return html`<div${raw(needsYear ? ` data-credential-year="${c.yearKey}" hidden` : '')}>
        <h3 class="t-h4">${c.label}${c.year ? `, ${c.year}` : ''}${needsYear ? raw(' <span data-year-value></span>') : ''}</h3>
        <p>${c.body}</p>
      </div>`;
      })}
    </div>
  </div>
</section>`;
}

function areas(cfg, copy) {
  if (!cfg.has.serviceAreas) return '';
  const suburbs = cfg.serviceAreas.flatMap((g) => g.suburbs ?? []);
  if (!suburbs.length) return '';
  return html`
<section>
  <div class="wrap">
    ${head(copy.areasLabel ?? 'Where we work', copy.areasHeadline ?? 'Where we work.', copy.areasIntro)}
    <ul class="areas" data-reveal>${each(suburbs, (s) => html`<li>${s}</li>`)}</ul>
  </div>
</section>`;
}

function faq(cfg, copy) {
  if (!cfg.has.faq) return '';
  return html`
<section style="background:var(--bg-card)">
  <div class="wrap" data-reveal>
    ${when(copy.faqLabel, (l) => html`<p class="t-label">${l}</p>`)}
    <h2 class="t-d1" data-lines>${raw(headlineLines(copy.faqHeadline ?? 'Questions we are asked.').join('<br>'))}</h2>
    <div class="faqs">
      ${each(cfg.faq, (f) => html`<details class="faq"><summary>${f.q}</summary><div class="a">${
        raw(String(f.a).startsWith('<p') ? f.a : `<p>${f.a}</p>`)
      }</div></details>`)}
    </div>
  </div>
</section>`;
}

function enquire(cfg, { tel, sms, phone, copy }) {
  const b = cfg.business ?? {};
  return html`
<section class="enq" id="enquire">
  ${when(cfg.photos?.enquiryBackground, (p) => html`<img class="bgimg" src="${p.src}"${
    raw(p.width ? ` width="${p.width}"` : '')}${raw(p.height ? ` height="${p.height}"` : '')
  } loading="lazy" decoding="async" alt="" aria-hidden="true">`)}
  <div class="wrap">
    <div data-reveal>
      ${when(copy.enquireLabel, (l) => html`<p class="t-label">${l}</p>`)}
      <h2 class="t-d1" data-lines>${raw(headlineLines(copy.enquireHeadline ?? 'Tell us about<br>the job.').join('<br>'))}</h2>
      ${when(copy.enquireIntro, (i) => html`<p class="t-lede" style="margin-top:var(--s32)">${i}</p>`)}
      <div class="direct">
        ${tel ? html`<a href="${tel}">${ICON.phone}${phone.display}</a>` : ''}
        ${when(b.email, (e) => html`<a href="mailto:${e}">${ICON.mail}${e}</a>`)}
        ${sms ? html`<a class="only-narrow" data-sms href="${sms}">${ICON.sms}${cfg.sms?.label ?? 'Text a photo of the space'}</a>` : ''}
      </div>
      ${promise(cfg)}
    </div>
    <div data-reveal>
      ${enquiryForm(cfg, FORM_CLASSES.trust)}
      ${thanksPanel(cfg)}
    </div>
  </div>
</section>`;
}

function footer(cfg, { tel, phone, nav }) {
  const b = cfg.business ?? {};
  return html`
<footer>
  <div class="wrap">
    <div class="foot">
      <div>
        ${when(b.logo, (l) => html`<img src="${l.src}" width="${l.width ?? 687}" height="${l.height ?? 255}" alt="${b.name}">`)}
        ${when(cfg.tagline, (t) => html`<p class="t-small" style="color:var(--fg-mute);max-width:34ch">${t}</p>`)}
      </div>
      ${nav.length ? html`<div><h2>Explore</h2><ul>${
        each(nav, ([href, label]) => html`<li><a href="${href}">${label}</a></li>`)
      }</ul></div>` : ''}
      <div>
        <h2>Contact</h2>
        <ul>
          ${tel ? html`<li><a href="${tel}">${phone.display}</a></li>` : ''}
          ${when(b.email, (e) => html`<li><a href="mailto:${e}">${e}</a></li>`)}
          ${when(b.baseSuburb, (s) => html`<li>${b.region ? `${s}, ${b.region}` : s}</li>`)}
          <li><a href="#enquire">${cfg.copy?.ctaLabel ?? 'Start a conversation'}</a></li>
        </ul>
      </div>
    </div>
    ${demoFooterNote(cfg)}
    <div class="legal">
      <span>&copy; <span id="yr">${cfg.year ?? new Date().getFullYear()}</span> ${b.name}</span>
      <span>${cfg.live ? 'Site by Frontline Systems' : 'Demo by Frontline Systems'}</span>
    </div>
  </div>
</footer>`;
}

function stickyBar(cfg, { tel, sms, phone }) {
  if (!tel && !sms) return '';
  const owner = cfg.business?.ownerFirstName;
  return html`
<div class="stickybar" id="sticky">
  ${sms ? html`<a class="btn" data-sms href="${sms}">${cfg.sms?.label ?? 'Text a photo'}</a>` : ''}
  ${tel ? html`<a class="btn ghost" href="${tel}">Call${owner ? ` ${owner}` : ''}</a>` : ''}
</div>`;
}

function callDock(cfg, { tel, phone }) {
  if (!tel) return '';
  const owner = cfg.business?.ownerFirstName;
  return html`
<a class="calldock" id="calldock" href="${tel}" aria-label="Call${owner ? ` ${owner}` : ''} on ${phone.display}">
  ${ICON.phone}<span class="num">${phone.display}</span>
</a>`;
}

function lightbox(cfg) {
  if (!cfg.has.gallery) return '';
  return raw(`
<dialog class="lb" id="lb" aria-label="Project image viewer">
  <div class="lbin">
    <img id="lbImg" src="" alt="" width="1600" height="1067">
    <div class="lbbar">
      <span class="t-label mute" id="lbCap" style="margin:0"></span>
      <div class="lbnav">
        <button id="lbPrev" aria-label="Previous image"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
        <button id="lbNext" aria-label="Next image"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
        <button id="lbClose" aria-label="Close viewer"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
    </div>
  </div>
</dialog>`);
}

/* -------------------------------------------------------------------- pieces */

const head = (label, headline, intro) => html`
    <div class="head" data-reveal>
      <div>
        ${when(label, (l) => html`<p class="t-label">${l}</p>`)}
        <h2 class="t-d1" data-lines>${raw(headlineLines(headline).join('<br>'))}</h2>
      </div>
      ${when(intro, (i) => html`<p class="t-lede">${i}</p>`)}
    </div>`;

const figure = (p, ratio, sizes, caption) => html`<figure class="figure" data-reveal="img" style="margin:0;aspect-ratio:${ratio}">
      <img src="${p.src}"${raw(p.srcset ? ` srcset="${p.srcset}" sizes="${sizes}"` : '')}${
        raw(p.width ? ` width="${p.width}"` : '')}${raw(p.height ? ` height="${p.height}"` : '')
      } loading="lazy" decoding="async" alt="${p.alt ?? ''}">
      ${when(caption, (c) => html`<figcaption class="t-label mute" style="margin:var(--s16) 0 0">${c}</figcaption>`)}
    </figure>`;

function heroPreload(cfg) {
  const hero = cfg.photos?.hero;
  if (!present(hero?.src)) return '';
  if (hero.srcset) {
    return `<link rel="preload" as="image" href="${escAttr(hero.src)}" imagesrcset="${escAttr(hero.srcset)}" imagesizes="100vw" fetchpriority="high">`;
  }
  return `<link rel="preload" as="image" href="${escAttr(hero.src)}" fetchpriority="high">`;
}

function jsonScript(cfg) {
  const data = cfg.__runtime ?? {};
  // A literal </script> inside a string would end the block early, and
  // U+2028/U+2029 are line terminators to a JS parser but legal inside JSON.
  return JSON.stringify(data).replace(/[<\u2028\u2029]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

const escText = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
