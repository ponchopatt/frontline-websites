// Run the app on this computer: node dev.mjs  ->  http://localhost:8790
// Serves public/ (compressed, as Vercel does) and answers /api/day and /api/month.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import day from "./api/day.js";
import month from "./api/month.js";
const root = path.join(path.dirname(new URL(import.meta.url).pathname), "public");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8" };
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const handler = { "/api/day": day, "/api/month": month }[url.pathname];
  if (handler) {
    const r = { query: Object.fromEntries(url.searchParams) };
    const out = { status(c) { res.statusCode = c; return out; }, setHeader: (k, v) => res.setHeader(k, v), json(o) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); } };
    return handler(r, out);
  }
  const file = path.join(root, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.statusCode = 404; return res.end("not found"); }
  const type = types[path.extname(file)] || "application/octet-stream";
  res.setHeader("Content-Type", type);
  if (/text|json|javascript|svg/.test(type) && /gzip/.test(req.headers["accept-encoding"] || "")) {
    res.setHeader("Content-Encoding", "gzip");
    return fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
  }
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 8790, () => console.log("http://localhost:" + (process.env.PORT || 8790)));
