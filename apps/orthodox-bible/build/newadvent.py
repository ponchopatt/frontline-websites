"""Save New Advent's Fathers index (names, titles and links only) for the Fathers library.

    python3 build/newadvent.py <sources-dir>

Reads https://www.newadvent.org/fathers/ once and writes <sources-dir>/na-index.json.
Only the list of authors and work titles is kept; the app links to New Advent for the texts.
"""
import html
import json
import os
import re
import sys
import urllib.request

req = urllib.request.Request("https://www.newadvent.org/fathers/", headers={"User-Agent": "Mozilla/5.0"})
s = urllib.request.urlopen(req, timeout=60).read().decode("latin-1")
out = []
for p in re.findall(r"<p>(.*?)</p>", s, re.S):
    m = re.search(r"<strong>([^<]+)</strong>", p)
    works = [(h, html.unescape(t).strip()) for h, t in re.findall(r'href="\.\./fathers/(\d+\.htm)">([^<]+)</a>', p)]
    if m and works:
        out.append({"name": html.unescape(m.group(1)).strip(), "works": works})
with open(os.path.join(sys.argv[1], "na-index.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=0)
print(len(out), "entries")
