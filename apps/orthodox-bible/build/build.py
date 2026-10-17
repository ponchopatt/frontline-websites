"""Build the app's data from free sources.

    python3 build/build.py <sources-dir>

<sources-dir> holds:
  brenton/  eBible.org's Brenton Septuagint in USFM (public domain, 1851)
  web/      eBible.org's World English Bible with the deuterocanon in USFM (public domain)
  cdb/      a clone of github.com/HistoricalChristianFaith/Commentaries-Database
  na-index.json  New Advent's list of Fathers and works (made by build/newadvent.py)
  grcbrent/ grcbyz/  eBible.org's Greek Septuagint and 1904 Patriarchal New Testament in USFM
  step/     a clone of github.com/STEPBible/STEPBible-Data (the Greek lexicon, CC BY 4.0)
  xref/     cross_references.txt from openbible.info/labs/cross-references (CC BY)

Writes public/data/:
  books.json                 the books, chapter counts and sections
  bible/<tr>/<BOOK>.json     each book: [[chapter, [[verse, text], ...]], ...]
  map.json                   Septuagint -> English numbers for Psalms, Jeremiah and Daniel
  fathers/authors.json       every Father kept, with an honest Orthodox label
  fathers/<BOOK>/<ch>.json   the Fathers' words on each chapter, in English numbering
  library.json               every Father on New Advent, with an introduction and links
  plans.json                 the reading plans
  help/<id>.json             help for struggles: Scripture, the Fathers and a plan for each
  faith/<id>.json            questions about the faith: a short answer, Scripture and the Fathers
  bible/grc/<BOOK>.json      the Greek; New Testament words carry Strong's numbers (word@3056)
  lex/<n>.json               Greek word meanings, by thousands of Strong's numbers
  fathers/idx/<BOOK>.json    which verses the Fathers wrote on (for the red dots and counts)
  votd.json                  the verses of the day, with their text in both Bibles
  plans/<id>.json            each plan in full (plans.json keeps only titles and readings)
  search/<tr>.txt            each Bible in one file for searching
  xref/<BOOK>.json           similar verses for each verse, best first

Only public-domain translations of the Fathers are kept: the 19th-century Ante-Nicene and
Nicene and Post-Nicene Fathers volumes, the 1841 Catena Aurea, and a few other old
translations named in fathers.py. Everything else in the source data is left out.
"""
import json
import os
import re
import sys
import tomllib
import unicodedata
import urllib.parse

sys.path.insert(0, os.path.dirname(__file__))
from books import BOOKS, SECTIONS  # noqa: E402
from fathers import author_for, source_ok  # noqa: E402
import library  # noqa: E402
import plans  # noqa: E402

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data")


def write(path, data):
    path = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


# ---------------------------------------------------------------- USFM

def usfm_file(folder, code):
    for f in os.listdir(os.path.join(SRC, folder)):
        if f.endswith(".usfm") and f.split("-")[1][:3] == code:
            return os.path.join(SRC, folder, f)
    return None


def clean(text):
    text = re.sub(r"\\f .*?\\f\*", "", text, flags=re.S)  # footnotes
    text = re.sub(r"\\x .*?\\x\*", "", text, flags=re.S)  # cross references
    text = re.sub(r"\\\+?w ([^|\\]*)(\|[^\\]*)?\\\+?w\*", r"\1", text)  # Strong's-tagged words
    text = re.sub(r"\\\+?(bdit|add|sc|wj|nd|qs|it|bk|k|tl|em|bd|pn|wh|qt|sls|ord)\*?", "", text)
    text = re.sub(r"\\(q\d?|p|m|pi\d?|b|nb|li\d?|d|s\d?|ms\d?|mr|r|sp|cl|tr|tc\d|th\d|qa|qc|qm\d?)\b", " ", text)
    text = re.sub(r"\\[a-z0-9]+\*?", "", text)
    return re.sub(r"\s+", " ", text).strip()


