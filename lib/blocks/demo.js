/**
 * Demo safety.
 *
 * Every demo carries a real business's name, logo and photography for a
 * business that has not hired us. So while `live` is false:
 *
 *   - noindex, in the page AND as a response header (see the generated
 *     vercel.json). A demo that outranks the real site, or gets mistaken for
 *     it, is a serious problem for them and for us.
 *   - a footer line saying plainly what this is
 *   - a dismissible banner naming who it was prepared for, which ?clean=1
 *     removes so the same URL can be shown mid-call without the pitch on it
 *
 * The banner ships `hidden` and JS reveals it, so the default state — and the
 * no-JS state — is the clean visitor view. The thing that fails is the pitch
 * chrome, never the site.
 */
import { html, when, raw } from '../render.js';

const fill = (text, vars) =>
  String(text ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));

export function robotsMeta(cfg) {
  if (cfg.live) return '';
  return raw('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex">');
}

/**
 * Decided before first paint, not after.
 *
 * The banner used to ship hidden and be revealed by the deferred script, which
 * meant the whole page jumped down a banner's height once JS ran — 0.146 of
 * cumulative layout shift, and the single biggest drag on the performance
 * score. Now the markup ships visible and this inline script hides it before
 * anything is painted, so neither state shifts.
 */
export function demoBannerHeadScript(cfg) {
  if (cfg.live) return '';
  const key = `fl-demobar-${cfg.slug ?? 'demo'}`;
  return raw(`<script>(function(){try{`
    + `var d=document.documentElement;`
    + `if(new URLSearchParams(location.search).has("clean")||sessionStorage.getItem(${JSON.stringify(key)})==="off")`
    + `d.classList.add("fl-clean");`
    + `}catch(e){}})()</script>`);
}

export function demoBanner(cfg) {
  if (cfg.live) return '';
  const d = cfg.demo ?? {};
  const owner = cfg.business?.ownerName || cfg.business?.ownerFirstName || cfg.business?.name;
  const site = cfg.business?.currentSite;
  return html`
<div class="fl-demobar" id="demobar">
  <div class="wrap fl-demobar-in">
    <p>${d.bannerPrefix ?? 'Prepared for'} <b>${owner}</b> ${d.bannerSuffix ?? 'by Frontline Systems'}${
      when(site, (s) => html` — a preview of what ${s} could look like`)}.</p>
    ${when(d.bannerCta, (label) => html`<a class="fl-demobar-cta" id="demoBook" href="${d.bannerCtaUrl ?? '#quote'}">${label}</a>`)}
    <button class="fl-demobar-x" id="demoClose" type="button" aria-label="Dismiss this banner">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
  </div>
</div>`;
}

export function demoFooterNote(cfg) {
  if (cfg.live) return '';
  const d = cfg.demo ?? {};
  const text = fill(d.footerNote, { business: cfg.business?.name ?? 'this business' });
  return when(text, (t) => html`<p class="fl-demo-note">${t}</p>`);
}
