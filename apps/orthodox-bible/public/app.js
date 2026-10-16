/* Orthodox Bible: the Septuagint and New Testament with the Church Fathers, the day's readings
   from the Church calendar, plans, prayers and the Jesus Prayer. One page, no accounts:
   everything a person saves stays on their own phone. */
(() => {
"use strict";

// ---------------------------------------------------------------- saved on this phone
const KEY = "ob1";
const blank = () => ({ settings: { tr: "lxx", cal: "new", size: 19, theme: "dark", writers: true, voice: "" },
  name: "", last: { b: "JHN", c: 1 }, hl: {}, hlAt: {}, bm: {}, notes: {}, noteAt: {}, plans: {}, saved: {}, read: {}, days: [],
  best: 0, rope: {}, ropeSize: 100, liked: {}, earned: {} });
let S;
try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = blank(); }
S.settings = Object.assign(blank().settings, S.settings);
if (S.settings.theme === "auto") S.settings.theme = "dark";
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: works for this visit */ } }

// ---------------------------------------------------------------- helpers
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const view = $("#view");
const I = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
const ICON = {
  book: I('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>'),
  father: I('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>'),
  out: I('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  check: I('<path d="M5 12l5 5 9-10"/>'),
  search: I('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  aa: I('<path d="M3 18l5-12 5 12M5 14h6M15 18l3.5-8 3.5 8M16 16h5"/>'),
  note: I('<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4"/>'),
  heart: I('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  share: I('<path d="M12 4v11M7 9l5-5 5 5M5 14v5h14v-5"/>'),
  image: I('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="M20 15l-5-5-9 9"/>'),
  pen: I('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  flame: I('<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1 2.5 2 3 0-3 0-5.5.5-8z"/>'),
  play: I('<path d="M8 5l11 7-11 7z"/>'),
  pause: I('<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>'),
  speaker: I('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>'),
  left: I('<path d="M15 5l-7 7 7 7"/>'),
  right: I('<path d="M9 5l7 7-7 7"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  gear: I('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  pray: I('<path d="M12 3v6M9 21l1-6-3-4 3-2h4l3 2-3 4 1 6"/>'),
  beads: I('<circle cx="12" cy="5" r="2"/><circle cx="17.5" cy="8" r="2"/><circle cx="17.5" cy="15" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="6.5" cy="15" r="2"/><circle cx="6.5" cy="8" r="2"/>'),
  cross: I('<path d="M12 3v18M9 6h6M7 10h10M9.5 17l5 2"/>'),
  dome: I('<path d="M4 20h16M6 20v-7a6 6 0 0 1 12 0v7M12 4v3M10.5 5.5h3"/>'),
  bookmark: I('<path d="M7 4h10v16l-5-4-5 4z"/>'),
};
const MOTIF = {
  cross: '<path d="M12 1v22M8 4.5h8M5 9h14M8.5 18l7 2.5"/>',
  halo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/>',
  dome: '<path d="M2 22h20M5 22V13a7 7 0 0 1 14 0v9M12 2v4M10 4h4"/>',
  wave: '<path d="M0 8c3-3 6-3 9 0s6 3 9 0 6-3 9 0M0 14c3-3 6-3 9 0s6 3 9 0 6-3 9 0M0 20c3-3 6-3 9 0s6 3 9 0 6-3 9 0"/>',
  book: '<path d="M2 5c4-2 7-2 10 0v16c-3-2-6-2-10 0zM22 5c-4-2-7-2-10 0v16c3-2 6-2 10 0z"/>',
  dove: '<path d="M3 14c4 0 6-3 9-3s6 3 9 2c-2 3-5 5-9 5-3 0-6-2-9-4zM12 11c0-3 2-6 6-7-1 3-2 5-6 7z"/>',
  star: '<path d="M12 2l2.5 7H22l-6 4.5 2.3 7L12 16l-6.3 4.5 2.3-7L2 9h7.5z"/>',
  flame: '<path d="M12 1c1.5 4 7 7 7 13a7 7 0 0 1-14 0c0-3.5 2-5.5 3.5-7 .4 2.2 1.4 3.5 2.8 4.2C11.3 7 11.3 4 12 1z"/>',
};
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200); }
function applyTheme() {
  document.documentElement.setAttribute("data-theme", S.settings.theme);
  document.documentElement.style.setProperty("--size", S.settings.size + "px");
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", S.settings.theme === "light" ? "#f6f5f2" : "#121212");
}
applyTheme();
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
const longDate = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const dayOfYear = () => { const n = new Date(); return Math.floor((n - new Date(n.getFullYear(), 0, 0)) / 864e5); };
const ago = (t) => { const s = (Date.now() - t) / 1000; if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m"; if (s < 86400) return Math.round(s / 3600) + "h"; if (s < 86400 * 7) return Math.round(s / 86400) + "d"; return Math.round(s / 86400 / 7) + "w"; };

// ---------------------------------------------------------------- data
const cache = new Map();
async function get(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch("data/" + path).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  cache.set(path, p); p.catch(() => cache.delete(path));
  return p;
}
const getOr = (path, fallback) => get(path).catch(() => fallback);
let BOOKS = [], BY = {}, SECTIONS = {}, MAP = null, AUTH = {};
async function boot() {
  const [b, m, a] = await Promise.all([get("books.json"), get("map.json"), get("fathers/authors.json")]);
  BOOKS = b.books; SECTIONS = b.sections; MAP = m; AUTH = a;
  BOOKS.forEach((x) => (BY[x.code] = x));
  buildPsalmIndex();
}
const plans = () => get("plans.json");
const lib = () => get("library.json");
const prayers = () => get("prayers.json");
const tr = () => S.settings.tr;
const trName = (t = tr()) => (t === "lxx" ? "LXX" : "WEB");
const chapters = (code, t = tr()) => BY[code]?.["ch_" + t] || 0;
const bookName = (code, t = tr()) => { const b = BY[code]; if (!b) return code; return t === "lxx" && b.lxx && b.ot ? b.lxx : b.name; };
const inTr = (code, t = tr()) => chapters(code, t) > 0;

// ---------------------------------------------------------------- Septuagint <-> English numbering
// The Fathers' words, notes and plans use English (Hebrew) numbers; the Septuagint numbers Psalms,
// Jeremiah's later chapters and Daniel 3 differently, so the reader converts both ways.
let PSI = {};
function buildPsalmIndex() {
  PSI = {};
  Object.entries(MAP.PSA).forEach(([lc, rows]) => rows.forEach(([ec, ev], i) => { if (ev) PSI[ec + ":" + ev] = PSI[ec + ":" + ev] || [Number(lc), i]; }));
}
const JER_BACK = () => { const o = {}; Object.entries(MAP.JER).forEach(([l, e]) => { if (!(e in o)) o[e] = Number(l); }); return o; };
function toEng(code, c, v, verseIndex) {
  if (code === "PSA" && tr() === "lxx") { const row = MAP.PSA[c]; return row && row[verseIndex] ? row[verseIndex] : [c, v]; }
  if (code === "JER" && tr() === "lxx") return [MAP.JER[c] || c, v];
  if (code === "DAG" && c === 3 && v >= 91) return [3, v - 67];
  return [c, v];
}
// [code, chapter, verse, verseIndex|undefined] in the reader's numbering, for an English reference.
function fromEng(code, c, v) {
  if (code === "DAN") code = "DAG";
  if (code === "EST") code = "ESG";
  if (code === "PSA" && tr() === "lxx") {
    const hit = PSI[c + ":" + v];
    if (hit) return [code, hit[0], null, hit[1]];
    return [code, c > 9 && c < 148 ? c - 1 : c, v];
  }
  if (code === "JER" && tr() === "lxx") return [code, JER_BACK()[c] || c, v];
  if (code === "DAG" && c === 3 && v >= 24 && v <= 30) return [code, 3, v + 67];
  return [code, c, v];
}
const psalmLabel = (c) => { if (tr() !== "lxx") return `Psalm ${c}`; const row = MAP.PSA[c]; const e = row ? [...new Set(row.map((x) => x[0]))] : []; return e.length && (e.length > 1 || e[0] !== c) ? `Psalm ${c} (${e.join("–")})` : `Psalm ${c}`; };
const chapLabel = (code, c) => (code === "PSA" ? psalmLabel(c) : `${bookName(code)} ${c}`);
const shortChap = (code, c) => (code === "PSA" ? `Psalm ${c}` : `${bookName(code)} ${c}`);
// The text of an English-numbered verse in the current Bible: {code, c, v, i, text}
async function verseText(code, c, v) {
  const [b, ch, vv, idx] = fromEng(code, c, v);
  const book = await get(`bible/${tr()}/${b}.json`);
  const chap = book.find((x) => x[0] === ch); if (!chap) return null;
  const i = idx != null ? idx : chap[1].findIndex((x) => x[0] === vv);
  if (i < 0 || !chap[1][i]) return null;
  return { code: b, c: ch, v: chap[1][i][0], i, text: chap[1][i][1] };
}

// ---------------------------------------------------------------- references
const ALIAS = {};
function aliases() {
  if (Object.keys(ALIAS).length) return ALIAS;
  const extra = { GEN: "gn ge", EXO: "ex exod", LEV: "lv lev", NUM: "nm nu num", DEU: "dt deut", JOS: "josh jos", JDG: "judg jdg jg", RUT: "ru rth",
    "1SA": "1sam 1sm 1kingdoms 1kgdms", "2SA": "2sam 2sm 2kingdoms 2kgdms", "1KI": "1kgs 1kg 3kingdoms 3kgdms", "2KI": "2kgs 2kg 4kingdoms 4kgdms",
    "1CH": "1chr 1ch", "2CH": "2chr 2ch", EZR: "ezra ezr 2esdras", NEH: "neh ne", TOB: "tob tb", JDT: "jdt jud judith", ESG: "esth est esther",
    PSA: "ps psa pss psalm psalms", PRO: "prov pr prv", ECC: "eccl ecc qoh", SNG: "song sos canticles", WIS: "wis ws", SIR: "sir ecclus",
    ISA: "isa is esaias", JER: "jer jr jeremias", LAM: "lam la", EZK: "ezek ezk eze", DAG: "dan dn da daniel", HOS: "hos ho osee", JOL: "joel jl",
    AMO: "amos am", OBA: "obad ob", JON: "jonah jon jnh", MIC: "mic mi", NAM: "nah na", HAB: "hab hb", ZEP: "zeph zep", HAG: "hag hg", ZEC: "zech zec",
    MAL: "mal ml", BAR: "bar", "1MA": "1macc 1mac", "2MA": "2macc 2mac", "3MA": "3macc 3mac", "4MA": "4macc 4mac", "1ES": "1esd 1esdras",
    MAT: "mt matt mat", MRK: "mk mar mrk", LUK: "lk luk lu", JHN: "jn jhn joh", ACT: "ac acts", ROM: "rom ro rm", "1CO": "1cor 1co", "2CO": "2cor 2co",
    GAL: "gal ga", EPH: "eph", PHP: "phil php", COL: "col", "1TH": "1thess 1th", "2TH": "2thess 2th", "1TI": "1tim 1ti", "2TI": "2tim 2ti",
    TIT: "tit ti", PHM: "phlm phm philem", HEB: "heb", JAS: "jas jm", "1PE": "1pet 1pe 1pt", "2PE": "2pet 2pe 2pt", "1JN": "1jn 1jo 1john",
    "2JN": "2jn 2jo 2john", "3JN": "3jn 3jo 3john", JUD: "jude jud", REV: "rev re apoc apocalypse" };
  BOOKS.forEach((b) => {
    const add = (s) => { s = s.toLowerCase().replace(/[^a-z0-9]/g, ""); if (s) ALIAS[s] = ALIAS[s] || b.code; };
    add(b.name); if (b.lxx) add(b.lxx); add(b.code); (extra[b.code] || "").split(" ").forEach(add);
  });
  return ALIAS;
}
function parseRef(q) {
  const m = q.trim().toLowerCase().match(/^([1-4]?\s*[a-z][a-z .]*?)\s*(\d+)(?:\s*[:.\s]\s*(\d+)(?:\s*-\s*(\d+))?)?$/);
  if (!m) return null;
  const code = aliases()[m[1].replace(/[^a-z0-9]/g, "")];
  return code ? { code, c: Number(m[2]), v: m[3] ? Number(m[3]) : 0, to: m[4] ? Number(m[4]) : 0 } : null;
}
function planRef(s) {
  const m = s.match(/^(\w+) (\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/);
  if (!m) return null;
  const [, code, c, v, a, b] = m;
  if (!v) return { code, c: +c, v: 0, c2: a ? +a : +c, v2: 0 };
  return { code, c: +c, v: +v, c2: b ? +a : +c, v2: b ? +b : a ? +a : +v };
}
function refText(r) {
  const name = r.code === "PSA" ? (r.c2 !== r.c ? "Psalms" : "Psalm") : BY[r.code] ? BY[r.code].name : r.code;
  if (!r.v) return `${name} ${r.c}${r.c2 !== r.c ? "–" + r.c2 : ""}`;
  return `${name} ${r.c}:${r.v}${r.c2 !== r.c ? `–${r.c2}:${r.v2}` : r.v2 !== r.v ? "–" + r.v2 : ""}`;
}
const readHash = (r, extra = {}) => {
  const [code, c, v, idx] = fromEng(r.code, r.c, r.v || 1);
  const end = r.v2 ? fromEng(r.code, r.c2, r.v2) : null;
  const p = new URLSearchParams();
  if (r.v) { if (idx != null) p.set("i", idx); else p.set("v", v); }
  if (end && end[1] === c) { if (end[3] != null) p.set("ti", end[3]); else p.set("to", end[2]); }
  Object.entries(extra).forEach(([k, x]) => p.set(k, x));
  return `#/read/${code}/${c}${p.toString() ? "?" + p : ""}`;
};

// ---------------------------------------------------------------- the Fathers
async function fathersFor(code, engChapters) {
  const lists = await Promise.all([...new Set(engChapters)].map((c) => getOr(`fathers/${code}/${c}.json`, []).then((l) => l.map((e) => ({ ...e, ch: c })))));
  return lists.flat().filter((e) => S.settings.writers || !["writer", "document"].includes(AUTH[e.a]?.label));
}
const covers = (e, c, v) => e.ch === c && e.v[0] <= v && v <= e.v[1];
const authorName = (id) => AUTH[id]?.name || id;
const LABEL = { saint: "Saint", blessed: "Blessed", western: "Western saint", writer: "Not a saint", document: "Early writing" };
function fatherHTML(e, i) {
  const a = AUTH[e.a] || { name: e.a, label: "writer", about: "" };
  const long = e.q.length > 700;
  const shown = long ? e.q.slice(0, e.q.lastIndexOf(" ", 650)) + "…" : e.q;
  return `<div class="father"><div class="who"><b>${esc(a.name)}</b><span class="chip ${a.label}" title="${esc(a.about)}">${esc(LABEL[a.label] || "")}</span></div>
    <div class="work">${esc(e.t)}${e.v[1] !== e.v[0] ? ` · verses ${e.v[0]}${e.v[1] === 999 ? "+" : "–" + e.v[1]}` : ""}</div>
    <blockquote>${esc(shown)}</blockquote>
    <div>${long ? `<button class="ghost" data-more="${i}">Read all</button>` : ""}${e.u ? `<a class="ghost" href="${esc(e.u)}" target="_blank" rel="noopener">Source ${ICON.out}</a>` : ""}</div></div>`;
}
function fathersList(box, entries) {
  const people = [...new Set(entries.map((e) => e.a))].sort((x, y) => (AUTH[x]?.rank || 9) - (AUTH[y]?.rank || 9));
  let pick = "";
  const draw = () => {
    const list = entries.filter((e) => !pick || e.a === pick).sort((x, y) => (AUTH[x.a]?.rank || 9) - (AUTH[y.a]?.rank || 9));
    box.innerHTML = (people.length > 1 ? `<div class="filters"><button aria-pressed="${!pick}" data-p="">All ${entries.length}</button>${people.map((p) => `<button aria-pressed="${pick === p}" data-p="${esc(p)}">${esc(authorName(p).replace(/^(St|Blessed) /, ""))}</button>`).join("")}</div>` : "") +
      list.map((e) => fatherHTML(e, entries.indexOf(e))).join("");
    box.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { pick = b.dataset.p; draw(); }));
    box.querySelectorAll("[data-more]").forEach((b) => (b.onclick = () => { b.closest(".father").querySelector("blockquote").textContent = entries[+b.dataset.more].q; b.remove(); }));
  };
  draw();
}

// ---------------------------------------------------------------- sheets
function openSheet(html, onOpen, full = false) {
  $("#sheet").classList.toggle("full", full);
  $("#sheetBody").innerHTML = html; $("#sheet").hidden = false; $(".sheet-in").scrollTop = 0;
  $("#sheetBody").querySelectorAll("[data-x]").forEach((b) => (b.onclick = closeSheet));
  if (onOpen) onOpen($("#sheetBody"));
}
function closeSheet() { $("#sheet").hidden = true; $("#sheetBody").innerHTML = ""; document.querySelectorAll(".verse.sel").forEach((v) => v.classList.remove("sel")); }
$("#sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") closeSheet(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
const closeBtn = `<button class="iconbtn round" data-x aria-label="Close">${ICON.x}</button>`;

// ---------------------------------------------------------------- reading days, streaks, badges
function markRead(key) {
  const t = today();
  S.read[t] = S.read[t] || [];
  if (!S.read[t].includes(key)) S.read[t].push(key);
  if (!S.days.includes(t)) S.days.push(t);
  S.best = Math.max(S.best || 0, streak());
  save(); checkBadges();
}
function streak() {
  const set = new Set(S.days); let n = 0, d = today();
  if (!set.has(d)) d = addDays(d, -1);
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
const daysThisYear = () => S.days.filter((d) => d.startsWith(String(new Date().getFullYear()))).length;
const planDone = (id) => !!S.plans[id]?.finished;
const ropeTotal = () => Object.values(S.rope).reduce((a, b) => a + b, 0);
const BADGES = [
  { id: "first", name: "First Steps", sub: "Read for the first time", color: "#6b8f5e", icon: "book", got: () => S.days.length >= 1 },
  { id: "week", name: "A Week", sub: "7 days in a row", color: "#e5484d", icon: "flame", got: () => (S.best || 0) >= 7 },
  { id: "forty", name: "Forty Days", sub: "40 days in a row", color: "#b5532e", icon: "flame", got: () => (S.best || 0) >= 40 },
  { id: "psalter", name: "Psalter", sub: "All 20 kathismata", color: "#2f4a5c", icon: "beads", got: () => planDone("psalter") },
  { id: "gospels", name: "Evangelist", sub: "The Four Gospels", color: "#6b8f5e", icon: "book", got: () => planDone("gospels") },
  { id: "councils", name: "Seven Councils", sub: "All seven councils", color: "#8a6a2f", icon: "dome", got: () => planDone("councils") || ["nicaea1", "constantinople1", "ephesus", "chalcedon", "constantinople2", "constantinople3", "nicaea2"].every(planDone) },
  { id: "fathers", name: "Friend of the Fathers", sub: "Meet the Fathers", color: "#4a3f35", icon: "father", got: () => planDone("meet-fathers") },
  { id: "creed", name: "I Believe", sub: "The Creed in 12 days", color: "#1f3b4d", icon: "cross", got: () => planDone("creed") },
  { id: "rope", name: "Prayer Rope", sub: "1,000 Jesus Prayers", color: "#7b4fa0", icon: "beads", got: () => ropeTotal() >= 1000 },
  { id: "notes", name: "Scribe", sub: "10 notes", color: "#a8742c", icon: "pen", got: () => Object.keys(S.notes).length >= 10 },
];
function badgeHTML(b) {
  return `<div class="badge ${b.got() ? "" : "locked"}" data-badge="${b.id}"><div class="disc" style="background:${b.color};color:#fff">${ICON[b.icon]}</div><div class="bn">${esc(b.name)}</div><div class="bs">${esc(b.sub)}</div></div>`;
}
function checkBadges() {
  S.earned = S.earned || {};
  BADGES.forEach((b) => { if (b.got() && !S.earned[b.id]) { S.earned[b.id] = Date.now(); save(); setTimeout(() => toast(`New badge: ${b.name}`), 700); } });
}

// ---------------------------------------------------------------- art
function coverHTML(c, cls = "") {
  if (!c) return "";
  return `<div class="cover ${cls} ${c.style === "serif" ? "serif-c" : ""}" style="background:${c.bg}"><svg class="motif" viewBox="0 0 24 24">${MOTIF[c.motif] || ""}</svg><div class="ct">${esc(c.t)}</div><div class="cs">${esc(c.s)}</div></div>`;
}
const PALETTE = ["#6b8f5e", "#2f4a5c", "#7a2d3a", "#8a6a2f", "#3c3a5c", "#5c3a2e", "#2e5c58", "#6a2f4f"];
function monogram(name, i, size = 72) {
  const w = name.replace(/^(St|Blessed|The) /, "").split(" ");
  const letters = w[0][0] + (w[1] && !/^(of|the)$/.test(w[1]) ? w[1][0] : "");
  return `<div class="monogram" style="background:${PALETTE[i % PALETTE.length]};width:${size}px;height:${size}px;font-size:${Math.round(size / 3)}px${size < 60 ? ";margin:0;flex:0 0 " + size + "px" : ""}">${esc(letters)}</div>`;
}
const thumbArt = (bg, motif, inner = "") => `<div class="thumb" style="background:${bg}"><svg class="motif" viewBox="0 0 24 24" style="position:absolute;inset:-10%;width:120%;height:120%;opacity:.2;stroke:#fff">${MOTIF[motif] || ""}</svg>${inner}</div>`;

// ---------------------------------------------------------------- top bar
function setTop(title, { back = false, acts = "", left = "", hide = false } = {}) {
  $("#top").hidden = hide;
  $("#title").innerHTML = left || esc(title);
  $("#back").hidden = !back;
  $("#topActs").innerHTML = acts;
  document.title = title ? `${title} · Orthodox Bible` : "Orthodox Bible";
}
$("#back").onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/today"));

// ---------------------------------------------------------------- Home
async function dayData(date) {
  const k = `day:${S.settings.cal}:${date}`;
  try {
    const r = await fetch(`api/day?date=${date}&cal=${S.settings.cal}`);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    try { localStorage.setItem(k, JSON.stringify(d)); } catch (e) { /* full */ }
    return d;
  } catch (e) { try { return JSON.parse(localStorage.getItem(k)); } catch (e2) { return null; } }
}
function readingRanges(verses) {
  const out = [];
  verses.forEach(([b, c, v]) => {
    const last = out[out.length - 1];
    if (last && last.code === b && last.c2 === c && last.v2 === v - 1) last.v2 = v;
    else if (last && last.code === b && last.c2 === c - 1 && v === 1) { last.c2 = c; last.v2 = v; }
    else out.push({ code: b, c, v, c2: c, v2: v });
  });
  return out;
}
const wholeReading = (ranges) => { const a = ranges[0], z = ranges[ranges.length - 1]; return a.code === z.code && a.c === z.c2 ? { ...a, c2: z.c2, v2: z.v2 } : a; };
// Verse of the day: one of these, by day of the year (English numbering).
const VOTD = ["JHN 3:16", "PHP 4:13", "ROM 8:28", "MAT 11:28", "PSA 23:1", "ISA 40:31", "JHN 14:6", "MAT 5:8", "PSA 51:10", "JHN 1:14", "1JN 4:8", "LUK 18:13",
  "PRO 3:5", "2CO 5:17", "GAL 2:20", "ROM 12:2", "MAT 6:33", "JHN 15:5", "HEB 11:1", "JAS 1:5", "1PE 5:7", "PSA 46:10", "ISA 9:6", "MAT 5:14", "JHN 11:25",
  "ROM 5:8", "EPH 2:8", "COL 3:12", "1CO 13:4", "1CO 13:13", "PSA 119:105", "MAT 22:37", "JHN 13:34", "LUK 1:38", "MAT 16:24", "JHN 8:12", "JHN 20:29",
  "2TI 1:7", "HEB 12:1", "REV 21:4", "PSA 34:8", "PSA 103:1", "MAT 7:7", "LUK 6:36", "JHN 6:35", "JHN 10:11", "ROM 8:38", "PHP 4:6", "1TH 5:17", "TIT 3:5",
  "2PE 1:4", "JHN 17:3", "MAT 25:40", "LUK 23:42", "JHN 1:5", "WIS 3:1", "SIR 2:1", "MAT 5:9", "PSA 27:1", "ISA 53:5", "JHN 14:27", "ROM 6:4", "GAL 5:22", "1JN 1:9"];
async function votd() {
  const r = planRef(VOTD[dayOfYear() % VOTD.length]);
  const v = await verseText(r.code, r.c, r.v);
  if (!v) return null;
  const [ec, ev] = toEng(v.code, v.c, v.v, v.i);
  const f = await fathersFor(v.code, [ec]);
  return { ...v, key: `${v.code}.${ec}.${ev}`, ref: `${shortChap(v.code, v.c)}:${v.v}`, fathers: f.filter((e) => covers(e, ec, ev)) };
}
const minsFor = (words) => { const m = Math.max(1, Math.round(words / 160)); return m <= 2 ? `${m}–${m + 1} min` : `${m} min`; };
const listWords = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " or " + a[a.length - 1]);
async function renderToday() {
  setTop("", { hide: true });
  const t = today(); const h = new Date().getHours();
  const hello = `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}${S.name ? ", " + esc(S.name) : ""}`;
  view.innerHTML = `<div class="hello" style="padding-top:calc(16px + env(safe-area-inset-top,0px))"><h1>${hello}</h1><a class="streak-chip" href="#/you" aria-label="Your streak">${ICON.flame}${streak()}</a></div><div id="home"><div class="card empty">Loading…</div></div>`;
  const [d, vd, P, PR] = await Promise.all([dayData(t), votd().catch(() => null), plans(), prayers()]);
  const home = $("#home");
  const parts = [];
  if (vd) {
    const liked = !!S.liked[vd.key];
    parts.push(`<div class="card votd"><div class="label">Verse of the day</div><div class="ref">${esc(vd.ref)} ${tr() === "lxx" && BY[vd.code].ot ? "LXX" : "WEB"}</div>
      <div class="vtext">${esc(vd.text)}</div>
      <div class="acts"><button data-v="like" aria-pressed="${liked}">${ICON.heart}<span>${liked ? "Saved" : "Save"}</span></button><button data-v="fathers">${ICON.father}<span>${vd.fathers.length ? vd.fathers.length + " Fathers" : "Fathers"}</span></button><button data-v="image">${ICON.image}<span>Image</span></button><button data-v="read">${ICON.book}<span>Read</span></button></div></div>`);
  }
  const readings = d ? d.readings.map((r, i) => ({ r, i, ranges: readingRanges(r.verses), done: (S.read[t] || []).includes(`${t}:${i}`) })) : [];
  if (d) {
    const fast = d.fastLevel ? `<span class="pill fast">${esc(d.fast)}${d.fastException ? " · " + esc(d.fastException) : ""}</span>` : `<span class="pill">${esc(d.fast || "No fast")}</span>`;
    parts.push(`<div class="card day-card"><div class="label">${esc(longDate(t))}${d.cal === "old" ? ` · ${esc(new Date(d.churchDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" }))} Old Calendar` : ""}</div>
      <div class="feast">${esc(d.titles[0] || d.feast || "")}</div>${d.saints.length ? `<p class="saints">${esc(d.saints.join(" · "))}</p>` : ""}
      <div class="row">${fast}${(d.feasts || []).map((f) => `<span class="pill feast">${esc(f)}</span>`).join("")}${d.tone ? `<span class="pill">Tone ${d.tone}</span>` : ""}</div>
      ${d.fastLevel && d.abstain.length ? `<p class="small muted" style="margin:10px 0 0">No ${esc(listWords(d.abstain))} today. Follow the guidance of your priest.</p>` : ""}</div>`);
    const art = [["#2f4a5c", "book"], ["#7a2d3a", "cross"], ["#6b8f5e", "wave"], ["#8a6a2f", "halo"]];
    readings.forEach(({ r, i, ranges, done }) => {
      parts.push(`<a class="card guided" href="${readHash(wholeReading(ranges), { k: `${t}:${i}` })}"><div class="txt"><div class="kind">${esc(r.source)}${r.desc ? " · " + esc(r.desc) : ""}</div><h3>${esc(r.display.replace(/\./g, ":"))}</h3><div class="dur">${ICON.play}${minsFor(r.verses.length * 24)}<span data-meta="${i}"></span></div></div>
        ${thumbArt(art[i % 4][0], art[i % 4][1], done ? `<span class="done">${ICON.check}</span>` : "")}</a>`);
    });
  } else parts.push(`<div class="card empty">Can't reach the Church calendar right now.<br><br><button class="btn small" onclick="location.reload()">Try again</button></div>`);
  const pr = h < 11 ? PR.find((p) => p.id === "morning") : h >= 18 ? PR.find((p) => p.id === "evening") : null;
  const playDisc = (icon) => `<span style="position:relative;width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.95);color:#111;display:grid;place-items:center">${icon.replace("<svg", '<svg style="width:20px;height:20px"')}</span>`;
  if (pr) parts.push(`<a class="card guided" href="#/prayer/${pr.id}"><div class="txt"><div class="kind">${esc(pr.kind)}</div><h3>${esc(pr.title)}</h3><div class="dur">${ICON.play}${esc(pr.mins)}</div></div>${thumbArt("#2b2433", "halo", playDisc(ICON.pray))}</a>`);
  parts.push(`<a class="card guided" href="#/rope"><div class="txt"><div class="kind">The Jesus Prayer</div><h3>Lord Jesus Christ, have mercy on me</h3><div class="dur">${ICON.play}${S.rope[t] ? `${S.rope[t]} today` : "Pray with a prayer rope"}</div></div>${thumbArt("#3a2f4f", "star", playDisc(ICON.beads))}</a>`);
  const active = P.plans.filter((p) => S.plans[p.id]?.started && !S.plans[p.id]?.finished);
  if (active.length) parts.push(`<div class="sec-h"><h2>Your plans</h2><a href="#/plans?tab=mine">See all ${ICON.chev}</a></div><div class="list">${active.map((p) => { const n = nextDay(p); return planRowHTML(p, `Day ${n + 1}: ${p.days[n].title}`, `#/plan/${p.id}/${n + 1}`, "Continue"); }).join("")}</div>`);
  else parts.push(`<div class="sec-h"><h2>Need a place to begin?</h2><a href="#/plans">Plans ${ICON.chev}</a></div><div class="scroller">${P.featured.map((id) => P.plans.find((p) => p.id === id)).map((p) => `<a class="hero-card" href="#/plan/${p.id}">${coverHTML(p.cover, "hero")}<div class="cap">${esc(p.title)}</div></a>`).join("")}</div>`);
  parts.push(`<div class="sec-h"><h2>Badges</h2><a href="#/you">See all ${ICON.chev}</a></div><div class="scroller badges">${BADGES.slice().sort((a, b) => b.got() - a.got()).map(badgeHTML).join("")}</div>`);
  home.innerHTML = `<div class="stack">${parts.join("")}</div>`;
  home.querySelectorAll("[data-badge]").forEach((b) => (b.onclick = () => (location.hash = "#/you")));
  if (vd) {
    const act = (k) => home.querySelector(`[data-v="${k}"]`);
    act("like").onclick = () => {
      if (S.liked[vd.key]) delete S.liked[vd.key]; else { S.liked[vd.key] = Date.now(); S.bm[vd.key] = S.bm[vd.key] || { at: Date.now(), ref: vd.ref, text: vd.text }; }
      save(); act("like").setAttribute("aria-pressed", !!S.liked[vd.key]); act("like").querySelector("span").textContent = S.liked[vd.key] ? "Saved" : "Save";
    };
    act("fathers").onclick = () => openSheet(`<div class="sheet-h"><h3>The Fathers on ${esc(vd.ref)}</h3>${closeBtn}</div><div id="fl"></div>`, (b) => (vd.fathers.length ? fathersList($("#fl", b), vd.fathers) : ($("#fl", b).innerHTML = `<div class="empty">No comments on this verse yet.</div>`)));
    act("image").onclick = () => verseImage(vd.text, vd.ref);
    act("read").onclick = () => (location.hash = `#/read/${vd.code}/${vd.c}?${vd.code === "PSA" && tr() === "lxx" ? "i=" + vd.i : "v=" + vd.v}`);
  }
  readings.forEach(async ({ ranges, i }) => {
    const r = ranges[0]; const code = r.code === "DAN" ? "DAG" : r.code;
    const list = await fathersFor(code, ranges.map((x) => x.c));
    const n = list.filter((e) => ranges.some((x) => e.ch >= x.c && e.ch <= x.c2 && e.v[1] >= (e.ch === x.c ? x.v : 1) && e.v[0] <= (e.ch === x.c2 ? x.v2 : 999))).length;
    const el = home.querySelector(`[data-meta="${i}"]`); if (el && n) el.textContent = ` · ${n} from the Fathers`;
  });
}

// ---------------------------------------------------------------- Bible: book picker
function bookPicker(cur) {
  const groups = {};
  BOOKS.filter((b) => inTr(b.code)).forEach((b) => (groups[b.section] = groups[b.section] || []).push(b));
  openSheet(`<div class="sheet-bar">${closeBtn}<h3>Books</h3><div class="seg" style="padding:0"><button data-tr="lxx" aria-pressed="${tr() === "lxx"}">LXX</button><button data-tr="web" aria-pressed="${tr() === "web"}">WEB</button></div></div>
    <div class="book-list">${Object.entries(groups).map(([sec, list]) => `<div class="sec">${esc(SECTIONS[sec] || sec)}</div>${list.map((b) => `<button class="row-btn" data-b="${b.code}"><span class="grow">${esc(bookName(b.code))}${tr() === "lxx" && b.lxx && b.ot ? `<small>${esc(b.name)}</small>` : ""}</span></button><div class="chapters" data-for="${b.code}" hidden></div>`).join("")}`).join("")}</div>`, (box) => {
    box.querySelectorAll("[data-tr]").forEach((x) => (x.onclick = () => { S.settings.tr = x.dataset.tr; save(); bookPicker(cur); }));
    box.querySelectorAll("[data-b]").forEach((x) => (x.onclick = () => {
      const code = x.dataset.b, grid = box.querySelector(`[data-for="${code}"]`), n = chapters(code);
      if (n === 1) { closeSheet(); location.hash = `#/read/${code}/1`; return; }
      box.querySelectorAll(".chapters").forEach((g) => { if (g !== grid) g.hidden = true; });
      grid.hidden = !grid.hidden;
      if (!grid.innerHTML) grid.innerHTML = Array.from({ length: n }, (_, i) => `<button data-c="${i + 1}" class="${cur && cur.b === code && cur.c === i + 1 ? "cur" : ""}">${i + 1}</button>`).join("");
      grid.querySelectorAll("[data-c]").forEach((c) => (c.onclick = () => { closeSheet(); location.hash = `#/read/${code}/${c.dataset.c}`; }));
    }));
    if (cur) { const el = box.querySelector(`[data-b="${cur.b}"]`); if (el) setTimeout(() => el.scrollIntoView({ block: "center" }), 30); }
  }, true);
}

// ---------------------------------------------------------------- the reader
let speaking = null;
async function renderReader(code, c, q) {
  stopSpeaking();
  if (code === "DAN") code = "DAG";
  if (code === "EST") code = "ESG";
  if (!BY[code]) { location.replace("#/today"); return; }
  if (!inTr(code)) {
    const other = tr() === "lxx" ? "web" : "lxx";
    if (inTr(code, other)) { S.settings.tr = other; save(); toast(`Switched to the ${other === "lxx" ? "Septuagint" : "World English Bible"} for this book`); }
  }
  const n = chapters(code);
  c = Math.min(Math.max(1, c), n);
  S.last = { b: code, c }; save();
  const passage = q.get("k") || q.get("plan");
  setTop(chapLabel(code, c), { back: !!passage, left: `<span class="reader-top"><button class="pill-btn" id="pick">${esc(shortChap(code, c))}</button><button class="pill-btn" id="trBtn">${trName()}</button></span>`,
    acts: `<button class="iconbtn" id="listen" aria-label="Listen">${ICON.speaker}</button><button class="iconbtn" id="goSearch" aria-label="Search">${ICON.search}</button><button class="iconbtn" id="aa" aria-label="Text and theme">${ICON.aa}</button>` });
  $("#pick").onclick = () => bookPicker({ b: code, c });
  $("#trBtn").onclick = () => { S.settings.tr = tr() === "lxx" ? "web" : "lxx"; save(); toast(tr() === "lxx" ? "Septuagint (Brenton) with the WEB New Testament" : "World English Bible"); route(); };
  $("#goSearch").onclick = () => (location.hash = "#/search");
  $("#aa").onclick = textSheet;
  view.innerHTML = `<div class="reader"><div class="empty">Loading…</div></div>`;
  let book;
  try { book = await get(`bible/${tr()}/${code}.json`); } catch (e) { view.innerHTML = `<div class="card empty">Can't load this chapter. Check your connection.</div>`; return; }
  const ch = book.find((x) => x[0] === c) || book[c - 1];
  if (!ch) { view.innerHTML = `<div class="empty">Chapter not found.</div>`; return; }
  const verses = ch[1];
  const eng = verses.map(([v], i) => toEng(code, c, v, i));
  const fathers = await fathersFor(code, eng.map((x) => x[0]));
  const has = (i) => { const [ec, ev] = eng[i]; return ev > 0 && fathers.some((e) => covers(e, ec, ev)); };
  const vi = q.get("i") != null ? +q.get("i") : q.get("v") ? verses.findIndex(([v]) => v === +q.get("v")) : -1;
  const ti = q.get("ti") != null ? +q.get("ti") : q.get("to") ? verses.findIndex(([v]) => v === +q.get("to")) : vi;
  const inPassage = (i) => vi < 0 || (i >= vi && i <= (ti < 0 ? verses.length - 1 : ti));
  const keyOf = (i) => `${code}.${eng[i][0]}.${eng[i][1]}`;
  const dim = passage && vi >= 0;
  view.innerHTML = `<div class="reader">
    <div class="ch-title">${esc(chapLabel(code, c))}</div>
    <div class="ch-sub">${tr() === "lxx" && BY[code].ot ? "Septuagint · Brenton" : "World English Bible"}${fathers.length ? ` · <span style="color:var(--accent)">●</span> ${fathers.length} from the Fathers` : ""}</div>
    <div id="verses">${verses.map(([v, t], i) => `<span class="verse${has(i) ? " has" : ""}${S.hl[keyOf(i)] ? " hl-" + S.hl[keyOf(i)] : ""}${dim && !inPassage(i) ? " dim" : ""}${!passage && i === vi ? " sel" : ""}" data-i="${i}"><sup>${v}</sup>${esc(t)}${S.notes[keyOf(i)] ? `<span class="note-mark">${ICON.note}</span>` : ""} </span>`).join("")}</div>
    ${fathers.length ? `<div class="ch-fathers"><button class="btn secondary wide" id="allF">${ICON.father} What the Fathers said on this ${code === "PSA" ? "psalm" : "chapter"}</button></div>` : ""}
    ${passage ? `<div class="passage-bar"><button class="btn red wide" id="doneP">${q.get("k") ? ICON.check + " Mark as read" : "Back to the plan"}</button></div>` : ""}
  </div>
  <div class="float-nav"><button id="prev" aria-label="Previous chapter" ${c <= 1 && !prevBook(code) ? "disabled" : ""}>${ICON.left}</button><button class="play" id="play" aria-label="Listen to this chapter">${ICON.play}</button><button id="next" aria-label="Next chapter" ${c >= n && !nextBook(code) ? "disabled" : ""}>${ICON.right}</button></div>`;
  const box = $("#verses");
  box.onclick = (e) => { const el = e.target.closest(".verse"); if (el) verseSheet(code, c, verses, +el.dataset.i, eng, fathers); };
  if ($("#allF")) $("#allF").onclick = () => openSheet(`<div class="sheet-h"><h3>The Fathers on ${esc(chapLabel(code, c))}</h3>${closeBtn}</div><div id="fl"></div>`, (b) => fathersList($("#fl", b), fathers));
  const keep = q.get("plan") ? `?plan=${q.get("plan")}` : "";
  $("#prev").onclick = () => (location.hash = (c > 1 ? `#/read/${code}/${c - 1}` : `#/read/${prevBook(code)}/${chapters(prevBook(code))}`) + keep);
  $("#next").onclick = () => (location.hash = (c < n ? `#/read/${code}/${c + 1}` : `#/read/${nextBook(code)}/1`) + keep);
  const toggle = () => (speaking ? stopSpeaking() : speak(verses, dim ? vi : 0, dim ? ti : -1));
  $("#play").onclick = toggle; $("#listen").onclick = toggle;
  if ($("#doneP")) $("#doneP").onclick = () => {
    if (q.get("k")) { markRead(q.get("k")); toast("Marked as read"); location.hash = "#/today"; }
    else { const [id, d] = q.get("plan").split(":"); location.hash = `#/plan/${id}/${d}`; }
  };
  if (vi >= 0) { const el = box.querySelector(`[data-i="${vi}"]`); if (el) setTimeout(() => el.scrollIntoView({ block: "center" }), 30); }
  else window.scrollTo(0, 0);
}
const order = () => BOOKS.filter((b) => inTr(b.code)).map((b) => b.code);
const prevBook = (code) => { const o = order(); return o[o.indexOf(code) - 1]; };
const nextBook = (code) => { const o = order(); return o[o.indexOf(code) + 1]; };

// Listen: the phone's own voice reads the chapter, lighting each verse as it goes.
function speak(verses, from, to) {
  if (!("speechSynthesis" in window)) { toast("This phone can't read aloud"); return; }
  stopSpeaking();
  let i = Math.max(0, from);
  const last = to >= 0 ? to : verses.length - 1;
  const me = { stop: false };
  speaking = me;
  const btn = () => { const p = $("#play"); if (p) p.innerHTML = speaking ? ICON.pause : ICON.play; };
  btn();
  const next = () => {
    if (me.stop || i > last) { if (speaking === me) { speaking = null; btn(); document.querySelectorAll(".verse.speaking").forEach((x) => x.classList.remove("speaking")); } return; }
    document.querySelectorAll(".verse.speaking").forEach((x) => x.classList.remove("speaking"));
    const el = document.querySelector(`.verse[data-i="${i}"]`);
    if (el) { el.classList.add("speaking"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
    const u = new SpeechSynthesisUtterance(verses[i][1]);
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
    const pick = voices.find((v) => v.name === S.settings.voice) || voices.find((v) => /Daniel|Samantha|Google UK|Arthur|Serena/.test(v.name)) || voices[0];
    if (pick) u.voice = pick;
    u.rate = 0.95;
    u.onend = () => { i++; next(); };
    u.onerror = () => { me.stop = true; next(); };
    speechSynthesis.speak(u);
  };
  next();
}
function stopSpeaking() {
  if (speaking) speaking.stop = true;
  speaking = null;
  try { speechSynthesis.cancel(); } catch (e) { /* none */ }
  document.querySelectorAll(".verse.speaking").forEach((x) => x.classList.remove("speaking"));
  const p = $("#play"); if (p) p.innerHTML = ICON.play;
}
function textSheet() {
  openSheet(`<div class="sheet-h"><h3>Text and theme</h3>${closeBtn}</div>
    <div class="label" style="margin:6px 0 8px">Size</div><div class="seg">${[16, 18, 19, 21, 24].map((s) => `<button data-s="${s}" aria-pressed="${S.settings.size === s}" style="font-size:${s - 4}px;flex:1">Aa</button>`).join("")}</div>
    <div class="label" style="margin:18px 0 8px">Theme</div><div class="seg">${["dark", "light"].map((t) => `<button data-t="${t}" aria-pressed="${S.settings.theme === t}" style="flex:1">${t === "dark" ? "Dark" : "Light"}</button>`).join("")}</div>`, (b) => {
    b.querySelectorAll("[data-s]").forEach((x) => (x.onclick = () => { S.settings.size = +x.dataset.s; save(); applyTheme(); b.querySelectorAll("[data-s]").forEach((y) => y.setAttribute("aria-pressed", y === x)); }));
    b.querySelectorAll("[data-t]").forEach((x) => (x.onclick = () => { S.settings.theme = x.dataset.t; save(); applyTheme(); b.querySelectorAll("[data-t]").forEach((y) => y.setAttribute("aria-pressed", y === x)); }));
  });
}
function verseSheet(code, c, verses, i, eng, fathers) {
  document.querySelectorAll(".verse.sel").forEach((v) => v.classList.remove("sel"));
  const el = document.querySelector(`.verse[data-i="${i}"]`); if (el) el.classList.add("sel");
  const [v, text] = verses[i];
  const [ec, ev] = eng[i];
  const key = `${code}.${ec}.${ev}`;
  const ref = `${shortChap(code, c)}:${v}`;
  const mine = fathers.filter((e) => ev > 0 && covers(e, ec, ev));
  const hlBtn = (k) => `<button data-hl="${k}" aria-pressed="${S.hl[key] === k}" style="background:var(--hl-${k})" aria-label="Highlight"></button>`;
  openSheet(`<div class="sheet-h"><div><h3>${esc(ref)}</h3><div class="vtext">${esc(text)}</div></div>${closeBtn}</div>
    <div class="swatches">${hlBtn("y")}${hlBtn("g")}${hlBtn("b")}${hlBtn("p")}<button data-hl="" aria-label="No highlight" style="background:var(--surface);display:grid;place-items:center">${ICON.x.replace("<svg", '<svg style="width:14px;height:14px"')}</button></div>
    <div class="actions">
      <button data-a="bm" aria-pressed="${!!S.bm[key]}">${ICON.bookmark}<span>${S.bm[key] ? "Saved" : "Save"}</span></button>
      <button data-a="note">${ICON.pen}<span>Note</span></button>
      <button data-a="image">${ICON.image}<span>Image</span></button>
      <button data-a="copy">${ICON.copy}<span>Copy</span></button>
      <button data-a="share">${ICON.share}<span>Share</span></button></div>
    <div id="noteBox" ${S.notes[key] ? "" : "hidden"} style="margin-top:10px"><textarea id="noteText" rows="3" placeholder="Your note">${esc(S.notes[key] || "")}</textarea></div>
    <div class="sec-h" style="margin-top:22px"><h2>What the Fathers said</h2><span class="muted small">${mine.length || ""}</span></div>
    <div id="fl">${mine.length ? "" : `<div class="empty small">No comments from the Fathers on this verse yet.${fathers.length ? " Try the whole chapter." : ""}</div>`}</div>`, (b) => {
    if (mine.length) fathersList($("#fl", b), mine);
    b.querySelectorAll("[data-hl]").forEach((x) => (x.onclick = () => {
      if (x.dataset.hl) { S.hl[key] = x.dataset.hl; S.hlAt[key] = Date.now(); } else { delete S.hl[key]; delete S.hlAt[key]; }
      save(); b.querySelectorAll("[data-hl]").forEach((y) => y.setAttribute("aria-pressed", y === x && !!x.dataset.hl));
      if (el) { el.className = el.className.replace(/\bhl-\w\b/g, "").trim(); if (S.hl[key]) el.classList.add("hl-" + S.hl[key]); }
    }));
    const act = (a) => b.querySelector(`[data-a="${a}"]`);
    act("bm").onclick = () => { if (S.bm[key]) delete S.bm[key]; else S.bm[key] = { at: Date.now(), ref, text }; save(); act("bm").setAttribute("aria-pressed", !!S.bm[key]); act("bm").querySelector("span").textContent = S.bm[key] ? "Saved" : "Save"; toast(S.bm[key] ? "Saved to your verses" : "Removed"); };
    act("note").onclick = () => { $("#noteBox", b).hidden = false; $("#noteText", b).focus(); };
    $("#noteText", b).oninput = (e) => { const t = e.target.value.trim(); if (t) { S.notes[key] = t; S.noteAt[key] = Date.now(); } else { delete S.notes[key]; delete S.noteAt[key]; } save(); };
    act("image").onclick = () => verseImage(text, ref);
    const plain = `"${text}" (${ref})`;
    act("copy").onclick = () => navigator.clipboard?.writeText(plain).then(() => toast("Copied"), () => toast("Couldn't copy"));
    act("share").onclick = () => { if (navigator.share) navigator.share({ text: plain }).catch(() => {}); else navigator.clipboard?.writeText(plain).then(() => toast("Copied to share")); };
  });
}

// ---------------------------------------------------------------- verse images
const IMG_THEMES = [
  { bg: ["#1d2b22", "#3f5a43"], ink: "#f3efe4" }, { bg: ["#2a0f14", "#7a2d3a"], ink: "#fbeee2" }, { bg: ["#0f1a2a", "#2f4a5c"], ink: "#eef3f7" },
  { bg: ["#2b2116", "#a0763a"], ink: "#fff6e6" }, { bg: ["#f4efe6", "#e6dccb"], ink: "#231c17" }, { bg: ["#16131c", "#3a2f4f"], ink: "#f1ecf7" },
];
function drawVerse(canvas, text, ref, th) {
  const W = 1080, H = 1350, x = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = th.ink; x.globalAlpha = 0.12; x.lineWidth = 10; x.lineCap = "round";  // a quiet three-bar cross
  x.beginPath(); x.moveTo(W - 150, 120); x.lineTo(W - 150, 360); x.moveTo(W - 185, 165); x.lineTo(W - 115, 165); x.moveTo(W - 215, 215); x.lineTo(W - 85, 215); x.moveTo(W - 190, 300); x.lineTo(W - 110, 330); x.stroke();
  x.globalAlpha = 1; x.fillStyle = th.ink; x.textBaseline = "top";
  let size = text.length > 320 ? 46 : text.length > 200 ? 54 : text.length > 110 ? 64 : 74;
  const wrap = () => { x.font = `400 ${size}px "Source Serif 4", Georgia, serif`; const out = []; let line = ""; for (const w of `“${text}”`.split(" ")) { const t = line ? line + " " + w : w; if (x.measureText(t).width > W - 200) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; };
  let lines = wrap(); while (lines.length * size * 1.35 > H - 520 && size > 34) { size -= 4; lines = wrap(); }
  const top = (H - lines.length * size * 1.35) / 2 - 40;
  lines.forEach((l, i) => x.fillText(l, 100, top + i * size * 1.35));
  x.font = `600 38px Geist, Inter, system-ui, sans-serif`; x.globalAlpha = 0.9;
  x.fillText(ref, 100, top + lines.length * size * 1.35 + 50);
  x.globalAlpha = 0.5; x.font = `500 28px Geist, Inter, system-ui, sans-serif`;
  x.fillText("Orthodox Bible", 100, H - 110);
  x.globalAlpha = 1;
}
function verseImage(text, ref) {
  let th = 0;
  openSheet(`<div class="sheet-h"><h3>Verse image</h3>${closeBtn}</div><canvas class="preview" id="vc"></canvas>
    <div class="img-themes">${IMG_THEMES.map((t, i) => `<button data-th="${i}" aria-pressed="${i === 0}" style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]})" aria-label="Style ${i + 1}"></button>`).join("")}</div>
    <div class="row"><button class="btn red" id="vshare" style="flex:1">${ICON.share} Share</button><button class="btn secondary" id="vsave" style="flex:1">Save image</button></div>`, (b) => {
    const cv = $("#vc", b);
    const draw = () => drawVerse(cv, text, ref, IMG_THEMES[th]);
    if (document.fonts) document.fonts.ready.then(draw);
    draw();
    b.querySelectorAll("[data-th]").forEach((x) => (x.onclick = () => { th = +x.dataset.th; b.querySelectorAll("[data-th]").forEach((y) => y.setAttribute("aria-pressed", y === x)); draw(); }));
    const blob = () => new Promise((r) => cv.toBlob(r, "image/png"));
    const name = ref.replace(/[^\w]+/g, "-") + ".png";
    $("#vsave", b).onclick = async () => { const a = document.createElement("a"); a.href = URL.createObjectURL(await blob()); a.download = name; a.click(); };
    $("#vshare", b).onclick = async () => {
      const f = new File([await blob()], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: ref }).catch(() => {});
      else $("#vsave", b).click();
    };
  });
}

// ---------------------------------------------------------------- plans
const progress = (id) => (S.plans[id] = S.plans[id] || { done: {} });
const nextDay = (p) => { const pr = S.plans[p.id] || { done: {} }; const i = p.days.findIndex((_, d) => !pr.done[d]); return i < 0 ? p.days.length - 1 : i; };
const doneCount = (p) => Object.keys((S.plans[p.id] || {}).done || {}).filter((d) => d < p.days.length).length;
function planRowHTML(p, sub, href, cta) {
  const n = doneCount(p);
  return `<a class="plan-row" href="${href || "#/plan/" + p.id}">${coverHTML(p.cover, "thumb")}<div class="info"><div class="days">${esc(sub || p.days.length + " Days")}</div><div class="name">${esc(p.title)}</div>${n && S.plans[p.id]?.started ? `<div class="bar"><i style="width:${(100 * n) / p.days.length}%"></i></div>` : ""}</div><span class="btn secondary small">${cta || (S.plans[p.id]?.started ? "Continue" : "Start")}</span></a>`;
}
let plansTab = "find";
async function renderPlans(q) {
  setTop("", { acts: `<button class="iconbtn round" id="goSearch" aria-label="Search">${ICON.search}</button>` });
  $("#goSearch").onclick = () => (location.hash = "#/search");
  if (q.get("tab")) plansTab = q.get("tab");
  const P = await plans();
  const topic = q.get("topic") && P.topics.find((t) => t.id === q.get("topic"));
  const tabs = [["mine", "My plans"], ["find", "Find plans"], ["saved", "Saved"], ["done", "Completed"]];
  const empty = (title, msg) => `<div class="empty" style="padding-top:56px">${ICON.check.replace("<svg", '<svg class="icon"')}<h3 style="margin-bottom:6px">${title}</h3><p class="muted" style="margin:0 0 18px">${msg}</p><button class="btn" data-tab="find">Find a Plan</button></div>`;
  let body = "";
  if (topic) {
    body = `<div class="sec-h" style="margin-top:14px"><h2>${esc(topic.name)}</h2><a href="#/plans">All plans ${ICON.chev}</a></div><div class="list">${topic.plans.map((id) => P.plans.find((p) => p.id === id)).filter(Boolean).map((p) => planRowHTML(p)).join("")}</div>`;
  } else if (plansTab === "mine") {
    const list = P.plans.filter((p) => S.plans[p.id]?.started && !S.plans[p.id]?.finished);
    body = list.length ? `<div class="list" style="margin-top:10px">${list.map((p) => { const n = nextDay(p); return planRowHTML(p, `Day ${n + 1} of ${p.days.length}`, `#/plan/${p.id}/${n + 1}`, "Continue"); }).join("")}</div>` : empty("No Plans Yet", "Choose a plan to read Scripture with the Fathers.");
  } else if (plansTab === "saved") {
    const list = P.plans.filter((p) => S.saved[p.id]);
    body = list.length ? `<div class="list" style="margin-top:10px">${list.map((p) => planRowHTML(p)).join("")}</div>` : empty("Nothing Saved", "Tap Save on any plan to keep it here for later.");
  } else if (plansTab === "done") {
    const list = P.plans.filter((p) => S.plans[p.id]?.finished);
    body = list.length ? `<div class="list" style="margin-top:10px">${list.map((p) => planRowHTML(p, "Completed", null, "Again")).join("")}</div>` : empty("None Finished Yet", "Plans you finish will show here, with a badge for the big ones.");
  } else {
    body = `<div class="scroller" style="margin-top:14px">${P.featured.map((id) => P.plans.find((p) => p.id === id)).map((p) => `<a class="hero-card" href="#/plan/${p.id}">${coverHTML(p.cover, "hero")}<div class="cap">${esc(p.title)}</div></a>`).join("")}</div>
      <div class="tiles" style="margin-top:18px">${P.topics.map((t) => `<a class="tile" href="#/plans?topic=${t.id}" style="background:${t.bg}">${esc(t.name)}</a>`).join("")}</div>
      ${Object.entries(P.categories).map(([cat, name]) => `<div class="sec-h"><h2>${esc(name)}</h2></div><div class="list">${P.plans.filter((p) => p.cat === cat).map((p) => planRowHTML(p)).join("")}</div>`).join("")}`;
  }
  view.innerHTML = `<div class="big-title">Plans</div><div class="seg edge">${tabs.map(([k, n]) => `<button data-tab="${k}" aria-pressed="${!topic && plansTab === k}">${n}</button>`).join("")}</div>${body}`;
  view.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { plansTab = b.dataset.tab; if (topic) location.hash = "#/plans"; else renderPlans(new URLSearchParams()); }));
}
async function renderPlan(id) {
  const P = await plans(); const p = P.plans.find((x) => x.id === id);
  if (!p) { location.replace("#/plans"); return; }
  setTop("", { back: true, acts: `<button class="iconbtn" id="sv" aria-label="${S.saved[id] ? "Remove from saved" : "Save plan"}">${ICON.bookmark.replace("<svg", `<svg style="${S.saved[id] ? "fill:currentColor" : ""}"`)}</button>` });
  $("#sv").onclick = () => { if (S.saved[id]) delete S.saved[id]; else S.saved[id] = Date.now(); save(); toast(S.saved[id] ? "Saved for later" : "Removed from saved"); renderPlan(id); };
  const pr = S.plans[id] || { done: {} }; const n = doneCount(p);
  view.innerHTML = `<div class="plan-hero">${coverHTML(p.cover, "hero")}</div>
    <h2 style="font-size:26px;margin:18px 0 4px">${esc(p.title)}</h2><div class="muted small">${p.days.length} Days${n ? ` · ${n} done` : ""}</div>
    <p class="prose muted" style="margin:12px 0 16px">${esc(p.about)}</p>
    ${n ? `<div class="bar" style="margin-bottom:16px"><i style="width:${(100 * n) / p.days.length}%"></i></div>` : ""}
    <div class="row"><button class="btn red" id="go" style="flex:1">${pr.started ? (n ? `Continue · Day ${nextDay(p) + 1}` : "Start Day 1") : "Start Plan"}</button>${pr.started ? `<button class="btn secondary" id="stop">${pr.finished ? "Start again" : "Stop"}</button>` : `<button class="btn secondary" id="save2">${S.saved[id] ? "Saved" : "Save for later"}</button>`}</div>
    <div class="sec-h"><h2>Days</h2></div>
    <div class="list">${p.days.map((d, i) => `<button class="row-btn" data-d="${i + 1}"><span class="numdot ${pr.done[i] ? "on" : ""}">${pr.done[i] ? ICON.check : i + 1}</span><span class="grow"><span class="t">${esc(d.title)}</span></span>${ICON.chev}</button>`).join("")}</div>`;
  $("#go").onclick = () => { const x = progress(id); x.started = x.started || today(); x.finished = false; save(); location.hash = `#/plan/${id}/${nextDay(p) + 1}`; };
  if ($("#stop")) $("#stop").onclick = () => { if (confirm(pr.finished ? "Start this plan again from day 1?" : "Stop this plan? Your ticks will be cleared.")) { delete S.plans[id]; save(); renderPlan(id); } };
  if ($("#save2")) $("#save2").onclick = () => $("#sv").click();
  view.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => (location.hash = `#/plan/${id}/${b.dataset.d}`)));
}
async function renderPlanDay(id, d) {
  const P = await plans(); const p = P.plans.find((x) => x.id === id);
  if (!p || !p.days[d - 1]) { location.replace(`#/plan/${id}`); return; }
  const day = p.days[d - 1];
  setTop(`Day ${d} of ${p.days.length}`, { back: true });
  const pr = progress(id); if (!pr.started) { pr.started = today(); save(); }
  const isDone = !!pr.done[d - 1];
  const item = (it) => {
    if (it.text) return `<div class="prose"><p>${esc(it.text)}</p></div>`;
    if (it.read) {
      const r = planRef(it.read); if (!r) return "";
      let label = refText(r);
      if (it.n === "lxx" && r.code === "PSA" && tr() === "lxx") label = r.c === r.c2 ? psalmLabel(r.c) : `Psalms ${r.c}–${r.c2}`;
      return `<a class="card day-item" href="${planReadHash(r, it.n, id, d)}"><span class="icon">${ICON.book}</span><span style="flex:1"><b>${esc(label)}</b><span class="small muted" style="display:block">Read${it.n === "lxx" ? " · Church numbering" : ""}</span></span>${ICON.chev}</a>`;
    }
    if (it.father) return `<a class="card day-item" href="${esc(it.u)}" target="_blank" rel="noopener"><span class="icon" style="color:var(--gold)">${ICON.father}</span><span style="flex:1"><b>${esc(it.father)}</b><span class="small muted" style="display:block">Opens on New Advent</span></span>${ICON.out}</a>`;
    return "";
  };
  view.innerHTML = `<div class="row" style="gap:12px;margin:4px 0 16px;flex-wrap:nowrap">${coverHTML(p.cover, "thumb")}<div style="min-width:0"><div class="small muted">${esc(p.title)}</div><h2 style="margin-top:2px">${esc(day.title)}</h2></div></div>
    <div class="stack">${day.items.map(item).join("")}</div>
    <button class="btn ${isDone ? "secondary" : "red"} wide" id="done" style="margin-top:22px">${isDone ? "Done ✓ · Undo" : "Mark Day " + d + " Done"}</button>
    <div class="row" style="justify-content:space-between;margin-top:14px"><button class="btn secondary small" id="pd" ${d <= 1 ? "disabled" : ""}>‹ Day ${d - 1}</button><button class="btn secondary small" id="nd" ${d >= p.days.length ? "disabled" : ""}>Day ${d + 1} ›</button></div>`;
  $("#done").onclick = () => {
    if (pr.done[d - 1]) delete pr.done[d - 1];
    else { pr.done[d - 1] = today(); markRead(`plan:${id}:${d}`); }
    pr.finished = doneCount(p) === p.days.length; save(); checkBadges();
    if (pr.done[d - 1]) { toast(pr.finished ? "Plan finished. Glory to God!" : `Day ${d} done`); if (!pr.finished && d < p.days.length) { location.hash = `#/plan/${id}/${d + 1}`; return; } }
    renderPlanDay(id, d);
  };
  $("#pd").onclick = () => (location.hash = `#/plan/${id}/${d - 1}`);
  $("#nd").onclick = () => (location.hash = `#/plan/${id}/${d + 1}`);
}
function planReadHash(r, numbering, id, d) {
  if (numbering === "lxx" && r.code === "PSA") {
    const c = tr() === "lxx" ? r.c : (MAP.PSA[r.c] || [[r.c]]).find((x) => x[1] > 0)?.[0] || r.c;
    return `#/read/PSA/${c}?plan=${id}:${d}`;
  }
  return readHash(r, { plan: `${id}:${d}` });
}

// ---------------------------------------------------------------- Discover
const COUNCIL_IDS = ["nicaea1", "constantinople1", "ephesus", "chalcedon", "constantinople2", "constantinople3", "nicaea2"];
async function renderDiscover() {
  setTop("");
  const [P, L, PR] = await Promise.all([plans(), lib(), prayers()]);
  const saints = L.filter((a) => a.label === "saint");
  view.innerHTML = `<div class="big-title">Discover</div>
    <a href="#/search" style="display:block"><input type="search" placeholder="Search the Bible" readonly style="cursor:pointer;pointer-events:none" aria-label="Search the Bible"></a>
    <div class="quick" style="margin-top:14px">
      <a href="#/fathers">${ICON.father}The Fathers</a><a href="#/plans?topic=councils">${ICON.dome}The Councils</a>
      <a href="#/prayers">${ICON.pray}Prayers</a><a href="#/rope">${ICON.beads}Jesus Prayer</a></div>
    <div class="sec-h"><h2>Topics</h2><a href="#/plans">See all ${ICON.chev}</a></div>
    <div class="tiles">${P.topics.map((t) => `<a class="tile" href="#/plans?topic=${t.id}" style="background:${t.bg}">${esc(t.name)}</a>`).join("")}</div>
    <div class="sec-h"><h2>The Holy Fathers</h2><a href="#/fathers">See all ${ICON.chev}</a></div>
    <div class="scroller">${saints.slice(0, 16).map((a, i) => `<a class="person" href="#/father/${esc(a.id)}">${monogram(a.name, i)}${esc(a.name.replace(/^St /, ""))}</a>`).join("")}</div>
    <div class="sec-h"><h2>The Seven Councils</h2><a href="#/plans?topic=councils">See all ${ICON.chev}</a></div>
    <div class="scroller">${COUNCIL_IDS.map((id) => P.plans.find((p) => p.id === id)).map((p) => `<a href="#/plan/${p.id}" style="width:150px">${coverHTML(p.cover, "").replace('class="cover', 'style="height:150px" class="cover')}<div class="small" style="margin-top:8px">${esc(p.title.replace(/^\d+\. /, ""))}</div></a>`).join("")}</div>
    <div class="sec-h"><h2>Prayers</h2><a href="#/prayers">See all ${ICON.chev}</a></div>
    <div class="list">${PR.map((p) => `<a class="row-btn" href="#/prayer/${p.id}"><span class="grow"><span class="t">${esc(p.title)}</span><span class="sub">${esc(p.kind)} · ${esc(p.mins)}</span></span>${ICON.chev}</a>`).join("")}</div>
    <div class="sec-h"><h2>Scripture with the Fathers</h2></div>
    <div class="list">${P.plans.filter((p) => p.cat === "scripture").map((p) => planRowHTML(p)).join("")}</div>`;
}
async function renderFathers() {
  setTop("The Fathers", { back: true });
  const L = await lib();
  const groups = [["saint", "Saints"], ["western", "Western saints before the schism"], ["blessed", "Honoured, with some reservations"], ["document", "Early Christian writings"], ["writer", "Early Christian writers, not saints"]];
  view.innerHTML = `<p class="prose muted" style="margin:0 0 14px;font-size:17px">The saints and teachers who handed on the faith of the Apostles. A red dot on any verse in the Bible means they wrote about it.</p>
    <input type="search" id="fq" placeholder="Find a Father" aria-label="Find a Father"><div id="fbox"></div>`;
  const draw = (q = "") => {
    q = q.toLowerCase();
    $("#fbox").innerHTML = groups.map(([lab, name]) => {
      const list = L.filter((a) => a.label === lab && (!q || a.name.toLowerCase().includes(q)));
      return list.length ? `<div class="sec-h"><h2 style="font-size:17px">${esc(name)}</h2></div><div class="list">${list.map((a) => `<a class="row-btn" href="#/father/${esc(a.id)}">${monogram(a.name, L.indexOf(a), 44)}<span class="grow"><span class="t">${esc(a.name)}</span><span class="sub">${esc(a.era)} century · ${a.works.length} ${a.works.length === 1 ? "work" : "works"}</span></span>${ICON.chev}</a>`).join("")}</div>` : "";
    }).join("") || `<div class="empty">No Father by that name.</div>`;
  };
  draw();
  $("#fq").oninput = (e) => draw(e.target.value.trim());
}
async function renderFather(id) {
  const L = await lib(); const i = L.findIndex((x) => x.id === id); const a = L[i];
  if (!a) { location.replace("#/fathers"); return; }
  setTop("", { back: true });
  view.innerHTML = `<div style="text-align:center;margin:6px 0 18px">${monogram(a.name, i, 96)}
    <h2 style="font-size:26px">${esc(a.name)}</h2><div style="margin-top:8px"><span class="chip ${a.label}">${esc(LABEL[a.label])}</span></div>
    <div class="small muted" style="margin-top:8px">${esc(a.era)} century${a.feast ? ` · Feast: ${esc(a.feast)}` : ""}</div></div>
    <p class="prose">${esc(a.bio)}</p>
    <div class="sec-h"><h2>Writings</h2><span class="small muted">on New Advent</span></div>
    <div class="list">${a.works.map((w) => `<a class="row-btn" href="${esc(w.u)}" target="_blank" rel="noopener" style="border-bottom:1px solid var(--line)"><span class="grow"><span class="t" style="white-space:normal">${esc(w.t)}</span></span>${ICON.out}</a>`).join("")}</div>
    <p class="small muted" style="margin-top:14px">These open the 19th-century English translations on newadvent.org.</p>`;
}

// ---------------------------------------------------------------- prayers and the rope
async function renderPrayers() {
  setTop("Prayers", { back: true });
  const PR = await prayers();
  view.innerHTML = `<div class="stack">${PR.map((p, i) => `<a class="card guided" href="#/prayer/${p.id}"><div class="txt"><div class="kind">${esc(p.kind)}</div><h3>${esc(p.title)}</h3><div class="dur">${ICON.play}${esc(p.mins)}</div></div>${thumbArt(PALETTE[(i + 3) % PALETTE.length], ["halo", "star", "wave", "flame", "cross"][i % 5])}</a>`).join("")}
    <a class="card guided" href="#/rope"><div class="txt"><div class="kind">The Jesus Prayer</div><h3>Pray with a prayer rope</h3><div class="dur">${ICON.play}${ropeTotal().toLocaleString()} prayed so far</div></div>${thumbArt("#3a2f4f", "halo", `<span style="position:relative;color:#fff">${ICON.beads.replace("<svg", '<svg style="width:40px;height:40px"')}</span>`)}</a></div>
    <p class="small muted" style="margin:18px 4px">English versions made for this app from the traditional texts. Pray as your parish and your priest guide you.</p>`;
}
async function renderPrayer(id) {
  const PR = await prayers(); const p = PR.find((x) => x.id === id);
  if (!p) { location.replace("#/prayers"); return; }
  setTop(p.title, { back: true });
  const html = [];
  for (const part of p.parts) {
    if (part.h) html.push(`<h3>${esc(part.h)}</h3>`);
    else if (part.p) html.push(`<p>${esc(part.p)}</p>`);
    else if (part.r) html.push(`<p class="rubric">${esc(part.r)}</p>`);
    else if (part.read) {
      const r = planRef(part.read); let vs = null;
      try {
        if (part.n === "lxx" && r.code === "PSA") { const book = await get(`bible/${tr()}/PSA.json`); const cc = tr() === "lxx" ? r.c : (MAP.PSA[r.c] || [[r.c]]).find((x) => x[1] > 0)[0]; vs = (book.find((x) => x[0] === cc) || [0, []])[1]; }
        else { const [b, ch] = fromEng(r.code, r.c, r.v || 1); const book = await get(`bible/${tr()}/${b}.json`); vs = (book.find((x) => x[0] === ch) || [0, []])[1]; if (r.v) vs = vs.filter(([v]) => v >= r.v && v <= r.v2); }
      } catch (e) { vs = null; }
      html.push(vs && vs.length ? `<p>${esc(vs.map((x) => x[1]).join(" "))}</p>` : `<p class="rubric">${esc(refText(r))}</p>`);
    }
  }
  view.innerHTML = `<div class="label">${esc(p.kind)} · ${esc(p.mins)}</div><div class="big-title" style="font-size:30px">${esc(p.title)}</div><div class="prayer">${html.join("")}</div>
    <button class="btn red wide" id="prayed" style="margin-top:18px">${ICON.check} Amen</button>`;
  $("#prayed").onclick = () => { markRead(`prayer:${id}`); toast("Glory to God"); history.back(); };
}
function renderRope() {
  setTop("The Jesus Prayer", { back: true });
  const t = today();
  const draw = () => {
    const n = S.rope[t] || 0, size = S.ropeSize, inRope = n % size, R = 104, C = 2 * Math.PI * R;
    view.innerHTML = `<div class="rope">
      <div class="words">Lord Jesus Christ, Son of God, have mercy on me, a sinner.</div>
      <button class="knot" id="knot" aria-label="Pray once. ${n} today."><svg viewBox="0 0 230 230"><circle cx="115" cy="115" r="${R}" stroke="var(--surface2)" stroke-width="10" fill="none"/><circle cx="115" cy="115" r="${R}" stroke="var(--accent)" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - inRope / size)}" style="transition:stroke-dashoffset .25s"/></svg>
        <div><div class="count">${n}</div><div class="of">${Math.floor(n / size)} ${Math.floor(n / size) === 1 ? "rope" : "ropes"} · ${inRope} of ${size}</div></div></button>
      <p class="muted small" style="max-width:300px;margin:0">Tap the circle once for each prayer. Pray slowly and attentively. Your phone gives a little buzz at the end of each rope.</p>
      <div class="seg" style="justify-content:center">${[33, 50, 100].map((s) => `<button data-size="${s}" aria-pressed="${S.ropeSize === s}">${s} knots</button>`).join("")}</div>
      <div class="row" style="justify-content:center"><span class="small muted">${ropeTotal().toLocaleString()} prayed in all</span>${n ? `<button class="ghost" id="reset" style="margin-left:12px">Reset today</button>` : ""}</div></div>`;
    $("#knot").onclick = () => {
      S.rope[t] = (S.rope[t] || 0) + 1; save();
      if (navigator.vibrate) navigator.vibrate(S.rope[t] % S.ropeSize === 0 ? [40, 60, 40] : 8);
      if (S.rope[t] % S.ropeSize === 0) { markRead("rope"); toast("A full rope. Glory to God"); }
      if (ropeTotal() === 1000) checkBadges();
      draw();
    };
    view.querySelectorAll("[data-size]").forEach((b) => (b.onclick = () => { S.ropeSize = +b.dataset.size; save(); draw(); }));
    if ($("#reset")) $("#reset").onclick = () => { if (confirm("Reset today's count?")) { delete S.rope[t]; save(); draw(); } };
  };
  draw();
}

// ---------------------------------------------------------------- search
async function renderSearch(q0) {
  setTop("Search", { back: true });
  view.innerHTML = `<input type="search" id="q" placeholder="A word, or a verse like John 3:16" value="${esc(q0)}" aria-label="Search the Bible">
    <p class="small muted" style="margin:10px 4px">Searching the ${tr() === "lxx" ? "Septuagint Bible" : "World English Bible"}.</p><div id="res"></div>`;
  const input = $("#q");
  const go = () => { const q = input.value.trim(); history.replaceState(null, "", "#/search?q=" + encodeURIComponent(q)); run(q); };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  let t; input.oninput = () => { clearTimeout(t); t = setTimeout(go, 350); };
  if (q0) run(q0);
  setTimeout(() => input.focus(), 50);
}
let searchRun = 0;
async function run(q) {
  const res = $("#res"); const id = ++searchRun;
  if (!q) { res.innerHTML = ""; return; }
  const ref = parseRef(q);
  if (ref && inTr(ref.code === "DAN" ? "DAG" : ref.code)) {
    const b = ref.code === "DAN" ? "DAG" : ref.code;
    res.innerHTML = `<a class="card" href="#/read/${b}/${ref.c}${ref.v ? "?v=" + ref.v + (ref.to ? "&to=" + ref.to : "") : ""}" style="display:block"><div class="small muted">Go to</div><h3>${esc(shortChap(b, ref.c))}${ref.v ? ":" + ref.v + (ref.to ? "–" + ref.to : "") : ""}</h3></a>`;
    return;
  }
  if (q.length < 3) { res.innerHTML = `<div class="empty small">Type at least 3 letters.</div>`; return; }
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = []; const codes = order(); let done = 0;
  res.innerHTML = `<div class="empty small">Searching… <span id="prog">0</span>%</div>`;
  for (const code of codes) {
    let book; try { book = await get(`bible/${tr()}/${code}.json`); } catch (e) { continue; }
    if (id !== searchRun) return;
    for (const [c, vs] of book) for (const [v, t] of vs) { const low = t.toLowerCase(); if (words.every((w) => low.includes(w))) hits.push([code, c, v, t]); }
    done++; const p = $("#prog"); if (p) p.textContent = Math.round((100 * done) / codes.length);
    if (hits.length >= 300) break;
  }
  if (id !== searchRun) return;
  const re = new RegExp("(" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
  res.innerHTML = hits.length ? `<p class="small muted" style="margin:0 4px 8px">${hits.length >= 300 ? "First 300" : hits.length} ${hits.length === 1 ? "verse" : "verses"}</p><div class="list">${hits.map(([code, c, v, t]) => `<a class="row-btn search-res" href="#/read/${code}/${c}?v=${v}" style="border-bottom:1px solid var(--line)"><span class="grow"><span class="ref">${esc(shortChap(code, c))}:${v}</span><br>${esc(t).replace(re, "<mark>$1</mark>")}</span></a>`).join("")}</div>` : `<div class="empty">No verses found.</div>`;
}

// ---------------------------------------------------------------- You
let youTab = "all";
async function renderYou() {
  setTop("", { acts: `<button class="iconbtn round" id="gear" aria-label="Settings">${ICON.gear}</button>` });
  $("#gear").onclick = () => (location.hash = "#/settings");
  const P = await plans();
  const feed = [];
  Object.entries(S.hlAt).forEach(([k, at]) => S.hl[k] && feed.push({ kind: "hl", at, k, verb: "highlighted" }));
  Object.entries(S.noteAt).forEach(([k, at]) => S.notes[k] && feed.push({ kind: "notes", at, k, verb: "wrote a note on", sub: S.notes[k] }));
  Object.entries(S.bm).forEach(([k, b]) => feed.push({ kind: "bm", at: b.at, k, verb: "saved", sub: b.text }));
  Object.entries(S.plans).forEach(([id, pr]) => { const p = P.plans.find((x) => x.id === id); if (!p) return; Object.entries(pr.done || {}).forEach(([d, date]) => feed.push({ kind: "plans", at: new Date(date + "T20:00:00").getTime(), plan: p, d: +d + 1, verb: `finished day ${+d + 1} of` })); });
  feed.sort((a, b) => b.at - a.at);
  const label = (k) => { const [code, c, v] = k.split("."); const pos = fromEng(code, +c, +v); const vn = pos[2] || (pos[3] != null ? pos[3] + 1 : ""); return { text: `${shortChap(pos[0], pos[1])}${vn ? ":" + vn : ""}`, href: `#/read/${pos[0]}/${pos[1]}?${pos[3] != null ? "i=" + pos[3] : "v=" + pos[2]}` }; };
  const icon = { hl: ICON.pen, notes: ICON.note, bm: ICON.bookmark, plans: ICON.check };
  const list = feed.filter((f) => youTab === "all" || f.kind === youTab);
  const tabs = [["all", "All"], ["hl", "Highlights"], ["notes", "Notes"], ["bm", "Saved"], ["plans", "Plans"]];
  view.innerHTML = `<div class="profile"><div class="av">${esc((S.name || "☩")[0].toUpperCase())}</div><div style="flex:1;min-width:0"><div class="big-title" style="margin:0;font-size:26px">${esc(S.name || "Welcome")}</div><button class="ghost" id="nm">${S.name ? "Change name" : "Add your name"}</button></div></div>
    <div class="stats"><div class="card"><div class="label">Reading streak</div><b>${streak()}${ICON.flame}</b><div class="small muted">Best: ${Math.max(S.best || 0, streak())}</div></div>
      <div class="card"><div class="label">Days reading this year</div><b>${daysThisYear()}</b><div class="small muted">${ropeTotal().toLocaleString()} Jesus Prayers</div></div></div>
    <div class="sec-h"><h2>Badges</h2><span class="small muted">${BADGES.filter((b) => b.got()).length} of ${BADGES.length}</span></div>
    <div class="scroller badges">${BADGES.slice().sort((a, b) => b.got() - a.got()).map(badgeHTML).join("")}</div>
    <div class="sec-h"><h2>Activity</h2></div>
    <div class="filters">${tabs.map(([k, n]) => `<button data-yt="${k}" aria-pressed="${youTab === k}">${n}</button>`).join("")}</div>
    <div class="list feed">${list.length ? list.slice(0, 80).map((f) => {
      if (f.kind === "plans") return `<a class="row-btn" href="#/plan/${f.plan.id}/${f.d}"><span class="ic">${icon.plans}</span><span class="grow"><span class="t" style="white-space:normal">You ${esc(f.verb)} ${esc(f.plan.title)}</span></span><span class="small muted">${ago(f.at)}</span></a>`;
      const l = label(f.k);
      return `<a class="row-btn" href="${l.href}"><span class="ic">${icon[f.kind]}</span><span class="grow"><span class="t">You ${esc(f.verb)} ${esc(l.text)}</span>${f.sub ? `<span class="sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.sub)}</span>` : ""}</span><span class="small muted">${ago(f.at)}</span></a>`;
    }).join("") : `<div class="empty">Highlights, notes, saved verses and plan days will show here.</div>`}</div>`;
  $("#nm").onclick = () => { const n = prompt("Your name (only kept on this phone)", S.name || ""); if (n !== null) { S.name = n.trim().slice(0, 40); save(); renderYou(); } };
  view.querySelectorAll("[data-yt]").forEach((b) => (b.onclick = () => { youTab = b.dataset.yt; renderYou(); }));
}
function renderSettings() {
  setTop("Settings", { back: true });
  view.innerHTML = `
    <div class="sec-h" style="margin-top:6px"><h2>Bible</h2></div>
    <div class="seg"><button data-tr="lxx" aria-pressed="${tr() === "lxx"}" style="flex:1">Septuagint</button><button data-tr="web" aria-pressed="${tr() === "web"}" style="flex:1">World English Bible</button></div>
    <p class="small muted" style="margin:8px 4px 0">${tr() === "lxx" ? "The Old Testament the Orthodox Church reads (Brenton's Septuagint, 1851) with the World English Bible New Testament." : "Modern English throughout, Old Testament from the Hebrew, with the Orthodox books added."}</p>
    <div class="sec-h"><h2>Church calendar</h2></div>
    <div class="seg"><button data-cal="new" aria-pressed="${S.settings.cal === "new"}" style="flex:1">New Calendar</button><button data-cal="old" aria-pressed="${S.settings.cal === "old"}" style="flex:1">Old Calendar</button></div>
    <p class="small muted" style="margin:8px 4px 0">Greek, Antiochian, Romanian and OCA parishes mostly keep the New (Revised Julian) Calendar; Russian, Serbian, Georgian and Athonite parishes the Old. Ask your priest if unsure.</p>
    <div class="sec-h"><h2>Look</h2></div>
    <div class="seg"><button data-t="dark" aria-pressed="${S.settings.theme === "dark"}" style="flex:1">Dark</button><button data-t="light" aria-pressed="${S.settings.theme === "light"}" style="flex:1">Light</button></div>
    <div class="sec-h"><h2>The Fathers</h2></div>
    <label class="card row" style="justify-content:space-between;cursor:pointer;flex-wrap:nowrap"><span>Show early writers who are not saints<span class="small muted" style="display:block">Origen, Tertullian, Eusebius and others, clearly labelled</span></span><input type="checkbox" id="writers" ${S.settings.writers ? "checked" : ""} style="width:22px;height:22px;flex:0 0 22px"></label>
    <div class="sec-h"><h2>Daily reminder</h2></div>
    <div class="card stack"><div class="row"><input type="time" id="rt" value="07:00" style="width:auto"><button class="btn small" id="ics">Add to my calendar</button></div>
      <p class="small muted" style="margin:0">Adds a daily event to your phone's calendar to remind you to read. Change or delete it there.</p></div>
    <div class="sec-h"><h2>Offline</h2></div>
    <div class="card stack"><button class="btn secondary" id="offline">Save the whole Bible for offline</button><p class="small muted" style="margin:0" id="offMsg">Chapters you open are kept automatically. This saves every book (about 5 MB).</p></div>
    <div class="sec-h"><h2>Backup</h2></div>
    <div class="row"><button class="btn secondary small" id="exp">Download my data</button><label class="btn secondary small" style="cursor:pointer">Restore<input type="file" id="imp" accept="application/json" hidden></label></div>
    <div class="sec-h"><h2>About</h2></div>
    <div class="card prose small" style="font-size:16px">
      <p>A simple Orthodox Bible: the Septuagint, the readings of the Church year and the Holy Fathers on every page. Free, with no ads, no accounts and no tracking. What you save stays on this phone.</p>
      <p><b>Texts.</b> Brenton's Septuagint (1851) and the World English Bible, both public domain, from eBible.org.</p>
      <p><b>The Fathers.</b> Public-domain 19th-century translations (the Ante-Nicene and Nicene and Post-Nicene Fathers, and the 1841 Catena Aurea), arranged by verse by the Historical Christian Faith Commentaries Database. Writings open on New Advent.</p>
      <p><b>Calendar.</b> orthocal.info, following the rubrics of the Orthodox Church in America.</p>
      <p><b>Prayers.</b> English versions made for this app from the traditional texts.</p>
      <p>This app is not a substitute for your parish or your spiritual father.</p></div>`;
  view.querySelectorAll("[data-tr]").forEach((b) => (b.onclick = () => { S.settings.tr = b.dataset.tr; save(); renderSettings(); }));
  view.querySelectorAll("[data-cal]").forEach((b) => (b.onclick = () => { S.settings.cal = b.dataset.cal; save(); renderSettings(); }));
  view.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { S.settings.theme = b.dataset.t; save(); applyTheme(); renderSettings(); }));
  $("#writers").onchange = (e) => { S.settings.writers = e.target.checked; save(); };
  $("#ics").onclick = () => reminder($("#rt").value || "07:00");
  $("#offline").onclick = saveOffline;
  $("#exp").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: "application/json" })); a.download = `orthodox-bible-backup-${today()}.json`; a.click(); };
  $("#imp").onchange = async (e) => { try { const d = JSON.parse(await e.target.files[0].text()); if (!d.settings) throw 0; S = Object.assign(blank(), d); save(); applyTheme(); toast("Restored"); renderSettings(); } catch (err) { toast("That file isn't a backup from this app"); } };
}
function reminder(time) {
  const [h, m] = time.split(":");
  const start = today().replace(/-/g, "") + `T${h}${m}00`;
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Orthodox Bible//EN", "BEGIN:VEVENT", `UID:ob-${Date.now()}@orthodox-bible`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART:${start}`, "DURATION:PT10M", "RRULE:FREQ=DAILY", "SUMMARY:Today's readings", `DESCRIPTION:Open Orthodox Bible: ${location.origin}${location.pathname}`, "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Today's readings", "TRIGGER:PT0M", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "daily-readings.ics"; a.click();
  toast("Open the file to add it to your calendar");
}
async function saveOffline() {
  const b = $("#offline"); b.setAttribute("disabled", ""); const codes = order(); let n = 0;
  for (const code of codes) { try { await get(`bible/${tr()}/${code}.json`); } catch (e) { /* keep going */ } n++; $("#offMsg").textContent = `Saving… ${Math.round((100 * n) / codes.length)}%`; }
  await Promise.all([plans(), lib(), prayers()]).catch(() => {});
  $("#offMsg").textContent = "Saved. The Bible now works without internet."; b.removeAttribute("disabled");
}

// ---------------------------------------------------------------- routes
async function route() {
  closeSheet();
  if (!location.hash.startsWith("#/read")) stopSpeaking();
  const [path, qs] = (location.hash.slice(1) || "/today").split("?");
  const q = new URLSearchParams(qs || "");
  const p = path.split("/").filter(Boolean);
  const tab = { today: "today", bible: "bible", read: "bible", plans: "plans", plan: "plans", discover: "discover", fathers: "discover", father: "discover", prayers: "discover", prayer: "discover", rope: "discover", search: "discover", you: "you", settings: "you", more: "you", mine: "you" }[p[0]] || "today";
  document.querySelectorAll(".tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"));
  try {
    if (!BOOKS.length) await boot();
    if (p[0] === "bible") { location.replace(`#/read/${p[1] || S.last.b}/${p[1] ? 1 : S.last.c}`); return; }
    else if (p[0] === "read") await renderReader(p[1], +p[2] || 1, q);
    else if (p[0] === "plans") await renderPlans(q);
    else if (p[0] === "plan" && p[2]) await renderPlanDay(p[1], +p[2]);
    else if (p[0] === "plan") await renderPlan(p[1]);
    else if (p[0] === "discover") await renderDiscover();
    else if (p[0] === "fathers") await renderFathers();
    else if (p[0] === "father") await renderFather(p[1]);
    else if (p[0] === "prayers") await renderPrayers();
    else if (p[0] === "prayer") await renderPrayer(p[1]);
    else if (p[0] === "rope") renderRope();
    else if (p[0] === "search") await renderSearch(q.get("q") || "");
    else if (p[0] === "you" || p[0] === "mine") await renderYou();
    else if (p[0] === "settings" || p[0] === "more") renderSettings();
    else await renderToday();
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card empty">Something went wrong loading this page. Check your connection and try again.<br><br><button class="btn small" onclick="location.reload()">Reload</button></div>`;
  }
  if (p[0] !== "read") window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
route();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