def read_usfm(path, strongs=False):
    """[[chapter, [[verse, text], ...]], ...] in the file's own numbering. With strongs=True each
    tagged word keeps its Strong's number, as word@3056."""
    s = open(path, encoding="utf-8-sig").read()
    if strongs:
        s = re.sub(r'\\\+?w ([^|\\]*)\|strong="G0*(\d+)[a-zA-Z]?"\\\+?w\*', r"\1@\2", s)
    s = re.sub(r"\\vp .*?\\vp\*", "", s)
    out = []
    for part in re.split(r"\\c (\d+)", s)[1:]:
        if part.isdigit():
            out.append([int(part), []])
            continue
        verses = re.split(r"\\v (\d+)[a-z]?(?:-\d+)?\s", part)
        for i in range(1, len(verses), 2):
            t = clean(verses[i + 1])
            if t:
                out[-1][1].append([int(verses[i]), t])
    return [c for c in out if c[1]]


# ---------------------------------------------------------------- Bible

books_meta = []
texts = {"lxx": {}, "web": {}}
for code, name, lxx, section, src, eng in BOOKS:
    b = usfm_file("brenton", code) if src == "brenton" else usfm_file("web", code)
    w = usfm_file("web", code)
    if b:
        texts["lxx"][code] = read_usfm(b)
    if w:
        texts["web"][code] = read_usfm(w)
    meta = {"code": code, "name": name, "section": section, "ot": src == "brenton"}
    if lxx:
        meta["lxx"] = lxx
    for tr in texts:
        if code in texts[tr]:
            meta["ch_" + tr] = len(texts[tr][code])
    books_meta.append(meta)

for tr, books in texts.items():
    for code, chapters in books.items():
        write(f"bible/{tr}/{code}.json", chapters)
write("books.json", {"books": books_meta, "sections": SECTIONS})

