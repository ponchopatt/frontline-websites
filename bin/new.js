#!/usr/bin/env node
/**
 * npm run new -- <slug> <their current website url> <industry>
 *
 * Reads their site, writes clients/<slug>/config.json, and downloads their own
 * photos as webp at 800 and 1800.
 *
 * EVERY value it worked out carries "_check": true. None of them is trusted
 * until a person confirms it, and `npm run check` refuses to pass a demo with
 * flags still on it. Reviews are left empty on purpose — those get pasted in by
 * hand from the Google profile, word for word.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fetchSite, extract } from '../lib/scrape.js';
import { downloadPhotos, downloadRaw } from '../lib/images.js';
import { INDUSTRIES, INDUSTRY_TEMPLATE, CLIENTS_DIR } from '../lib/config.js';
import { toE164, formatAuPhone } from '../lib/render.js';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const force = args.includes('--force');
const [slug, url, industry] = args.filter((a) => !a.startsWith('--'));

if (!slug || !url || !industry) {
  console.error('\nusage: npm run new -- <slug> <url> <industry>\n');
  console.error(`industries: ${INDUSTRIES.join(', ')}\n`);
  process.exit(2);
}
if (!INDUSTRIES.includes(industry)) {
  console.error(`\n"${industry}" is not one of: ${INDUSTRIES.join(', ')}\n`);
  process.exit(2);
}

const dir = join(CLIENTS_DIR, slug);
if (existsSync(join(dir, 'config.json')) && !force) {
  console.error(`\nclients/${slug}/config.json already exists. Pass --force to overwrite it.\n`);
  process.exit(2);
}

const startUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
console.log(`\nReading ${startUrl}`);

let site;
try {
  site = await fetchSite(startUrl, { verbose });
} catch (err) {
  console.error(`\n  Could not read their site.\n  ${err.message}\n`);
  console.error('  Nothing was written. A config full of guesses from an error page is worse');
  console.error('  than no config, because it looks like it worked.\n');
  console.error('  What to do:');
  console.error('    · open the site yourself and check it is up');
  console.error('    · if it is behind bot protection, build this one by hand:');
  console.error(`        cp -r clients/bondi-landscapes clients/${slug}   (or the closest existing client)`);
  console.error('        then replace the content and photos with theirs');
  console.error('    · their photos can be saved from the browser and dropped into');
  console.error(`        clients/${slug}/assets/\n`);
  process.exit(1);
}
const found = extract(site);
console.log(`  ${Object.keys(site.pages).length} pages · ${found.platform} · ${found.photos.length} candidate images`);

/**
 * Did we actually learn anything?
 *
 * Pattern-matching error pages is a losing game — every host dresses them up
 * differently. What is reliable is the result: a real tradie's website always
 * yields at least a phone number, an email or some photographs. None of the
 * three means we read something that was not their website, and writing a
 * config from it would look like it worked. "403" as a business name is the
 * exact failure this catches.
 */
const learned = [found.phone, found.email, found.photos.length, found.services.length].filter(Boolean).length;
if (learned === 0) {
  console.error('\n  Read the page, but found nothing on it — no phone, no email, no photos, no services.');
  console.error('  That is not their website. Most likely bot protection served us an error page.');
  console.error(`  The page we got back was titled "${found.name}".\n`);
  console.error('  Nothing was written. Build this one by hand:');
  console.error(`    mkdir -p clients/${slug}/assets`);
  console.error('    copy the closest existing client\'s config.json and replace the content');
  console.error(`    save their photos from your browser into clients/${slug}/assets/\n`);
  process.exit(1);
}

await mkdir(join(dir, 'assets'), { recursive: true });

console.log('  downloading their photos');
const { kept, skipped } = await downloadPhotos(found.photos, join(dir, 'assets'), { verbose });
console.log(`  kept ${kept.length}, skipped ${skipped.length}`);

const logoAsset = found.logo ? await downloadRaw(found.logo, join(dir, 'assets'), 'logo') : null;

const template = INDUSTRY_TEMPLATE[industry];

/**
 * Their own photos first, stock last.
 *
 * A demo whose hero is a Getty image is the exact failure this project exists
 * to avoid: an owner recognises a stock photo of somebody else's roof instantly,
 * and the whole pitch dies with it. Stock is kept in the file so Pat can see
 * what their site is using, but it can never lead.
 */
const ranked = [...kept].sort((a, b) => Number(a.stock) - Number(b.stock));
const ownPhotos = ranked.filter((p) => !p.stock);
const hero = ownPhotos[0] ?? null;
const gallery = ownPhotos.slice(1, 9);
const servicePhotos = ownPhotos.slice(1, 7);
const e164 = toE164(found.phone);

/** Wrap a guessed value so it carries its own flag. */
const guess = (value) => (value === '' || value == null ? undefined : value);

