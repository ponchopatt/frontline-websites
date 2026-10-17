import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// The Pascha sum from app.js, run on its own.
const src = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const body = src.match(/function pascha\(y\) \{[\s\S]*?\n\}/)[0];
const pascha = new Function("ymd", `${body}; return pascha;`)((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);

test("Orthodox Pascha falls on the right Sunday", () => {
  const known = { 2024: "2024-05-05", 2025: "2025-04-20", 2026: "2026-04-12", 2027: "2027-05-02", 2028: "2028-04-16", 2030: "2030-04-28" };
  for (const [y, d] of Object.entries(known)) assert.equal(pascha(+y), d, y);
  for (let y = 2000; y < 2100; y++) assert.equal(new Date(pascha(y) + "T12:00:00").getDay(), 0, `${y} is a Sunday`);
});