# Search: the whole of each Bible in one plain file (book, chapter, verse, text on each line), so a
# search is one download the phone keeps, not one per book.
for tr in texts:
    lines = [f"{code}\t{c}\t{v}\t{t}" for code, *_ in BOOKS if code in texts[tr] for c, vs in texts[tr][code] for v, t in vs]
    os.makedirs(os.path.join(OUT, "search"), exist_ok=True)
    with open(os.path.join(OUT, "search", f"{tr}.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")



# ---------------------------------------------------------------- Septuagint -> English numbers

def verse_count(tr, code, ch):
    for c, vs in texts[tr].get(code, []):
        if c == ch:
            return len(vs)
    return 0


def psalm_map():
    """For each Septuagint psalm, the English [chapter, verse] of each of its verses (verse 0 = the title)."""
    segs = {}
    for n in range(1, 151):
        if n <= 8 or n >= 148:
            segs[n] = [(n, 1, None)]
        elif n == 9:
            segs[n] = [(9, 1, None), (10, 1, None)]
        elif n <= 112:
            segs[n] = [(n + 1, 1, None)]
        elif n == 113:
            segs[n] = [(114, 1, None), (115, 1, None)]
        elif n == 114:
            segs[n] = [(116, 1, 9)]
        elif n == 115:
            segs[n] = [(116, 10, 19)]
        elif n <= 145:
            segs[n] = [(n + 1, 1, None)]
        elif n == 146:
            segs[n] = [(147, 1, 11)]
        elif n == 147:
            segs[n] = [(147, 12, 20)]
    out = {}
    for n, parts in segs.items():
        eng = []
        for ch, a, z in parts:
            z = z or verse_count("web", "PSA", ch)
            eng += [[ch, v] for v in range(a, z + 1)]
        lxx_vs = [v for c, vs in texts["lxx"]["PSA"] if c == n for v, _ in vs]
        titles = max(0, len(lxx_vs) - len(eng))
        row = []
        for i, v in enumerate(lxx_vs):
            if i < titles:
                row.append([eng[0][0], 0])
            else:
                row.append(eng[min(i - titles, len(eng) - 1)])
        out[n] = row
    return out


# Septuagint Jeremiah puts the oracles against the nations in the middle of the book.
JER = {26: 46, 27: 50, 28: 51, 29: 47, 31: 48, 32: 25, 52: 52}
JER.update({c: c for c in range(1, 26)})
JER.update({c: c - 7 for c in range(33, 52)})
write("map.json", {
    "PSA": psalm_map(),
    "JER": JER,
    # Daniel 3: the Song of the Three Children is 3:24-90; English 3:24-30 is 3:91-97.
    "DAG3": {"from": 91, "shift": -67, "song": [24, 90]},
})


# ---------------------------------------------------------------- the Greek

# The Septuagint in Greek (the text Brenton translated) and the 1904 Patriarchal New Testament,
# both public domain, from eBible.org. The New Testament words carry Strong's numbers, so the app
# can show what each word means from the STEP Bible lexicon (CC BY 4.0).
grc_used = set()
grc_books = []
for code, name, lxx, section, src, eng in BOOKS:
    f = usfm_file("grcbrent", code) if src == "brenton" else usfm_file("grcbyz", code)
    if f:
        grc_books.append((code, src, read_usfm(f, strongs=src != "brenton")))
all_lex = {}
LEX = os.path.join(SRC, "step", "Lexicons", "TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt")
for line in open(LEX, encoding="utf-8"):
    f = line.rstrip("\n").split("\t")
    m = re.match(r"^G0*(\d+)$", f[0]) if len(f) >= 8 else None
    if m and m.group(1) not in all_lex:
        all_lex[m.group(1)] = [f[3], f[4], f[6], f[7]]
plain = lambda w: unicodedata.normalize("NFC", w).lower().replace("(", "").replace(")", "")
by_lemma = {}
for n, x in all_lex.items():
    for lemma in {plain(x[0]), plain(re.sub(r"\(.*?\)", "", x[0]))}:
        by_lemma.setdefault(lemma, set()).add(n)
# A few New Testament words have no number in the source; give them the one the same word has
# everywhere else, when it always has the same one.
forms = {}
for code, src, book in grc_books:
    if src != "brenton":
        for c, vs in book:
            for v, t in vs:
                for w, n in re.findall(r"([^\s@,.;·:()\[\]«»]+)@(\d+)", t):
                    forms.setdefault(w, set()).add(n)
def tag_for(w):
    """The one number this word has elsewhere, or the word is itself a dictionary headword."""
    # ἐστι is ἐστιν and οὕτω is οὕτως: the same word without its last letter.
    for found in (forms.get(w, ()), by_lemma.get(plain(w), ()), forms.get(w + "ν", ()), by_lemma.get(plain(w + "ς"), ())):
        if len(found) == 1:
            return next(iter(found))
    return ""


UNTAGGED = re.compile(r"(?<![^\s(«\[])([^\s@,.;·:()\[\]«»᾽]+)(?=[\s,.;·:)\]»]|$)")
for code, src, book in grc_books:
    if src == "brenton":
        continue
    for row in (r for c, vs in book for r in vs):
        row[1] = UNTAGGED.sub(lambda m: m.group(1) + "@" + tag_for(m.group(1)) if tag_for(m.group(1)) else m.group(1), row[1])
for code, src, book in grc_books:
    if code == "JHN":  # the 1904 text splits John 1:38 in two; number it as the English does
        vs = book[0][1]
        v38 = [t for v, t in vs if v in (38, 39)]
        book[0][1] = [[v, t] for v, t in vs if v < 38] + [[38, " ".join(v38)]] + [[v - 1, t] for v, t in vs if v > 39]
    for c, vs in book:
        for v, t in vs:
            grc_used.update(re.findall(r"@(\d+)", t))
    write(f"bible/grc/{code}.json", book)
    for b in books_meta:
        if b["code"] == code:
            b["grc"] = 1
write("books.json", {"books": books_meta, "sections": SECTIONS})


def short_def(html):
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", html)
    t = re.sub(r"\[in LXX.*?\]", "", t)
    t = re.sub(r"<[^>]+>", " ", t).replace("__", " ")
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"\s+([,.;:)])", r"\1", t)
    t = re.sub(r"(?:[,;:]\s*){2,}(?:al\.)?", "; ", t)
    t = re.sub(r":\s*(?:al\.)?\s*(?=\d+\.|[IV]+\.|\(|$)", ". ", t)
    t = re.sub(r"\s+", " ", t).strip(" ;,")
    return t[:260].rsplit(" ", 1)[0] + "…" if len(t) > 260 else t


