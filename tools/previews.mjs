/**
 * previews — turn a client's reviewer screenshots into something committable.
 *
 *   node tools/previews.mjs <slug>
 *
 * The shots themselves are PNG at deviceScaleFactor 2: a 1440 fold is ~6 MB and
 * a full-page mobile shot ~10 MB and 38,814 pixels tall. Fourteen clients of
 * those is a quarter of a gigabyte of binaries git cannot delta, for files that
 * regenerate in seconds — so the shots directory is gitignored and this writes a
 * small webp set beside the config instead, which is what survives the container.
 *
 * Two kinds come out:
 *
 *   fold     the top of the page as a visitor first sees it, scaled to a sane
 *            width. This is the one to glance at.
 *   sheet    the WHOLE page as a contact sheet — sliced into vertical columns
 *            and laid side by side, so the entire layout is one image you can
 *            take in at once.
 *
 * The sheet exists because a full-page shot cannot simply be scaled down. WebP
 * stops at 16,383 pixels a side, and 38,814 tall only reaches that by dropping
 * to 300px wide, at which point nothing is legible. Cutting it into thirds keeps
 * the width and brings the height inside the limit.
 */
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const WEBP_MAX = 16383;
const GUTTER = 16;

const slug = process.argv[2];
if (!slug) { console.error('usage: node tools/previews.mjs <slug>'); process.exit(2); }

const dir = join('clients', slug, 'shots');
if (!existsSync(dir)) { console.log(`no shots for ${slug}`); process.exit(0); }

const { default: sharp } = await import('sharp');
const out = join('clients', slug, 'preview');
await mkdir(out, { recursive: true });

/** The top of the page, scaled to something readable. */
async function fold(src, dest) {
  const info = await sharp(src)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(dest);
  return info;
}

/**
 * The whole page, cut into columns and laid out left to right.
 *
 * Enough columns that each one clears WEBP_MAX, then one more if that still
 * leaves it tight. Every column is the same height so the sheet reads as a grid;
 * the last one is simply short and sits on transparent background.
 */
async function sheet(src, dest, targetWidth) {
  const meta = await sharp(src).metadata();
  const scale = Math.min(1, targetWidth / meta.width);
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);

  const scaled = await sharp(src).resize({ width: w }).png().toBuffer();

  const columns = Math.max(1, Math.ceil(h / WEBP_MAX) + (h > WEBP_MAX ? 1 : 0), Math.ceil(h / 6500));
  const colH = Math.ceil(h / columns);

  const parts = [];
  for (let i = 0; i < columns; i++) {
    const top = i * colH;
    const height = Math.min(colH, h - top);
    if (height <= 0) break;
    parts.push({
      input: await sharp(scaled).extract({ left: 0, top, width: w, height }).png().toBuffer(),
      left: i * (w + GUTTER),
      top: 0,
    });
  }

  const info = await sharp({
    create: {
      width: parts.length * w + (parts.length - 1) * GUTTER,
      height: colH,
      channels: 4,
      background: { r: 24, g: 23, b: 20, alpha: 1 },
    },
  }).composite(parts).webp({ quality: 74 }).toFile(dest);
  return { ...info, columns: parts.length };
}

let made = 0;
for (const file of (await readdir(dir)).sort()) {
  if (!/\.(png|jpe?g)$/i.test(file)) continue;
  const base = file.replace(/\.(png|jpe?g)$/i, '');
  const isFull = /full/i.test(base);
  const dest = join(out, `${base}.webp`);
  try {
    const info = isFull
      ? await sheet(join(dir, file), dest, /1440/.test(base) ? 900 : 390)
      : await fold(join(dir, file), dest);
    console.log(`  ${dest}  ${info.width}x${info.height}${info.columns ? ` (${info.columns} columns)` : ''}  ${(info.size / 1024).toFixed(0)}KB`);
    made++;
  } catch (err) {
    console.log(`  skipped ${file}: ${err.message}`);
  }
}
console.log(`${made} preview(s) for ${slug}`);
