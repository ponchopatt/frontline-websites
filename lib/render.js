/**
 * render — the small set of helpers every template and block is built from.
 *
 * Two rules the whole factory rests on:
 *
 * 1. ESCAPING IS AUTOMATIC. Use the `html` tagged template. Every interpolated
 *    value is escaped unless you wrap it in `raw()`. The generator this repo
 *    already has (sites/crossroads-church/build.py) escapes by convention, and
 *    its own notes call that out as the thing that will eventually go wrong.
 *    Client copy arrives from a scraped website, so it is never trusted.
 *
 * 2. NOTHING IS AN EMPTY SECTION. Every helper that takes data returns the
 *    empty string when that data is missing, so a block with nothing to say
 *    emits no markup at all — no stray heading, no "0", no dangling sentence.
 */

/** Marks a string as already-safe HTML so `html` will not escape it again. */
class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

/** Wrap trusted markup (usually the output of another helper). */
export const raw = (value) => new Raw(value == null ? '' : String(value));

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a value for use in text or an attribute. */
export function esc(value) {
  if (value == null || value === false) return '';
  if (value instanceof Raw) return value.value;
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * Tagged template that escapes every interpolation.
 * Arrays are joined with no separator, so `${items.map(...)}` just works.
 * `null`, `undefined` and `false` render as nothing, which is what makes
 * `${cond && html`...`}` a safe way to include an optional part.
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += flatten(values[i]) + strings[i + 1];
  }
  return new Raw(out);
}

function flatten(value) {
  if (value == null || value === false || value === true) return '';
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(flatten).join('');
  return esc(value);
}

/** Render `fn(value)` only when `value` has something in it. Otherwise nothing. */
export function when(value, fn) {
  if (!present(value)) return '';
  return fn(value);
}

/** Render a list, or nothing at all when it is empty. */
export function each(list, fn, join = '') {
  if (!Array.isArray(list) || list.length === 0) return '';
  return raw(list.map((item, i) => flatten(fn(item, i))).join(join));
}

/**
 * Is there actually something here?
 * `0` counts as absent for our purposes: a stat of 0 jobs done is a stat we do
 * not have, and printing "0" next to "jobs completed" is worse than silence.
 * Pass a real 0 through `stat.allowZero` if a block ever needs it.
 */
export function present(value) {
  if (value == null || value === false || value === '') return false;
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return String(value).trim() !== '';
}

/* ------------------------------------------------------------------ numbers */

/** 1234567 -> "1,234,567". Imperium's counter prints "10000"; this does not. */
export const group = (n) =>
  Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-AU') : '';

/** 4500 -> "$4,500". Nothing in, nothing out — never "$NaN" or "$0". */
export function money(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0) return '';
  return '$' + Math.round(n).toLocaleString('en-AU');
}

/** A price range as one string: "$95 to $135". */
export function moneyRange(lo, hi) {
  const a = money(lo);
  const b = money(hi);
  if (a && b) return a === b ? a : `${a} to ${b}`;
  return a || b || '';
}

/* -------------------------------------------------------------------- links */

/** Australian mobile/landline -> E.164. Returns '' if it cannot be trusted. */
export function toE164(input, country = '+61') {
  if (!input) return '';
  const digits = String(input).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return /^\+\d{8,15}$/.test(digits) ? digits : '';
  const local = digits.replace(/^0+/, '');
  if (local.length < 8 || local.length > 12) return '';
  return country + local;
}

export const telHref = (phone) => {
  const e164 = phone?.e164 || toE164(phone?.display ?? phone);
  return e164 ? `tel:${e164}` : '';
};

/**
 * `sms:` deep link with the message pre-written.
 * The `?&body=` form is the cross-platform hack — iOS wants `&`, Android wants
 * `?`, and this shape is the one both accept. Both source sites use it.
 */
export function smsHref(phone, body = '') {
  const e164 = phone?.e164 || toE164(phone?.display ?? phone);
  if (!e164) return '';
  return `sms:${e164}${body ? `?&body=${encodeURIComponent(body)}` : ''}`;
}

export const mailHref = (email, subject) =>
  email ? `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}` : '';

/* ------------------------------------------------------------------- images */

/**
 * An <img> with srcset built from the widths we generate (800 and 1800), plus
 * width/height so nothing shifts as it loads.
 *
 * `eager` is for the hero only: it drops `loading` and adds fetchpriority=high,
 * to be paired with a matching <link rel=preload> in the head. Everything else
 * is lazy. A hero whose preload and <img> disagree fetches the picture twice —
 * that exact bug cost the Bondi demo 194KB and nine Lighthouse points.
 */
export function image(photo, { sizes = '100vw', eager = false, className = '' } = {}) {
  if (!present(photo?.src)) return '';
  const { src, alt = '', width, height, srcset } = photo;
  return html`<img${raw(className ? ` class="${esc(className)}"` : '')} src="${src}"${
    raw(srcset ? ` srcset="${esc(srcset)}" sizes="${esc(sizes)}"` : '')
  }${raw(width ? ` width="${esc(width)}"` : '')}${raw(height ? ` height="${esc(height)}"` : '')} ${
    raw(eager ? 'fetchpriority="high"' : 'loading="lazy"')
  } decoding="async" alt="${alt}">`;
}

/** Build a srcset string from the variants a file actually has on disk. */
export const srcsetFrom = (variants) =>
  (variants || []).map(({ src, width }) => `${src} ${width}w`).join(', ');

/* --------------------------------------------------------------------- text */

/**
 * Split an authored headline on its `<br>` so each line can be masked and
 * risen separately. Both templates animate headlines this way, and both depend
 * on the author's line breaks rather than measuring text.
 */
export const headlineLines = (text) =>
  String(text || '').split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);

/** "Antony Aris" -> "Antony". Used wherever copy addresses the owner. */
export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

/** Join a list the way a person would: "Matt, Max and Tom". */
export function sentenceList(items) {
  const list = (items || []).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return String(list[0]);
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** A stable id from any label, for anchors and form fields. */
export const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