const config = {
  _comment: `Built by "npm run new" from ${startUrl} on ${new Date().toISOString().slice(0, 10)}. Everything listed in _check was worked out by reading their website and is NOT confirmed. Go through the checklist, fix or delete each one, then remove it from _check. Reviews are deliberately empty — paste them in from their Google profile, word for word.`,

  slug,
  template,
  industry,
  live: false,

  business: {
    name: found.name || slug.replace(/-/g, ' '),
    ownerName: '',
    ownerFirstName: '',
    phone: { display: formatAuPhone(found.phone), e164 },
    email: found.email || '',
    abn: found.abn || '',
    baseSuburb: found.suburbs[0] || '',
    region: '',
    currentSite: new URL(startUrl).hostname.replace(/^www\./, ''),
    brand: guess(found.brandColour) ? { accent: found.brandColour } : {},
    ...(logoAsset ? { logo: logoAsset } : {}),
  },

  responsePromise: '',

  copy: {
    headline: '',
    sub: '',
    kicker: '',
  },

  stats: {
    googleRating: null,
    reviewCount: null,
    jobsDone: null,
    yearsInBusiness: found.yearsInBusiness ?? null,
  },

  services: (found.services.slice(0, 5)).map((title, i) => ({
    title,
    blurb: '',
    ...(servicePhotos[i] ? { photo: photoField(servicePhotos[i]) } : {}),
  })),

  serviceAreas: found.suburbs.length
    ? [{ region: 'Service area', suburbs: found.suburbs.slice(0, 24) }]
    : [],

  credentials: found.credentials,

  photos: {
    ...(hero ? { hero: photoField(hero) } : {}),
    gallery: gallery.map((p) => ({ ...photoField(p), full: p.full, caption: '' })),
    beforeAfter: [],
  },

  googleReviewsUrl: found.socials.google ?? '',
  googleWriteReviewUrl: '',
  reviews: [],
  _todo_reviews: 'Paste their Google reviews here, word for word, as {"name": "...", "text": "..."}. Never write one.',

  form: { accessKey: '' },

  _source: {
    url: startUrl,
    platform: found.platform,
    pagesRead: Object.keys(site.pages),
    aboutText: found.about,
    socials: found.socials,
    stockLookingPhotos: kept.filter((p) => p.stock).map((p) => p.source),
  },

  _check: buildCheckList({ found, hero, kept, logoAsset, e164 }),
};

if (template === 'quote') {
  config.calculator = {
    _comment: 'Prices are NOT filled in. Get them from the owner, then set each range. Any range left with "_check": true renders "Guide only, confirmed on site".',
    jobs: [],
  };
}

await writeFile(join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n');

/* ------------------------------------------------------------------ report */

console.log(`\n  wrote clients/${slug}/config.json`);
console.log(`  wrote clients/${slug}/assets/ (${kept.length} photos, ${kept.length * 2} files)\n`);
console.log('─'.repeat(64));
console.log(`CHECKLIST — ${config.business.name}`);
console.log('─'.repeat(64));

const gotIt = [];
const needIt = [];

const line = (label, value, note) => (value ? gotIt.push(`  ${label}: ${value}${note ? `  (${note})` : ''}`) : needIt.push(`  ${label}${note ? `  — ${note}` : ''}`));

line('Business name', config.business.name, 'check the spelling and the legal form');
line('Phone', config.business.phone.display, e164 ? `dials as ${e164}` : 'COULD NOT BE PARSED');
line('Email', config.business.email);
line('ABN', config.business.abn);
line('Years in business', config.stats.yearsInBusiness);
line('Base suburb', config.business.baseSuburb);
line('Brand colour', config.business.brand?.accent);
line('Logo', logoAsset?.src);
line('Hero photo', hero?.src);
line('Services found', config.services.length ? `${config.services.length}` : '');
line('Suburbs found', found.suburbs.length ? `${found.suburbs.length}` : '');

if (gotIt.length) {
  console.log('\nFound, but unconfirmed — read every one:');
  gotIt.forEach((l) => console.log(l));
}

console.log('\nYou still need to fill in:');
if (!config.business.ownerName) console.log('  Owner\'s name — nothing on their site gave it away');
if (!config.responsePromise) console.log('  Response promise, e.g. "Quote back within a few hours"');
if (!config.copy.headline) console.log('  Hero headline, subhead and kicker');
console.log('  Service blurbs (the titles came off their site, the words did not)');
if (!config.photos.hero?.alt) console.log('  Alt text for every photo');
console.log('  Google reviews — paste them word for word. Never write one.');
console.log('  Google reviews URL and write-a-review URL');
if (template === 'quote') console.log('  Every price in the calculator — ask the owner, do not guess');
needIt.forEach((l) => console.log(l));

if (config.stats.googleRating == null) {
  console.log('\n  Note: no Google rating is set. Only add one if it is 4.7 or higher —');
  console.log('        below that the number works against the pitch and the bar hides it.');
}

const stockish = kept.filter((p) => p.stock);
if (stockish.length) {
  console.log(`\n  WARNING: ${stockish.length} photo(s) look like stock library images:`);
  stockish.forEach((p) => console.log(`    ${p.src}  from ${p.source}`));
  console.log('  Only their own photos should go on a demo. Delete these unless Pat says otherwise.');
}

if (skipped.length) {
  console.log(`\n  ${skipped.length} image(s) skipped:`);
  const reasons = {};
  for (const s of skipped) reasons[s.why] = (reasons[s.why] ?? 0) + 1;
  for (const [why, n] of Object.entries(reasons)) console.log(`    ${n} × ${why}`);
}

console.log(`\nNext:  npm run build -- ${slug}  then  npm run check -- ${slug}\n`);

/* ------------------------------------------------------------------ pieces */

function photoField(p) {
  return { src: p.src, srcset: p.srcset, width: p.width, height: p.height, alt: p.alt || '' };
}

function buildCheckList({ found, hero, kept, logoAsset, e164 }) {
  const flags = [
    'business.name',
    'business.phone.display',
    'business.email',
    'business.baseSuburb',
    'services',
    'serviceAreas',
  ];
  if (found.abn) flags.push('business.abn');
  if (found.yearsInBusiness != null) flags.push('stats.yearsInBusiness');
  if (found.brandColour) flags.push('business.brand.accent');
  if (found.credentials.length) flags.push('credentials');
  if (logoAsset) flags.push('business.logo');
  if (hero) flags.push('photos.hero');
  if (kept.length > 1) flags.push('photos.gallery');
  if (!e164) flags.push('business.phone.e164');
  return flags;
}