lex = {n: [x[0], x[1], x[2], short_def(x[3])] for n, x in all_lex.items() if n in grc_used}
for k in range(10):
    part = {n: x for n, x in lex.items() if int(n) // 1000 == k}
    if part:
        write(f"lex/{k}.json", part)
print(f"Greek: {len(lex)} of {len(grc_used)} words found in the lexicon")

# ---------------------------------------------------------------- the Fathers

ENG_CODE = {eng: code for code, name, lxx, section, src, eng in BOOKS if eng}
ENG_CODE["Prayer of Azariah"] = "DAG"
REF = re.compile(r"^(.+?) (\d+)_(\d+)(?:-(?:(\d+)_)?(\d+))?\.toml$")

authors = {}
by_chapter = {}
kept = dropped = 0
for folder in sorted(os.listdir(os.path.join(SRC, "cdb"))):
    path = os.path.join(SRC, "cdb", folder)
    if not os.path.isdir(path) or folder.startswith("."):
        continue
    who = author_for(folder)
    if not who:
        continue
    for f in os.listdir(path):
        m = REF.match(f)
        if not m or m.group(1) not in ENG_CODE:
            continue
        book, c1, v1, c2, v2 = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4), m.group(5)
        c2 = int(c2) if c2 else c1
        v2 = int(v2) if v2 else v1
        if book == "Prayer of Azariah":  # numbered from 1 in the source; it is Daniel 3:24-90
            c1 = c2 = 3
            v1, v2 = v1 + 23, v2 + 23
        try:
            d = tomllib.load(open(os.path.join(path, f), "rb"))
        except Exception:
            continue
        for x in d.get("commentary", []):
            url, title = x.get("source_url", ""), x.get("source_title", "")
            work = ""
            if "file=" in url:
                work = "/".join(urllib.parse.unquote(urllib.parse.unquote(url.split("file=")[1])).split("/")[:3])
            if not source_ok(folder, url, work):
                dropped += 1
                continue
            q = re.sub(r"\n{3,}", "\n\n", x.get("quote", "").strip())
            if len(q) < 40:
                continue
            kept += 1
            authors[who["id"]] = who
            entry = {"a": who["id"], "v": [v1, v2] if c2 == c1 else [v1, 999], "t": title.strip(), "q": q}
            if url:
                entry["u"] = url
            by_chapter.setdefault((ENG_CODE[book], c1), []).append(entry)

fathers_idx = {}
for (code, ch), entries in by_chapter.items():
    entries.sort(key=lambda e: (e["v"][0], authors[e["a"]]["rank"], e["a"]))
    write(f"fathers/{code}/{ch}.json", entries)
    # Just which verses each passage covers (1 = a writer who isn't a saint), so the app can show
    # the red dots and counts without loading every word.
    fathers_idx.setdefault(code, {})[ch] = [e["v"] + ([1] if authors[e["a"]]["label"] in ("writer", "document") else []) for e in entries]
for code, chs in fathers_idx.items():
    write(f"fathers/idx/{code}.json", chs)
write("fathers/authors.json", authors)
counts = {}
for (code, ch), entries in by_chapter.items():
    counts.setdefault(code, {})[ch] = len(entries)
write("fathers/counts.json", counts)
print(f"Bible: {len(texts['lxx'])} books in the Septuagint Bible, {len(texts['web'])} in the WEB")
print(f"Fathers: kept {kept} quotes from {len(authors)} authors on {len(by_chapter)} chapters; left out {dropped}")

lib, order = library.build(json.load(open(os.path.join(SRC, "na-index.json"), encoding="utf-8")))
lib.sort(key=lambda a: (order[a["label"]], a["name"].replace("St ", "").replace("Blessed ", "").replace("The ", "")))
write("library.json", lib)
all_plans = plans.all_plans(lib)
write("plans.json", {"plans": all_plans, "categories": plans.CATEGORIES, "featured": plans.FEATURED,
                     "topics": [{"id": i, "name": n, "bg": c, "plans": ps} for i, n, c, ps in plans.TOPICS]})
