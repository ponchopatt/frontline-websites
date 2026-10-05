/*
  Imperium SOPs: the job page.

  One screen, five ticks: before videos, exterior done, interior done, final
  check, after videos and cards. Job done unlocks when every tick that fits
  the job is on. Who ticked what, and when, only shows in the summary picture
  sent to the group.

  Everything stays on this phone, in the same place the old checklist kept
  its jobs (imp.jobs.local), so jobs saved by the old page still open here.
  A new-style job keeps its ticks in job.five; an old job's own fields are
  never changed.
*/
(() => {
  'use strict';
  const G = window.GUIDE;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STORE_KEY = 'imp.jobs.local';
  const ME_KEY = 'imp.sopdemo.me';
  const KEEP_DAYS = 40;
  const WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7.5"/></svg>';
  const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  /* ================================================================ time == */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };
  const nowIso = () => new Date().toISOString();
  const clock = d => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase();
  function dayName(key) {
    if (!key) return '';
    const t = today();
    if (key === t) return 'Today';
    if (key === addDays(t, 1)) return 'Tomorrow';
    if (key === addDays(t, -1)) return 'Yesterday';
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  // A time, with the day in front when it isn't the job's own day.
  function at(iso, jobDay) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return '';
    const [y, m, dd] = ymd(d).split('-').map(Number);
    return ymd(d) === jobDay ? clock(d) : `${new Date(y, m - 1, dd).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}, ${clock(d)}`;
  }
  function duration(min) {
    min = Math.max(0, Math.round(min));
    if (min < 60) return min + ' min';
    return Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '');
  }
  const hours = m => String(Math.round(m / 15) / 4);
  function goalText(g) {
    if (!g) return '';
    if (g[0] < 60) return g[0] + ' min to ' + hours(g[1]) + (g[1] === 60 ? ' hour' : ' hours');
    return hours(g[0]) + ' to ' + hours(g[1]) + ' hours';
  }

  /* =============================================================== store == */
  let store = { v: 1, jobs: {} };
  let canSave = true;
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && s.v === 1 && s.jobs && typeof s.jobs === 'object') store = s;
    } catch {}
  }
  // Writes back everything that was read (the old page's SOPs and settings too).
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); canSave = true; }
    catch {
      if (canSave) toast('This phone isn’t saving the ticks. Turn off private browsing, then try again.', 'bad');
      canSave = false;
    }
  }
  let me = '';
  try { me = localStorage.getItem(ME_KEY) || ''; } catch {}

  /* ============================================================= the job == */
  // Which lists a job gets, from its services. Same rules as the old checklist.
  function plan(j) {
    const keys = [], stop = {};
    let known = false;
    for (const s of j.services || []) {
      const m = G.services[s];
      if (!m) continue;
      known = true;
      for (const k of m.templates) if (!keys.includes(k)) keys.push(k);
      Object.assign(stop, m.stopAfter || {});
    }
    if (!known) {
      const old = j.meta && Array.isArray(j.meta.templateKeys) ? j.meta.templateKeys : ['exterior', 'interior'];
      for (const k of old) if (!keys.includes(k)) keys.push(k);
    }
    return { keys, stop };
  }
  // "a|b": the job has a or b. "!a": it doesn't have a. Nothing: always.
  function fits(needs, keys) {
    if (!needs) return true;
    const pos = [], neg = [];
    String(needs).split('|').forEach(p => (p.charAt(0) === '!' ? neg.push(p.slice(1)) : pos.push(p)));
    if (neg.some(k => keys.includes(k))) return false;
    return !pos.length || pos.some(k => keys.includes(k));
  }

  // The ticks this job gets, in order. A job with no outside work has no
  // Exterior done, and the other way round.
  function ticksFor(j) {
    const { keys } = plan(j);
    const has = k => keys.includes(k);
    let out = has('exterior') || has('maintenance') || has('correction') || has('ceramic');
    let inn = has('interior') || has('maintenance');
    if (!out && !inn) out = inn = true;
    // Regulars on a maintenance wash don't get cards; everyone else does.
    const cards = !(has('maintenance') && !has('exterior') && !has('interior') && !has('correction') && !has('ceramic'));
    return [
      { k: 'before', name: 'Before videos', lines: [out && 'Front 3/4 of the car', inn && 'Driver seat and carpet'] },
      out && { k: 'ext', name: 'Exterior done', film: 'Film the car with foam on', guide: 'out' },
      inn && { k: 'int', name: 'Interior done', guide: 'in' },
      { k: 'check', name: 'Final check', label: 'All checked' },
      { k: 'after', name: 'After videos and cards', lines: [out && 'Front 3/4 of the finished car', inn && 'Driver seat and carpet', cards && 'Put the review card and business card inside the steering wheel cover'] },
    ].filter(Boolean).map(t => ({ ...t, lines: (t.lines || []).filter(Boolean) }));
  }

  // An old job finished on the old checklist.
  function oldFinish(j) {
    const st = j.state || {};
    if (st.done && !st.done.off) return { by: st.done.by || '', at: st.done.at || '' };
    if (j.sum && j.sum.stage === 'done') return { by: j.sum.finishedBy || '', at: j.sum.finishedAt || '' };
    return null;
  }
  // When an old job's first tick was made.
  function oldStart(j) {
    let start = '';
    for (const [k, v] of Object.entries(j.state || {})) {
      if (k.indexOf('s:') === 0 && v && (v.done || v.skipped) && v.at && (!start || v.at < start)) start = v.at;
    }
    return start;
  }
  const OLD = { old: true };
  // The five ticks and Job done, for reading. Old jobs done on the old
  // checklist read as all ticked and done.
  function fiveOf(j) {
    if (j.five) return j.five;
    const fin = oldFinish(j);
    if (fin) return { ticks: { before: OLD, ext: OLD, int: OLD, check: OLD, after: OLD }, done: { ...fin, old: true } };
    return { ticks: {}, done: null };
  }
  // The same, ready to change. Only now does an old job get a five of its own.
  function editFive(j) {
    if (!j.five) j.five = JSON.parse(JSON.stringify(fiveOf(j)));
    if (!j.five.ticks) j.five.ticks = {};
    return j.five;
  }
  const isDone = j => !!fiveOf(j).done;
  const left = j => { const f = fiveOf(j); return ticksFor(j).filter(t => !f.ticks[t.k]).length; };

  /* ============================================================ the guide == */
  function guideHtml(j, side) {
    const { keys, stop } = plan(j);
    const groups = G[side].filter(g => keys.includes(g.key));
    const parts = [];
    for (const g of groups) {
      const cut = stop[g.key];
      const secs = g.sections.map(s => {
        const end = cut ? (s.items.find(it => it.id === cut) || {}).o : undefined;
        const items = s.items.filter(it => fits(it.n, keys) && (end === undefined || it.o <= end));
        return { name: s.name, items };
      }).filter(s => s.items.length);
      secs.forEach(s => {
        const head = [groups.length > 1 ? g.name : '', secs.length > 1 ? s.name : ''].filter(Boolean).join(': ');
        if (head) parts.push(`<h4 class="steps-h">${esc(head)}</h4>`);
        parts.push('<ol class="steps">' + s.items.map(it => `<li><b>${esc(it.t)}</b><p>${esc(it.m)}</p></li>`).join('') + '</ol>');
      });
    }
    return parts.join('');
  }
  function checkHtml(j) {
    const { keys } = plan(j);
    return G.check.filter(s => fits(s.n, keys)).map(s => {
      const items = s.items.filter(it => fits(it.n, keys));
      return items.length ? `<h4>${esc(s.name)}</h4><ul>${items.map(it => `<li>${esc(it.t)}</li>`).join('')}</ul>` : '';
    }).join('');
  }

  /* ============================================================== screens == */
  let openId = null;
  const guideOpen = new Set();
  const cur = () => (openId ? store.jobs[openId] : null);

  function paintWho() {
    $('whoName').textContent = me || 'Who are you?';
    $('whoBtn').toggleAttribute('data-set', !!me);
  }

  function cardHtml(j) {
    const T = ticksFor(j), f = fiveOf(j), done = !!f.done;
    const n = T.filter(t => f.ticks[t.k]).length;
    const C = 2 * Math.PI * 21;
    const frac = done ? 1 : n / T.length;
    const sub = [j.customer ? j.car : '', j.suburb].filter(Boolean).join(', ');
    const status = done ? 'Done' : `${n} of ${T.length} ticked`;
    return `<button class="jc" type="button" data-open="${esc(j.id)}"${done ? ' data-done' : ''}>
      <span class="ring" aria-hidden="true"><svg viewBox="0 0 48 48"><circle class="tr" cx="24" cy="24" r="21"/><circle class="ar" cx="24" cy="24" r="21" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(2)}"/></svg>${done ? `<svg class="ok" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7.5"/></svg>` : `<b>${n}/${T.length}</b>`}</span>
      <span class="jc-main"><span class="jc-title">${esc(j.customer || j.car || 'Job')}</span>
        <span class="jc-sub">${sub ? esc(sub) + '<br>' : ''}${esc((j.services || []).join(' + '))} <b>${status}</b></span></span>
      <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
    </button>`;
  }

  function paintList() {
    const t = today(), from = addDays(t, -KEEP_DAYS);
    const list = Object.values(store.jobs).filter(j => j && j.id && typeof j.date === 'string' && j.date >= from);
    if (!list.length) {
      $('jobList').innerHTML = '<p class="empty">No jobs yet. At the car, tap <b>Start a job</b> and pick the service.</p>';
      return;
    }
    const byCreated = (a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    const groups = [];
    const ahead = list.filter(j => j.date > t).sort((a, b) => a.date.localeCompare(b.date) || byCreated(a, b));
    if (ahead.length) groups.push(['Coming up', ahead]);
    for (const d of [...new Set(list.filter(j => j.date <= t).map(j => j.date))].sort().reverse()) {
      groups.push([dayName(d), list.filter(j => j.date === d).sort(byCreated)]);
    }
    const jobs = n => `${n} job${n === 1 ? '' : 's'}`;
    $('jobList').innerHTML = groups.map(([name, js]) =>
      `<h2 class="day"><span>${esc(name)}</span><span>${jobs(js.length)}</span></h2>` + js.map(cardHtml).join('')).join('');
  }

  function tickButton(t, i, label) {
    const lines = label ? '' : (t.film ? `<span class="l film">${esc(t.film)}</span>` : '') + t.lines.map(l => `<span class="l">${esc(l)}</span>`).join('');
    return `<button class="tk${label ? ' all' : ''}" type="button" data-k="${t.k}" aria-pressed="false">
      <span class="c">${label ? '' : i + 1}${CHECK}</span>
      <span><span class="t">${esc(label || t.name)}</span>${lines}</span>
    </button>`;
  }

  function paintJob() {
    const j = cur();
    if (!j) return;
    const T = ticksFor(j);
    $('jt').textContent = j.car || j.customer || 'Job';
    $('js').innerHTML = [j.car ? esc(j.customer) : '', esc(j.suburb), j.date !== today() ? esc(dayName(j.date)) : '']
      .filter(Boolean).concat(`<b>${esc((j.services || []).join(' + '))}</b>`).join(', ');
    $('jobBody').innerHTML = '<ol class="five">' + T.map((t, i) => {
      if (t.k === 'check') {
        return `<li><div class="hd"><span class="n">${i + 1}</span><span class="t">${esc(t.name)}</span></div>
          <div class="chk">${checkHtml(j)}</div>${tickButton(t, i, t.label)}</li>`;
      }
      const guide = t.guide ? guideHtml(j, t.guide) : '';
      return `<li>${tickButton(t, i)}${guide ? `<details class="guide" data-g="${t.k}"${guideOpen.has(t.k) ? ' open' : ''}><summary>Not sure what’s next? ${CHEV}</summary>${guide}</details>` : ''}</li>`;
    }).join('') + '</ol>';
    paintState();
  }

  // Only the ticks and the finish change on a tap, so open guides stay open.
  function paintState(just) {
    const j = cur();
    if (!j) return;
    const f = fiveOf(j), done = !!f.done;
    document.querySelectorAll('#jobBody .tk').forEach(b => {
      b.setAttribute('aria-pressed', String(!!f.ticks[b.dataset.k]));
      b.setAttribute('aria-disabled', String(done));
      b.toggleAttribute('data-just', b.dataset.k === just && !!f.ticks[just]);
    });
    const n = left(j), total = ticksFor(j).length;
    $('finish').innerHTML = done
      ? `<div class="seal"><span class="stamp">${CHECK}</span><div><h3>Job done</h3><p>Send the summary to the group.</p></div></div>
         <button class="go" type="button" data-act="summary">Send the summary to the group</button>
         <button class="ghost" type="button" data-act="reopen">Reopen this job</button>`
      : `<button class="go" type="button" data-act="done"${n ? ' disabled' : ''}>Job done</button>
         <p class="hint">${n === total ? `Tick all ${WORDS[total]} to finish.` : n ? `${WORDS[n][0].toUpperCase() + WORDS[n].slice(1)} to go.` : 'All ticked. Tap Job done.'}</p>`;
  }

  function show() {
    const m = /^#job\/(.+)$/.exec(location.hash);
    const id = m ? decodeURIComponent(m[1]) : null;
    if (id && store.jobs[id]) {
      if (openId !== id) guideOpen.clear();
      openId = id;
      $('vJobs').hidden = true;
      $('vJob').hidden = false;
      $('brand').hidden = true;
      $('back').hidden = false;
      paintJob();
    } else {
      openId = null;
      $('vJob').hidden = true;
      $('vJobs').hidden = false;
      $('brand').hidden = false;
      $('back').hidden = true;
      paintList();
    }
  }
  // Opening a job adds a step to the phone's history, so its back button returns to the list.
  function openJob(id) {
    history.pushState({ fromList: true }, '', '#job/' + encodeURIComponent(id));
    show();
    window.scrollTo(0, 0);
  }
  function backToList() {
    if (history.state && history.state.fromList) history.back();
    else { history.replaceState(null, '', location.pathname + location.search); show(); }
  }

  /* ============================================================= actions == */
  let pending = null;
  // Anything that puts a name on the job asks who's holding the phone first.
  function asMe(fn) {
    if (me) return fn();
    pending = fn;
    openWho();
  }
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch {} };
  const touch = j => { j.updatedAt = nowIso(); save(); };

  function tick(k) {
    const j = cur();
    if (!j) return;
    if (isDone(j)) return toast('This job is done. Reopen it to change a tick.');
    asMe(() => {
      const f = editFive(j);
      if (f.ticks[k]) delete f.ticks[k];
      else { f.ticks[k] = { by: me, at: nowIso() }; buzz(12); }
      touch(j);
      paintState(k);
    });
  }
  function finish() {
    const j = cur();
    if (!j || isDone(j) || left(j)) return;
    asMe(() => {
      editFive(j).done = { by: me, at: nowIso() };
      touch(j);
      buzz(20);
      paintState();
      openSummary();
    });
  }
  function reopen() {
    const j = cur();
    if (!j || !isDone(j)) return;
    asMe(() => {
      const f = editFive(j);
      (f.reopened = f.reopened || []).push({ by: me, at: nowIso() });
      f.done = null;
      touch(j);
      paintState();
      toast('Reopened. Fix what’s needed, then tap Job done again.');
    });
  }

  /* ================================================================= who == */
  function openWho() {
    $('whoList').innerHTML = G.crew.map(n => `<button type="button" data-me="${esc(n)}" aria-pressed="${n === me}">${esc(n)}</button>`).join('');
    $('whoOther').value = G.crew.includes(me) ? '' : me;
    $('whoDlg').showModal();
  }
  function setMe(name) {
    name = String(name || '').trim().slice(0, 40);
    if (!name) return;
    me = name;
    try { localStorage.setItem(ME_KEY, me); } catch {}
    paintWho();
    const fn = pending;
    pending = null;
    $('whoDlg').close();
    if (fn) fn();
  }

  /* ============================================================ job form == */
  let jd = null;
  function openJobDlg(j) {
    jd = { id: j ? j.id : null, services: j ? (j.services || []).slice() : [], date: j ? j.date : today() };
    $('jdTitle').textContent = j ? 'Job details' : 'Start a job';
    $('jdSave').textContent = j ? 'Save changes' : 'Start the job';
    $('jdName').value = j ? j.customer || '' : '';
    $('jdCar').value = j ? j.car || '' : '';
    $('jdSuburb').value = j ? j.suburb || '' : '';
    $('jdErr').hidden = true;
    $('jdFoot').hidden = !j;
    paintJd();
    $('jobDlg').showModal();
  }
  function paintJd() {
    const names = Object.keys(G.services);
    const extra = jd.services.filter(s => !names.includes(s));
    $('jdSvc').innerHTML = names.concat(extra).map(n => `<button type="button" data-svc="${esc(n)}" aria-pressed="${jd.services.includes(n)}">${esc(n)}</button>`).join('');
    const t = today(), tm = addDays(t, 1);
    const other = jd.date !== t && jd.date !== tm;
    $('jdDays').innerHTML = [[t, 'Today'], [tm, 'Tomorrow']].map(([d, l]) => `<button type="button" data-jday="${d}" aria-pressed="${jd.date === d}">${l}</button>`).join('') +
      `<button type="button" data-jday="pick" aria-pressed="${other}">${other ? esc(dayName(jd.date)) : 'Another day'}</button>`;
    $('jdDate').value = jd.date;
    $('jdSave').disabled = !jd.services.length;
  }
  function saveJd() {
    const customer = $('jdName').value.trim(), car = $('jdCar').value.trim(), suburb = $('jdSuburb').value.trim();
    const err = m => { $('jdErr').textContent = m; $('jdErr').hidden = false; };
    if (!jd.services.length) return err('Pick a service.');
    if (!car && !customer) return err('Add the car or the customer’s name.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jd.date)) return err('Pick the day.');
    const now = nowIso();
    if (jd.id) {
      const j = store.jobs[jd.id];
      Object.assign(j, { customer, car, suburb, services: jd.services.slice(), date: jd.date, updatedAt: now });
      save();
      $('jobDlg').close();
      paintJob();
      return;
    }
    const id = 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    store.jobs[id] = { id, date: jd.date, customer, car, suburb, services: jd.services.slice(), createdBy: me, createdAt: now, updatedAt: now, five: { ticks: {}, done: null } };
    save();
    $('jobDlg').close();
    openJob(id);
  }
  async function deleteJob() {
    const j = store.jobs[jd && jd.id];
    if (!j) return;
    $('jobDlg').close();
    if (!await ask('Delete this job?', `${j.customer || j.car}, ${dayName(j.date).toLowerCase()}. Its ticks go too. It can’t be undone.`)) return;
    delete store.jobs[j.id];
    save();
    backToList();
    toast('Job deleted.');
  }

  let askDone = null;
  function ask(title, body) {
    return new Promise(resolve => {
      $('askTitle').textContent = title;
      $('askBody').textContent = body;
      askDone = resolve;
      $('askDlg').showModal();
    });
  }
  function closeAsk(yes) { const d = askDone; askDone = null; $('askDlg').close(); if (d) d(yes); }

  let toastTimer = 0;
  function toast(msg, kind) {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast' + (kind === 'bad' ? ' bad' : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'bad' ? 6000 : 3800);
  }

  /* ============================================================= summary == */
  // The picture sent to the group. Drawn on a canvas so it needs nothing
  // from the internet.
  const C = {
    bg: '#121113', panel: '#1A181B', line: 'rgba(244, 241, 236, 0.10)', steel: '#35323A',
    ivory: '#F4F1EC', ash: '#C3BEB8', slate: '#928D89', amber: '#FFB020', amberLit: '#FFCB63', good: '#57D08A', warn: '#FF7A66',
  };
  const FONT = { display: "'Big Shoulders Display', 'Instrument Sans', sans-serif", sans: "'Instrument Sans', system-ui, sans-serif" };
  const CARD_W = 1080, PAD = 72, INNER = CARD_W - PAD * 2;

  function summaryFacts(j) {
    const f = fiveOf(j), T = ticksFor(j);
    const rows = T.map((t, i) => {
      const x = f.ticks[t.k];
      return { n: i + 1, name: t.name, by: x ? (x.old ? 'Old checklist' : x.by || '') : '', when: x && !x.old ? at(x.at, j.date) : '', on: !!x };
    });
    const times = T.map(t => f.ticks[t.k]).filter(x => x && x.at && !x.old).map(x => x.at);
    if (T.some(t => f.ticks[t.k] && f.ticks[t.k].old)) { const s = oldStart(j); if (s) times.push(s); }
    const start = times.sort()[0] || '';
    const end = f.done ? f.done.at : '';
    const mins = start && end ? (new Date(end) - new Date(start)) / 60000 : null;
    let goal = null;
    for (const s of j.services || []) {
      const g = G.services[s] && G.services[s].goal;
      if (g) goal = goal ? [goal[0] + g[0], goal[1] + g[1]] : g.slice();
    }
    const [y, m, d] = j.date.split('-').map(Number);
    return {
      title: j.car || j.customer || 'Job',
      services: (j.services || []).join(' + '),
      sub: [j.car ? j.customer : '', j.suburb].filter(Boolean).join(', '),
      when: new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }),
      rows,
      total: mins != null && mins >= 0 ? duration(mins) : '',
      span: start && end ? `First tick ${at(start, j.date)}. Job done ${at(end, j.date)}.` : '',
      goal: goal ? `Goal ${goalText(goal)}` : '',
      over: !!(goal && mins != null && mins > goal[1]),
      finished: f.done ? (f.done.by ? `Job done by ${f.done.by}.` : 'Job done.') : 'Not finished yet.',
    };
  }

  function wrapLines(ctx, text, max) {
    const lines = [];
    let line = '';
    for (const w of String(text || '').split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + w : w;
      if (!line || ctx.measureText(t).width <= max) line = t;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    return lines;
  }
  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // Lays the card out from the top. Run once to measure, once to paint.
  function drawCard(ctx, d, logo, height) {
    const text = (str, x, y, font, color, align) => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(str, x, y);
    };
    const block = (str, y, font, color, lh, max, x) => {
      ctx.font = font;
      const lines = wrapLines(ctx, str, max || INNER);
      if (height) lines.forEach((l, i) => text(l, x || PAD, y + lh * (i + 1) - Math.round(lh * 0.22), font, color));
      return y + lh * lines.length;
    };
    if (height) {
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, CARD_W, height);
      const glow = ctx.createRadialGradient(CARD_W / 2, -80, 40, CARD_W / 2, -80, 760);
      glow.addColorStop(0, 'rgba(255, 176, 32, 0.16)');
      glow.addColorStop(1, 'rgba(255, 176, 32, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, CARD_W, 700);
    }
    let y = PAD;
    if (logo && height) {
      const h = 50, w = Math.round(logo.width * (h / logo.height));
      ctx.drawImage(logo, PAD, y, w, h);
    }
    if (height) text(d.when, CARD_W - PAD, y + 36, `500 30px ${FONT.sans}`, C.slate, 'right');
    y += 50 + 58;
    y = block(d.title, y, `700 112px ${FONT.display}`, C.ivory, 106);
    y += 10;
    y = block(d.services, y, `600 44px ${FONT.sans}`, C.amber, 56);
    if (d.sub) y = block(d.sub, y + 6, `400 34px ${FONT.sans}`, C.slate, 46);
    y += 44;

    // Total time, big.
    const panelTop = y;
    let py = y + 40;
    py = block(d.total || 'No time', py, `700 120px ${FONT.display}`, d.over ? C.warn : C.ivory, 116, INNER - 80, PAD + 40);
    py = block('Total job time', py + 4, `600 38px ${FONT.sans}`, C.ash, 50, INNER - 80, PAD + 40);
    if (d.span) py = block(d.span, py + 4, `400 30px ${FONT.sans}`, C.slate, 42, INNER - 80, PAD + 40);
    if (d.goal) py = block(d.goal, py + 2, `600 30px ${FONT.sans}`, d.over ? C.warn : C.good, 42, INNER - 80, PAD + 40);
    const panelH = py + 36 - panelTop;
    if (height) {
      rounded(ctx, PAD, panelTop, INNER, panelH, 28);
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    y = panelTop + panelH + 40;

    // The ticks: who and when.
    for (const r of d.rows) {
      const rowTop = y, cx = PAD + 34, cy = rowTop + 46;
      const nameEnd = block(r.name, rowTop + 8, `600 40px ${FONT.sans}`, C.ivory, 52, INNER - 96, PAD + 96);
      const whoEnd = block(r.on ? [r.by, r.when].filter(Boolean).join(', ') : 'Not ticked', nameEnd, `400 32px ${FONT.sans}`, r.on ? C.ash : C.warn, 44, INNER - 96, PAD + 96);
      if (height) {
        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        if (r.on) { ctx.fillStyle = C.amber; ctx.fill(); }
        else { ctx.strokeStyle = C.steel; ctx.lineWidth = 4; ctx.stroke(); }
        if (r.on) {
          ctx.strokeStyle = C.bg;
          ctx.lineWidth = 7;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(cx - 13, cy + 1);
          ctx.lineTo(cx - 4, cy + 10);
          ctx.lineTo(cx + 14, cy - 9);
          ctx.stroke();
        } else text(String(r.n), cx, cy + 12, `700 34px ${FONT.display}`, C.slate, 'center');
      }
      y = Math.max(whoEnd, rowTop + 92) + 22;
    }

    if (height) { ctx.fillStyle = C.line; ctx.fillRect(PAD, y, INNER, 2); }
    y += 34;
    y = block(d.finished, y, `600 34px ${FONT.sans}`, C.ivory, 46);
    y = block('Imperium Detailing job checklist', y + 6, `400 26px ${FONT.sans}`, C.slate, 38);
    return y + PAD - 20;
  }
  function loadImage(src) {
    return new Promise((ok, no) => {
      if (!src) return no(new Error('no image'));
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = no;
      img.src = src;
    });
  }
  async function summaryCanvas(j) {
    const d = summaryFacts(j);
    try {
      await Promise.all([`700 112px ${FONT.display}`, `600 40px ${FONT.sans}`, `400 34px ${FONT.sans}`]
        .map(f => (document.fonts && document.fonts.load ? document.fonts.load(f) : null)));
    } catch {}
    let logo = null;
    try { logo = await loadImage(document.querySelector('.head img').src); } catch {}
    const probe = document.createElement('canvas').getContext('2d');
    const height = Math.ceil(drawCard(probe, d, logo, 0));
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = height;
    drawCard(canvas.getContext('2d'), d, logo, height);
    return canvas;
  }

  let sumBlob = null, sumUrl = '', sumName = '';
  const sumSay = m => { $('sumMsg').textContent = m; };
  async function openSummary() {
    const j = cur();
    if (!j) return;
    sumBlob = null;
    if (sumUrl) URL.revokeObjectURL(sumUrl);
    sumUrl = '';
    $('sumImg').hidden = true;
    $('sumWait').hidden = false;
    $('sumWait').textContent = 'Making the picture…';
    for (const id of ['sumCopy', 'sumShare', 'sumSave']) $(id).disabled = true;
    sumSay('');
    $('sumDlg').showModal();
    try {
      const canvas = await summaryCanvas(j);
      sumBlob = await new Promise((ok, no) => canvas.toBlob(b => (b ? ok(b) : no(new Error('no picture'))), 'image/png'));
    } catch {
      $('sumWait').textContent = 'The picture couldn’t be made on this phone.';
      return;
    }
    sumUrl = URL.createObjectURL(sumBlob);
    sumName = `imperium-${String(j.car || j.customer || 'job').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${j.date}.png`;
    $('sumImg').src = sumUrl;
    $('sumImg').hidden = false;
    $('sumWait').hidden = true;
    let canShare = false;
    try { canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([sumBlob], sumName, { type: 'image/png' })] })); } catch {}
    $('sumShare').hidden = !canShare;
    for (const id of ['sumCopy', 'sumShare', 'sumSave']) $(id).disabled = false;
  }
  // The picture is ready before the tap, so Safari lets the copy happen.
  async function copySummary() {
    if (!sumBlob) return;
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no clipboard');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': sumBlob })]);
      sumSay('Copied. Open the Imperium group chat and paste it.');
      buzz(14);
    } catch {
      sumSay('This phone won’t copy a picture from here. Hold your finger on the picture and tap Copy, or use Share.');
    }
  }
  async function shareSummary() {
    if (!sumBlob) return;
    try { await navigator.share({ files: [new File([sumBlob], sumName, { type: 'image/png' })], title: 'Job summary' }); }
    catch (err) { if (err && err.name !== 'AbortError') sumSay('Sharing didn’t work here. Copy or Save it instead.'); }
  }
  function saveSummary() {
    if (!sumUrl) return;
    const a = document.createElement('a');
    a.href = sumUrl;
    a.download = sumName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    sumSay(`Saved ${sumName}.`);
  }

  /* ============================================================== wiring == */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-k],[data-act],[data-open],[data-me],[data-svc],[data-jday]');
    if (!t) return;
    if (t.dataset.k) return tick(t.dataset.k);
    if (t.dataset.open) return openJob(t.dataset.open);
    if (t.dataset.me) return setMe(t.dataset.me);
    if (t.dataset.act === 'done') return finish();
    if (t.dataset.act === 'summary') return openSummary();
    if (t.dataset.act === 'reopen') return reopen();
    if (t.dataset.svc) {
      const s = t.dataset.svc;
      jd.services = jd.services.includes(s) ? jd.services.filter(x => x !== s) : jd.services.concat(s);
      $('jdErr').hidden = true;
      return paintJd();
    }
    if (t.dataset.jday) {
      if (t.dataset.jday === 'pick') { $('jdDate').hidden = false; try { $('jdDate').showPicker(); } catch {} return; }
      jd.date = t.dataset.jday;
      $('jdDate').hidden = true;
      return paintJd();
    }
  });
  document.addEventListener('toggle', e => {
    const d = e.target;
    if (!d.matches || !d.matches('details.guide')) return;
    if (d.open) guideOpen.add(d.dataset.g); else guideOpen.delete(d.dataset.g);
  }, true);

  $('newJob').addEventListener('click', () => openJobDlg(null));
  $('details').addEventListener('click', () => { const j = cur(); if (j) openJobDlg(j); });
  $('back').addEventListener('click', backToList);
  $('whoBtn').addEventListener('click', openWho);
  $('whoCancel').addEventListener('click', () => { pending = null; $('whoDlg').close(); });
  $('whoDlg').addEventListener('close', () => { pending = null; });
  $('whoOtherGo').addEventListener('click', () => setMe($('whoOther').value));
  $('whoOther').addEventListener('keydown', e => { if (e.key === 'Enter') setMe($('whoOther').value); });
  $('jdCancel').addEventListener('click', () => $('jobDlg').close());
  $('jdSave').addEventListener('click', saveJd);
  $('jdDelete').addEventListener('click', deleteJob);
  $('jdDate').addEventListener('change', () => { if ($('jdDate').value) { jd.date = $('jdDate').value; paintJd(); } });
  $('askNo').addEventListener('click', () => closeAsk(false));
  $('askYes').addEventListener('click', () => closeAsk(true));
  $('askDlg').addEventListener('cancel', () => closeAsk(false));
  $('sumCopy').addEventListener('click', copySummary);
  $('sumShare').addEventListener('click', shareSummary);
  $('sumSave').addEventListener('click', saveSummary);
  $('sumClose').addEventListener('click', () => $('sumDlg').close());
  window.addEventListener('popstate', show);
  window.addEventListener('hashchange', show);
  // Another tab on this phone changed the jobs.
  window.addEventListener('storage', e => { if (e.key === STORE_KEY) { load(); show(); } });

  load();
  paintWho();
  show();
})();
