/**
 * Stats bar — Google rating, review count, jobs done, years in business.
 *
 * Three rules, all learned from a real page:
 *
 *   EACH TILE DROPS ON ITS OWN. Bondi Landscapes has one confirmed 1-star
 *   review, so their rating is not 5.0 and no rating is shown at all — but they
 *   still have twenty years behind them. Hiding the whole bar because one
 *   number is missing would throw away the numbers we do have.
 *
 *   THE FINAL FIGURE IS IN THE HTML. The count-up only animates over the top of
 *   it, so no-JS, reduced-motion and crawlers all see the right number.
 *
 *   NEVER PRINT NaN OR 0. Imperium's counter renders the literal "NaN" for a
 *   missing value and "10000" without separators. Both are handled here.
 */
import { html, raw, when, group } from '../render.js';

/** The order they read best in: proof first, then scale, then longevity. */
const ORDER = ['googleRating', 'reviewCount', 'jobsDone', 'yearsInBusiness'];

/**
 * Print the figure, and nothing on the end of it.
 *
 * These used to render "25+", "400+", "20+" by appending a character to
 * whatever the config held. On Sunset Pools that produced "25+ Reviews" from a
 * count of exactly 25, verified against the Google pull — which is rounding up,
 * and QUALITY.md says in as many words: show the real rating and count, never
 * round up.
 *
 * The same objection applies to the other two. A business that really says
 * "over 20 years" is making a claim in its own words, and that belongs in a
 * label or a trustClaim where it can be sourced — not synthesised here by
 * sticking a plus on an exact number. Understating is safe; overstating is the
 * thing a sceptical owner checks first.
 */
const FORMAT = {
  googleRating: (n) => n.toFixed(1),
  reviewCount: (n) => group(n),
  jobsDone: (n) => group(n),
  yearsInBusiness: (n) => group(n),
};

/** Kept so the count-up animation can still land on the printed value. */
const SUFFIX = {};

export function statsBar(cfg, className = '') {
  const stats = cfg.stats ?? {};
  const labels = cfg.statLabels ?? {};
  const subs = cfg.statSublabels ?? {};

  const tiles = ORDER.filter((key) => Number.isFinite(stats[key]) && stats[key] !== 0);

  /**
   * Claims that are not numbers — "Fully insured", "Fixed-price quotes". They
   * live in the same strip because they do the same job, and a business with no
   * publishable rating often still has these. Dropping them with the numbers
   * would throw away real content.
   */
  const claims = (cfg.trustClaims ?? []).filter((c) => c?.value && c?.label);

  if (tiles.length === 0 && claims.length === 0) return '';

  return html`
<section class="fl-stats${raw(className ? ' ' + className : '')}" aria-label="Why you can trust us">
  <ul class="wrap" data-reveal="stagger">
    ${tiles.map((key) => {
      const n = stats[key];
      const shown = (FORMAT[key] ?? group)(n);
      return html`<li>
      <b data-count="${key === 'googleRating' ? n.toFixed(1) : String(n)}"${
        raw(SUFFIX[key] ? ` data-suffix="${SUFFIX[key]}"` : '')
      }>${shown}</b>
      <span>${labels[key] ?? key}${when(subs[key], (s) => html`<small>${s}</small>`)}</span>
    </li>`;
    })}
    ${claims.map((c) => html`<li>
      <b>${c.value}</b>
      <span>${c.label}${when(c.sub, (s) => html`<small>${s}</small>`)}</span>
    </li>`)}
  </ul>
</section>`;
}