import prayers  # noqa: E402
write("prayers.json", prayers.PRAYERS)
print(f"Library: {len(lib)} Fathers and writings. Plans: {len(all_plans)}, {sum(len(p['days']) for p in all_plans)} days in all")

# ---------------------------------------------------------------- help for struggles
import help as helpdata  # noqa: E402

LABEL_ORDER = {"saint": 0, "western": 1, "blessed": 2}


def fathers_on(t):
    """The Fathers' best passages on a topic: comments on its verses first, then passages that
    use its words most, saints first, at most four from any one Father."""
    pat = re.compile(r"\b(" + "|".join(re.escape(k) for k in t["keys"]) + r")\b", re.I)
    # The topic's own verses, so comments written on them come first.
    own = {}
    for ref in t["verses"]:
        m = re.match(r"(\w+) (\d+):(\d+)(?:-(\d+))?$", ref)
        own.setdefault((m.group(1), int(m.group(2))), []).append((int(m.group(3)), int(m.group(4) or m.group(3))))
    found = []
    for (code, ch), entries in by_chapter.items():
        for e in entries:
            a = authors[e["a"]]
            if a["label"] not in LABEL_ORDER or not 150 <= len(e["q"]) <= 2200:
                continue
            hits = len(pat.findall(e["q"]))
            on = any(e["v"][0] <= b and a2 <= e["v"][1] for a2, b in own.get((code, ch), []))
            if hits < (1 if on else 2):
                continue
            # More hits in fewer words ranks higher; comments on the topic's verses and saints first.
            score = hits * 100 / len(e["q"]) ** 0.5 + (20 if on else 0) - LABEL_ORDER[a["label"]] * 3 - a["rank"] * 0.2
            found.append((score, code, ch, e))
    found.sort(key=lambda x: -x[0])
    quotes, per, seen = [], {}, set()
    for score, code, ch, e in found:
        if per.get(e["a"], 0) >= 4 or e["q"][:120] in seen:
            continue
        per[e["a"]] = per.get(e["a"], 0) + 1
        seen.add(e["q"][:120])
        q = {"a": e["a"], "b": code, "c": ch, "v": e["v"], "t": e["t"], "q": e["q"]}
        if e.get("u"):
            q["u"] = e["u"]
        quotes.append(q)
        if len(quotes) >= 28:
            break
    return quotes


help_index, help_plans = [], []
for t in helpdata.TOPICS:
    quotes = fathers_on(t)
    out = {k: t[k] for k in ("id", "name", "color", "about", "verses", "plans") if k in t}
    out.update({"safety": t.get("safety"), "link": t.get("link"), "quotes": quotes, "plan": "help-" + t["id"]})
    write(f"help/{t['id']}.json", out)
    help_index.append({"id": t["id"], "name": t["name"], "color": t["color"], "find": t["find"]})
    # A 7-day plan: one verse a day with a short word from a Father.
    days, used = [], set()
    for i, ref in enumerate(t["verses"][:7]):
        items = [{"read": ref}]
        m = re.match(r"(\w+) (\d+):(\d+)(?:-(\d+))?$", ref)
        b, c, v1, v2 = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4) or m.group(3))
        # A comment on the day's own verse if there is one, else the best one not used yet.
        pick = [n for n, q in enumerate(quotes) if n not in used and len(q["q"]) <= 1200 and q["b"] == b and q["c"] == c and q["v"][0] <= v2 and v1 <= q["v"][1]]
        pick = pick or [n for n, q in enumerate(quotes) if n not in used and len(q["q"]) <= 900]
        if pick:
            used.add(pick[0])
            q = quotes[pick[0]]
            items.append({"text": f"{authors[q['a']]['name']}: “{q['q']}”"})
        if i == 0:
            items.append({"text": t["about"]})
        if t.get("safety") and i == 0:
            items.append({"text": t["safety"]})
        days.append({"title": f"Day {i + 1}", "items": items})
    help_plans.append({"id": "help-" + t["id"], "cat": "help", "title": t["name"],
                       "about": f"Seven days of Scripture and the Fathers for anyone struggling with {t['name'].lower()}.",
                       "days": days,
                       "cover": {"bg": t["color"], "t": t["name"], "s": "7 days with the Fathers", "style": "serif", "motif": "halo"}})
    print(f"Help: {t['id']}: {len(quotes)} passages")
