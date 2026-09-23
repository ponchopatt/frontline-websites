/**
 * test-lib — checks the two rules the whole factory rests on actually hold:
 * interpolated values are escaped, and missing data produces nothing at all.
 *
 *   node tools/test-lib.mjs
 */
import assert from 'node:assert/strict';
import {
  html, raw, esc, when, each, present, money, moneyRange, group,
  toE164, telHref, smsHref, headlineLines, sentenceList, firstName, image, slugify,
} from '../lib/render.js';
import { merge, normalise, cleanStats, findChecks, missingRequired, RATING_FLOOR } from '../lib/config.js';
import { staticChecks } from '../lib/check.js';

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL ${name}\n       ${err.message}`); }
};

console.log('\nrender');

check('escapes interpolated values', () => {
  const evil = '<script>alert(1)</script>';
  assert.equal(String(html`<p>${evil}</p>`), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
});

check('escapes quotes so attributes cannot break out', () => {
  assert.equal(String(html`<a title="${'a" onclick="x'}">`), '<a title="a&quot; onclick=&quot;x">');
});

check('raw() opts out, for markup we built ourselves', () => {
  assert.equal(String(html`<p>${raw('<b>ok</b>')}</p>`), '<p><b>ok</b></p>');
});

check('nested html templates are not double-escaped', () => {
  const inner = html`<b>${'A & B'}</b>`;
  assert.equal(String(html`<p>${inner}</p>`), '<p><b>A &amp; B</b></p>');
});

check('null, undefined and false render as nothing', () => {
  assert.equal(String(html`[${null}${undefined}${false}]`), '[]');
});

check('arrays join with no separator', () => {
  assert.equal(String(html`${[1, 2, 3].map((n) => html`<i>${n}</i>`)}`), '<i>1</i><i>2</i><i>3</i>');
});

console.log('\nemptiness');

check('present() treats 0 as absent', () => {
  assert.equal(present(0), false);
  assert.equal(present(4.9), true);
  assert.equal(present(''), false);
  assert.equal(present([]), false);
  assert.equal(present([1]), true);
  assert.equal(present({}), false);
  assert.equal(present(null), false);
});

check('when() renders nothing for missing data', () => {
  assert.equal(when(null, () => 'X'), '');
  assert.equal(when([], () => 'X'), '');
  assert.equal(when('hi', (v) => v), 'hi');
});

check('each() renders nothing for an empty list', () => {
  assert.equal(String(each([], (x) => x)), '');
  assert.equal(String(each(['a', 'b'], (x) => x)), 'ab');
});

check('money() never prints $0 or $NaN', () => {
  assert.equal(money(0), '');
  assert.equal(money(null), '');
  assert.equal(money('nope'), '');
  assert.equal(money(4500), '$4,500');
});

check('moneyRange() collapses and degrades', () => {
  assert.equal(moneyRange(95, 135), '$95 to $135');
  assert.equal(moneyRange(95, 95), '$95');
  assert.equal(moneyRange(95, null), '$95');
  assert.equal(moneyRange(null, null), '');
});

check('group() adds thousands separators', () => {
  assert.equal(group(10000), '10,000');
  assert.equal(group('nope'), '');
});

console.log('\nlinks');

check('toE164 handles the shapes a scraped site gives us', () => {
  assert.equal(toE164('0412 154 594'), '+61412154594');
  assert.equal(toE164('(02) 9130 7070'), '+61291307070');
  assert.equal(toE164('+61412154594'), '+61412154594');
  assert.equal(toE164('12345'), '', 'too short to be a phone number');
  assert.equal(toE164(''), '');
});

check('a phone we cannot parse produces no link at all', () => {
  assert.equal(telHref({ display: 'call us!' }), '');
  assert.equal(telHref({ display: '0412 154 594' }), 'tel:+61412154594');
});

check('smsHref pre-writes the message', () => {
  const href = smsHref({ e164: '+61412154594' }, 'Hi there');
  assert.equal(href, 'sms:+61412154594?&body=Hi%20there');
  assert.equal(smsHref({ e164: '' }, 'x'), '');
});

console.log('\ntext');

check('headlineLines splits on authored breaks', () => {
  assert.deepEqual(headlineLines('Gardens built<br>the way they<br>were drawn.'),
    ['Gardens built', 'the way they', 'were drawn.']);
  assert.deepEqual(headlineLines(''), []);
});

check('sentenceList reads like a person wrote it', () => {
  assert.equal(sentenceList(['Matt', 'Max', 'Tom']), 'Matt, Max and Tom');
  assert.equal(sentenceList(['Matt']), 'Matt');
  assert.equal(sentenceList([]), '');
});

check('firstName and slugify', () => {
  assert.equal(firstName('Antony Aris'), 'Antony');
  assert.equal(slugify('Horgan Building & Renovations'), 'horgan-building-renovations');
});

console.log('\nimages');

check('image() renders nothing without a source', () => {
  assert.equal(image(null), '');
  assert.equal(image({ alt: 'x' }), '');
});

check('hero is eager and high priority, everything else lazy', () => {
  const hero = String(image({ src: 'a.webp', alt: 'A' }, { eager: true }));
  assert.match(hero, /fetchpriority="high"/);
  assert.doesNotMatch(hero, /loading="lazy"/);
  const rest = String(image({ src: 'b.webp', alt: 'B' }));
  assert.match(rest, /loading="lazy"/);
});

check('image alt is escaped', () => {
  assert.match(String(image({ src: 'a.webp', alt: 'Tom & "Max"' })), /alt="Tom &amp; &quot;Max&quot;"/);
});

console.log('\nconfig merge');

check('objects merge', () => {
  assert.deepEqual(merge({ a: { x: 1, y: 2 } }, { a: { y: 3 } }), { a: { x: 1, y: 3 } });
});

check('arrays REPLACE, so a client never inherits leftover preset entries', () => {
  const preset = { faq: [{ q: 'p1' }, { q: 'p2' }, { q: 'p3' }] };
  const client = { faq: [{ q: 'c1' }] };
  assert.deepEqual(merge(preset, client).faq, [{ q: 'c1' }]);
});

check('an absent key keeps the preset value', () => {
  assert.deepEqual(merge({ faq: [1] }, {}).faq, [1]);
});

console.log('\nconfig normalise');

check('phone is normalised from a bare string', () => {
  const c = normalise({ business: { name: 'X', phone: '0412 154 594' } });
  assert.equal(c.business.phone.display, '0412 154 594');
  assert.equal(c.business.phone.e164, '+61412154594');
});

check('owner first name is derived', () => {
  assert.equal(normalise({ business: { ownerName: 'Antony Aris' } }).business.ownerFirstName, 'Antony');
});

check('template comes from the industry when unset', () => {
  assert.equal(normalise({ industry: 'roofing' }).template, 'quote');
  assert.equal(normalise({ industry: 'pools' }).template, 'trust');
});

check('stats drop anything we cannot stand behind', () => {
  assert.deepEqual(cleanStats({ googleRating: 4.9, reviewCount: 37, jobsDone: 0, yearsInBusiness: null }),
    { googleRating: 4.9, reviewCount: 37 });
  assert.deepEqual(cleanStats({ googleRating: 5.4 }), {}, 'a rating over 5 is a typo');
  assert.deepEqual(cleanStats({}), {});
});

check(`a rating under ${RATING_FLOOR} takes the review count with it`, () => {
  assert.deepEqual(cleanStats({ googleRating: 4.6, reviewCount: 120, jobsDone: 400 }), { jobsDone: 400 },
    'a count with no rating beside it reads as a rating being hidden');
  assert.deepEqual(cleanStats({ googleRating: 4.7, reviewCount: 120 }), { googleRating: 4.7, reviewCount: 120 },
    '4.7 exactly is on the right side of the line');
  assert.deepEqual(cleanStats({ googleRating: 4.75, reviewCount: 9 }), { googleRating: 4.75, reviewCount: 9 });
});

check('a review count with no rating at all is dropped too', () => {
  // Scraping can turn up "127 reviews" with no aggregate. On its own that
  // number implies a rating we have not got.
  assert.deepEqual(cleanStats({ reviewCount: 127, yearsInBusiness: 18 }), { yearsInBusiness: 18 });
});

check('Bondi keeps no rating and no review count', () => {
  // They have a 1-star review, so their rating is not 5.0 and none is shown.
  const c = normalise({ stats: { googleRating: null, reviewCount: null, yearsInBusiness: 20 } });
  assert.deepEqual(c.stats, { yearsInBusiness: 20 });
  assert.equal(c.has.stats, true, 'the bar still renders the one stat we do have');
});

check('has.* is false for every empty section', () => {
  const c = normalise({});
  for (const [key, value] of Object.entries(c.has)) assert.equal(value, false, `has.${key}`);
});

check('review links need BOTH urls or neither shows', () => {
  assert.equal(normalise({ googleReviewsUrl: 'https://g.page/x' }).has.googleReviews, false);
  assert.equal(
    normalise({ googleReviewsUrl: 'https://g.page/x', googleWriteReviewUrl: 'https://g.page/x/review' }).has.googleReviews,
    true);
});

console.log('\n_check flags');

check('findChecks finds flags wherever they sit', () => {
  const found = findChecks({
    business: { yearsInBusiness: { value: 18, _check: true } },
    services: [{ title: 'A' }, { title: 'B', _check: ['from'] }],
  });
  assert.ok(found.includes('business.yearsInBusiness'), found.join(','));
  assert.ok(found.includes('services[1].from'), found.join(','));
  assert.equal(found.length, 2);
});

check('a clean config has no flags', () => {
  assert.deepEqual(findChecks({ business: { name: 'X' } }), []);
});

console.log('\nrequired fields');

check('missingRequired names what is absent', () => {
  const missing = missingRequired(normalise({}));
  assert.ok(missing.includes('business.name'));
  assert.ok(missing.includes('photos.hero.src'));
});

check('a complete config has nothing missing', () => {
  const cfg = normalise({
    industry: 'builders',
    business: { name: 'X', ownerName: 'Pat P', phone: '0412 154 594', baseSuburb: 'Bondi' },
    services: [{ title: 'a' }, { title: 'b' }, { title: 'c' }],
    photos: { hero: { src: 'h.webp', alt: 'A hero' } },
    responsePromise: 'Quote back within a few hours',
  });
  assert.deepEqual(missingRequired(cfg), []);
});

/* ------------------------------------------------- the rating and the pull */

console.log('\nratings against data/google_reviews_top25.json');

const acheck = async (name, fn) => {
  try { await fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL ${name}\n       ${err.message}`); }
};

