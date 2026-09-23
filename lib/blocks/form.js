/**
 * Qualifying enquiry form.
 *
 * Field order is the point of it: what the job is and when they want it come
 * FIRST, before we ask for a name. Someone who answers two dropdowns has
 * already started; someone asked for their mobile first has been asked to pay
 * before they know the price. Imperium's booking form is built the same way and
 * their comment calls it "the playbook's four qualifying questions".
 *
 * Then: name, mobile, suburb, optional email, optional notes.
 *
 * Each label's text and its asterisk sit in one <span>. Templates lay labels
 * out as a grid, and a bare text node plus a star span became two grid rows,
 * dropping the red * onto its own line under every required field.
 *
 * Two honeypots, both hidden from keyboards and password managers:
 *   company  — ours, checked in the page, silently aborts
 *   botcheck — Web3Forms' own server-side trap, the name is load-bearing
 */
import { html, raw, when, each, present } from '../render.js';

/**
 * Class names differ between the two designs, and the whole point of keeping
 * both designs is not forcing one to wear the other's CSS. The markup, the
 * field order and the ids are shared; only these names change.
 */
export const FORM_CLASSES = {
  quote: { form: 'form', row: 'row2', err: 'field-err', foot: 'alt', req: true },
  trust: { form: '', row: 'row two', err: 'err', foot: 't-cap', req: false },
};

export function enquiryForm(cfg, classes = FORM_CLASSES.quote) {
  const f = cfg.form ?? {};
  const errs = f.errors ?? {};
  const jobTypes = (cfg.services ?? []).map((s) => s.title).filter(present);
  const extra = f.extraJobTypes ?? [];
  const options = [...jobTypes, ...extra, 'Something else'];
  const timing = f.timingOptions ?? [];
  const c = { ...FORM_CLASSES.quote, ...classes };
  const star = c.req ? raw(' <span class="req" aria-hidden="true">*</span>') : '';

  return html`
<form class="${c.form}" id="quoteForm" novalidate data-reveal>
  <div class="${c.row}">
    <label for="qService">${f.serviceLabel ?? 'What do you need?'}
      <select id="qService" name="service">
        ${each(options, (o) => html`<option>${o}</option>`)}
      </select>
    </label>
    <label for="qWhen">${f.whenLabel ?? 'When do you need it?'}
      <select id="qWhen" name="when">
        ${each(timing, (o) => html`<option>${o}</option>`)}
      </select>
    </label>
  </div>
  <div class="${c.row}">
    <label for="qName"><span>Your name${star}</span>
      <input id="qName" name="name" type="text" autocomplete="name" required aria-describedby="qNameErr">
      <small class="${c.err}" id="qNameErr" hidden>${errs.name ?? 'Please add your name'}</small>
    </label>
    <label for="qPhone"><span>Mobile${star}</span>
      <input id="qPhone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required aria-describedby="qPhoneErr">
      <small class="${c.err}" id="qPhoneErr" hidden>${errs.phone ?? 'Please check the mobile number, it needs at least 8 digits'}</small>
    </label>
  </div>
  <div class="${c.row}">
    <label for="qSuburb"><span>Suburb${star}</span>
      <input id="qSuburb" name="suburb" type="text" autocomplete="address-level2" required aria-describedby="qSuburbErr">
      <small class="${c.err}" id="qSuburbErr" hidden>${errs.suburb ?? 'Please add your suburb'}</small>
    </label>
    <label for="qEmail"><span>Email <small>(optional)</small></span>
      <input id="qEmail" name="email" type="email" autocomplete="email">
    </label>
  </div>
  ${when(cfg.calculator?.formQuantityLabel, (label) => html`<label for="qQty"><span>${label} <small>(optional)</small></span>
    <input id="qQty" name="size" type="number" inputmode="numeric" min="1" max="9999" placeholder="${cfg.calculator.formQuantityHint ?? ''}">
  </label>`)}
  <label for="qMsg"><span>Anything else? <small>(optional)</small></span>
    <textarea id="qMsg" name="notes" placeholder="${f.notesHint ?? 'Whatever helps us quote it.'}"></textarea>
  </label>
  <input type="hidden" id="qColour" name="colour" value="">
  <input type="hidden" id="qGuide" name="guide" value="">
  <div class="hp" aria-hidden="true">
    <label for="qCompany">Company</label>
    <input id="qCompany" name="company" type="text" tabindex="-1" autocomplete="off">
    <input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off">
  </div>
  <p class="err" id="formErr" hidden>${errs.form ?? 'Please complete the highlighted fields.'}</p>
  <button class="btn" type="submit" id="qSend">${f.submitLabel ?? 'Send enquiry'}</button>
  <div class="${c.foot}"><span>${f.privacyNote ?? 'We will only use your details to reply to this enquiry.'}</span></div>
</form>`;
}

/**
 * The panel that replaces the form once it is sent.
 * One shell, three states, filled in by the runtime — so the wording can never
 * drift between the sent, demo and error paths.
 */
export function thanksPanel(cfg) {
  const phone = cfg.business?.phone ?? {};
  return html`
<div class="thanks" id="thanks" hidden role="status">
  <h3 id="thanksHead"></h3>
  <p id="thanksBody"></p>
  <p class="fl-demo-note" id="thanksNote" hidden></p>
  ${when(phone.display, (d) => html`<p>In a hurry? Call <a href="tel:${phone.e164}">${d}</a>.</p>`)}
  <span id="thanksSmsWrap"><a class="btn" id="thanksSms" href="#">Open the text message</a></span>
</div>`;
}
