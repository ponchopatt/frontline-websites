"""Builds the Imperium SOPs site from the Clock app's own SOP file.

    python3 sites/imperium-sops/src/build.py

Writes two single-file pages next to this folder:
  index.html  the job page: five ticks, and read-only guides under two of them
  full.html   the full guide: everything the old checklist page showed, to read

Every word in the guides comes from sites/clock/sops.json, so a change there
reaches this site the next time this runs. The page is public, so the build
stops if an unlock code, a pay rate or the Google Sheet address gets in.
"""
import base64
import html
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parent
CLOCK = SITE.parent / 'clock'

seed = json.loads((CLOCK / 'sops.json').read_text(encoding='utf-8'))
TPL = {t['key']: t for t in seed['templates']}
SERVICES = seed['services']
PRICES = seed['settings'].get('prices') or {}


def b64(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode()


FONTS = ''.join(
    f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:{w};font-display:swap;src:url('{b64(CLOCK / f, 'font/woff2')}') format('woff2');}}\n"
    for fam, w, f in [('Big Shoulders Display', '500 700', 'fonts/bigshoulders-8a3351.woff2'),
                      ('Instrument Sans', '400 600', 'fonts/instrumentsans-f587e7.woff2')])
LOGO = b64(CLOCK / 'logo.webp', 'image/webp')
ICON = b64(CLOCK / 'icon-180.png', 'image/png')

# The crew names, and nothing else, from the Clock's config.
crew_m = re.search(r"DEFAULT_CREW:\s*\[([^\]]*)\]", (CLOCK / 'config.js').read_text(encoding='utf-8'))
CREW = re.findall(r"'([^']+)'", crew_m.group(1)) if crew_m else ['AJ', 'Gus', 'Lucas', 'Nick']


def section(key, sid):
    for s in TPL[key]['sections']:
        if s['id'] == sid:
            return s
    raise SystemExit(f'No section {sid} in {key}: sops.json changed, update build.py')


def title(it):
    return re.sub(r'[\s.,:;]+$', '', (it.get('title') or it.get('detail') or '').strip())


def step(it, o):
    how = it.get('more') or ' '.join([it.get('detail', '')] + it.get('subs', [])).strip()
    return {'id': it['id'], 'o': o, 't': title(it), 'm': how, 'n': it.get('needs', '')}


def steps(key, sid):
    return [step(it, o) for o, it in enumerate(section(key, sid)['items']) if it['type'] == 'step']


def reorder(items, order, names):
    """Puts the listed steps in the given order. A step not in the list stays
    straight after the step it follows now."""
    ids = [it['id'] for it in items]
    for sid, name in zip(order, names):
        assert sid in ids, sid
        got = next(it['t'] for it in items if it['id'] == sid)
        assert got.lower() == name.lower(), f'{sid} is "{got}", expected "{name}": sops.json changed, update build.py'

    def tail(i):
        out = []
        i += 1
        while i < len(items) and items[i]['id'] not in order:
            out.append(items[i])
            i += 1
        return out

    out = []
    i = 0
    while i < len(items) and items[i]['id'] not in order:
        out.append(items[i])
        i += 1
    for sid in order:
        i = ids.index(sid)
        out.append(items[i])
        out += tail(i)
    assert sorted(it['id'] for it in out) == sorted(ids)
    return out


# Exterior: wheels and tyres, foam, touch wash, rinse, dry, sealant, glass, tyre dressing.
EXT = reorder(steps('exterior', 'ext-steps'),
              ['ext-steps-1', 'ext-steps-2', 'ext-steps-3', 'ext-steps-4', 'ext-steps-9', 'ext-steps-8', 'ext-steps-11', 'ext-steps-12'],
              ['Wheels and tyres', 'Pre-wash', 'Touch wash', 'Rinse', 'Dry', 'Ceramic sealant', 'Glass', 'Tyre shine'])
# Interior: rubbish out, mats, vacuum, seats and carpets, plastics and dash, door jambs, glass, final vacuum.
INT = reorder(steps('interior', 'int-steps'),
              ['int-steps-1', 'int-steps-3', 'int-steps-8', 'int-steps-10', 'int-steps-4', 'int-steps-5', 'int-steps-2', 'int-steps-9', 'int-steps-11'],
              ['Clear out', 'Mats', 'Vacuum', 'Seats', 'Carpets', 'Hard surfaces', 'Door jambs', 'Glass', 'Final vacuum'])


def group(key, secs):
    return {'key': key, 'name': TPL[key]['name'], 'sections': [{'name': n, 'items': items} for n, items in secs]}