/** A config with nothing else wrong with it, so only the stats can fail. */
const statsCfg = (slug, stats) => normalise({
  slug,
  industry: 'builders',
  business: { name: 'X', ownerName: 'Pat P', phone: '0412 154 594', baseSuburb: 'Bondi' },
  services: [{ title: 'a' }, { title: 'b' }, { title: 'c' }],
  photos: { hero: { src: 'h.webp', alt: 'A hero' } },
  responsePromise: 'Quote back within a few hours',
  demo: { footerNote: 'A demo.' },
  stats,
});
const ratingIssues = (list) => list.filter((s) => /rating|reviewCount|pull/i.test(s));

await acheck('a 5.0 the pull confirms passes', async () => {
  // Horgan really is 5.0 from 5 reviews. This is the case that used to fail on
  // the reasoning that a 5.0 might be invented; the pull settles it.
  const r = await staticChecks(statsCfg('horgan-building', { googleRating: 5, reviewCount: 5 }));
  assert.deepEqual(ratingIssues(r.blockers), [], 'a verified 5.0 is not a blocker');
  assert.deepEqual(ratingIssues(r.confirm), [], 'and nothing left to confirm');
  assert.ok(r.notes.some((n) => /verified against/.test(n)), 'and it says where it was verified');
});

await acheck('a 5.0 the pull has never heard of is a question, not a blocker', async () => {
  const r = await staticChecks(statsCfg('someone-new', { googleRating: 5, reviewCount: 12 }));
  assert.deepEqual(ratingIssues(r.blockers), [], 'an unknown 5.0 no longer stops the build');
  assert.equal(ratingIssues(r.confirm).length, 1, 'it goes on the to-confirm list');
});

