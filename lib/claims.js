/**
 * claims — every fact on the page must have a source, or the check fails.
 *
 * A reviewer catches an invented fact by fetching the client's site and looking
 * for it. That works, but it is expensive, it is late, and it depends on the
 * reviewer thinking to look. On the first night's run it found a "boardwalk"
 * that was on none of Utopian's pages, thank-you notes credited to the wrong
 * year group, and a school named from one student's testimonial. This makes the
 * same test mechanical: read the built page, pull out every specific fact, and
 * look for each one in the evidence.
 *
 * THE EVIDENCE is exactly two things:
 *   cfg._source                         what was read off their own site
 *   data/google_reviews_top25.json      what Google shows, for this slug
 * plus `_source.confirmed`, for a fact Pat confirmed with the owner directly —
 * write it as the sentence the owner gave, with who and when.
 *
 * WHAT COUNTS AS A FACT — the specifics an owner can check and a sceptic picks at:
 *   a number with a unit     20 years, 14 staff, 331 reviews, 132 steps, 10%
 *   a year                   since 1988, Gold in 2013
 *   a price                  $1,900
 *   a licence or ABN         Lic. 166547C, ARCTick AU 16525
 *   the owner's surname      Ben Thompson
 *   an award or membership   anything naming an award, a medal, a body
 *
 * WHAT IT CANNOT DO: judge meaning. "SPASA only awards Innovation where a firm
 * has solved a problem worth recognising" names SPASA, which is sourced, and
 * invents the rest. That is still the reviewer's job. This removes the class of
 * error where a specific number, name or code simply is not theirs.
 *
 * A sentence that appears verbatim in the evidence passes whole, so a review
 * quoted word for word never trips on its own numbers.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const WORD_NUMBERS = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80,
  ninety: 90, hundred: 100,
};
const WORDNUM = Object.keys(WORD_NUMBERS).join('|');

/* Units that turn a number into a claim. "One job at a time" is a stance, not a
   count, so one and zero are left alone. */
const UNIT = [
  'years?', 'yrs?', 'months?', 'weeks?', 'days?',
  'jobs?', 'projects?', 'pools?', 'homes?', 'houses?', 'gardens?', 'roofs?',
  'clients?', 'customers?', 'families', 'staff', 'people', 'employees',
  'tradespeople', 'apprentices?', 'crews?', 'teams?', 'generations?',
  'reviews?', 'stars?', 'awards?', 'medals?',
  'steps', 'zones?', 'brands?', 'suburbs?', 'vans?', 'utes?', 'trucks?',
  'kw', 'kilowatts?', 'm2', 'm²', 'sqm', 'square metres?', 'metres?', 'meters?',
  'mm', 'cm', 'km', 'litres?',
].join('|');

const AWARD_WORDS = /\b(awards?|awarded|award-winning|winners?|won|finalists?|medals?|medallists?|gold|silver|bronze|accredited|certified|endorsed|member(?:s|ship)? of|recogni[sz]ed by)\b/i;

/* Abbreviations that are not bodies anyone would invent a membership of. */
const NOT_A_BODY = new Set([
  'NSW', 'ACT', 'QLD', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'AU', 'AUS',
  'FAQ', 'SMS', 'DIY', 'OK', 'AM', 'PM', 'UV', 'LED', 'CBD', 'CEO', 'ABN',
  'TV', 'PDF', 'GPS', 'USA', 'UK', 'NZ',
]);

/*
 * Claims with no number in them, which is how the worst ones hid.
 *
 * South Coast's demo told customers Ryan is "a fully licensed landscaper" and
 * that "the first consultation is free", six times over. Neither is on anything
 * he has published, and "actually mate, I don't quote for free" loses the call.
 * A number check cannot see either, so each of these words needs its stem
 * somewhere in the evidence before the page may use it.
 */
const CREDENTIALS = [
  [/\b(?:fully\s+)?licen[cs]ed\b|\blicen[cs]e holders?\b/i, /licen[cs]/, 'a licence'],
  [/\b(?:fully\s+)?insured\b|\binsurance\b/i, /insur/, 'insurance'],
  [/\bfree\s+(?:quotes?|consultations?|measures?|inspections?|site visits?|design|advice|call-?outs?)\b|\bno charge\b|\bcosts nothing\b|\bat no cost\b|\bthe first (?:\w+ )?is free\b|\bobligation[- ]free\b/i, /\bfree\b|no charge|no cost|obligation/, 'a free service'],
  [/\bguarantee[ds]?\b/i, /guarantee/, 'a guarantee'],
  [/\bwarrant(?:y|ies|ed)\b/i, /warrant/, 'a warranty'],
  [/\b(?:certified|accredited)\b/i, /certif|accredit/, 'a certification'],
  [/\bqualified\s+(?:\w+\s+)?(?:tradesm[ae]n|electricians?|plumbers?|builders?|landscapers?|technicians?|staff|team|crew)\b/i, /qualified/, 'a qualification'],
  [/\bfixed[- ]price\b/i, /fixed[- ]price|fixed quote|fixed cost/, 'a fixed price'],
  [/\bfamily[- ](?:run|owned|operated|business)\b/i, /family/, 'family-run'],
  [/\bowner[- ]operated\b|\blocally owned\b/i, /owner|local/, 'owner-operated'],
];

