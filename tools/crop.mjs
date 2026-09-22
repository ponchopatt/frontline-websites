import sharp from 'sharp';
const [a, b, out, h] = process.argv.slice(2);
const H = Number(h || 1100);
const [A, B] = await Promise.all([a, b].map((p) => sharp(p).extract({ left: 0, top: 0, width: 390, height: H }).toBuffer()));
await sharp({ create: { width: 796, height: H, channels: 3, background: '#222' } })
  .composite([{ input: A, left: 0, top: 0 }, { input: B, left: 406, top: 0 }])
  .png().toFile(out);
console.log('wrote', out);
