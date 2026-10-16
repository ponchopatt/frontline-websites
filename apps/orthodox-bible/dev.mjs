// Run the app on this computer: node dev.mjs  ->  http://localhost:8790
// Serves public/ and answers /api/day and /api/month the way Vercel does.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import day from "./api/day.js";
import month from "./api/month.js";
const root = path.join(path.dirname(new URL(import.meta.url).pathname), "public");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
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
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 8790, () => console.log("http://localhost:" + (process.env.PORT || 8790)));
