/**
 * Reviews carousel, plus the two links to their Google profile.
 *
 * Mechanics lifted from Imperium's testimonial columns: the list is printed
 * twice and translated to -50%, so the loop lands on a pixel-identical frame
 * with no JS at all. The duplicate pass is aria-hidden, so a screen reader
 * reads each review once. Pauses on hover AND on focus-within — Imperium has
 * the hover half only, which strands a keyboard user on a moving target.
 *
 * The links only appear when BOTH Google URLs are real. A "Read all reviews"
 * button that goes nowhere is worse than no button.
 *
 * Nothing here invents anything: reviews are pasted in by hand, word for word,
 * and a business with none renders no section at all.
 */
import { html, raw, when, each, present } from '../render.js';

const STAR = raw('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.7 5.9 21l1.3-6.8-5-4.7 6.8-.8z"/></svg>');

/**
 * `headClass` and `kickerClass` are the template's own heading classes.
 *
 * This block used to emit a bare <h2>, which inherited whatever the template's
 * element default was: on the trust pages that came out at 26px while every
 * other section heading on the page was 48px or 108px uppercase with an accent
 * eyebrow. The most important proof block was introduced by what read as a
 * caption, and it was the one heading not in the page's type system — so it
 * looked, twice over to two different reviewers, like the stylesheet had failed
 * to load. Shared blocks cannot assume a heading style; the template passes it,
 * the same way FORM_CLASSES works.
 */
export function reviews(cfg, {
  title = 'What customers say',
  intro,
  className = '',
  headClass = '',
  kicker,
  kickerClass = '',
  introClass = 'lede',
} = {}) {
  const list = (cfg.reviews ?? []).filter((r) => present(r?.text) && present(r?.name));
  if (list.length === 0) return '';

  const links = cfg.reviewsLinks ?? {};
  const showLinks = cfg.has?.googleReviews;
  // Two rows read better than one long belt; one row if there are only a few.
  const rows = list.length >= 6 ? [list.slice(0, Math.ceil(list.length / 2)), list.slice(Math.ceil(list.length / 2))] : [list];
  // One or two reviews can't fill a belt: the loop copy put the same card
  // side by side, half cut off (CJG Pools, one review). Show them still.
  const still = list.length < 3;

  return html`
<section class="fl-reviews${raw(className ? ' ' + className : '')}" id="reviews">
  <div class="wrap">
    <div class="fl-reviews-head" data-reveal>
      <div class="head">
        <div>
          ${when(kicker, (k) => html`<p class="${kickerClass}">${k}</p>`)}
          <h2 class="${headClass}">${title}</h2>
        </div>
        ${when(intro, (i) => html`<p class="${introClass}">${i}</p>`)}
      </div>
      ${showLinks ? html`<div class="fl-reviews-links">
        <a class="btn ghost small" href="${cfg.googleReviewsUrl}" target="_blank" rel="noopener">${links.readAll ?? 'Read all reviews on Google'}</a>
        <a class="btn small" href="${cfg.googleWriteReviewUrl}" target="_blank" rel="noopener">${links.write ?? 'Write a review'}</a>
      </div>` : ''}
    </div>
  </div>
  <div class="fl-reviews-rows" data-reveal>
    ${each(rows, (row, i) => html`<div class="fl-rv-row${raw(i === 1 ? ' rev' : '')}${raw(still ? ' still' : '')}">
      ${each(row, (r) => card(r, false))}${still ? '' : each(row, (r) => card(r, true))}
    </div>`)}
  </div>
</section>`;
}

function card(r, dup) {
  return html`<blockquote class="fl-rv${raw(dup ? ' dup' : '')}"${raw(dup ? ' aria-hidden="true"' : '')}>
  <div class="stars" aria-label="5 out of 5 stars">${STAR}${STAR}${STAR}${STAR}${STAR}</div>
  <p>${r.text}</p>
  <footer><b>${r.name}</b><span>${r.source ?? 'Google review'}</span></footer>
</blockquote>`;
}
