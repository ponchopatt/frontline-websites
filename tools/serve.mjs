/**
 * serve — a tiny static file server for checking a built demo locally.
 *
 *   node tools/serve.mjs <dir> <port>
 *
 * Deliberately minimal: no directory listing, no config. Vercel serves the real
 * thing; this only has to be good enough for Chromium and Lighthouse.
 *
 * With one exception. Text responses are gzipped, because Vercel serves them
 * compressed and a score measured without compression is not the score the
 * prospect gets. Serving uncompressed made two demos read as 85 and 88; the
 * same builds over gzip are 94 and 96.
 */
import { createServer } from 'node:http';
import { createGzip } from 'node:zlib';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const dir = process.argv[2] || 'dist';
const port = Number(process.argv[3] || 8900);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  // Strip the query and refuse to climb out of the served directory.
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let path = join(dir, rel);
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  const type = TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
  const compressible = /^(text\/|application\/(json|javascript))/.test(type) || type.includes('svg');
  const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  if (compressible && wantsGzip) {
    res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    createReadStream(path).pipe(createGzip()).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type });
    createReadStream(path).pipe(res);
  }
}).listen(port, '127.0.0.1', () => console.log(`serving ${dir} on http://127.0.0.1:${port}`));