await acheck('a rating that disagrees with the pull is a blocker', async () => {
  const r = await staticChecks(statsCfg('horgan-building', { googleRating: 4.9, reviewCount: 5 }));
  assert.ok(r.blockers.some((b) => /does not match their profile/.test(b)),
    'showing a number their Google profile does not show is the thing an owner checks');
});

await acheck('a review count that disagrees with the pull is a blocker', async () => {
  const r = await staticChecks(statsCfg('lmac', { googleRating: 4.8, reviewCount: 300 }));
  assert.ok(r.blockers.some((b) => /reviewCount is 300/.test(b)), 'LMAC has 331');
});

await acheck('a round review count the pull confirms is left alone', async () => {
  // The round-number rule exists because 500 jobs is a guess. A count Google
  // itself reports is not a guess, however tidy it looks.
  const r = await staticChecks(statsCfg('lmac', { googleRating: 4.8, reviewCount: 331 }));
  assert.deepEqual(ratingIssues(r.blockers), []);
});

await acheck(`a rating under ${RATING_FLOOR} is dropped and the note says why`, async () => {
  const r = await staticChecks(statsCfg('dimension-gardenscape', { googleRating: 4.5, reviewCount: 54 }));
  assert.deepEqual(ratingIssues(r.blockers), [], 'hidden, not failed');
  assert.ok(r.notes.some((n) => /under the 4.7 floor/.test(n)), 'and it names the real figure');
});

