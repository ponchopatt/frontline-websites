/*
  Film List on a computer, with no Supabase: the page from public/ and /api/film on a JSON file.

    FILM_LOCAL_STORE=/tmp/film.json FILM_TOKEN_SECRET=dev FILM_TEAM_PIN=1111 FILM_ADMIN_PIN=222222 \
      FILM_REMINDER_KEY=dev node film/dev-server.mjs

  Then open http://localhost:8790/film/. The PINs here are for this computer only.
*/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.FILM_LOCAL_STORE) throw new Error("Set FILM_LOCAL_STORE to a JSON file path");
const { GET, POST } = await import("../api/film.js");

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const port = Number(process.env.PORT || 8790);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:" + port);
  if (url.pathname === "/api/film") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: req.method === "POST" ? Buffer.concat(chunks) : undefined });
    const out = await (req.method === "POST" ? POST : GET)(request);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  let file = path.join(pub, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ""));
  if (file.endsWith(path.sep) || url.pathname.endsWith("/")) file = path.join(file, "index.html");
  if (!file.startsWith(pub) || !fs.existsSync(file)) { res.writeHead(404); res.end("Not found"); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log("Film List on http://localhost:" + port + "/film/"));
