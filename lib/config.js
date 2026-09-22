/**
 * config — load one client's config.json, fold in its industry preset, and
 * normalise it into the shape the templates expect.
 *
 * The merge rule, which matters more than it looks:
 *
 *   OBJECTS MERGE, ARRAYS REPLACE.
 *
 * If a client has four FAQs, they get four — not their four plus the preset's
 * six. A preset is a starting point for a client we know nothing about yet, and
 * the moment we learn something real it wins outright.
 *
 * `_check: true` marks a value nobody has confirmed. `npm run new` sets it on
 * everything it guessed off a website. It travels alongside the value it
 * belongs to, so it survives the merge and the checker can find it.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { toE164, slugify } from './render.js';

export const ROOT = resolve(import.meta.dirname, '..');
export const CLIENTS_DIR = join(ROOT, 'clients');
export const PRESETS_DIR = join(ROOT, 'presets');
export const DIST_DIR = join(ROOT, 'dist');

export const TEMPLATES = ['trust', 'quote'];

/**
 * Which template an industry gets when nobody says otherwise.
 * Trust: big jobs, bought on whether they believe you. Quote: mid-size jobs,
 * bought on price and how fast you can start.
 */
export const INDUSTRY_TEMPLATE = {
  pools: 'trust',
  landscaping: 'trust',
  builders: 'trust',
  'granny-flats': 'trust',
  'kitchens-joinery': 'trust',
  bathrooms: 'trust',
  roofing: 'quote',
  'air-conditioning': 'quote',
  'solar-batteries': 'quote',
  fencing: 'quote',
  concreting: 'quote',
  'decks-pergolas': 'quote',
  glazing: 'quote',
};

export const INDUSTRIES = Object.keys(INDUSTRY_TEMPLATE);

/* ------------------------------------------------------------------- merging */

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Deep merge where objects merge and arrays replace whole. `override` wins. */
export function merge(base, override) {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? merge(base[key], value) : value;
  }
  return out;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`${path} is not valid JSON: ${err.message}`);
  }
}

/* ------------------------------------------------------------------- loading */

export async function listClients() {
  if (!existsSync(CLIENTS_DIR)) return [];
  const entries = await readdir(CLIENTS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && existsSync(join(CLIENTS_DIR, e.name, 'config.json')))
    .map((e) => e.name)
    .sort();
}

/**
 * Load a client: base preset, then industry preset, then the client's own file.
 * Returns the normalised config plus `sources`, so the checker can say where a
 * value came from when it complains about it.
 */
export async function loadConfig(slug) {
  const dir = join(CLIENTS_DIR, slug);
  const file = join(dir, 'config.json');
  const own = await readJson(file);
  if (!own) throw new Error(`No config for "${slug}". Expected ${file}`);

  const base = (await readJson(join(PRESETS_DIR, '_base.json'))) ?? {};
  const industry = own.industry ?? base.industry;
  const preset = industry ? await readJson(join(PRESETS_DIR, `${industry}.json`)) : null;

  if (industry && !preset && INDUSTRIES.includes(industry)) {
    throw new Error(`Industry "${industry}" has no preset at presets/${industry}.json`);
  }

  const merged = merge(merge(base, preset ?? {}), own);
  return normalise({ ...merged, slug: own.slug ?? slug }, { dir });
}

/* --------------------------------------------------------------- normalising */

/**
 * Fill in everything derivable so no template has to guess, and make the shapes
 * uniform so a block can trust what it is handed.
 */