write("help/index.json", help_index)

# Questions about the faith: the same, without a plan.
import faith  # noqa: E402
faith_index = []
CAT_NAME = {c[0]: c[1] for c in faith.CATEGORIES}
for t in faith.TOPICS:
    out = {k: t[k] for k in ("id", "name", "color", "about", "verses", "plans") if k in t}
    # A few practical questions have no good passages in the Fathers; they leave that part out.
    out.update({"link": t.get("link"), "safety": t.get("safety"), "quotes": fathers_on(t) if t.get("fathers", True) else []})
    write(f"faith/{t['id']}.json", out)
    faith_index.append({"id": t["id"], "name": t["name"], "color": t["color"], "find": t["find"], "cat": CAT_NAME[t["cat"]]})
    print(f"Faith: {t['id']}: {len(out['quotes'])} passages")
write("faith/index.json", faith_index)
plans_json = json.load(open(os.path.join(OUT, "plans.json"), encoding="utf-8"))
plans_json["plans"] += help_plans
plans_json["categories"]["help"] = "Help for struggles"
write("plans.json", plans_json)

# ---------------------------------------------------------------- similar verses
# OpenBible.info's cross references (CC BY), voted on by readers. English numbering, like the
# Fathers. Kept: the ten best for each verse.
OSIS = {"Gen": "GEN", "Exod": "EXO", "Lev": "LEV", "Num": "NUM", "Deut": "DEU", "Josh": "JOS", "Judg": "JDG", "Ruth": "RUT",
        "1Sam": "1SA", "2Sam": "2SA", "1Kgs": "1KI", "2Kgs": "2KI", "1Chr": "1CH", "2Chr": "2CH", "Ezra": "EZR", "Neh": "NEH",
        "Esth": "ESG", "Job": "JOB", "Ps": "PSA", "Prov": "PRO", "Eccl": "ECC", "Song": "SNG", "Isa": "ISA", "Jer": "JER",
        "Lam": "LAM", "Ezek": "EZK", "Dan": "DAG", "Hos": "HOS", "Joel": "JOL", "Amos": "AMO", "Obad": "OBA", "Jonah": "JON",
        "Mic": "MIC", "Nah": "NAM", "Hab": "HAB", "Zeph": "ZEP", "Hag": "HAG", "Zech": "ZEC", "Mal": "MAL", "Matt": "MAT",
        "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT", "Rom": "ROM", "1Cor": "1CO", "2Cor": "2CO", "Gal": "GAL",
        "Eph": "EPH", "Phil": "PHP", "Col": "COL", "1Thess": "1TH", "2Thess": "2TH", "1Tim": "1TI", "2Tim": "2TI", "Titus": "TIT",
        "Phlm": "PHM", "Heb": "HEB", "Jas": "JAS", "1Pet": "1PE", "2Pet": "2PE", "1John": "1JN", "2John": "2JN", "3John": "3JN",
        "Jude": "JUD", "Rev": "REV"}


def osis(r):
    a, _, b = r.partition("-")
    bk, c, v = a.split(".")
    out = f"{OSIS[bk]} {c}:{v}"
    if b:
        bk2, c2, v2 = b.split(".")
        out += f"-{v2}" if c2 == c else f"-{c2}:{v2}"
    return out


xref = {}
for line in open(os.path.join(SRC, "xref", "cross_references.txt"), encoding="utf-8"):
    f = line.rstrip("\n").split("\t")
    if len(f) < 3 or not f[2].lstrip("-").isdigit() or int(f[2]) < 3:
        continue
    bk, c, v = f[0].split(".")
    xref.setdefault(OSIS[bk], {}).setdefault(f"{c}.{v}", []).append((int(f[2]), osis(f[1])))
for code, verses in xref.items():
    write(f"xref/{code}.json", {k: [r for _, r in sorted(rs, key=lambda x: -x[0])[:10]] for k, rs in verses.items()})