DATA = {
    'crew': CREW,
    'services': {name: {'templates': m['templates'], 'stopAfter': m.get('stopAfter', {}), 'goal': m.get('goal')}
                 for name, m in SERVICES.items()},
    'out': [
        group('exterior', [('', EXT)]),
        group('correction', [('', steps('correction', 'cor-steps'))]),
        group('ceramic', [(section('ceramic', s)['name'], steps('ceramic', s))
                          for s in ['cer-before-you-open-the-bottle', 'cer-applying', 'cer-after']]),
        group('maintenance', [('Outside', steps('maintenance', 'mnt-outside'))]),
    ],
    'in': [
        group('interior', [('', INT)]),
        group('maintenance', [('Inside', steps('maintenance', 'mnt-inside'))]),
    ],
    'check': [{'name': s['name'], 'n': s.get('needs', ''),
               'items': [{'t': it['detail'], 'n': it.get('needs', '')} for it in s['items'] if it['type'] == 'signoff']}
              for s in TPL['signoff']['sections']],
}


def fill(template, **parts):
    out = template
    for k, v in parts.items():
        assert '{{' + k + '}}' in out, k
        out = out.replace('{{' + k + '}}', v)
    assert '{{' not in out, 'a placeholder was left in'
    return out


def guard(name, page):
    # A public page: no unlock codes, no pay rate, no Google Sheet address.
    # (Fonts and pictures are skipped: their base64 can hold any digits.)
    text = re.sub(r"data:[a-z/+-]+;base64,[A-Za-z0-9+/=]+", '', page)
    for bad in ['1906', 'script.google.com', 'STAFF_CODE', 'ADMIN_CODE', 'DEFAULT_RATE', 'ENDPOINT']:
        assert bad not in text, f'{name} has "{bad}" in it'


