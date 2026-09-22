#!/usr/bin/env node
/**
 * npm run batch -- prospects.csv
 *
 * Columns: slug,url,industry   (a header row is optional)
 *
 * Runs `new` for every row, one at a time, and prints one table at the end of
 * what still needs a person. Sites are visited one after another with a pause
 * between them — this is somebody else's server and there is no hurry.
 *
 * A row that fails does not stop the run. The summary says which ones need
 * doing by hand and why, which is the whole point of running a batch.
 */
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { INDUSTRIES, CLIENTS_DIR, ROOT } from '../lib/config.js';

const args = process.argv.slice(2);
const force = args.includes('--force');
const file = args.find((a) => !a.startsWith('--')) ?? 'prospects.csv';

if (!existsSync(file)) {
  console.error(`\nNo such file: ${file}`);
  console.error('\nMake one with a line per prospect:\n');
  console.error('  slug,url,industry');
  console.error('  horgan-building,horganbuildingandrenovations.com.au,builders');
  console.error('  nulook-pools,nulookpools.com.au,pools\n');
  console.error(`industries: ${INDUSTRIES.join(', ')}\n`);
  process.exit(2);
}

const rows = parseCsv(await readFile(file, 'utf8'));
if (!rows.length) { console.error(`\n${file} has no rows.\n`); process.exit(2); }

console.log(`\n${rows.length} prospect${rows.length === 1 ? '' : 's'} in ${file}\n`);

const results = [];
for (const [i, row] of rows.entries()) {
  const { slug, url, industry } = row;
  console.log(`${'─'.repeat(66)}\n[${i + 1}/${rows.length}] ${slug}`);

  if (!slug || !url || !industry) {
    results.push({ ...row, status: 'skipped', why: 'row is missing slug, url or industry' });
    console.log('  skipped: row is missing a column');
    continue;
  }
  if (!INDUSTRIES.includes(industry)) {
    results.push({ ...row, status: 'skipped', why: `"${industry}" is not a known industry` });
    console.log(`  skipped: "${industry}" is not a known industry`);
    continue;
  }
  if (existsSync(join(CLIENTS_DIR, slug, 'config.json')) && !force) {
    results.push({ ...row, status: 'exists', why: 'already built — pass --force to redo it' });
    console.log('  already exists, leaving it alone');
    continue;
  }

  const code = await run(['bin/new.js', slug, url, industry, ...(force ? ['--force'] : [])]);
  if (code === 0) {
    results.push({ ...row, status: 'built', ...summarise(slug) });
  } else {
    results.push({ ...row, status: 'failed', why: 'could not read their site — see the output above' });
  }

  if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 2000));   // be a polite visitor
}

/* ----------------------------------------------------------------- summary */

console.log(`\n${'═'.repeat(66)}\nSUMMARY\n${'═'.repeat(66)}\n`);

const built = results.filter((r) => r.status === 'built');
const failed = results.filter((r) => r.status === 'failed');
const skipped = results.filter((r) => r.status === 'skipped' || r.status === 'exists');

if (built.length) {
  console.log(`Built ${built.length}:\n`);
  console.log(`  ${'slug'.padEnd(26)}${'photos'.padEnd(9)}${'phone'.padEnd(8)}${'services'.padEnd(10)}needs work on`);
  for (const r of built) {
    console.log(`  ${r.slug.padEnd(26)}${String(r.photos).padEnd(9)}${(r.phone ? 'yes' : 'NO').padEnd(8)}${String(r.services).padEnd(10)}${r.gaps.join(', ')}`);
  }
}

if (failed.length) {
  console.log(`\nCould not read ${failed.length} — build these by hand:\n`);
  for (const r of failed) console.log(`  ${r.slug.padEnd(26)} ${r.url}`);
}

if (skipped.length) {
  console.log(`\nSkipped ${skipped.length}:\n`);
  for (const r of skipped) console.log(`  ${(r.slug || '(no slug)').padEnd(26)} ${r.why}`);
}

if (built.length) {
  const noPhotos = built.filter((r) => r.photos === 0);
  const stock = built.filter((r) => r.stock > 0);
  if (noPhotos.length) {
    console.log(`\n  ${noPhotos.length} have NO usable photos of their own: ${noPhotos.map((r) => r.slug).join(', ')}`);
    console.log('  Ask the owner for their photo folder on the call — it is a good opening.');
  }
  if (stock.length) {
    console.log(`\n  ${stock.length} are using stock library photos on their current site:`);
    for (const r of stock) console.log(`    ${r.slug} (${r.stock})`);
    console.log('  Those are excluded from the demo. Worth mentioning: their site shows');
    console.log('  somebody else\'s work, and yours would show theirs.');
  }
  console.log('\nEvery one of these still needs its reviews pasted in by hand.');
  console.log(`\nNext:  npm run build   then   npm run check\n`);
}

process.exit(failed.length ? 1 : 0);

/* ------------------------------------------------------------------ pieces */

function run(argv) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, argv, { cwd: ROOT, stdio: 'inherit' });
    child.on('close', resolve);
  });
}

/** Read back what `new` wrote, so the summary reflects reality not hopes. */
function summarise(slug) {
  try {
    const cfg = JSON.parse(readFileSync(join(CLIENTS_DIR, slug, 'config.json'), 'utf8'));
    const gaps = [];
    if (!cfg.business?.ownerName) gaps.push('owner name');
    if (!cfg.business?.baseSuburb) gaps.push('suburb');
    if (!cfg.copy?.headline) gaps.push('headline');
    if (!cfg.photos?.hero?.src) gaps.push('hero photo');
    if (!(cfg.serviceAreas ?? []).length) gaps.push('service areas');
    if (cfg.template === 'quote' && !(cfg.calculator?.jobs ?? []).length) gaps.push('prices');
    gaps.push('reviews');
    return {
      photos: (cfg.photos?.gallery ?? []).length + (cfg.photos?.hero ? 1 : 0),
      phone: Boolean(cfg.business?.phone?.e164),
      services: (cfg.services ?? []).length,
      stock: (cfg._source?.stockLookingPhotos ?? []).length,
      gaps,
    };
  } catch {
    return { photos: 0, phone: false, services: 0, stock: 0, gaps: ['everything'] };
  }
}

/** Minimal CSV: no quoted commas, because a slug and a URL never contain one. */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (!lines.length) return [];
  const first = lines[0].toLowerCase();
  const start = /(^|,)\s*slug\s*(,|$)/.test(first) ? 1 : 0;
  return lines.slice(start).map((line) => {
    const [slug, url, industry] = line.split(',').map((c) => c.trim());
    return { slug, url, industry };
  });
}