print(f"Similar verses: {sum(len(v) for v in xref.values())} verses have them")


# ---------------------------------------------------------------- small files for a fast start
# The verse of the day, one a day in turn, with its text in both Bibles so Home doesn't have to
# load a whole book.
VOTD = ["JHN 3:16", "PHP 4:13", "ROM 8:28", "MAT 11:28", "PSA 23:1", "ISA 40:31", "JHN 14:6", "MAT 5:8", "PSA 51:10", "JHN 1:14", "1JN 4:8", "LUK 18:13",
        "PRO 3:5", "2CO 5:17", "GAL 2:20", "ROM 12:2", "MAT 6:33", "JHN 15:5", "HEB 11:1", "JAS 1:5", "1PE 5:7", "PSA 46:10", "ISA 9:6", "MAT 5:14", "JHN 11:25",
        "ROM 5:8", "EPH 2:8", "COL 3:12", "1CO 13:4", "1CO 13:13", "PSA 119:105", "MAT 22:37", "JHN 13:34", "LUK 1:38", "MAT 16:24", "JHN 8:12", "JHN 20:29",
        "2TI 1:7", "HEB 12:1", "REV 21:4", "PSA 34:8", "PSA 103:1", "MAT 7:7", "LUK 6:36", "JHN 6:35", "JHN 10:11", "ROM 8:38", "PHP 4:6", "1TH 5:17", "TIT 3:5",
        "2PE 1:4", "JHN 17:3", "MAT 25:40", "LUK 23:42", "JHN 1:5", "WIS 3:1", "SIR 2:1", "MAT 5:9", "PSA 27:1", "ISA 53:5", "JHN 14:27", "ROM 6:4", "GAL 5:22", "1JN 1:9"]
PSA_MAP = json.load(open(os.path.join(OUT, "map.json"), encoding="utf-8"))["PSA"]


def place(tr, code, c, v):
    """[code, chapter, verse, index, text] of an English reference in this Bible's own numbering."""
    book = dict((ch, vs) for ch, vs in texts[tr].get(code, []))
    if code == "PSA" and tr == "lxx":
        for lc, rows in PSA_MAP.items():
            if [c, v] in rows:
                i = rows.index([c, v])
                return [code, int(lc), book[int(lc)][i][0], i, book[int(lc)][i][1]]
    for i, (vv, t) in enumerate(book.get(c, [])):
        if vv == v:
            return [code, c, vv, i, t]
    return None


votd = []
for ref in VOTD:
    code, cv = ref.split(" ")
    c, v = map(int, cv.split(":"))
    row = {"r": ref, "lxx": place("lxx", code, c, v), "web": place("web", code, c, v)}
    assert row["lxx"] or row["web"], ref
    votd.append(row)
write("votd.json", votd)

# Plans: a light list for the plan screens (each day's title and readings), and each plan in full
# for the day screen.
for pl in plans_json["plans"]:
    write(f"plans/{pl['id']}.json", pl)
plans_json["plans"] = [{**pl, "days": [{"title": d["title"], "items": [it for it in d["items"] if it.get("read")]} for d in pl["days"]]}
                       for pl in plans_json["plans"]]
write("plans.json", plans_json)

for b in books_meta:
    if b["code"] in fathers_idx:
        b["fathers"] = 1
    if b["code"] in xref:
        b["xref"] = 1
write("books.json", {"books": books_meta, "sections": SECTIONS})

# The phone keeps data files it has seen; a new name for that store makes it fetch them again.
import hashlib  # noqa: E402
h = hashlib.sha1()
for root, dirs, files in sorted(os.walk(OUT)):
    dirs.sort()
    for f in sorted(files):
        h.update(f.encode())
        h.update(open(os.path.join(root, f), "rb").read())
SW = os.path.join(OUT, "..", "sw.js")
sw = re.sub(r'DATA = "ob-data-[^"]*"', f'DATA = "ob-data-{h.hexdigest()[:10]}"', open(SW, encoding="utf-8").read())
open(SW, "w", encoding="utf-8").write(sw)
print(f"Data version {h.hexdigest()[:10]}")
