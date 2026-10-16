/* Orthodox Bible: the Septuagint and New Testament with the Church Fathers, the day's readings
   from the Church calendar, and reading plans. One page, no accounts: everything a person saves
   (place, highlights, notes, plans) stays on their own phone. */
(() => {
"use strict";

// ---------------------------------------------------------------- saved on this phone
const KEY = "ob1";
const blank = () => ({ settings: { tr: "lxx", cal: "new", size: 19, theme: "auto", writers: true },
  last: { b: "JHN", c: 1 }, hl: {}, bm: {}, notes: {}, plans: {}, read: {}, days: [] });
let S;
try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = blank(); }
S.settings = Object.assign(blank().settings, S.settings);
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: works for this visit */ } }

// ---------------------------------------------------------------- small helpers
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const view = $("#view");
const ICON = {
  book: '<svg viewBox="0 0 24 24"><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/></svg>',
  father: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/></svg>',
  out: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
  aa: '<svg viewBox="0 0 24 24"><path d="M3 18l5-12 5 12M5 14h6M15 18l3.5-8 3.5 8M16 16h5"/></svg>',
  note: '<svg viewBox="0 0 24 24"><path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4"/></svg>',
  mark: '<svg viewBox="0 0 24 24"><path d="M7 4h10v16l-5-4-5 4z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 9l5-5 5 5M5 14v5h14v-5"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
};
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200); }
function applyTheme() {
  const root = document.documentElement;
  if (S.settings.theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", S.settings.theme);
  root.style.setProperty("--size", S.settings.size + "px");
}
applyTheme();
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
const longDate = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

// ---------------------------------------------------------------- data (cached by the service worker too)
const cache = new Map();
async function get(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch("data/" + path).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  cache.set(path, p);
  p.catch(() => cache.delete(path));
  return p;
}
const getOr = (path, fallback) => get(path).catch(() => fallback);
let BOOKS = [], BY = {}, SECTIONS = {}, MAP = null, AUTH = {}, PLANS = null, LIB = null;
async function boot() {
  const [b, m, a] = await Promise.all([get("books.json"), get("map.json"), get("fathers/authors.json")]);
  BOOKS = b.books; SECTIONS = b.sections; MAP = m; AUTH = a;
  BOOKS.forEach((x) => (BY[x.code] = x));
  buildPsalmIndex();
}
const tr = () => S.settings.tr;
const chapters = (code, t = tr()) => BY[code]?.["ch_" + t] || 0;
const bookName = (code, t = tr()) => { const b = BY[code]; if (!b) return code; return t === "lxx" && b.lxx && b.ot ? b.lxx : b.name; };
const inTr = (code, t = tr()) => chapters(code, t) > 0;

// ---------------------------------------------------------------- Septuagint <-> English numbering
// The Fathers' words are filed by English (Hebrew) numbers. The Septuagint numbers Psalms,
// Jeremiah's later chapters and Daniel 3 differently, so the reader converts both ways.
let PSI = {};
function buildPsalmIndex() {
  PSI = {};
  Object.entries(MAP.PSA).forEach(([lc, rows]) => rows.forEach(([ec, ev], i) => { if (ev) PSI[ec + ":" + ev] = PSI[ec + ":" + ev] || [Number(lc), i]; }));
}
const JER_BACK = () => { const o = {}; Object.entries(MAP.JER).forEach(([l, e]) => { if (!(e in o)) o[e] = Number(l); }); return o; };
// [engChapter, engVerse] for a verse in the reader. Psalms need the chapter's verse list (index).
function toEng(code, c, v, verseIndex) {
  if (code === "PSA" && tr() === "lxx") { const row = MAP.PSA[c]; return row && row[verseIndex] ? row[verseIndex] : [c, v]; }
  if (code === "JER" && tr() === "lxx") return [MAP.JER[c] || c, v];
  if (code === "DAG" && c === 3 && v >= 91) return [3, v - 67];
  return [c, v];
}
// The reader's [chapter, verse] for an English reference (plans and the calendar use English numbers).
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
// "jn 3:16", "Psalm 50", "1 cor 13 4-7" -> {code, c, v, to}
function parseRef(q) {
  const m = q.trim().toLowerCase().match(/^([1-4]?\s*[a-z][a-z .]*?)\s*(\d+)(?:\s*[:.\s]\s*(\d+)(?:\s*-\s*(\d+))?)?$/);
  if (!m) return null;
  const code = aliases()[m[1].replace(/[^a-z0-9]/g, "")];
  if (!code) return null;
  return { code, c: Number(m[2]), v: m[3] ? Number(m[3]) : 0, to: m[4] ? Number(m[4]) : 0 };
}
// "JHN 1:1-18", "PSA 1-8", "MAT 6:9" (plans) -> {code, c, v, c2, v2}
function planRef(s) {
  const m = s.match(/^(\w+) (\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/);
  if (!m) return null;
  const [, code, c, v, a, b] = m;
  if (!v) return { code, c: +c, v: 0, c2: a ? +a : +c, v2: 0 };
  return { code, c: +c, v: +v, c2: b ? +a : +c, v2: b ? +b : a ? +a : +v };
}
function refText(r, numbering) {
  const name = r.code === "PSA" ? (r.c2 !== r.c ? "Psalms" : "Psalm") : BY[r.code] ? BY[r.code].name : r.code;
  if (!r.v) return `${name} ${r.c}${r.c2 !== r.c ? "–" + r.c2 : ""}`;
  return `${name} ${r.c}:${r.v}${r.c2 !== r.c ? `–${r.c2}:${r.v2}` : r.v2 !== r.v ? "–" + r.v2 : ""}`;
}

// ---------------------------------------------------------------- the Fathers on a chapter
async function fathersFor(code, engChapters) {
  const lists = await Promise.all([...new Set(engChapters)].map((c) => getOr(`fathers/${code}/${c}.json`, []).then((l) => l.map((e) => ({ ...e, ch: c })))));
  return lists.flat().filter((e) => S.settings.writers || !["writer", "document"].includes(AUTH[e.a]?.label));
}
const covers = (e, c, v) => e.ch === c && e.v[0] <= v && v <= e.v[1];
const authorName = (id) => AUTH[id]?.name || id;
function fatherHTML(e, i) {
  const a = AUTH[e.a] || { name: e.a, label: "writer", about: "" };
  const long = e.q.length > 700;
  const shown = long ? e.q.slice(0, e.q.lastIndexOf(" ", 650)) + "…" : e.q;
  return `<div class="father" data-i="${i}">
    <div class="who"><b>${esc(a.name)}</b><span class="chip ${a.label}" title="${esc(a.about)}">${esc(LABEL[a.label] || "")}</span></div>
    <div class="work">${esc(e.t)}${e.v[1] !== e.v[0] ? ` · on verses ${e.v[0]}${e.v[1] === 999 ? "+" : "–" + e.v[1]}` : ""}</div>
    <blockquote>${esc(shown)}</blockquote>
    <div class="row">${long ? `<button class="btn ghost more" data-more="${i}">Read all</button>` : ""}${e.u ? `<a class="btn ghost" href="${esc(e.u)}" target="_blank" rel="noopener">Source ${ICON.out}</a>` : ""}</div>
  </div>`;
}
const LABEL = { saint: "Saint", blessed: "Blessed", western: "Western saint", writer: "Not a saint", document: "Early writing" };
function fathersList(box, entries) {
  const people = [...new Set(entries.map((e) => e.a))].sort((x, y) => (AUTH[x]?.rank || 9) - (AUTH[y]?.rank || 9));
  let pick = "";
  const draw = () => {
    const list = entries.filter((e) => !pick || e.a === pick).sort((x, y) => (AUTH[x.a]?.rank || 9) - (AUTH[y.a]?.rank || 9));
    box.innerHTML = (people.length > 1 ? `<div class="filters"><button aria-pressed="${!pick}" data-p="">All ${entries.length}</button>${people.map((p) => `<button aria-pressed="${pick === p}" data-p="${esc(p)}">${esc(authorName(p).replace(/^(St|Blessed) /, ""))}</button>`).join("")}</div>` : "") +
      (list.length ? list.map((e) => fatherHTML(e, entries.indexOf(e))).join("") : `<div class="empty">Nothing here yet.</div>`);
    box.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { pick = b.dataset.p; draw(); }));
    box.querySelectorAll("[data-more]").forEach((b) => (b.onclick = () => { const e = entries[+b.dataset.more]; const q = b.closest(".father").querySelector("blockquote"); q.textContent = e.q; b.remove(); }));
  };
  draw();
}

