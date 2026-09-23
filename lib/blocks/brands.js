/**
 * Brand logos — the row of manufacturers a client is a dealer or installer
 * for. Greyscale by default, full colour on hover/focus, so it reads as a
 * quiet trust signal rather than a wall of noise competing with the CTA.
 *
 * Renders nothing if a client sets no brands, so a trade with no dealer
 * relationships to show doesn't get an empty strip.
 */
import { html, when, each, present } from '../render.js';

export function brands(cfg) {
  const list = cfg.brands ?? [];
  if (list.length === 0) return '';
  const copy = cfg.copy ?? {};
  return html`
<section class="brands" id="brands">
  <div class="wrap">
    ${when(copy.brandsTitle, (t) => html`<p class="brands-kicker">${t}</p>`)}
    <ul class="brand-row">
      ${each(list, (b) => html`<li>${
        present(b.logo?.src)
          ? html`<img src="${b.logo.src}"${b.logo.width ? html` width="${b.logo.width}"` : ''}${b.logo.height ? html` height="${b.logo.height}"` : ''} loading="lazy" decoding="async" alt="${b.name}">`
          : html`<span class="brand-word">${b.name}</span>`
      }</li>`)}
    </ul>
  </div>
</section>`;
}