/* Keys whose values are addresses, paths and metadata, not prose. Their digits
   are image widths and URL segments, and would otherwise "source" a claim. */
const NOT_EVIDENCE = new Set([
  'url', 'website', 'src', 'srcset', 'href', 'path', 'file', 'when', 'readAt',
  'pagesRead', 'stockLookingPhotos', 'photoClaims', 'photoNote', 'platform',
]);

const norm = (s) => String(s)
  .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-').replace(/ /g, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase();

const toNumber = (raw) => {
  const w = WORD_NUMBERS[String(raw).toLowerCase()];
  if (w != null) return w;
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

function collect(value, out = []) {
  if (typeof value === 'string') {
    if (!/^(?:https?:)?\/\/|^\/\S+$|\.(?:jpe?g|png|webp|svg|gif)$/i.test(value.trim())) out.push(value);
  } else if (typeof value === 'number') {
    out.push(String(value));
  } else if (Array.isArray(value)) {
    for (const v of value) collect(v, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (!NOT_EVIDENCE.has(k)) collect(v, out);
  }
  return out;
}

/** Everything we are allowed to say, as searchable text and a set of numbers. */
export function buildEvidence(cfg, googleRecord) {
  const strings = [...collect(cfg._source ?? {}), ...collect(googleRecord ?? {})];
  const text = norm(strings.join(' \n '));
  const numbers = new Set();
  for (const m of text.matchAll(/\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?/g)) numbers.add(toNumber(m[0]));
  for (const m of text.matchAll(new RegExp(`\\b(${WORDNUM})\\b`, 'g'))) numbers.add(WORD_NUMBERS[m[1]]);
  const compact = text.toUpperCase().replace(/\s+/g, '');
  return { text, compact, numbers, empty: strings.length === 0 };
}

/* ------------------------------------------------------------ the page text */

/** Remove the element carrying `marker` in its opening tag, nested children and all. */
function stripElement(html, marker) {
  let at = html.indexOf(marker);
  while (at !== -1) {
    const start = html.lastIndexOf('<', at);
    const tag = /^<([a-z0-9]+)/i.exec(html.slice(start))?.[1];
    if (!tag) break;
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    re.lastIndex = start;
    let depth = 0, end = -1, m;
    while ((m = re.exec(html))) {
      depth += m[1] ? -1 : 1;
      if (depth === 0) { end = re.lastIndex; break; }
    }
    if (end === -1) break;
    html = html.slice(0, start) + ' ' + html.slice(end);
    at = html.indexOf(marker);
  }
  return html;
}

/**
 * What a visitor reads, one block per line. The demo banner and footer note are
 * ours, not claims about them, and the copyright year is the build's.
 */
export function visibleText(html) {
  let s = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html) ?? [, html])[1];
  s = s.replace(/<(script|style|template|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  s = stripElement(s, 'class="fl-demobar');
  s = stripElement(s, 'class="fl-demo-note');
  s = s.replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|h[1-6]|div|section|figcaption|blockquote|dt|dd|td|th|summary|header|footer|article|figure|label|button|a)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = s.replace(/&copy;/gi, '©').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, ' ');
  s = s.replace(/(?:©|copyright)\s*\d{4}/gi, ' ');
  return s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/* ----------------------------------------------------------------- the check */

/** Every fact on the page with no source behind it. */
export function unsourcedClaims(lines, evidence, cfg, now = new Date()) {
  const out = [];
  const seen = new Set();
  const flag = (claim, line, why) => {
    const key = `${why}|${claim.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    const i = line.toLowerCase().indexOf(claim.toLowerCase());
    const context = line.slice(Math.max(0, i - 40), i + claim.length + 40).trim();
    out.push({ claim, why, context });
  };
  const has = (n) => n != null && evidence.numbers.has(n);

  /* A year count can be arithmetic on a founding year they state themselves —
     "since 1988" sources "38 years". Only a founding phrase counts, so a stray
     date elsewhere in their copy cannot source an age. */
  const founded = [...evidence.text.matchAll(
    /\b(?:since|established|est\.?|founded|operating since|started(?: in)?|in business since|trading since)\s+(?:in\s+)?(19\d\d|20\d\d)\b/g,
  )].map((m) => Number(m[1]));
  const yearsOk = (n) => founded.some((y) => Math.abs(now.getFullYear() - y - n) <= 1);

  const verbatim = (line) => line.length >= 20 && evidence.text.includes(norm(line));

  for (const line of lines) {
    if (verbatim(line)) continue;
    const low = line.toLowerCase();

    for (const m of line.matchAll(new RegExp(`\\b(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?|${WORDNUM})\\s*\\+?\\s*[-]?\\s*(?:(?:odd|plus|more)\\s+)?(${UNIT})\\b`, 'gi'))) {
      const n = toNumber(m[1]);
      if (n == null || n < 2) continue;
      if (has(n)) continue;
      if (/^y/i.test(m[2]) && yearsOk(n)) continue;
      // "Four steps" heading a four-step process is the page describing itself.
      if (/^steps$/i.test(m[2]) && n === (cfg.process ?? []).length) continue;
      flag(m[0], line, 'a number');
    }
    for (const m of line.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|per ?cent)/gi)) {
      if (!has(toNumber(m[1]))) flag(m[0], line, 'a percentage');
    }
    for (const m of line.matchAll(/\b(\d\.\d)\s*(?:stars?|out of 5|\/5|google rating|rating)/gi)) {
      if (!has(toNumber(m[1]))) flag(m[0], line, 'a rating');
    }
    for (const m of line.matchAll(/\b(19[5-9]\d|20[0-4]\d)\b/g)) {
      if (!has(Number(m[1]))) flag(m[1], line, 'a year');
    }
    for (const m of line.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?\s*(k\b)?/gi)) {
      const base = toNumber(m[1]);
      const literal = m[0].replace(/\s+/g, '').toLowerCase();
      if (has(base * (m[2] ? 1000 : 1)) || (m[2] && has(base)) || evidence.text.includes(literal)) continue;
      flag(m[0].trim(), line, 'a price');
    }
    for (const m of line.matchAll(/\b(?:lic(?:en[cs]e)?\.?|licen[cs]e\s+no\.?|contractor licen[cs]e(?: no\.?)?|arctick|abn)\s*[:#]?\s*((?:[A-Z]{1,3}\s?)?\d[\d ]{3,}\d[A-Z]?)\b/gi)) {
      if (!evidence.compact.includes(m[1].toUpperCase().replace(/\s+/g, ''))) flag(m[0], line, 'a licence number');
    }
    for (const m of line.matchAll(/\b(\d{5,7}[A-Z])\b/g)) {
      if (!evidence.compact.includes(m[1])) flag(m[1], line, 'a licence number');
    }

    for (const [re, stem, what] of CREDENTIALS) {
      const m = re.exec(line);
      if (m && !stem.test(evidence.text)) flag(m[0], line, what);
    }

    if (AWARD_WORDS.test(line)) {
      const bodies = (line.match(/\b[A-Z]{2,6}\b/g) ?? []).filter((a) => !NOT_A_BODY.has(a));
      for (const b of bodies) if (!evidence.compact.includes(b)) flag(b, line, 'an award or body');
      const anchors = [
        ...bodies,
        ...(line.match(/\b\d{2,}\b/g) ?? []),
        ...(line.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) ?? []),
      ];
      const anchored = anchors.some((a) => evidence.text.includes(a.toLowerCase()));
      if (!anchored && /\b(awards?|awarded|award-winning|finalists?|medals?|accredited|certified|member(?:s|ship)? of)\b/i.test(low)) {
        flag(line.slice(0, 60), line, 'an award or membership with nothing specific behind it');
      }
    }
  }

  /* The surname is the one detail most easily made up and most personally
     noticed. First names come from reviews constantly; surnames rarely do. */
  const owner = String(cfg.business?.ownerName ?? '').trim().split(/\s+/);
  if (owner.length >= 2) {
    const surname = owner.at(-1).replace(/[^A-Za-z'-]/g, '');
    if (surname && !new RegExp(`\\b${surname}\\b`, 'i').test(evidence.text)) {
      out.push({ claim: surname, why: "the owner's surname", context: `business.ownerName "${owner.join(' ')}"` });
    }
  }
  return out;
}

/** The check `npm run check` runs. Returns blocker strings. */
export async function claimBlockers(cfg, distDir, googleRecord) {
  const file = distDir && join(distDir, 'index.html');
  if (!file || !existsSync(file)) return [];
  const evidence = buildEvidence(cfg, googleRecord);
  const lines = visibleText(await readFile(file, 'utf8'));
  const found = unsourcedClaims(lines, evidence, cfg);
  if (!found.length) return [];
  const head = evidence.empty
    ? `${found.length} fact(s) on the page and no _source at all to check them against`
    : `${found.length} fact(s) on the page have no source`;
  return [
    `${head} — add each to _source as the sentence it came from, or take it off the page:`,
    ...found.slice(0, 15).map((f) => `  unsourced ${f.why}: "${f.claim}" — …${f.context}…`),
    ...(found.length > 15 ? [`  …and ${found.length - 15} more`] : []),
  ];
}
