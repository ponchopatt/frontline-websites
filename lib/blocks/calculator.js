/**
 * Price guide (quote template only).
 *
 * Everything comes from config.calculator — job types, the unit, the options
 * and the ranges. Nothing about fencing, roofing or concreting is written into
 * this file.
 *
 * A job is one of three shapes:
 *   per-unit  quantity x a tier range, plus an optional per-unit extra (taking
 *             the old one away) and an optional add-on
 *   fixed     the chosen option's own range
 *   quote     no number at all. We do not guess, so the panel says so.
 *
 * Any range carrying `_check: true` is a figure nobody has confirmed. The panel
 * then shows "Guide only, confirmed on site" — the checker lists it too, so it
 * cannot quietly ship as though it were their real pricing.
 */
import { html, raw, when, each, present, canReceiveSms } from '../render.js';

const SMS_ICON = raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/></svg>');

export function calculator(cfg) {
  const c = cfg.calculator;
  if (!c || !Array.isArray(c.jobs) || c.jobs.length === 0) return '';

  const first = c.jobs[0];
  const tiers = first.tiers ?? [];
  const addons = c.addons;
  const phone = cfg.business?.phone ?? {};
  // Through canReceiveSms, like every other text button. This one built its own
  // link, so LMAC's price card offered "Text us a photo" to a landline.
  const smsAttr = canReceiveSms(phone) ? `sms:${phone.e164}` : '';

  return html`
<section class="pricing" id="pricing">
  <div class="wrap">
    <div class="head" data-reveal>
      <h2>${c.heading ?? 'Your rough price in ten seconds'}</h2>
      ${when(c.intro, (i) => html`<p class="lede">${i}</p>`)}
    </div>
    <div class="pg-grid" data-reveal>
      <div class="pg-choices">
        <div>
          <h3>${c.jobLabel ?? "What's the job?"}</h3>
          <div class="chips ${raw(countClass(c.jobs.length))}" role="radiogroup" aria-label="Job type">
            ${each(c.jobs, (j, i) => html`<label class="chip">
              <input type="radio" name="pgJob" value="${j.id}"${raw(i === 0 ? ' checked' : '')}>
              <b>${j.label}</b>${when(j.sub, (s) => html`<small>${s}</small>`)}
            </label>`)}
          </div>
        </div>

        ${tiers.length ? html`<div id="pgTierWrap">
          <h3>${first.tierLabel ?? 'Which one?'}</h3>
          <div class="chips ${raw(countClass(tiers.length))}" role="radiogroup" aria-label="${first.tierLabel ?? 'Option'}">
            ${each(tiers, (t) => html`<label class="chip">
              <input type="radio" name="pgTier" value="${t.id}"${raw(t.default ? ' checked' : '')}>
              <b>${t.label}</b>${when(t.sub, (s) => html`<small>${s}</small>`)}
            </label>`)}
          </div>
        </div>` : ''}

        ${first.quantity ? html`<div id="pgQtyWrap">
          <h3>${first.quantity.label ?? 'How many?'}</h3>
          <div class="stepper">
            <button type="button" id="pgMinus" aria-label="Fewer">−</button>
            <input id="pgQty" type="number" inputmode="numeric"
              min="${first.quantity.min ?? 1}" max="${first.quantity.max ?? 999}" step="${first.quantity.step ?? 1}"
              value="${first.quantity.default ?? first.quantity.min ?? 1}"
              aria-label="${first.quantity.label ?? 'Quantity'}">
            <button type="button" id="pgPlus" aria-label="More">+</button>
          </div>
          ${when(first.quantity.hint, (h) => html`<p class="pg-fine" style="margin-top:8px;color:var(--mute)">${h}</p>`)}
        </div>` : ''}

        ${addons && addons.options?.length ? html`<div id="pgAddonWrap">
          <h3 id="pgAddonHead">${addons.label ?? 'Anything else?'}</h3>
          <div class="chips ${raw(countClass(addons.options.length))}" role="radiogroup" aria-label="${addons.label ?? 'Extras'}">
            ${each(addons.options, (o, i) => html`<label class="chip">
              <input type="radio" name="pgAddon" value="${o.id}"${raw(i === 0 ? ' checked' : '')}>
              <b>${o.label}</b>${when(o.sub, (s) => html`<small>${s}</small>`)}
            </label>`)}
          </div>
        </div>` : ''}

        <div class="pg-after">
          ${smsAttr ? html`<a class="btn" data-sms="pg2" href="${smsAttr}">${SMS_ICON}${cfg.sms?.label ?? 'Lock it in by text'}</a>` : ''}
          <a class="btn ghost" href="#quote" data-toform>Send it through the form</a>
          ${when(c.fine, (f) => html`<p class="pg-fine">${f}</p>`)}
        </div>
      </div>

      <div class="pg-result" aria-live="polite">
        <span class="eyebrow" id="pgEyebrow"></span>
        <div class="pg-price" id="pgPrice"></div>
        <p class="pg-note" id="pgNote"></p>
        <p class="pg-flag" id="pgFlag" hidden>${cfg.calculatorNotes?.unconfirmed ?? 'Guide only, confirmed on site.'}</p>
        ${when(c.included, (list) => html`<ul class="inc" id="pgInc">${each(list, (x) => html`<li>${x}</li>`)}</ul>`)}
        <div class="pg-actions">
          ${smsAttr ? html`<a class="btn" data-sms="pg" href="${smsAttr}">${SMS_ICON}${cfg.sms?.label ?? 'Lock it in by text'}</a>` : ''}
          <a class="btn ghost" href="#quote" data-toform>Send it through the form</a>
        </div>
        ${when(c.fine, (f) => html`<p class="pg-fine">${f}</p>`)}
      </div>
    </div>
  </div>
</section>`;
}

const countClass = (n) => (n >= 4 ? 'four' : n === 3 ? 'three' : 'two');

/**
 * The runtime needs the ranges, so they are handed over as data rather than
 * re-typed. Only what the calculator actually reads.
 */
export function calculatorData(cfg) {
  const c = cfg.calculator;
  if (!c || !Array.isArray(c.jobs) || c.jobs.length === 0) return null;
  return {
    roundTo: c.roundTo ?? 50,
    minimum: c.minimum ?? null,
    emptyEyebrow: c.emptyEyebrow,
    emptyPrice: c.emptyPrice,
    addons: c.addons ?? null,
    jobs: c.jobs.map((j) => ({
      id: j.id,
      label: j.label,
      mode: j.mode ?? (j.tiers ? 'per-unit' : j.options ? 'fixed' : 'quote'),
      eyebrow: j.eyebrow,
      quoteEyebrow: j.quoteEyebrow,
      quoteLabel: j.quoteLabel,
      note: j.note,
      formService: j.formService,
      quantity: j.quantity ?? null,
      tiers: j.tiers ?? null,
      options: j.options ?? null,
      extraPerUnit: j.extraPerUnit ?? null,
      addons: j.addons,
    })),
  };
}
