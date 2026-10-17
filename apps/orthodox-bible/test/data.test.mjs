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
  for (const { id } of data("plans.json").plans) for (const d of data(`plans/${id}.json`).days) for (const it of d.items)
    if (it.father) assert.match(it.u, /^https:\/\/www\.newadvent\.org\/fathers\/\d+\.htm$/, `${id}: ${it.father}`);
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

test("similar verses point to real books, best first", () => {
  const x = data("xref/JHN.json");
  assert.ok(x["3.16"].includes("ROM 5:8"));
  for (const r of x["3.16"]) assert.ok(books[r.split(" ")[0]], r);
  assert.ok(data("xref/DAG.json"), "Daniel filed under DAG");
});

test("the small files for a fast start match the full ones", () => {
  const list = data("plans.json").plans;
  for (const p of list) {
    const full = data(`plans/${p.id}.json`);
    assert.equal(full.days.length, p.days.length, p.id);
    p.days.forEach((d, i) => assert.equal(d.title, full.days[i].title, `${p.id} day ${i + 1}`));
  }
  const idx = data("fathers/idx/JHN.json"), full = data("fathers/JHN/3.json");
  assert.equal(idx[3].length, full.length);
  assert.deepEqual(idx[3][0].slice(0, 2), full[0].v);
  for (const v of data("votd.json")) assert.ok((v.lxx || v.web)[4].length > 10, v.r);
  const psalm = data("votd.json").find((v) => v.r === "PSA 51:10");
  assert.equal(psalm.lxx[1], 50, "Psalm 51 is Psalm 50 in the Septuagint");
});

test("the search files hold every verse of each Bible", () => {
  for (const tr of ["lxx", "web"]) {
    const lines = readFileSync(new URL(`../public/data/search/${tr}.txt`, import.meta.url), "utf8").trim().split("\n");
    let n = 0;
    for (const b of Object.values(books)) if (b["ch_" + tr]) for (const [, vs] of data(`bible/${tr}/${b.code}.json`)) n += vs.length;
    assert.equal(lines.length, n, tr);
    assert.match(lines.find((l) => l.startsWith("JHN\t3\t16\t")), /God so loved the world/);
  }
});

test("every question about the faith has an answer, real verses and the Fathers", () => {
  const plans = new Set(data("plans.json").plans.map((p) => p.id));
  const authors = data("fathers/authors.json");
  const index = data("faith/index.json");
  assert.ok(index.length >= 90);
  assert.equal(new Set(index.map((t) => t.id)).size, index.length, "question ids are unique");
  for (const t of index) {
    const f = data(`faith/${t.id}.json`);
    assert.ok(f.about.length > 150, `${t.id}: answer too short`);
    assert.ok(f.verses.length >= 4, t.id);
    for (const ref of f.verses) {
      const m = ref.match(/^(\w+) (\d+):(\d+)(?:-(\d+))?$/);
      assert.ok(m, `${t.id}: bad reference ${ref}`);
      const book = data(`bible/web/${m[1]}.json`), ch = book.find((c) => c[0] === +m[2]);
      assert.ok(ch && ch[1].some(([v]) => v === +m[3]), `${t.id}: ${ref} isn't in the Bible`);
    }
    assert.ok(t.cat, `${t.id}: no section`);
    if (f.quotes.length) assert.ok(f.quotes.length >= 10, `${t.id}: only ${f.quotes.length} passages`);
    for (const q of f.quotes) assert.ok(["saint", "blessed", "western"].includes(authors[q.a].label), `${t.id}: ${q.a}`);
    for (const p of f.plans) assert.ok(plans.has(p), `${t.id}: no plan ${p}`);
    if (f.link) assert.match(f.link[0], /^#\/[a-z]+(\/[a-z-]+)?$/, t.id);
    if (f.link && f.link[0].startsWith("#/faith/")) assert.ok(index.some((x) => `#/faith/${x.id}` === f.link[0]), `${t.id}: links to a missing question`);
  }
});