// ---------------------------------------------------------------- sheet
function openSheet(html, onOpen) {
  $("#sheetBody").innerHTML = html; $("#sheet").hidden = false; $(".sheet-in").scrollTop = 0;
  if (onOpen) onOpen($("#sheetBody"));
}
function closeSheet() { $("#sheet").hidden = true; $("#sheetBody").innerHTML = ""; document.querySelectorAll(".verse.sel").forEach((v) => v.classList.remove("sel")); }
$("#sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") closeSheet(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });

// ---------------------------------------------------------------- reading days and streaks
function markRead(key) {
  const t = today();
  S.read[t] = S.read[t] || [];
  if (!S.read[t].includes(key)) S.read[t].push(key);
  if (!S.days.includes(t)) S.days.push(t);
  save();
}
function streak() {
  const set = new Set(S.days); let n = 0, d = today();
  if (!set.has(d)) d = addDays(d, -1);
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

// ---------------------------------------------------------------- top bar
function setTop(title, { back = false, acts = "", titleHTML = "" } = {}) {
  $("#title").innerHTML = titleHTML || esc(title);
  $("#back").hidden = !back;
  $("#topActs").innerHTML = acts;
  document.title = title ? `${title} · Orthodox Bible` : "Orthodox Bible";
}
$("#back").onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/today"));

// ---------------------------------------------------------------- Today
async function dayData(date) {
  const k = `day:${S.settings.cal}:${date}`;
  try {
    const r = await fetch(`api/day?date=${date}&cal=${S.settings.cal}`);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    try { localStorage.setItem(k, JSON.stringify(d)); } catch (e) { /* full: fine */ }
    return d;
  } catch (e) {
    try { return JSON.parse(localStorage.getItem(k)); } catch (e2) { return null; }
  }
}
// The calendar gives each reading as a list of verses; group them into ranges.
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
// A link to open a passage given in English numbers. extra: {k: today's reading} or {plan: "id:day"}.
const readHash = (r, extra = {}) => {
  const [code, c, v, idx] = fromEng(r.code, r.c, r.v || 1);
  const end = r.v2 ? fromEng(r.code, r.c2, r.v2) : null;
  const p = new URLSearchParams();
  if (r.v) { if (idx != null) p.set("i", idx); else p.set("v", v); }
  if (end && end[1] === c) { if (end[3] != null) p.set("ti", end[3]); else p.set("to", end[2]); }
  Object.entries(extra).forEach(([k, x]) => p.set(k, x));
  return `#/read/${code}/${c}${p.toString() ? "?" + p : ""}`;
};
// Today's reading as one passage: from the first verse to the last, if they share a chapter.
const wholeReading = (ranges) => { const a = ranges[0], z = ranges[ranges.length - 1]; return a.code === z.code && a.c === z.c2 ? { ...a, c2: z.c2, v2: z.v2 } : a; };
async function renderToday() {
  setTop("Today", { acts: `<button class="iconbtn" id="goSearch" aria-label="Search">${ICON.search}</button>` });
  $("#goSearch").onclick = () => (location.hash = "#/search");
  const t = today();
  view.innerHTML = `<div class="day-head"><div class="date">${esc(longDate(t))}</div><h2>&nbsp;</h2><p class="saints muted">Loading the Church calendar…</p></div>`;
  const d = await dayData(t);
  if (!d) {
    view.innerHTML = `<div class="day-head"><div class="date">${esc(longDate(t))}</div></div><div class="card empty">Can't reach the Church calendar right now. Check your connection and try again.<br><br><button class="btn" onclick="location.reload()">Try again</button></div>` + plansToday();
    wirePlansToday(); return;
  }
  const fast = d.fastLevel ? `<span class="pill fast">${esc(d.fast)}${d.fastException ? " · " + esc(d.fastException) : ""}</span>` : `<span class="pill">${esc(d.fast || "No fast")}</span>`;
  const abstain = d.fastLevel && d.abstain.length ? `<p class="small muted" style="margin:8px 4px 0">Fasting from ${esc(listWords(d.abstain))}. Follow the guidance of your priest.</p>` : "";
  const readings = d.readings.map((r, i) => {
    const ranges = readingRanges(r.verses);
    const key = `${t}:${i}`;
    const done = (S.read[t] || []).includes(key);
    return { r, i, ranges, key, done };
  });
  const sk = streak();
  view.innerHTML = `
    <div class="day-head">
      <div class="date">${esc(longDate(t))}${d.cal === "old" ? ` · ${esc(new Date(d.churchDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" }))} (Old Calendar)` : ""}</div>
      <h2>${esc(d.titles[0] || d.feast || "")}</h2>
      ${d.saints.length ? `<p class="saints">${esc(d.saints.join(" · "))}</p>` : ""}
      <div class="row">${fast}${d.feasts && d.feasts.length ? d.feasts.map((f) => `<span class="pill feast">${esc(f)}</span>`).join("") : ""}${d.tone ? `<span class="pill">Tone ${d.tone}</span>` : ""}</div>
      ${abstain}
    </div>
    <div class="eyebrow">Today's readings</div>
    <div class="stack" id="readings">${readings.map(({ r, i, ranges, done }) => `
      <a class="card reading" href="${readHash(wholeReading(ranges), { k: `${t}:${i}` })}" style="text-decoration:none;color:inherit" data-i="${i}">
        <div style="flex:1;min-width:0"><div class="kind">${esc(r.source)}${r.desc ? " · " + esc(r.desc) : ""}</div>
        <div class="ref">${esc(r.display.replace(/\./g, ":"))}</div><div class="meta" data-meta="${i}">&nbsp;</div></div>
        <span class="tick ${done ? "on" : ""}">${done ? ICON.check : ""}</span></a>`).join("") || `<div class="card empty">No readings listed for today.</div>`}
    </div>
    ${sk ? `<div class="eyebrow">Keep going</div><div class="card streak"><b>${sk}</b><div>${sk === 1 ? "day" : "days in a row"} of reading<div class="small muted">Read today's Gospel or a plan day to keep it up.</div></div></div>` : ""}
    ${plansToday()}`;
  wirePlansToday();
  // How many comments the Fathers left on each reading.
  readings.forEach(async ({ ranges, i }) => {
    const r = ranges[0]; const code = r.code === "DAN" ? "DAG" : r.code;
    const list = await fathersFor(code, ranges.map((x) => x.c));
    const n = list.filter((e) => ranges.some((x) => e.ch >= x.c && e.ch <= x.c2 && e.v[1] >= (e.ch === x.c ? x.v : 1) && e.v[0] <= (e.ch === x.c2 ? x.v2 : 999))).length;
    const el = view.querySelector(`[data-meta="${i}"]`); if (el) el.textContent = n ? `${n} ${n === 1 ? "comment" : "comments"} from the Fathers` : "";
  });
}
const listWords = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
function plansToday() {
  const active = Object.entries(S.plans).filter(([id, p]) => p.started && !p.finished);
  if (!active.length) return `<div class="eyebrow">Reading plans</div><a class="card" href="#/plans" style="display:block;text-decoration:none;color:inherit"><h3>Start a reading plan</h3><p class="muted small" style="margin:4px 0 0">The Gospels with the Fathers, the Psalter, the Seven Councils and more.</p></a>`;
  return `<div class="eyebrow">Your plans</div><div class="list" id="todayPlans">${active.map(([id]) => `<button class="list-btn" data-plan="${esc(id)}"><span class="grow"><b data-pt="${esc(id)}">${esc(id)}</b><span class="sub" data-pn="${esc(id)}"></span></span>${ICON.chev}</button>`).join("")}</div>`;
}
async function wirePlansToday() {
  const box = $("#todayPlans"); if (!box) return;
  const P = await plans();
  box.querySelectorAll("[data-plan]").forEach((b) => {
    const p = P.plans.find((x) => x.id === b.dataset.plan); if (!p) { b.remove(); return; }
    const n = nextDay(p);
    b.querySelector("[data-pt]").textContent = p.title;
    b.querySelector("[data-pn]").textContent = `Day ${n + 1} of ${p.days.length}: ${p.days[n].title}`;
    b.onclick = () => (location.hash = `#/plan/${p.id}/${n + 1}`);
  });
}

// ---------------------------------------------------------------- Bible: books and chapters
function renderBooks() {
  setTop("Bible", { acts: `<button class="iconbtn" id="goSearch" aria-label="Search">${ICON.search}</button>` });
  $("#goSearch").onclick = () => (location.hash = "#/search");
  const groups = {};
  BOOKS.filter((b) => inTr(b.code)).forEach((b) => (groups[b.section] = groups[b.section] || []).push(b));
  const last = S.last;
  view.innerHTML = `
    <a class="card" href="#/read/${last.b}/${last.c}" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;margin-bottom:6px">
      <div class="grow" style="flex:1"><div class="small muted">Continue reading</div><h3>${esc(last.b === "PSA" ? psalmLabel(last.c) : bookName(last.b) + " " + last.c)}</h3></div>${ICON.chev}</a>
    <div class="seg" style="margin:14px 0 4px" role="group" aria-label="Translation">
      <button data-tr="lxx" aria-pressed="${tr() === "lxx"}">Septuagint</button><button data-tr="web" aria-pressed="${tr() === "web"}">World English Bible</button></div>
    <p class="small muted" style="margin:6px 4px 0">${tr() === "lxx" ? "The Old Testament the Orthodox Church reads (Brenton's Septuagint, 1851) with the New Testament from the World English Bible." : "The World English Bible: modern English, Old Testament from the Hebrew, with the Orthodox books added."}</p>
    ${Object.entries(groups).map(([sec, list]) => `<div class="eyebrow">${esc(SECTIONS[sec] || sec)}</div><div class="books">${list.map((b) => `<button data-b="${b.code}">${esc(bookName(b.code))}${tr() === "lxx" && b.lxx && b.ot ? `<small>${esc(b.name)}</small>` : b.lxx && !b.ot ? `<small>${esc(b.lxx)}</small>` : ""}</button>`).join("")}</div>`).join("")}`;
  view.querySelectorAll("[data-tr]").forEach((b) => (b.onclick = () => { S.settings.tr = b.dataset.tr; save(); renderBooks(); }));
  view.querySelectorAll("[data-b]").forEach((b) => (b.onclick = () => (location.hash = `#/bible/${b.dataset.b}`)));
}
async function renderChapters(code) {
  const n = chapters(code);
  if (n === 1) { location.replace(`#/read/${code}/1`); return; }
  setTop(bookName(code), { back: true });
  const counts = await getOr("fathers/counts.json", {});
  view.innerHTML = `<div class="eyebrow">Chapters${code === "PSA" && tr() === "lxx" ? " · Septuagint numbers" : ""}</div><div class="chapters">${Array.from({ length: n }, (_, i) => `<button data-c="${i + 1}" class="${S.last.b === code && S.last.c === i + 1 ? "cur" : ""}">${i + 1}</button>`).join("")}</div>
    ${counts[code] ? `<p class="small muted" style="margin:16px 4px">${Object.values(counts[code]).reduce((a, b) => a + b, 0).toLocaleString()} comments from the Fathers on ${esc(bookName(code))}.</p>` : ""}`;
  view.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => (location.hash = `#/read/${code}/${b.dataset.c}`)));
}