await acheck('every row in QUEUE.csv has an industry the factory knows', async () => {
  const { readFileSync } = await import('node:fs');
  const { INDUSTRIES, INDUSTRY_TEMPLATE } = await import('../lib/config.js');
  const rows = readFileSync('QUEUE.csv', 'utf8').trim().split('\n').slice(1)
    .map((l) => l.split(',')).filter((c) => c[0]);
  assert.ok(rows.length, 'the queue is not empty');
  for (const [slug, , industry, template] of rows) {
    assert.ok(INDUSTRIES.includes(industry), `${slug}: "${industry}" is not an industry the factory knows`);
    assert.equal(INDUSTRY_TEMPLATE[industry], template, `${slug}: the queue says ${template}, the industry gives ${INDUSTRY_TEMPLATE[industry]}`);
  }
});

await acheck('every row in QUEUE.csv has reviews pulled for it', async () => {
  const { readFileSync } = await import('node:fs');
  const { loadProspectReviews } = await import('../lib/config.js');
  const pull = await loadProspectReviews();
  const rows = readFileSync('QUEUE.csv', 'utf8').trim().split('\n').slice(1)
    .map((l) => l.split(',')).filter((c) => c[0]);
  for (const [slug] of rows) {
    assert.ok(pull[slug], `${slug} is in the queue with no reviews pulled for it`);
  }
});

/* -------------------------------------------------- claims need sources */

console.log('\nclaims');
{
  const { buildEvidence, unsourcedClaims } = await import('../lib/claims.js');
  const cfg = { _source: { aboutText: 'Ben Thompson founded the business. For over 20 years we have built pools. Established in 1988.' }, business: { ownerName: 'Ben Thompson' } };
  const pull = { reviews: [{ text: 'Ben built our pool 12 years ago and it is still perfect.' }] };
  const ev = buildEvidence(cfg, pull);
  const found = (lines) => unsourcedClaims(lines, ev, cfg, new Date('2026-09-23')).map((f) => f.why + ':' + f.claim);

  check('a number with no source is flagged', () => {
    assert.ok(found(['We have finished 400 pools']).some((f) => f.includes('400 pools')));
  });
  check('a sourced number, a verbatim review and a founding-year age all pass', () => {
    assert.deepEqual(found(['More than 20 years building pools', 'Ben built our pool 12 years ago and it is still perfect.', '38 years in business']), []);
  });
  check('credential words with no number are still claims', () => {
    const f = found(['A fully licensed pool builder', 'Your first consultation is free', 'Family-run since the start']);
    assert.ok(f.some((x) => x.startsWith('a licence')), 'licensed');
    assert.ok(f.some((x) => x.startsWith('a free service')), 'free');
    assert.ok(f.some((x) => x.startsWith('family-run')), 'family-run');
  });
  check("an owner's surname nobody published is flagged", () => {
    const f = unsourcedClaims([], ev, { business: { ownerName: 'Ben Smith' } }).map((x) => x.why);
    assert.ok(f.includes("the owner's surname"));
  });
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