# ------------------------------------------------------------------ index --
data_js = json.dumps(DATA, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
index = fill((HERE / 'index.html').read_text(encoding='utf-8'),
             ICON=ICON, LOGO=LOGO, FONTS=FONTS,
             CSS=(HERE / 'app.css').read_text(encoding='utf-8'),
             DATA=data_js,
             JS=(HERE / 'app.js').read_text(encoding='utf-8'))
guard('index.html', index)
(SITE / 'index.html').write_text(index, encoding='utf-8')

# ------------------------------------------------------------- full guide --
e = html.escape
LIST_NAME = {'exterior': 'exterior detail', 'interior': 'interior detail', 'correction': 'paint correction',
             'ceramic': 'ceramic coating', 'maintenance': 'maintenance wash'}
WHEN = {'before': 'Film this first', 'during': 'Film during the step', 'after': 'Film after the step', 'later': 'Later'}
ALL_ITEMS = {it['id']: (it, s, t) for t in seed['templates'] for s in t['sections'] for it in s['items']}


def needs_note(needs):
    if not needs:
        return ''
    parts = needs.split('|')
    if all(p.startswith('!') for p in parts):
        return 'Not on ' + ' or '.join(LIST_NAME.get(p[1:], p[1:]) for p in parts) + ' jobs.'
    return 'Only on ' + ' or '.join(LIST_NAME.get(p, p) for p in parts if not p.startswith('!')) + ' jobs.'


def note(needs):
    n = needs_note(needs)
    return f'<p class="only">{e(n)}</p>' if n else ''


def how(it):
    return f'<details class="how"><summary>How to do it</summary><p>{e(it["more"])}</p></details>' if it.get('more') else ''


def subs(it):
    return '<ul class="subs">' + ''.join(f'<li>{e(x)}</li>' for x in it['subs']) + '</ul>' if it.get('subs') else ''


def where(ids):
    names = []
    for sid in ids or []:
        if sid in ALL_ITEMS:
            it, s, t = ALL_ITEMS[sid]
            names.append(f'{title(it)} ({LIST_NAME.get(t["key"], t["name"].lower())})')
    return names


def photos(it):
    if not it.get('photos'):
        return ''
    rows = []
    for p in it['photos']:
        at = where(p.get('at'))
        side = 'before' if p.get('pos') == 'before' else 'after'
        rows.append(f'<li><b>{e(p["label"])}</b>' +
                    (f'<span class="meta">Taken {side}: {e(", ".join(at))}.</span>' if at else '') +
                    note(p.get('needs', '')) + '</li>')
    return '<h4 class="ph">The job photos</h4><ol class="photos">' + ''.join(rows) + '</ol>'


def item_html(it, style):
    kind = it['type']
    if kind == 'step':
        return (f'<li><p><b>{e(it.get("title", ""))}</b> {e(it.get("detail", ""))}</p>{subs(it)}{note(it.get("needs", ""))}'
                f'{how(it)}</li>')
    if kind in ('rule', 'signoff'):
        return f'<li><p>{e(it.get("detail") or it.get("title", ""))}</p>{subs(it)}{note(it.get("needs", ""))}{how(it)}{photos(it)}</li>'
    if kind == 'clip':
        bits = [WHEN.get(it.get('when'), ''), it.get('length', '')]
        meta = ', '.join(b for b in bits if b)
        at = where(it.get('at'))
        return (f'<li><p><b>{e(it.get("title", ""))}</b></p>'
                f'<p class="meta">{e(meta)}{". " if meta else ""}{e(it.get("purpose", ""))}{"." if it.get("purpose") else ""}'
                f'{(" At: " + e(", ".join(at)) + ".") if at else ""}</p>{note(it.get("needs", ""))}</li>')
    if kind == 'script':
        return f'<li class="script"><p class="said">{e(it.get("title", ""))}</p><blockquote>{e(it.get("detail", ""))}</blockquote>{note(it.get("needs", ""))}</li>'
    return f'<li><p>{e(it.get("title", ""))} {e(it.get("detail", ""))}</p></li>'


def template_html(t):
    out = [f'<section class="tpl" id="g-{e(t["key"])}"><h2>{e(t["name"])}</h2>']
    if t.get('intro'):
        out.append(f'<p class="intro">{e(t["intro"])}</p>')
    for s in t['sections']:
        style = s.get('style') or 'numbered'
        if s.get('heading') is not False:
            out.append(f'<h3>{e(s["name"])}</h3>')
        if s.get('intro'):
            out.append(f'<p class="sec-intro">{e(s["intro"])}</p>')
        out.append(note(s.get('needs', '')))
        tag = 'ol' if style == 'numbered' else 'ul'
        out.append(f'<{tag} class="items {e(style)}">' + ''.join(item_html(it, style) for it in s['items']) + f'</{tag}>')
    out.append('</section>')
    return ''.join(out)


def services_html():
    rows = []
    for name, m in SERVICES.items():
        lists = ', '.join(TPL[k]['name'] for k in m['templates'] if k in TPL)
        g = m.get('goal')
        goal = ''
        if g:
            hrs = lambda x: str(round(x / 15) / 4).rstrip('0').rstrip('.')
            goal = f'{g[0]} min to {hrs(g[1])} hour{"" if g[1] == 60 else "s"}' if g[0] < 60 else f'{hrs(g[0])} to {hrs(g[1])} hours'
        rows.append(f'<tr><th scope="row">{e(name)}</th><td>{e(lists)}</td><td>{e(goal)}</td></tr>')
    return ('<section class="tpl" id="g-services"><h2>Services</h2><p class="intro">The lists each service gets, and how long it should take.</p>'
            '<div class="tbl"><table><thead><tr><th scope="col">Service</th><th scope="col">Lists</th><th scope="col">Time goal</th></tr></thead><tbody>'
            + ''.join(rows) + '</tbody></table></div></section>')


def prices_html():
    if not PRICES.get('vehicles'):
        return ''
    out = ['<section class="tpl" id="g-prices"><h2>Prices</h2>']
    cond = PRICES.get('condition') or {}
    if cond.get('range'):
        out.append(f'<p class="intro">{e(", ".join(cond.get("services", [])))}: up to ${cond["range"]} more depending on condition, agreed before you start. '
                   'Anything else: the price you quote is the price they pay.</p>')
    for v in PRICES['vehicles']:
        out.append(f'<h3>{e(v["name"])}</h3>')
        if v.get('prices'):
            out.append('<div class="tbl"><table><tbody>' + ''.join(
                f'<tr><th scope="row">{e(k)}</th><td class="num">${p:,}</td></tr>' for k, p in v['prices'].items()) + '</tbody></table></div>')
        if v.get('note'):
            out.append(f'<p class="sec-intro">{e(v["note"])}</p>')
    if PRICES.get('notOffered'):
        out.append(f'<p class="sec-intro">{e(PRICES["notOffered"])}</p>')
    out.append('</section>')
    return ''.join(out)


ordered = sorted(seed['templates'], key=lambda t: t.get('sort', 0))
nav = ''.join(f'<li><a href="#g-{e(t["key"])}">{e(t["name"])}</a></li>' for t in ordered)
nav += '<li><a href="#g-services">Services</a></li>' + ('<li><a href="#g-prices">Prices</a></li>' if PRICES.get('vehicles') else '')
body = ''.join(template_html(t) for t in ordered) + services_html() + prices_html()
full = fill((HERE / 'full.html').read_text(encoding='utf-8'),
            ICON=ICON, LOGO=LOGO, FONTS=FONTS,
            CSS=(HERE / 'full.css').read_text(encoding='utf-8'),
            NAV=nav, BODY=body)
guard('full.html', full)
(SITE / 'full.html').write_text(full, encoding='utf-8')

print(f'index.html {len(index) // 1024} KB, full.html {len(full) // 1024} KB')
print('Exterior guide:', ', '.join(it['t'] for it in EXT))
print('Interior guide:', ', '.join(it['t'] for it in INT))
