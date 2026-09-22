/**
 * images — download a business's own photos and convert them to webp.
 *
 * Two widths, 800 and 1800. 800 covers a phone at 2x; 1800 covers a desktop
 * hero. Anything narrower than 800 to begin with is kept at its own width
 * rather than upscaled, because an upscaled photo looks worse than a small one.
 *
 * Small images are rejected outright: under 700px wide it is a thumbnail, a
 * badge or an icon, not a job photo, whatever the filename says.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const WIDTHS = [800, 1800];
const MIN_WIDTH = 700;
const MIN_PIXELS = 700 * 400;

/**
 * Fetch, filter and convert. Returns what landed on disk and what was rejected,
 * because the rejections are half of what Pat needs to see.
 */
export async function downloadPhotos(photos, outDir, { limit = 14, verbose = false } = {}) {
  await mkdir(outDir, { recursive: true });
  const kept = [];
  const skipped = [];

  for (const photo of photos) {
    if (kept.length >= limit) break;
    try {
      const res = await fetch(photo.url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) { skipped.push({ ...photo, why: `HTTP ${res.status}` }); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(buf).metadata();

      if (!meta.width || !meta.height) { skipped.push({ ...photo, why: 'not an image' }); continue; }
      if (meta.width < MIN_WIDTH || meta.width * meta.height < MIN_PIXELS) {
        skipped.push({ ...photo, why: `too small (${meta.width}x${meta.height})` });
        continue;
      }
      // A very wide, very short image is a banner or a divider, not a photo.
      if (meta.width / meta.height > 4) {
        skipped.push({ ...photo, why: `banner shape (${meta.width}x${meta.height})` });
        continue;
      }

      const name = safeName(photo.url, kept.length);
      const variants = [];
      for (const w of WIDTHS) {
        if (w > meta.width && w !== WIDTHS[0]) continue;    // never upscale
        const width = Math.min(w, meta.width);
        const out = join(outDir, `${name}-${width}.webp`);
        const resized = await sharp(buf).rotate().resize({ width, withoutEnlargement: true })
          .webp({ quality: 80, effort: 5 }).toBuffer();
        await writeFile(out, resized);
        const m = await sharp(resized).metadata();
        variants.push({ src: `assets/${name}-${width}.webp`, width: m.width, height: m.height });
      }
      if (!variants.length) { skipped.push({ ...photo, why: 'no variant produced' }); continue; }

      kept.push({
        name,
        alt: photo.alt || '',
        stock: photo.stock === true,
        source: photo.url,
        variants,
        src: variants[0].src,
        full: variants[variants.length - 1].src,
        width: variants[0].width,
        height: variants[0].height,
        srcset: variants.map((v) => `${v.src} ${v.width}w`).join(', '),
      });
      if (verbose) console.log(`    kept ${name} (${meta.width}x${meta.height}${photo.stock ? ', LOOKS LIKE STOCK' : ''})`);
    } catch (err) {
      skipped.push({ ...photo, why: err.message });
    }
  }

  return { kept, skipped };
}

/** Download one image as-is (a logo, where we want the original format). */
export async function downloadRaw(url, outDir, name) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = /\.svg(\?|$)/i.test(url) ? 'svg' : 'webp';
    await mkdir(outDir, { recursive: true });
    if (ext === 'svg') {
      await writeFile(join(outDir, `${name}.svg`), buf);
      return { src: `assets/${name}.svg` };
    }
    const meta = await sharp(buf).metadata();
    const out = await sharp(buf).webp({ quality: 88 }).toBuffer();
    await writeFile(join(outDir, `${name}.webp`), out);
    return { src: `assets/${name}.webp`, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

function safeName(url, index) {
  const base = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '')
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-?\d{3,4}x\d{3,4}$/, '')          // WordPress size suffixes
    .slice(0, 40);
  return base || `photo-${index + 1}`;
}