// ---------------------------------------------------------------- the reader
async function renderReader(code, c, q) {
  if (code === "DAN") code = "DAG";
  if (code === "EST") code = "ESG";
  if (!inTr(code)) { // a book this translation doesn't have: switch to one that does
    const other = tr() === "lxx" ? "web" : "lxx";
    if (inTr(code, other)) { S.settings.tr = other; save(); toast("Switched to the " + (other === "lxx" ? "Septuagint" : "World English Bible") + " for this book"); }
    else { view.innerHTML = `<div class="empty">That book isn't in this Bible.</div>`; return; }
  }
  const n = chapters(code);
  c = Math.min(Math.max(1, c), n);
  S.last = { b: code, c }; save();
  const head = code === "PSA" ? psalmLabel(c) : `${bookName(code)} ${c}`;
  setTop(head, { back: !!q.get("k") || !!q.get("plan"), titleHTML: `<button id="pick">${esc(head)}</button>`,
    acts: `<button class="iconbtn" id="aa" aria-label="Text size">${ICON.aa}</button><button class="iconbtn" id="goSearch" aria-label="Search">${ICON.search}</button>` });
  $("#pick").onclick = () => (location.hash = `#/bible/${code}`);
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
  // A passage (from Today or a plan): show it, dim the rest.
  const vi = q.get("i") != null ? +q.get("i") : q.get("v") ? verses.findIndex(([v]) => v === +q.get("v")) : -1;
  const ti = q.get("ti") != null ? +q.get("ti") : q.get("to") ? verses.findIndex(([v]) => v === +q.get("to")) : vi;
  const inPassage = (i) => vi < 0 || (i >= vi && i <= (ti < 0 ? verses.length - 1 : ti));
  const keyOf = (i) => `${code}.${eng[i][0]}.${eng[i][1]}`;
  const passage = q.get("k") || q.get("plan");
  const dim = passage && vi >= 0;
  view.innerHTML = `<div class="reader">
    <div class="ch-title">${esc(code === "PSA" ? psalmLabel(c) : bookName(code))}</div>
    <div class="ch-sub">${code === "PSA" ? "" : "Chapter " + c + " · "}${tr() === "lxx" && BY[code].ot ? "Septuagint (Brenton)" : "World English Bible"}</div>
    <div id="verses">${verses.map(([v, t], i) => `<span class="verse${has(i) ? " has" : ""}${S.hl[keyOf(i)] ? " hl-" + S.hl[keyOf(i)] : ""}${dim && !inPassage(i) ? " dim" : ""}${!passage && i === vi ? " sel" : ""}" data-i="${i}"><sup>${v}</sup>${esc(t)}${S.notes[keyOf(i)] ? `<span class="note-mark">${ICON.note}</span>` : ""} </span>`).join("")}</div>
    ${fathers.length ? `<div class="ch-fathers"><button class="btn secondary wide" id="allF">${ICON.father} What the Fathers said on this ${code === "PSA" ? "psalm" : "chapter"} (${fathers.length})</button></div>` : ""}
    <div class="reader-nav"><button class="btn secondary" id="prev" ${c <= 1 && !prevBook(code) ? "disabled" : ""}>‹ Previous</button><button class="btn secondary" id="next" ${c >= n && !nextBook(code) ? "disabled" : ""}>Next ›</button></div>
    ${passage ? `<div class="passage-bar"><button class="btn" id="doneP">${q.get("k") ? ICON.check + " Mark as read" : "Back to the plan"}</button></div>` : ""}
  </div>`;
  const box = $("#verses");
  box.onclick = (e) => { const el = e.target.closest(".verse"); if (el) verseSheet(code, c, verses, +el.dataset.i, eng, fathers); };
  if ($("#allF")) $("#allF").onclick = () => openSheet(`<div class="sheet-h"><h3>The Fathers on ${esc(head)}</h3><button class="iconbtn" onclick="document.getElementById('sheet').hidden=true">✕</button></div><div id="fl"></div>`, (b) => fathersList($("#fl", b), fathers));
  const keep = q.get("plan") ? `?plan=${q.get("plan")}` : ""; // keep "Back to the plan" while reading on
  $("#prev").onclick = () => (location.hash = (c > 1 ? `#/read/${code}/${c - 1}` : `#/read/${prevBook(code)}/${chapters(prevBook(code))}`) + keep);
  $("#next").onclick = () => (location.hash = (c < n ? `#/read/${code}/${c + 1}` : `#/read/${nextBook(code)}/1`) + keep);
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
function textSheet() {
  openSheet(`<div class="sheet-h"><h3>Text</h3><button class="iconbtn" data-x>✕</button></div>
    <div class="eyebrow">Size</div><div class="seg">${[16, 18, 19, 21, 24].map((s) => `<button data-s="${s}" aria-pressed="${S.settings.size === s}" style="font-size:${s - 4}px">Aa</button>`).join("")}</div>
    <div class="eyebrow">Theme</div><div class="seg">${["auto", "light", "dark"].map((t) => `<button data-t="${t}" aria-pressed="${S.settings.theme === t}">${t === "auto" ? "Match phone" : t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>`, (b) => {
    b.querySelector("[data-x]").onclick = closeSheet;
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
  const ref = `${code === "PSA" ? psalmLabel(c) : bookName(code) + " " + c}:${v}`;
  const mine = fathers.filter((e) => ev > 0 && covers(e, ec, ev));
  const hlBtn = (k, col) => `<button data-hl="${k}" aria-pressed="${S.hl[key] === k}" style="background:var(--hl-${k})" aria-label="Highlight ${col}"></button>`;
  openSheet(`<div class="sheet-h"><div><h3>${esc(ref)}</h3><div class="vtext">${esc(text)}</div></div><button class="iconbtn" data-x aria-label="Close">✕</button></div>
    <div class="swatches">${hlBtn("y", "yellow")}${hlBtn("g", "green")}${hlBtn("b", "blue")}${hlBtn("p", "pink")}<button data-hl="" aria-label="No highlight" style="background:var(--surface)">✕</button></div>
    <div class="actions">
      <button data-a="bm" aria-pressed="${!!S.bm[key]}">${ICON.mark}${S.bm[key] ? "Saved" : "Save"}</button>
      <button data-a="note">${ICON.pen}Note</button>
      <button data-a="copy">${ICON.copy}Copy</button>
      <button data-a="share">${ICON.share}Share</button></div>
    <div id="noteBox" ${S.notes[key] ? "" : "hidden"} style="margin-top:8px"><textarea id="noteText" rows="3" placeholder="Your note">${esc(S.notes[key] || "")}</textarea></div>
    <div class="eyebrow">What the Fathers said${mine.length ? ` (${mine.length})` : ""}</div>
    <div id="fl">${mine.length ? "" : `<div class="empty small">No comments from the Fathers on this verse yet.${fathers.length ? " Try the whole chapter below." : ""}</div>`}</div>`, (b) => {
    if (mine.length) fathersList($("#fl", b), mine);
    b.querySelector("[data-x]").onclick = closeSheet;
    b.querySelectorAll("[data-hl]").forEach((x) => (x.onclick = () => {
      if (x.dataset.hl) S.hl[key] = x.dataset.hl; else delete S.hl[key];
      save(); b.querySelectorAll("[data-hl]").forEach((y) => y.setAttribute("aria-pressed", y === x && !!x.dataset.hl));
      if (el) { el.className = el.className.replace(/\bhl-\w\b/g, "").trim(); if (S.hl[key]) el.classList.add("hl-" + S.hl[key]); }
    }));
    const act = (a) => b.querySelector(`[data-a="${a}"]`);
    act("bm").onclick = () => { if (S.bm[key]) delete S.bm[key]; else S.bm[key] = { at: Date.now(), ref, text }; save(); act("bm").setAttribute("aria-pressed", !!S.bm[key]); act("bm").lastChild.textContent = S.bm[key] ? "Saved" : "Save"; toast(S.bm[key] ? "Saved to your verses" : "Removed"); };
    act("note").onclick = () => { $("#noteBox", b).hidden = false; $("#noteText", b).focus(); };
    $("#noteText", b).oninput = (e) => { const t = e.target.value.trim(); if (t) S.notes[key] = t; else delete S.notes[key]; save(); };
    const plain = `"${text}" (${ref})`;
    act("copy").onclick = () => { navigator.clipboard?.writeText(plain).then(() => toast("Copied"), () => toast("Couldn't copy")); };
    act("share").onclick = () => { if (navigator.share) navigator.share({ text: plain }).catch(() => {}); else navigator.clipboard?.writeText(plain).then(() => toast("Copied to share")); };
  });
}

// ---------------------------------------------------------------- plans
const plans = () => PLANS || (PLANS = get("plans.json"));
const progress = (id) => (S.plans[id] = S.plans[id] || { done: {} });
const nextDay = (p) => { const pr = S.plans[p.id] || { done: {} }; const i = p.days.findIndex((_, d) => !pr.done[d]); return i < 0 ? p.days.length - 1 : i; };
const doneCount = (p) => Object.keys((S.plans[p.id] || {}).done || {}).filter((d) => d < p.days.length).length;
async function renderPlans() {
  setTop("Reading plans");
  const P = await plans();
  const mine = P.plans.filter((p) => S.plans[p.id]?.started);
  const card = (p) => { const n = doneCount(p); return `<a class="card plan-card" href="#/plan/${p.id}" style="text-decoration:none;color:inherit">
      <h3>${esc(p.title)}</h3><div class="small muted">${esc(p.about)}</div><div class="small muted">${p.days.length} days${n ? ` · ${n} done` : ""}</div>
      ${n ? `<div class="bar"><i style="width:${(100 * n) / p.days.length}%"></i></div>` : ""}</a>`; };
  view.innerHTML = (mine.length ? `<div class="eyebrow">Your plans</div><div class="stack">${mine.map(card).join("")}</div>` : "") +
    Object.entries(P.categories).map(([cat, name]) => `<div class="eyebrow">${esc(name)}</div><div class="stack">${P.plans.filter((p) => p.cat === cat && !S.plans[p.id]?.started).map(card).join("")}</div>`).join("");
}
async function renderPlan(id) {
  const P = await plans(); const p = P.plans.find((x) => x.id === id);
  if (!p) { location.replace("#/plans"); return; }
  setTop(p.title, { back: true });
  const pr = S.plans[id] || { done: {} }; const n = doneCount(p);
  view.innerHTML = `<h2>${esc(p.title)}</h2><p class="prose muted" style="margin:8px 0 14px">${esc(p.about)}</p>
    ${n ? `<div class="bar" style="margin-bottom:6px"><i style="width:${(100 * n) / p.days.length}%"></i></div><p class="small muted" style="margin:0 0 12px">${n} of ${p.days.length} days done</p>` : ""}
    <div class="row" style="margin-bottom:6px"><button class="btn" id="go">${pr.started ? (n ? "Continue" : "Start") : "Start this plan"}: day ${nextDay(p) + 1}</button>${pr.started ? `<button class="btn ghost" id="stop">${n === p.days.length ? "Start again" : "Stop plan"}</button>` : ""}</div>
    <div class="eyebrow">Days</div><div class="list days">${p.days.map((d, i) => `<button class="list-btn" data-d="${i + 1}"><span class="num ${pr.done[i] ? "on" : ""}">${pr.done[i] ? ICON.check : i + 1}</span><span class="grow">${esc(d.title)}</span>${ICON.chev}</button>`).join("")}</div>`;
  $("#go").onclick = () => { const x = progress(id); x.started = x.started || today(); x.finished = false; save(); location.hash = `#/plan/${id}/${nextDay(p) + 1}`; };
  if ($("#stop")) $("#stop").onclick = () => { if (confirm(n === p.days.length ? "Start this plan again from day 1?" : "Stop this plan? Your ticks will be cleared.")) { delete S.plans[id]; save(); renderPlan(id); } };
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
      return `<a class="card day-item" href="${planReadHash(r, it.n, id, d)}" style="text-decoration:none;color:inherit"><span class="icon">${ICON.book}</span><span style="flex:1"><b>${esc(label)}</b><span class="small muted" style="display:block">Read${it.n === "lxx" ? " · Septuagint numbers" : ""}</span></span>${ICON.chev}</a>`;
    }
    if (it.father) return `<a class="card day-item" href="${esc(it.u)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="icon f">${ICON.father}</span><span style="flex:1"><b>${esc(it.father)}</b><span class="small muted" style="display:block">Opens on New Advent ↗</span></span></a>`;
    return "";
  };
  view.innerHTML = `<div class="small muted">${esc(p.title)}</div><h2 style="margin:4px 0 14px">${esc(day.title)}</h2>
    <div class="stack">${day.items.map(item).join("")}</div>
    <div class="row" style="margin-top:22px"><button class="btn wide" id="done">${isDone ? "Done ✓ · Undo" : "Mark day " + d + " done"}</button></div>
    <div class="reader-nav"><button class="btn secondary" id="pd" ${d <= 1 ? "disabled" : ""}>‹ Day ${d - 1}</button><button class="btn secondary" id="nd" ${d >= p.days.length ? "disabled" : ""}>Day ${d + 1} ›</button></div>`;
  $("#done").onclick = () => {
    if (pr.done[d - 1]) delete pr.done[d - 1];
    else { pr.done[d - 1] = today(); markRead(`plan:${id}:${d}`); }
    pr.finished = doneCount(p) === p.days.length; save();
    if (pr.done[d - 1]) { toast(pr.finished ? "Plan finished. Glory to God!" : "Day " + d + " done"); if (!pr.finished && d < p.days.length) { location.hash = `#/plan/${id}/${d + 1}`; return; } }
    renderPlanDay(id, d);
  };
  $("#pd").onclick = () => (location.hash = `#/plan/${id}/${d - 1}`);
  $("#nd").onclick = () => (location.hash = `#/plan/${id}/${d + 1}`);
}
function planReadHash(r, numbering, id, d) {
  if (numbering === "lxx" && r.code === "PSA") { // Church (Septuagint) psalm numbers
    const c = tr() === "lxx" ? r.c : (MAP.PSA[r.c] || [[r.c]]).find((x) => x[1] > 0)?.[0] || r.c;
    return `#/read/PSA/${c}?plan=${id}:${d}`;
  }
  return readHash(r, { plan: `${id}:${d}` });
}

// ---------------------------------------------------------------- the Fathers library
const lib = () => LIB || (LIB = get("library.json"));
async function renderFathers() {
  setTop("The Fathers");
  const L = await lib();
  const groups = [["saint", "Saints"], ["western", "Western saints before the schism"], ["blessed", "Honoured, with some reservations"], ["document", "Early Christian writings"], ["writer", "Early Christian writers, not saints"]];
  view.innerHTML = `<p class="prose muted" style="margin:4px 4px 12px">The Fathers are the saints and teachers who handed on the faith of the Apostles. Tap one to meet them and open their writings. Every verse in the Bible tab with a red dot has their words on it.</p>
    <input type="search" id="fq" placeholder="Find a Father" aria-label="Find a Father">
    <div id="fbox"></div>`;
  const draw = (q = "") => {
    q = q.toLowerCase();
    $("#fbox").innerHTML = groups.map(([lab, name]) => {
      const list = L.filter((a) => a.label === lab && (!q || a.name.toLowerCase().includes(q)));
      return list.length ? `<div class="eyebrow">${esc(name)}</div><div class="list">${list.map((a) => `<a class="list-btn" href="#/father/${esc(a.id)}"><span class="grow"><b>${esc(a.name)}</b><span class="sub">${esc(a.era)} century · ${a.works.length} ${a.works.length === 1 ? "work" : "works"}</span></span>${ICON.chev}</a>`).join("")}</div>` : "";
    }).join("") || `<div class="empty">No Father by that name.</div>`;
  };
  draw();
  $("#fq").oninput = (e) => draw(e.target.value.trim());
}
async function renderFather(id) {
  const L = await lib(); const a = L.find((x) => x.id === id);
  if (!a) { location.replace("#/fathers"); return; }
  setTop(a.name, { back: true });
  view.innerHTML = `<div class="lib-head"><h2>${esc(a.name)}</h2><span class="chip ${a.label}">${esc(LABEL[a.label])}</span></div>
    <p class="small muted" style="margin:6px 0 0">${esc(a.era)} century${a.feast ? ` · Feast: ${esc(a.feast)}` : ""}</p>
    <p class="prose" style="margin:12px 0">${esc(a.bio)}</p>
    <div class="eyebrow">Writings (on New Advent)</div>
    <div class="list">${a.works.map((w) => `<a class="list-btn" href="${esc(w.u)}" target="_blank" rel="noopener"><span class="grow">${esc(w.t)}</span>${ICON.out}</a>`).join("")}</div>
    <p class="small muted" style="margin:12px 4px">These open the 19th-century English translations on newadvent.org.</p>`;
}

// ---------------------------------------------------------------- search
async function renderSearch(q0) {
  setTop("Search", { back: true });
  view.innerHTML = `<input type="search" id="q" placeholder="A word, or a verse like John 3:16" value="${esc(q0)}" aria-label="Search the Bible" autofocus>
    <p class="small muted" style="margin:8px 4px">Searching the ${tr() === "lxx" ? "Septuagint Bible" : "World English Bible"}.</p><div id="res"></div>`;
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
    res.innerHTML = `<a class="card" href="#/read/${b}/${ref.c}${ref.v ? "?v=" + ref.v + (ref.to ? "&to=" + ref.to : "") : ""}" style="display:block;text-decoration:none;color:inherit"><div class="small muted">Go to</div><h3>${esc(b === "PSA" ? psalmLabel(ref.c) : bookName(b) + " " + ref.c)}${ref.v ? ":" + ref.v + (ref.to ? "–" + ref.to : "") : ""}</h3></a>`;
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
  res.innerHTML = hits.length ? `<p class="small muted" style="margin:0 4px 8px">${hits.length >= 300 ? "First 300" : hits.length} ${hits.length === 1 ? "verse" : "verses"}</p><div class="list">${hits.map(([code, c, v, t]) => `<a class="list-btn search-res" href="#/read/${code}/${c}?v=${v}"><span class="grow"><span class="ref">${esc(code === "PSA" ? psalmLabel(c) : bookName(code) + " " + c)}:${v}</span><br>${esc(t).replace(re, "<mark>$1</mark>")}</span></a>`).join("")}</div>` : `<div class="empty">No verses found.</div>`;
}

// ---------------------------------------------------------------- More: my verses, settings, about
function renderMore() {
  setTop("More");
  const n = (o) => Object.keys(o).length;
  view.innerHTML = `
    <div class="eyebrow">Your verses</div>
    <div class="list">
      <a class="list-btn" href="#/mine/bm"><span class="grow">Saved verses</span><span class="muted">${n(S.bm)}</span>${ICON.chev}</a>
      <a class="list-btn" href="#/mine/hl"><span class="grow">Highlights</span><span class="muted">${n(S.hl)}</span>${ICON.chev}</a>
      <a class="list-btn" href="#/mine/notes"><span class="grow">Notes</span><span class="muted">${n(S.notes)}</span>${ICON.chev}</a>
      <a class="list-btn" href="#/search"><span class="grow">Search the Bible</span>${ICON.chev}</a>
    </div>
    <div class="eyebrow">Church calendar</div>
    <div class="seg" role="group" aria-label="Calendar"><button data-cal="new" aria-pressed="${S.settings.cal === "new"}">New Calendar</button><button data-cal="old" aria-pressed="${S.settings.cal === "old"}">Old Calendar</button></div>
    <p class="small muted" style="margin:8px 4px 0">Greek, Antiochian, Romanian and OCA parishes mostly keep the New (Revised Julian) Calendar; Russian, Serbian, Georgian and Athonite parishes the Old (Julian). Ask your priest if unsure. Readings follow the OCA's order.</p>
    <div class="eyebrow">The Fathers</div>
    <label class="card row" style="justify-content:space-between;cursor:pointer"><span>Show early writers who are not saints<span class="small muted" style="display:block">Origen, Tertullian, Eusebius and others, clearly labelled</span></span><input type="checkbox" id="writers" ${S.settings.writers ? "checked" : ""} style="width:22px;height:22px"></label>
    <div class="eyebrow">Daily reminder</div>
    <div class="card stack"><div class="row"><input type="time" id="rt" value="07:00" style="width:auto"><button class="btn" id="ics">Add to my calendar</button></div>
      <p class="small muted" style="margin:0">Adds a daily event to your phone's calendar app that reminds you to read. You can change or delete it there.</p></div>
    <div class="eyebrow">Offline</div>
    <div class="card stack"><button class="btn secondary" id="offline">Save the whole Bible for offline</button><p class="small muted" style="margin:0" id="offMsg">Chapters you open are kept automatically. This saves every book of the ${tr() === "lxx" ? "Septuagint Bible" : "World English Bible"} (about 5 MB).</p></div>
    <div class="eyebrow">Backup</div>
    <div class="row"><button class="btn secondary" id="exp">Download my notes and plans</button><label class="btn secondary" style="cursor:pointer">Restore<input type="file" id="imp" accept="application/json" hidden></label></div>
    <div class="eyebrow">About</div>
    <div class="card prose small" style="font-size:16px">
      <p>A simple Orthodox Bible: the Septuagint, the readings of the Church year and the Holy Fathers on every page. Free, with no ads, no accounts and no tracking. What you save stays on this phone.</p>
      <p><b>Texts.</b> Old Testament: Sir Lancelot Brenton's translation of the Septuagint (1851), public domain. New Testament and the second Bible: the World English Bible, public domain. Both from eBible.org.</p>
      <p><b>The Fathers.</b> Quotations are from public-domain 19th-century translations (the Ante-Nicene and Nicene and Post-Nicene Fathers, and the Catena Aurea of 1841), arranged by verse by the Historical Christian Faith Commentaries Database. Writings open on New Advent.</p>
      <p><b>Calendar.</b> From orthocal.info, which follows the rubrics of the Orthodox Church in America.</p>
      <p><b>Labels.</b> "Saint" and "Blessed" follow how the Orthodox Church honours each writer. Writers marked "Not a saint" are early witnesses read with care. This app is not a substitute for your parish or your spiritual father.</p>
    </div>`;
  view.querySelectorAll("[data-cal]").forEach((b) => (b.onclick = () => { S.settings.cal = b.dataset.cal; save(); renderMore(); toast(b.dataset.cal === "old" ? "Old Calendar" : "New Calendar"); }));
  $("#writers").onchange = (e) => { S.settings.writers = e.target.checked; save(); };
  $("#ics").onclick = () => reminder($("#rt").value || "07:00");
  $("#offline").onclick = saveOffline;
  $("#exp").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: "application/json" })); a.download = `orthodox-bible-backup-${today()}.json`; a.click(); };
  $("#imp").onchange = async (e) => { try { const d = JSON.parse(await e.target.files[0].text()); if (!d.settings) throw 0; S = Object.assign(blank(), d); save(); toast("Restored"); renderMore(); } catch (err) { toast("That file isn't a backup from this app"); } };
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
  const b = $("#offline"); b.disabled = true; const codes = order(); let n = 0;
  for (const code of codes) { try { await get(`bible/${tr()}/${code}.json`); } catch (e) { /* keep going */ } n++; $("#offMsg").textContent = `Saving… ${Math.round((100 * n) / codes.length)}%`; }
  await Promise.all([plans(), lib()]).catch(() => {});
  $("#offMsg").textContent = "Saved. The Bible now works without internet. The Fathers' words are saved for each chapter you open."; b.disabled = false;
}
function renderMine(kind) {
  const names = { bm: "Saved verses", hl: "Highlights", notes: "Notes" };
  setTop(names[kind], { back: true });
  const o = kind === "bm" ? S.bm : kind === "hl" ? S.hl : S.notes;
  const keys = Object.keys(o).sort((a, b) => (kind === "bm" ? o[b].at - o[a].at : 0));
  view.innerHTML = keys.length ? `<div class="list">${keys.map((k) => {
    const [code, c, v] = k.split("."); const pos = fromEng(code, +c, +v);
    const vn = pos[2] || (pos[3] != null ? pos[3] + 1 : 0); // Septuagint psalms count their verses from 1
    const label = `${code === "PSA" ? psalmLabel(pos[1]) : bookName(code) + " " + pos[1]}${vn ? ":" + vn : ""}`;
    const sub = kind === "notes" ? o[k] : kind === "bm" ? o[k].text : "";
    const href = `#/read/${pos[0]}/${pos[1]}?${pos[3] != null ? "i=" + pos[3] : "v=" + pos[2]}`;
    return `<a class="list-btn" href="${href}"><span class="grow"><b>${esc(label)}</b>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</span>${ICON.chev}</a>`;
  }).join("")}</div>` : `<div class="empty">Nothing yet. Tap any verse in the Bible to ${kind === "notes" ? "write a note" : kind === "hl" ? "highlight it" : "save it"}.</div>`;
}

// ---------------------------------------------------------------- routes
async function route() {
  closeSheet();
  const [path, qs] = (location.hash.slice(1) || "/today").split("?");
  const q = new URLSearchParams(qs || "");
  const p = path.split("/").filter(Boolean);
  const tab = { today: "today", bible: "bible", read: "bible", search: "bible", plans: "plans", plan: "plans", fathers: "fathers", father: "fathers", more: "more", mine: "more" }[p[0]] || "today";
  document.querySelectorAll(".tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"));
  try {
    if (!BOOKS.length) await boot();
    if (p[0] === "bible" && p[1]) await renderChapters(p[1]);
    else if (p[0] === "bible") renderBooks();
    else if (p[0] === "read") await renderReader(p[1], +p[2] || 1, q);
    else if (p[0] === "plans") await renderPlans();
    else if (p[0] === "plan" && p[2]) await renderPlanDay(p[1], +p[2]);
    else if (p[0] === "plan") await renderPlan(p[1]);
    else if (p[0] === "fathers") await renderFathers();
    else if (p[0] === "father") await renderFather(p[1]);
    else if (p[0] === "search") await renderSearch(q.get("q") || "");
    else if (p[0] === "more") renderMore();
    else if (p[0] === "mine") renderMine(p[1]);
    else await renderToday();
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card empty">Something went wrong loading this page. Check your connection and try again.<br><br><button class="btn" onclick="location.reload()">Reload</button></div>`;
  }
  if (!["read"].includes(p[0])) window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
route();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