export function normalise(cfg, { dir } = {}) {
  const out = { ...cfg };
  out.dir = dir;
  out.slug = out.slug || slugify(out.business?.name);
  out.live = out.live === true;
  out.template = out.template || INDUSTRY_TEMPLATE[out.industry] || 'trust';

  const business = { ...(out.business ?? {}) };

  // Phone: accept a bare string, a display string, or both, and always end up
  // with a display form and a dialable form. An unparseable number yields '',
  // which hides every call button rather than producing a dead tel: link.
  const phone = typeof business.phone === 'string'
    ? { display: business.phone }
    : { ...(business.phone ?? {}) };
  phone.display = phone.display ? String(phone.display).trim() : '';
  phone.e164 = phone.e164 || toE164(phone.display);
  business.phone = phone;

  business.ownerFirstName =
    business.ownerFirstName || String(business.ownerName || '').trim().split(/\s+/)[0] || '';

  out.business = business;

  // Stats: drop anything missing, zero or not a number, so the bar renders only
  // the tiles we can stand behind. Bondi, for one, must show no rating at all.
  out.stats = cleanStats(out.stats);

  // A section is only "on" when it has data. Templates ask this, not the raw config.
  out.has = {
    services: nonEmpty(out.services),
    process: nonEmpty(out.process),
    reviews: nonEmpty(out.reviews),
    faq: nonEmpty(out.faq),
    credentials: nonEmpty(out.credentials),
    serviceAreas: nonEmpty(out.serviceAreas),
    gallery: nonEmpty(out.photos?.gallery),
    beforeAfter: nonEmpty(out.photos?.beforeAfter),
    stats: Object.keys(out.stats).length > 0,
    heroVideo: Boolean(out.heroVideo?.mp4 || out.heroVideo?.webm),
    calculator: out.template === 'quote' && nonEmpty(out.calculator?.jobs),
    // Both links have to be real, or the pair reads as broken.
    googleReviews: Boolean(out.googleReviewsUrl && out.googleWriteReviewUrl),
  };

  return out;
}

const nonEmpty = (v) => Array.isArray(v) && v.length > 0;

/**
 * The rating we will put our name to.
 *
 * Below this, the number does not help the pitch and putting it on the page
 * invites the prospect to go and read the bad ones. Bondi Landscapes is the
 * case that set this: roughly 27 reviews, one confirmed 1-star, so the rating
 * is not 5.0 and the page shows no rating at all — just the reviews themselves,
 * in the customers' own words, which still do the job.
 */
export const RATING_FLOOR = 4.7;

/**
 * Keep only finite, non-zero stats.
 *
 * A rating over 5 is a typo, not a rating. A rating under RATING_FLOOR takes
 * the review count down with it: a count with no rating beside it reads as a
 * rating being hidden, which is worse than showing neither.
 */
export function cleanStats(stats = {}) {
  const out = {};
  for (const [key, value] of Object.entries(stats ?? {})) {
    if (key.startsWith('_')) continue;
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) continue;
    if (key === 'googleRating' && (n < 1 || n > 5)) continue;
    out[key] = n;
  }

  const rating = out.googleRating;
  if (rating == null || rating < RATING_FLOOR) {
    delete out.googleRating;
    delete out.reviewCount;
  }
  return out;
}

/* -------------------------------------------------------------- _check flags */

/**
 * Walk the config and collect every `_check: true`, with the path to it.
 * A flag can sit beside the value (`{ amount: 4500, _check: true }`) or in a
 * sibling `_check` array naming which keys are unconfirmed.
 */
export function findChecks(value, path = '', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => findChecks(item, `${path}[${i}]`, found));
    return found;
  }
  if (!isPlainObject(value)) return found;

  if (value._check === true) found.push(path || '(root)');
  if (Array.isArray(value._check)) {
    for (const key of value._check) found.push(path ? `${path}.${key}` : key);
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === '_check' || key === 'dir') continue;
    findChecks(child, path ? `${path}.${key}` : key, found);
  }
  return found;
}

/** True when this particular value is one nobody has confirmed. */
export const isUnchecked = (value) =>
  isPlainObject(value) && (value._check === true || Array.isArray(value._check));

/* ------------------------------------------------------------------ required */

/** What a demo cannot go out without. Everything else is optional by design. */
export const REQUIRED = [
  ['business.name', (c) => c.business?.name],
  ['business.ownerFirstName', (c) => c.business?.ownerFirstName],
  ['business.phone.display', (c) => c.business?.phone?.display],
  ['business.phone.e164', (c) => c.business?.phone?.e164],
  ['business.baseSuburb', (c) => c.business?.baseSuburb],
  ['industry', (c) => c.industry],
  ['template', (c) => TEMPLATES.includes(c.template) && c.template],
  ['services (at least 3)', (c) => (c.services?.length ?? 0) >= 3],
  ['photos.hero.src', (c) => c.photos?.hero?.src],
  ['photos.hero.alt', (c) => c.photos?.hero?.alt],
  ['responsePromise', (c) => c.responsePromise],
];

export function missingRequired(cfg) {
  return REQUIRED.filter(([, get]) => !get(cfg)).map(([name]) => name);
}
