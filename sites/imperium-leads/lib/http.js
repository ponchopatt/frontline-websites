import { timingSafeEqual } from "node:crypto";

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
}

/** Compares two secrets without leaking how much of one matched. */
export function sameSecret(given, expected) {
  if (!given || !expected) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** JSON whether it arrives as application/json or as text/plain (a browser's simple request). */
export async function readJson(request) {
  const text = await request.text();
  if (text.length > 20000) throw new Error("too big");
  return text ? JSON.parse(text) : {};
}
