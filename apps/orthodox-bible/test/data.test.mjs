import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";

const data = (p) => JSON.parse(readFileSync(new URL("../public/data/" + p, import.meta.url), "utf8"));
const books = Object.fromEntries(data("books.json").books.map((b) => [b.code, b]));

test("every reading in every plan points to a chapter that exists", () => {
  for (const p of data("plans.json").plans) {
    assert.ok(p.days.length, p.id);
    for (const d of p.days) for (const it of d.items) {
      if (!it.read) continue;
      const m = it.read.match(/^(\w+) (\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/);
      assert.ok(m, `${p.id}: bad reference ${it.read}`);
      const b = books[m[1]];
      assert.ok(b, `${p.id}: no book ${m[1]}`);
      const max = it.n === "lxx" ? b.ch_lxx : Math.max(b.ch_web || 0, b.ch_lxx || 0);
      assert.ok(+m[2] <= max, `${p.id}: ${it.read} is past the last chapter`);
    }
  }
});

test("every Father reading and work links to New Advent", () => {
  for (const p of data("plans.json").plans) for (const d of p.days) for (const it of d.items)
    if (it.father) assert.match(it.u, /^https:\/\/www\.newadvent\.org\/fathers\/\d+\.htm$/, `${p.id}: ${it.father}`);
  for (const a of data("library.json")) for (const w of a.works) assert.match(w.u, /^https:\/\/www\.newadvent\.org\/fathers\/\d+\.htm$/);
});

test("the Fathers' words are filed by English chapter, and every author is labelled", () => {
  const authors = data("fathers/authors.json");
  const counts = data("fathers/counts.json");
  for (const [code, chs] of Object.entries(counts)) {
    assert.ok(books[code], code);
    for (const ch of Object.keys(chs)) assert.ok(existsSync(new URL(`../public/data/fathers/${code}/${ch}.json`, import.meta.url)));
  }
  const john3 = data("fathers/JHN/3.json");
  assert.ok(john3.some((e) => e.a === "john-chrysostom" && e.v[0] <= 16 && 16 <= e.v[1]), "Chrysostom on John 3:16");
  for (const e of john3) assert.ok(["saint", "blessed", "western", "writer", "document"].includes(authors[e.a].label));
});

test("Septuagint Psalm 50 is English Psalm 51, with its two title verses", () => {
  const map = data("map.json");
  assert.deepEqual(map.PSA["50"].slice(0, 3), [[51, 0], [51, 0], [51, 1]]);
  assert.deepEqual(map.PSA["22"][0], [23, 1]);
  assert.equal(map.PSA["113"].at(-1)[0], 115);
  assert.equal(map.JER["33"], 26);
});

test("every struggle has Scripture, the Fathers, a 7-day plan, and a safety note for despair", () => {
  const plans = new Set(data("plans.json").plans.map((p) => p.id));
  const authors = data("fathers/authors.json");
  for (const t of data("help/index.json")) {
    const h = data(`help/${t.id}.json`);
    assert.ok(h.verses.length >= 5, t.id);
    assert.ok(h.quotes.length >= 15, `${t.id}: only ${h.quotes.length} passages`);
    for (const q of h.quotes) assert.ok(["saint", "blessed", "western"].includes(authors[q.a].label), `${t.id}: ${q.a}`);
    assert.ok(plans.has(h.plan), `${t.id}: no plan`);
    for (const p of h.plans) assert.ok(plans.has(p), `${t.id}: no plan ${p}`);
  }
  assert.match(data("help/despair.json").safety, /13 11 14/);
});

test("the Greek lines up verse for verse with Brenton and the WEB", () => {
  for (const [code, other] of [["GEN", "lxx"], ["PSA", "lxx"], ["JHN", "web"], ["ROM", "web"]]) {
    const g = data(`bible/grc/${code}.json`), e = data(`bible/${other}/${code}.json`);
    assert.equal(g.length, e.length, code);
    assert.deepEqual(g[0][1].map((x) => x[0]), e[0][1].map((x) => x[0]), code);
  }
  const lex = data("lex/3.json");
  assert.equal(lex["3056"][0].normalize("NFC"), "λόγος".normalize("NFC"));
  assert.match(data("bible/grc/JHN.json")[0][1][0][1], /Λόγος@3056/);
});
