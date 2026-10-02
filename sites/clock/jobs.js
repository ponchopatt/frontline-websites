/* Imperium Clock — job checklists.

   The Jobs tab. Start a job, pick the service, and the checklist for that
   service is built from the SOPs: every step in order, a plain-words How to do
   it under each one, the clips to film, the handover words, and the second
   check before the customer sees the car.

   It shares the timesheet's habits and none of its data. Every tick is
   applied on the phone first, queued, and sent when there is signal, in its
   own queue: nothing here can hold up or touch a shift. The Google Sheet only
   gets checklists once its script says `v: 2` (see apps-script.gs); until
   then they stay on the phone and the strip says so, because an older script
   would file an unknown write under Shifts.

   The rules (what a job gets, progress, sign-off) live in sop.js, so they are
   tested apart from the screen. app.js lends this file who is holding the
   phone, the toasts and the confirm box, through window.ImpClock. */

(() => {
  'use strict';

  const S = window.ImpSop;
  const H = window.ImpClock;
  const CFG = window.IMP || {};
  const ENDPOINT = CFG.ENDPOINT || '';
  const LIST_POLL_MS = CFG.POLL_MS || 20000;
  const JOB_POLL_MS = 8000;               // an open job, so two phones see each other's ticks
  const PROBE_MS = 120000;                // checking whether the sheet has been updated
  const KEEP_DAYS = 40;
  const LOCAL_KEY = 'imp.jobs.local';     // checklists kept on this phone only
  const CACHE_KEY = 'imp.jobs.cache';     // what the sheet said last time
  const QUEUE_KEY = 'imp.jobs.queue';     // writes waiting for signal
  const BIG_PANELS = new Set(['bonnet', 'roof', 'boot']);   // "more on bonnet, roof and boot"

  const $ = id => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Straight after an update a phone can run this file next to the old
     app.js from its cache for one open. Say so rather than sit there. */
  if (!S || !H) {
    const host = $('jobList');
    if (host) host.innerHTML = '<div class="empty">The app has just updated. Close it and open it again to see Jobs.</div>';
    const go = $('newJobBtn');
    if (go) go.hidden = true;
    return;
  }

  /* =============================================================== helpers == */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nowIso = () => new Date().toISOString();
  const today = () => S.ymd(new Date());
  const uid = () => 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const rev = () => Math.random().toString(36).slice(2, 10);
  const clone = x => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const who = () => H.meName() || '';
  const admin = () => H.isAdmin();
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const clockTime = d => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });

  function dayName(key) {
    if (!key) return '';
    const t = today();
    if (key === t) return 'Today';
    if (key === S.addDays(t, 1)) return 'Tomorrow';
    if (key === S.addDays(t, -1)) return 'Yesterday';
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function whenText(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return S.ymd(d) === today() ? clockTime(d) : `${dayName(S.ymd(d))}, ${clockTime(d)}`;
  }
  const longDate = key => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return '';
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7.5"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };
  const SHORT = {
    every_job: 'Every job', exterior: 'Exterior', interior: 'Interior', correction: 'Correction',
    ceramic: 'Ceramic', maintenance: 'Maintenance', door_knock: 'Door knock', handover: 'Handover', signoff: 'Sign-off',
  };
  const shortName = t => SHORT[t.key] || t.name;
  const STAGE_WORD = { working: 'In progress', ready: 'Ready for sign-off', signed: 'Signed off', done: 'Job done' };

  /* ================================================================= state == */
  let mode = 'loading';     // 'local' or 'sheet'
  let why = '';             // why local: 'none', 'old', 'preview', 'offline'
  let linkOk = true;
  let model = { sops: [], settings: null, jobs: {} };
  let queue = [];
  let flushing = false;
  let seedCache = null;

  let openId = null;        // the job on screen
  let idx = {};             // item id -> { it, s, t, n } for the job on screen
  let place = { before: {}, after: {}, placed: {} };   // clips and photos shown at their step
  let openSet = new Set();  // rows with How to do it open
  let form = null;          // { id, kind: 'note' | 'skip', text }
  let overrideText = '';
  let overrideOpen = false;
  const just = new Map();   // id -> when it was ticked on this phone, for the check animation
  const blocks = new Map(); // slot key -> the html last put there
  const drawn = new WeakMap(); // element -> the html last put there

  /* Rewrites an element only when what it shows has changed. The browser
     re-serialises innerHTML, so the string written is what is compared. */
  function put(el, html) {
    if (!el || drawn.get(el) === html) return;
    el.innerHTML = html;
    drawn.set(el, html);
  }
  let prevStage = '';
  let listScroll = 0;
  let upgradeKept = [];     // SOPs edited in the app, so a newer version didn't replace them
  let quoteSel = { vehicle: 'sedan', service: 'Full detail' };
  try { quoteSel = { ...quoteSel, ...JSON.parse(localStorage.getItem('imp.jobs.quote') || '{}') }; } catch {}

  /* =========================================================== persistence == */
  const readJSON = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const saveQueue = () => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {} };
  const pendingIds = () => new Set(queue.map(q => (q.t === 'put' ? q.job.id : q.id)).filter(Boolean));

  /* What is kept on the phone. Lists are the heavy part (about 40 KB a job),
     so only recent jobs keep theirs; an older one fetches them when opened. */
  function persist() {
    const keepFrom = S.addDays(today(), mode === 'local' ? -KEEP_DAYS : -14);
    const pend = pendingIds();
    const jobs = {};
    for (const [id, j] of Object.entries(model.jobs)) {
      if (j.date >= keepFrom || pend.has(id) || id === openId) jobs[id] = j;
      else { const { lists, ...rest } = j; jobs[id] = mode === 'local' ? rest : { ...rest, state: undefined }; }
    }
    const out = { v: 1, sops: model.sops, settings: model.settings, jobs };
    try { localStorage.setItem(mode === 'local' ? LOCAL_KEY : CACHE_KEY, JSON.stringify(out)); } catch {}
  }

  async function seedFile() {
    if (seedCache) return clone(seedCache);
    const res = await fetch('sops.json');
    const s = await res.json();
    seedCache = { version: s.version || 1, previous: s.previous || {}, sops: s.templates, settings: { ...s.settings, services: s.services } };
    return clone(seedCache);
  }
  const stamp = x => ({ ...x, updatedAt: nowIso(), by: who() || 'Admin', rev: rev() });

  /* ================================================================ model == */
  function resum(j) { if (j && j.meta && j.state) j.sum = S.summary(j.meta, j.state); }

  function applyOp(op) {
    if (op.t === 'put') {
      const cur = model.jobs[op.job.id] || {};
      const j = { ...cur, ...op.job };
      j.state = S.merge(cur.state || {}, op.state || {});
      if (op.lists) j.lists = op.lists;
      resum(j);
      model.jobs[j.id] = j;
    } else if (op.t === 'patch') {
      const j = model.jobs[op.id];
      if (!j) return;
      j.state = S.merge(j.state || {}, op.set);
      resum(j);
    } else if (op.t === 'remove') {
      delete model.jobs[op.id];
    } else if (op.t === 'sop') {
      model.sops = model.sops.filter(t => t.key !== op.sop.key).concat([op.sop])
        .sort((a, b) => (a.sort || 0) - (b.sort || 0));
    } else if (op.t === 'sopdel') {
      model.sops = model.sops.filter(t => t.key !== op.key);
    } else if (op.t === 'settings') {
      model.settings = op.settings;
    }
  }

  /* One pending write per thing where it can be: ticks on the same job ride
     together, a second edit replaces the first. Nothing already in the air is
     changed, so a reply can never be matched against the wrong request. */
  function enqueue(op) {
    op.ts = Date.now();
    const last = queue[queue.length - 1];
    const same = q => !q.sent && q.t === op.t;
    if (op.t === 'patch') {
      if (last && same(last) && last.id === op.id) last.set = S.merge(last.set, op.set);
      else queue.push(op);
    } else if (op.t === 'remove') {
      queue = queue.filter(q => q.sent || (q.t === 'put' ? q.job.id : q.id) !== op.id);
      queue.push(op);
    } else if (op.t === 'put') {
      const i = queue.findIndex(q => same(q) && q.job.id === op.job.id);
      if (i >= 0) queue[i] = { ...op, lists: op.lists || queue[i].lists, state: S.merge(queue[i].state || {}, op.state || {}), ts: queue[i].ts };
      else queue.push(op);
    } else if (op.t === 'sop' || op.t === 'sopdel') {
      const key = op.t === 'sop' ? op.sop.key : op.key;
      queue = queue.filter(q => !(!q.sent && (q.t === 'sop' || q.t === 'sopdel') && (q.t === 'sop' ? q.sop.key : q.key) === key));
      queue.push(op);
    } else if (op.t === 'settings') {
      queue = queue.filter(q => !(same(q)));
      queue.push(op);
    }
    saveQueue();
  }

  /* Every change goes through here: on the phone first, then to the sheet. */
  function commit(op) {
    applyOp(op);
    if (mode === 'sheet') { enqueue(op); flush(); }
    persist();
    paintAll();
  }

  /* ================================================================ network == */
  function fetchT(url, opt, ms = 20000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return fetch(url, { ...opt, signal: c.signal }).finally(() => clearTimeout(t));
  }
  async function get(params) {
    const q = new URLSearchParams({ ...params, t: String(Date.now()) });
    const res = await fetchT(ENDPOINT + '?' + q);
    if (!res.ok) throw new Error('http ' + res.status);
    const out = await res.json();
    if (!out || out.ok === false) throw new Error((out && out.error) || 'bad reply');
    return out;
  }
  /* Sent as text/plain like the timesheet, so no preflight. A reply that says
     ok is believed; anything else is checked by reading the sheet back, because
     a write can land even when the reply is a Google error page. */
  async function post(body) {
    const res = await fetchT(ENDPOINT, { method: 'POST', body: JSON.stringify(body) });
    try { return await res.json(); } catch { return null; }
  }

  function bodyOf(op) {
    if (op.t === 'put') return { action: 'jobs', op: 'put', job: op.job, lists: op.lists, state: op.state };
    if (op.t === 'patch') return { action: 'jobs', op: 'patch', id: op.id, set: op.set };
    if (op.t === 'remove') return { action: 'jobs', op: 'remove', id: op.id };
    if (op.t === 'sop') return { action: 'sops', op: 'put', sop: op.sop };
    if (op.t === 'sopdel') return { action: 'sops', op: 'remove', key: op.key };
    return { action: 'sops', op: 'settings', settings: op.settings };
  }

  async function landed(op) {
    if (op.t === 'put' || op.t === 'patch' || op.t === 'remove') {
      const id = op.t === 'put' ? op.job.id : op.id;
      const j = (await get({ action: 'job', id, lists: '0' })).job;
      if (op.t === 'remove') return !j;
      if (!j) return false;
      if (op.t === 'put') return !!j.meta && j.meta.rev === op.job.rev;
      return Object.keys(op.set).every(k => j.state[k] && String(j.state[k].at || '') >= String(op.set[k].at || ''));
    }
    const r = await get({ action: 'sops' });
    if (op.t === 'sop') return r.sops.some(s => s.key === op.sop.key && s.rev === op.sop.rev);
    if (op.t === 'sopdel') return !r.sops.some(s => s.key === op.key);
    return !!r.settings && r.settings.rev === op.settings.rev;
  }

  function drop(op) {
    const i = queue.indexOf(op);
    if (i >= 0) queue.splice(i, 1);
    saveQueue();
  }

  async function flush() {
    if (flushing || !queue.length || mode !== 'sheet') return;
    flushing = true;
    try {
      let guard = 0;
      while (queue.length && guard++ < 80) {
        const op = queue[0];
        op.sent = true;
        let ok = false, error = '';
        try {
          const r = await post(bodyOf(op));
          if (r && r.ok === true && r.v === 2) ok = true;
          else if (r && r.ok === false) error = String(r.error || 'error');
        } catch {}
        if (!ok && !error) {
          try { ok = await landed(op); } catch { op.sent = false; linkOk = false; break; }
        }
        if (!ok) {
          op.sent = false;
          if (error) {
            // The script was reached and said no. Three goes, then it is let go and said out loud.
            op.fails = (op.fails || 0) + 1;
            if (op.fails >= 3) {
              drop(op);
              H.toast(/no job/.test(error)
                ? 'That job was deleted on another phone, so its last ticks weren’t saved.'
                : `A change couldn’t be saved to the sheet: ${esc(error)}`, 'bad');
              continue;
            }
            linkOk = true;
          } else {
            linkOk = false;
          }
          break;
        }
        linkOk = true;
        drop(op);
      }
    } finally {
      flushing = false;
      saveQueue();
      paintStrip();
    }
  }

  /* ================================================================ reading == */
  const windowFrom = () => S.addDays(today(), -KEEP_DAYS);

  async function refreshList() {
    if (mode !== 'sheet') return;
    let r;
    try { r = await get({ action: 'jobs', from: windowFrom() }); } catch { linkOk = false; paintStrip(); return; }
    if (r.v !== 2) return;
    linkOk = true;
    const pend = pendingIds(), seen = new Set();
    for (const s of r.jobs) {
      seen.add(s.id);
      const cur = model.jobs[s.id];
      if (cur && pend.has(s.id)) { resum(cur); continue; }       // ours is newer than what was read
      model.jobs[s.id] = { ...(cur || {}), ...s };
    }
    for (const [id, j] of Object.entries(model.jobs)) {
      if (!seen.has(id) && j.date >= windowFrom() && !pend.has(id)) delete model.jobs[id];
    }
    persist();
    paintAll();
  }

  /* The job on screen. Ticks are merged, never replaced, and anything still
     waiting to send is laid back on top, so a read can't undo a tap. */
  async function refreshJob(id, withLists) {
    if (mode !== 'sheet' || !id) return;
    let r;
    try { r = await get({ action: 'job', id, lists: withLists ? '1' : '0' }); } catch { linkOk = false; paintStrip(); return; }
    linkOk = true;
    const cur = model.jobs[id];
    const pend = pendingIds().has(id);
    if (!r.job) {
      if (pend || !cur) return;                                   // ours, still on its way
      delete model.jobs[id];
      persist();
      if (openId === id) { closeJob(); H.toast('That job was deleted on another phone.'); }
      paintAll();
      return;
    }
    const s = r.job;
    const sheetRev = s.meta && s.meta.rev, mineRev = cur && cur.meta && cur.meta.rev;
    if (!withLists && !pend && (!cur || !cur.lists || sheetRev !== mineRev)) return refreshJob(id, true);
    const putWaiting = queue.some(q => q.t === 'put' && q.job.id === id);
    const j = putWaiting ? { ...cur } : { ...(cur || {}), ...s };
    j.state = S.merge((cur && cur.state) || {}, s.state || {});
    for (const q of queue) if (q.t === 'patch' && q.id === id) j.state = S.merge(j.state, q.set);
    const listsChanged = !!s.lists && !putWaiting && (!cur || JSON.stringify(cur.lists) !== JSON.stringify(s.lists));
    if (s.lists && !putWaiting) j.lists = s.lists;
    resum(j);
    model.jobs[id] = j;
    persist();
    if (openId === id && listsChanged) buildJobView();
    paintAll();
  }

  /* ================================================================== boot == */
  async function start() {
    queue = (readJSON(QUEUE_KEY) || []).filter(q => q && q.t);
    queue.forEach(q => { q.sent = false; });
    const preview = typeof claude !== 'undefined' && claude.use;
    if (!ENDPOINT || preview) return goLocal(preview ? 'preview' : 'none');
    let r = null;
    try { r = await get({ action: 'sops' }); } catch {}
    if (r && r.v === 2) return goSheet(r);
    if (r) return goLocal('old');                // the sheet answered, but with the old script
    const cache = readJSON(CACHE_KEY);
    if (cache && cache.v === 1) {
      // No signal, but this phone has synced checklists before: carry on from what it saw.
      mode = 'sheet';
      linkOk = false;
      model = { sops: cache.sops || [], settings: cache.settings, jobs: cache.jobs || {} };
      queue.forEach(applyOp);
      paintAll();
      return;
    }
    return goLocal('offline');
  }

  async function goLocal(reason) {
    mode = 'local';
    why = reason;
    const saved = readJSON(LOCAL_KEY);
    model = saved && saved.v === 1 ? { sops: saved.sops || [], settings: saved.settings, jobs: saved.jobs || {} } : { sops: [], settings: null, jobs: {} };
    try {
      const seed = await seedFile();
      const u = S.upgrade(model.sops, model.settings, seed);
      upgradeKept = u.kept;
      if (u.changed.length || u.settingsChanged) {
        model.sops = u.sops;
        model.settings = u.settings;
        persist();
      }
    } catch {}
    paintAll();
  }

  async function goSheet(r) {
    const wasLocal = mode === 'local';
    mode = 'sheet';
    why = '';
    linkOk = true;
    const cache = readJSON(CACHE_KEY);
    model = cache && cache.v === 1 ? { sops: cache.sops || [], settings: cache.settings, jobs: cache.jobs || {} } : { sops: [], settings: null, jobs: {} };
    const local = readJSON(LOCAL_KEY);
    let seed = null;
    try { seed = await seedFile(); } catch {}
    if (r.sops.length) {
      model.sops = r.sops;
      model.settings = r.settings || model.settings;
      // A newer version of the SOPs replaces the ones nobody has edited, once, from whichever phone gets there first.
      upgradeSheet(seed);
    } else if (seed) {
      // The first phone to meet the new script fills its SOPs tab, with this phone's own edits if it has any.
      const u = local && local.sops && local.sops.length ? S.upgrade(local.sops, local.settings, seed) : { sops: seed.sops, settings: seed.settings, kept: [] };
      upgradeKept = u.kept;
      model.sops = u.sops.map(stamp);
      model.settings = stamp(u.settings);
      model.sops.forEach(sop => enqueue({ t: 'sop', sop }));
      enqueue({ t: 'settings', settings: model.settings });
    }

    // Checklists started on this phone before the sheet was ready go up now.
    const mine = local && local.jobs ? Object.values(local.jobs) : [];
    for (const j of mine) {
      if (!j.lists) continue;
      const { lists, state, sum, ...job } = j;
      const rv = rev();
      enqueue({ t: 'put', job: { ...job, rev: rv, meta: { ...job.meta, rev: rv } }, lists, state: state || {} });
    }
    if (mine.length) {
      try { localStorage.removeItem(LOCAL_KEY); } catch {}
      H.toast('Checklists from this phone are on their way to the Google Sheet.');
    }
    queue.forEach(applyOp);
    persist();
    if (wasLocal && openId && model.jobs[openId]) buildJobView();
    paintAll();
    flush();
    refreshList();
  }

  // Still local because the sheet was out of reach or not yet updated: look again now and then.
  async function probe() {
    if (mode !== 'local' || (why !== 'old' && why !== 'offline')) return;
    try { const r = await get({ action: 'sops' }); if (r.v === 2) await goSheet(r); else if (why === 'offline') { why = 'old'; paintStrip(); } } catch {}
  }

  function upgradeSheet(seed) {
    if (!seed) return;
    const u = S.upgrade(model.sops, model.settings, seed);
    upgradeKept = u.kept;
    model.sops = u.sops;
    model.settings = u.settings;
    for (const key of u.changed) enqueue({ t: 'sop', sop: stamp(model.sops.find(t => t.key === key)) });
    if (u.settingsChanged) { model.settings = stamp(model.settings); enqueue({ t: 'settings', settings: model.settings }); }
  }

  async function refreshSops() {
    if (mode !== 'sheet') return;
    try {
      const r = await get({ action: 'sops' });
      if (r.v !== 2 || !r.sops.length) return;
      model.sops = r.sops;
      if (r.settings) model.settings = r.settings;
      for (const q of queue) if (q.t === 'sop' || q.t === 'sopdel' || q.t === 'settings') applyOp(q);
      // Another phone on older code may have put older SOPs back: bring them up again.
      upgradeSheet(await seedFile().catch(() => null));
      persist();
    } catch {}
  }

  /* ================================================================ strips == */
  function stripState() {
    const n = queue.length;
    const stale = n && Date.now() - (queue[0].ts || 0) > 8000;
    if (mode === 'sheet' && !linkOk) {
      return ['bad', n
        ? `<b>No signal.</b> ${plural(n, 'change')} saved on this phone, waiting to sync. Tap to retry.`
        : '<b>No signal.</b> Showing the last checklist this phone saw. Ticks are kept and sent later. Tap to retry.'];
    }
    if (mode === 'sheet' && stale) return ['warn', `<b>Syncing.</b> ${plural(n, 'change')} on the way to the sheet.`];
    if (mode !== 'local') return null;
    if (why === 'old') return ['warn', '<b>On this phone only.</b> Checklists are shared once the Google Sheet script is updated.'];
    if (why === 'offline') return ['warn', '<b>No signal.</b> Checklists are kept on this phone and shared when there’s signal.'];
    if (why === 'preview') return ['warn', '<b>Preview.</b> Checklists here are not saved to the Google Sheet.'];
    return ['warn', '<b>On this phone only.</b> No shared sheet is set up.'];
  }
  function paintStrip() {
    const s = stripState();
    for (const el of [$('jobsLink'), $('jvLink')]) {
      if (!el) continue;
      el.hidden = !s;
      if (!s) continue;
      el.dataset.tone = s[0];
      put(el, s[1]);
    }
  }

  /* ================================================================== list == */
  function cardHtml(j) {
    const s = j.sum || { done: 0, total: 0, stage: 'working' };
    const full = s.stage === 'signed' || s.stage === 'done';
    const frac = full ? 1 : s.total ? s.done / s.total : 0;
    const C = 2 * Math.PI * 25;
    const title = j.customer || j.car || 'Job';
    const sub = [j.customer ? j.car : '', j.suburb].filter(Boolean).join(', ');
    const word = s.stage === 'working' ? `${s.done} of ${s.total} steps`
      : s.stage === 'ready' ? 'Ready for sign-off'
      : s.stage === 'signed' ? (s.signedBy ? `Signed off by ${s.signedBy}` : 'Let through')
      : 'Done';
    const centre = s.stage === 'done'
      ? `<svg class="ok" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7.5"/></svg>`
      : `<b>${Math.round(frac * 100)}<small>%</small></b>`;
    return `<button class="jcard" type="button" data-open-job="${esc(j.id)}" data-stage="${s.stage}">
      <span class="jring" aria-hidden="true"><svg viewBox="0 0 56 56"><circle class="tr" cx="28" cy="28" r="25"/>
        <circle class="ar" cx="28" cy="28" r="25" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(2)}"/></svg>${centre}</span>
      <span class="jc-main">
        <span class="jc-title">${esc(title)}</span>
        ${sub ? `<span class="jc-car">${esc(sub)}</span>` : ''}
        <span class="jc-status"><span>${esc((j.services || []).join(' + '))}</span> <b>${esc(word)}</b></span>
      </span>
      <svg class="jc-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
    </button>`;
  }

  function paintList() {
    const host = $('jobList');
    if (!host) return;
    const set = h => put(host, h);
    if (mode === 'loading') return set('<div class="empty">Loading the checklists&hellip;</div>');
    const t = today();
    const list = Object.values(model.jobs).filter(j => j && j.id && j.date >= windowFrom());
    $('jobsScope').textContent = list.length ? plural(list.filter(j => j.date === t).length, 'job') + ' today' : '';
    if (!list.length) {
      set('<div class="empty">No jobs yet. At the car, tap <b>Start a job</b> and pick the service. The checklist for it is built for you, with every step explained.</div>');
      return;
    }
    const byCreated = (a, b) => String(a.createdAt).localeCompare(String(b.createdAt));
    const groups = [];
    const ahead = list.filter(j => j.date > t).sort((a, b) => a.date.localeCompare(b.date) || byCreated(a, b));
    if (ahead.length) groups.push(['Coming up', ahead, true]);
    const days = [...new Set(list.filter(j => j.date <= t).map(j => j.date))].sort().reverse();
    for (const d of days) groups.push([dayName(d), list.filter(j => j.date === d).sort(byCreated), false]);
    const html = groups.map(([name, jobs, ahead]) => `<div class="jgroup"><h3 class="sub">${esc(name)}${ahead ? '' : `<span>${plural(jobs.length, 'job')}</span>`}</h3>` +
      jobs.map(j => (ahead ? cardHtml(j).replace('<span class="jc-status">', `<span class="jc-status"><span>${esc(dayName(j.date))}</span> `) : cardHtml(j))).join('') + '</div>').join('');
    // Redrawn only on a real change, so a poll can't swallow a tap on a card.
    set(html);
  }

  /* ============================================================ job: build == */
  const slot = (key, tag, cls) => `<${tag} data-b="${esc(key)}"${cls ? ` class="${cls}"` : ''}></${tag}>`;

  function buildJobView() {
    const body = $('jvBody');
    const j = model.jobs[openId];
    blocks.clear();
    idx = {};
    if (!j) return;
    if (!j.lists) {
      body.innerHTML = `<div class="empty">${mode === 'sheet' && !linkOk
        ? 'This checklist hasn’t reached this phone yet. It loads when there’s signal.'
        : 'Loading the checklist&hellip;'}</div>`;
      $('jvRail').innerHTML = '';
      return;
    }
    let html = '', hasSign = false;
    place = S.placements(j.lists);
    for (const t of j.lists) for (const s of t.sections) s.items.forEach((it, n) => { idx[it.id] = { it, s, t, n }; });
    // A clip or photo cue sits in the list right around its step.
    const cue = x => (x.clip ? slot('row:' + x.clip, 'li') : photoCue(x));
    const around = it => (place.before[it.id] || []).map(cue).join('') + slot('row:' + it.id, 'li') + (place.after[it.id] || []).map(cue).join('');
    for (const t of j.lists) {
      if (t.key === 'signoff') hasSign = true;
      html += `<section class="stage" id="stage-${esc(t.key)}" data-stage-key="${esc(t.key)}">`;
      html += `<header class="stage-head"><h2>${esc(t.name)}</h2><span class="stage-n tnum" data-n="${esc(t.key)}"></span>` +
        (t.optional ? '' : `<div class="stage-bar"><i data-bar="${esc(t.key)}"></i></div>`) + `${t.intro ? `<p class="stage-intro">${esc(t.intro)}</p>` : ''}</header>`;
      if (t.key === 'signoff') html += slot('sign', 'div');
      for (const s of t.sections) {
        if (s.style === 'scripts') {
          html += slot(s.items.some(it => it.pitch) ? 'say' : 'lines:' + s.id, 'div');
          continue;
        }
        if (s.style === 'clips') {
          // Clips already shown at their steps aren't listed again.
          const left = s.items.filter(it => !place.placed[it.id]);
          if (!left.length) continue;
          html += slot('sec:' + s.id, 'div');
          if (s.intro) html += `<p class="sec-intro">${esc(s.intro)}</p>`;
          html += '<ul class="items">' + left.map(it => slot('row:' + it.id, 'li')).join('') + '</ul>';
          continue;
        }
        if (s.heading !== false) html += `<h3 class="sub">${esc(s.name)}</h3>`;
        if (s.intro) html += `<p class="sec-intro">${esc(s.intro)}</p>`;
        html += `<ul class="${s.style === 'bullets' ? 'rules' : 'items'}">` + s.items.map(around).join('') + '</ul>';
      }
      if (t.key === 'signoff') html += slot('finish', 'div');
      html += '</section>';
    }
    // A service mapped without the sign-off list still needs a way to finish.
    if (!hasSign) html += `<section class="stage" id="stage-signoff"><header class="stage-head"><h2>Sign-off</h2></header>${slot('sign', 'div')}${slot('finish', 'div')}</section>`;
    body.innerHTML = html;
    $('jvRail').innerHTML = j.lists.map(t => `<button type="button" data-goto="${esc(t.key)}"><span>${esc(shortName(t))}</span><b class="tnum"></b></button>`).join('') +
      (hasSign ? '' : '<button type="button" data-goto="signoff"><span>Sign-off</span><b></b></button>');
    watchStages();
  }

  function ctxNow() {
    const j = model.jobs[openId];
    const st = (j && j.state) || {};
    const meta = (j && j.meta) || {};
    return {
      j, st, meta,
      sum: S.summary(meta, st),
      locked: S.locked(st),
      sign: S.canSignOff(meta, st, who()),
      admin: admin(),
      me: who(),
    };
  }

  /* ============================================================ job: rows == */
  function metaLine(x, it) {
    if (!x) return '';
    let out = '';
    if (x.done && x.by) out = `<span class="meta">${it.type === 'clip' ? 'Filmed' : it.type === 'signoff' ? 'Checked' : 'Done'} by <b>${esc(x.by)}</b>, ${esc(whenText(x.at))}</span>`;
    else if (x.skipped) out = `<span class="meta"><span class="warn">Skipped</span> by <b>${esc(x.by || '')}</b>: ${esc(x.reason || '')}</span>`;
    if (x.note) out += `<span class="note-line"><b>${esc(x.noteBy || x.by || '')}:</b> ${esc(x.note)}</span>`;
    return out;
  }

  function toolHtml(it, c) {
    const st = c.st;
    if (it.tool === 'paint') {
      const set = model.settings;
      let entered = 0, light = 0;
      for (const p of S.PANELS) {
        const f = S.paintFlags(st['p:' + p.key], set);
        if (f.count) entered++;
        if (f.light) light++;
      }
      const sub = entered
        ? `${entered} of ${S.PANELS.length} panels done${light ? `. <span class="warn">${plural(light, 'light-touch panel')}</span>` : ''}`
        : 'None yet. Tap to put them in.';
      return `<div class="tool"><button class="tool-btn" type="button" data-paint><span>Paint readings<small>${sub}</small></span>${ICON.right}</button></div>`;
    }
    if (it.combos) {
      const cur = S.val(st.combo);
      return `<div class="tool"><span class="lab">Which combo worked?</span><div class="seg">` +
        (it.subs || []).map(v => `<button type="button" data-val="combo" data-v="${esc(v)}" aria-pressed="${cur === v}">${esc(v)}</button>`).join('') + '</div></div>';
    }
    if (it.tool === 'correction') {
      const cur = S.val(st.correction);
      return `<div class="tool"><span class="lab">Stages done</span><div class="seg">` +
        S.STAGES.map(v => `<button type="button" data-val="correction" data-v="${esc(v)}" aria-pressed="${cur === v}">${esc(v)}</button>`).join('') + '</div></div>';
    }
    if (it.tool === 'warranty') {
      const w = st.warranty;
      const sub = w ? `Filled in by ${esc(w.by || '')}${w.annualCheck ? `. Annual check ${esc(longDate(w.annualCheck))}` : ''}` : 'Not filled in yet.';
      return `<div class="tool"><button class="tool-btn" type="button" data-warranty><span>Warranty record<small>${sub}</small></span>${ICON.right}</button></div>`;
    }
    if (it.script === 'pitch') {
      const p = pitchAsk(c);
      const cur = S.val(st[p.key]);
      return `<div class="tool"><span class="lab">${p.q}</span><div class="seg">` +
        p.opts.map(([v, l]) => `<button type="button" data-val="${p.key}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('') +
        '</div></div>';
    }
    if (it.tool === 'quote') return `<div class="tool">${quoteHtml()}</div>`;
    if (it.script === 'referral' || it.script === 'review') {
      return `<div class="tool"><div class="say-acts"><button class="btn" type="button" data-copy="${it.script}">Copy the words</button></div></div>`;
    }
    return '';
  }

  function howHtml(it, c, x, open) {
    const id = it.id;
    const step = it.type === 'step';
    let tail;
    if (form && form.id === id) {
      tail = `<div class="how-form">
        <label class="lab" for="f-${esc(id)}">${form.kind === 'skip' ? 'Why is it being skipped?' : 'Note'}</label>
        <textarea id="f-${esc(id)}" data-form-text maxlength="500" placeholder="${form.kind === 'skip' ? 'e.g. No power point on site' : 'e.g. Stone chip on the bonnet, told the customer'}">${esc(form.text || '')}</textarea>
        <div class="row"><button class="btn" type="button" data-form-cancel>Cancel</button>
        <button class="btn key" type="button" data-form-save>${form.kind === 'skip' ? 'Skip this step' : 'Save note'}</button></div></div>`;
    } else {
      const acts = [`<button class="btn" type="button" data-note="${esc(id)}">${x && x.note ? 'Change the note' : 'Add a note'}</button>`];
      if (step && !c.locked && x && x.skipped) acts.push(`<button class="btn" type="button" data-unskip="${esc(id)}">Undo the skip</button>`);
      else if (step && !c.locked && !(x && x.done)) acts.push(`<button class="btn" type="button" data-skip="${esc(id)}">Skip this step</button>`);
      tail = `<div class="how-acts">${acts.join('')}</div>`;
    }
    return `<div class="how-wrap"${open ? '' : ' inert'}><div><div class="how" id="how-${esc(id)}">` +
      (it.more ? `<p>${esc(it.more)}</p>` : '') + tail + '</div></div></div>';
  }

  function rowHtml(id, c) {
    const { it, s, n } = idx[id];
    const open = openSet.has(id);
    if (it.type === 'rule') {
      return `<div class="rule"${open ? ' data-open' : ''}><button class="rule-main" type="button" data-how="${esc(id)}" aria-expanded="${open}" aria-controls="how-${esc(id)}">
        <span>${esc(it.detail)}${it.more ? `<span class="how-cue">Why ${ICON.down}</span>` : ''}</span></button>` +
        (it.more ? `<div class="how-wrap"${open ? '' : ' inert'}><div><div class="how" id="how-${esc(id)}"><p>${esc(it.more)}</p></div></div></div>` : '') + '</div>';
    }
    const x = S.item(c.st, id);
    const state = x && x.done ? 'done' : x && x.skipped ? 'skipped' : 'todo';
    const isSign = it.type === 'signoff';
    const off = c.locked || (isSign && !c.sign.ok);
    const justNow = state === 'done' && just.has(id) && Date.now() - just.get(id) < 1500;
    const plainText = (it.title ? it.title + ' ' : '') + (it.detail || '');
    const tick = `<button class="tick" type="button" data-tick="${esc(id)}" aria-pressed="${state === 'done'}"${off ? ' aria-disabled="true"' : ''}
      aria-label="${esc((state === 'done' ? 'Done: ' : 'Tick: ') + plainText)}">${s.style === 'numbered' ? `<span>${n + 1}</span>` : ''}${ICON.check}</button>`;
    const attrs = ` data-state="${state}"${justNow ? ' data-just' : ''}`;
    if (it.type === 'clip') {
      // At its step it says what to do now; in a leftover list it says when.
      // A Later clip is for another day, so it has nothing to tick here.
      const atStep = !!place.placed[id];
      const mark = it.when === 'later' ? '<span class="tick-later" aria-hidden="true"></span>' : tick;
      const cueText = !atStep ? cap(it.when) : it.pos === 'before' ? 'Film this first' : it.when === 'during' ? 'Film during the step above' : 'Film this now';
      return `<div class="item clip${atStep ? ' inline' : ''}"${attrs}>${mark}<div class="item-main"><span class="when" data-w="${esc(atStep ? 'now' : it.when)}">${esc(cueText)}</span>` +
        `<span class="txt"><b>${esc(it.title)}</b></span><span class="why">${esc(String(it.length || '').replace(/^(\d+)s$/, '$1 sec clip'))}. ${esc(it.purpose)}</span>${metaLine(x, it)}</div></div>`;
    }
    const text = it.title ? `<b>${esc(it.title)}</b> ${esc(it.detail)}` : esc(it.detail);
    // Spans, not a list: they sit inside the button.
    const subs = !it.combos && it.subs && it.subs.length ? `<span class="subs">${it.subs.map(x2 => `<span>${esc(x2)}</span>`).join('')}</span>` : '';
    const cue = `<span class="how-cue">${it.more ? 'How to do it' : 'Add a note'} ${ICON.down}</span>`;
    return `<div class="item"${attrs}${open ? ' data-open' : ''}>${tick}` +
      `<button class="item-main" type="button" data-how="${esc(id)}" aria-expanded="${open}" aria-controls="how-${esc(id)}"><span class="txt">${text}</span>${subs}${metaLine(x, it)}${cue}</button>` +
      toolHtml(it, c) + howHtml(it, c, x, open) + '</div>';
  }

  /* ======================================================= job: the cards == */
  /* What the pitch question asks. A coating job: did you pitch the plan. Any
     other job: which one you pitched, kept in ceramicPitched as Yes (ceramic),
     Detail or No, so older jobs and the sheet read it the same way. */
  function pitchAsk(c) {
    return c.meta.pitch === 'plan'
      ? { key: 'planPitched', q: 'Did you pitch the maintenance plan?', opts: [['Yes', 'Yes'], ['No', 'No']] }
      : { key: 'ceramicPitched', q: 'What did you pitch?', opts: [['Detail', 'A detail'], ['Yes', 'Ceramic'], ['No', 'Nothing']] };
  }

  function sayHtml(c) {
    const lines = S.scripts(c.j.lists, c.meta, c.j);
    if (!lines.length) return '';
    const p = pitchAsk(c);
    const cur = S.val(c.st[p.key]);
    return `<div class="say-card"><h3>Handover helper</h3><p>The words for the car. Say them in your own voice, or copy one into a text.</p>` +
      lines.map(x => `<div class="say-block"><span class="lab">${esc(x.label)}</span><p class="say">${esc(x.text)}</p>
        <div class="say-acts"><button class="btn" type="button" data-copy="${x.key}">Copy</button></div>` +
        (x.key === 'pitch' ? `<span class="lab">${p.q}</span><div class="seg" role="group" aria-label="${p.q}">` +
          p.opts.map(([v, l]) => `<button type="button" data-val="${p.key}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('') + '</div>' : '') +
        '</div>').join('') + '</div>';
  }

  // Words to say, like the door knocking script: read them, no ticking.
  function linesHtml(secId, c) {
    let s = null;
    for (const t of c.j.lists) for (const x of t.sections) if (x.id === secId) s = x;
    if (!s) return '';
    const quoted = d => { const m = /"([^"]+)"/.exec(d || ''); return m ? m[1] : d || ''; };
    return `<div class="say-card"><h3>${esc(s.name)}</h3><p>Pick an ice breaker, then use your own words.</p>` +
      s.items.map(it => `<div class="say-block"><span class="lab">${esc(String(it.title || '').replace(/:$/, ''))}</span><p class="say">${esc(quoted(it.detail))}</p></div>`).join('') +
      '</div>';
  }

  /* The instant quote: the same prices as the website, picked by car size and service. */
  function quoteHtml() {
    const prices = S.settings(model.settings).prices;
    if (!prices || !prices.vehicles) return '<p class="sec-intro">The price list hasn’t loaded yet.</p>';
    const v = prices.vehicles.find(x => x.key === quoteSel.vehicle) || prices.vehicles[0];
    const names = Object.keys(v.prices || {});
    const service = names.includes(quoteSel.service) ? quoteSel.service : names[0];
    const q = service ? S.quote(prices, v.key, service) : S.quote(prices, v.key, '');
    let result;
    if (q && q.note) result = `<p class="q-note">${esc(q.note)}</p>`;
    else if (q) {
      result = `<p class="q-price tnum">$${q.from.toLocaleString('en-AU')}${q.to > q.from ? `<small> to $${q.to.toLocaleString('en-AU')}</small>` : ''}</p>` +
        `<p class="q-note">${q.to > q.from ? `Up to $${q.to - q.from} more depending on condition, agreed before you start.` : 'The price you quote is the price they pay.'}</p>`;
    } else result = '<p class="q-note">Pick a service.</p>';
    // The price first, so it's in view as soon as anything is picked.
    const what = q && !q.note ? `<p class="q-what">${esc(v.name)}, ${esc(service)}</p>` : '';
    return `<div class="quote"><div class="q-result" aria-live="polite">${what}${result}</div>` +
      `<span class="lab">Their car</span><div class="seg">` +
      prices.vehicles.map(x => `<button type="button" data-qv="${esc(x.key)}" aria-pressed="${x.key === v.key}">${esc(x.name)}</button>`).join('') + '</div>' +
      (names.length ? `<span class="lab">Service</span><div class="seg">` +
        names.map(n => `<button type="button" data-qs="${esc(n)}" aria-pressed="${n === service}">${esc(n)}</button>`).join('') + '</div>' : '') +
      (prices.notOffered ? `<p class="q-note">${esc(prices.notOffered)}</p>` : '') + '</div>';
  }
  function pickQuote(kind, value) {
    quoteSel = { ...quoteSel, [kind]: value };
    try { localStorage.setItem('imp.jobs.quote', JSON.stringify(quoteSel)); } catch {}
    if (openId) paintJob();
    if ($('quoteDlg').open) put($('quoteBody'), quoteHtml());
  }

  function sealHtml(title, line) {
    return `<div class="seal"><span class="stamp">${ICON.check}</span><div><h3>${title}</h3><p>${line}</p></div></div>`;
  }

  function signHtml(c) {
    const { sum, sign } = c;
    if (sum.stage === 'signed' || sum.stage === 'done') {
      return sum.signedBy
        ? sealHtml('Signed off', `Checked by <b>${esc(sum.signedBy)}</b>, ${esc(whenText(sum.signedAt))}.`)
        : sealHtml('Let through without a sign-off', `By <b>${esc(sum.overrideBy)}</b>: ${esc(sum.overrideReason)}`);
    }
    let p, btn = '', tone = '';
    if (sign.reason === 'steps') {
      p = `<b>${plural(sign.left, 'step')} to go</b> before the second check. Every step has to be done or skipped first.`;
      btn = `<div class="btn-wrap"><button class="btn" type="button" data-next-step>Go to the next step</button></div>`;
    } else if (sign.reason === 'who') {
      p = 'Someone who didn’t do most of the job checks it over. Pick your name, then tick each check as you look.';
      btn = `<div class="btn-wrap"><button class="btn key" type="button" data-pickwho>Pick my name</button></div>`;
    } else if (sign.reason === 'same') {
      p = `<b>${esc(sign.main)}</b> did most of this job, so someone else checks it. Hand the phone over and pick their name.`;
      btn = `<div class="btn-wrap"><button class="btn key" type="button" data-pickwho>Change the name</button></div>`;
    } else {
      tone = 'ok';
      p = sign.main
        ? `<b>${esc(c.me)}</b>, you’re checking ${esc(sign.main)}’s work. Look at each one properly, then tick it.`
        : 'Look at each one properly, then tick it.';
      btn = `<button class="go" type="button" data-signoff${sign.left ? ' disabled' : ''}>${sign.left ? `${plural(sign.left, 'check')} to go` : `Sign off as ${esc(c.me)}`}</button>`;
    }
    const over = c.admin ? `<details class="override" data-override-box${overrideOpen ? ' open' : ''}><summary>Let it through without a sign-off</summary>
      <div class="how-form"><label class="lab" for="ovWhy">Why? It’s kept on the job.</label>
      <textarea id="ovWhy" data-override-text placeholder="e.g. Solo job. Checked from the photos.">${esc(overrideText)}</textarea>
      <div class="row"><button class="btn" type="button" data-override>Let it through</button></div></div></details>` : '';
    return `<div class="signbox"${tone ? ` data-tone="${tone}"` : ''}><p>${p}</p>${btn}${over}</div>`;
  }

  function finishHtml(c) {
    const reopen = c.admin ? '<button class="ghost" type="button" data-reopen>Reopen this job</button>' : '';
    if (c.sum.stage === 'done') {
      return sealHtml('Job done', `Finished by <b>${esc(c.sum.finishedBy || 'the crew')}</b>, ${esc(whenText(c.sum.finishedAt))}.`) +
        `<div class="finish"><button class="go" type="button" data-summary>Send the summary to the group</button>${reopen}</div>`;
    }
    if (c.sum.stage === 'signed') return `<div class="finish"><button class="go" type="button" data-finish>Mark job done</button>${reopen}</div>`;
    return '';
  }

  function clipsHeadHtml(secId, c) {
    let s = null;
    for (const t of c.j.lists) for (const x of t.sections) if (x.id === secId) s = x;
    if (!s) return '';
    const left = s.items.filter(it => !place.placed[it.id]);
    const done = left.filter(it => { const x = S.item(c.st, it.id); return x && x.done; }).length;
    const name = left.length < s.items.length ? `${s.name}, the rest` : s.name;
    return `<h3 class="sub">${esc(name)}<span>${done} of ${left.length} filmed</span></h3>`;
  }

  // A job photo reminder, right where it's taken. Nothing to tick.
  function photoCue(c) {
    const p = c.photo;
    return `<li class="photo-cue"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>` +
      `<span><b>Take photo ${esc(c.i)} of ${esc(c.of)}:</b> ${esc(p.label)}</span></li>`;
  }

  function blockHtml(key, c) {
    if (key.startsWith('row:')) return idx[key.slice(4)] ? rowHtml(key.slice(4), c) : '';
    if (key.startsWith('sec:')) return clipsHeadHtml(key.slice(4), c);
    if (key === 'say') return sayHtml(c);
    if (key.startsWith('lines:')) return linesHtml(key.slice(6), c);
    if (key === 'sign') return signHtml(c);
    if (key === 'finish') return finishHtml(c);
    return '';
  }

  /* Each slot is redrawn only when what it shows has changed, and never while
     someone is typing in it. */
  function paintJob(opening) {
    const j = model.jobs[openId];
    if (!j) return;
    const c = ctxNow();
    paintHero(c, opening);
    if (!j.lists) return;
    const active = document.activeElement;
    for (const el of $('jvBody').querySelectorAll('[data-b]')) {
      const key = el.dataset.b;
      const html = blockHtml(key, c);
      if (blocks.get(key) === html) continue;
      if (active && el.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) continue;
      let refocus = null;
      if (active && el.contains(active)) {
        for (const a of ['data-tick', 'data-how', 'data-val', 'data-signoff', 'data-finish']) {
          if (active.hasAttribute(a)) { refocus = `[${a}${active.getAttribute(a) ? `="${CSS.escape(active.getAttribute(a))}"` : ''}]`; break; }
        }
      }
      el.innerHTML = html;
      blocks.set(key, html);
      if (refocus) { const f = el.querySelector(refocus); if (f) f.focus({ preventScroll: true }); }
    }
    paintStages(c);
    paintBar(c);
  }

  function paintStages(c) {
    const rail = $('jvRail');
    for (const t of c.j.lists) {
      const k = S.counts(t, c.st);
      const sign = t.key === 'signoff';
      const done = sign ? k.signDone : k.done, total = sign ? k.signTotal : k.total;
      const full = total > 0 && done >= total;
      const n = document.querySelector(`[data-n="${CSS.escape(t.key)}"]`);
      if (n) put(n, t.optional ? '<small>Optional</small>' : `${done}<small>/${total}</small>`);
      const bar = document.querySelector(`[data-bar="${CSS.escape(t.key)}"]`);
      if (bar) bar.style.setProperty('--p', total ? (done / total).toFixed(3) : (k.clipsTotal ? (k.clipsDone / k.clipsTotal).toFixed(3) : '0'));
      const b = rail.querySelector(`[data-goto="${CSS.escape(t.key)}"] b`);
      if (b) {
        put(b, full ? ICON.check : total ? `${done}/${total}` : '');
        b.parentElement.toggleAttribute('data-full', full);
      }
    }
  }

  function paintBar(c) {
    const bar = $('jvBar');
    let html = '';
    const next = (tone, small, text, attr) => `<button class="next" type="button"${tone ? ` data-tone="${tone}"` : ''} ${attr}>
      <span><small>${small}</small><span>${text}</span></span><i>${ICON.arrow}</i></button>`;
    if (c.sum.stage === 'working') {
      const n = S.nextStep(c.j.lists, c.st);
      if (n) {
        const words = n.item.title ? n.item.title.replace(/[.:,]$/, '') : String(n.item.detail || '').split(/[.:](?:\s|$)/)[0];
        html = next('', `Up next: ${esc(shortName(n.template))}`, esc(words), `data-next="${esc(n.item.id)}"`);
      }
    } else if (c.sum.stage === 'ready') {
      html = c.sign.ok && !c.sign.left
        ? `<button class="go" type="button" data-signoff>Sign off as ${esc(c.me)}</button>`
        : next('ready', 'Every step done', 'Time for the second check', 'data-goto="signoff"');
    } else if (c.sum.stage === 'signed') {
      html = '<button class="go" type="button" data-finish>Mark job done</button>';
    } else {
      html = next('done', 'Job done', 'Send the summary to the group', 'data-summary');
    }
    put(bar, `<div>${html}</div>`);
  }

  /* ============================================================ the gauge == */
  const ARC = 2 * Math.PI * 88;
  const tickEls = [];
  function buildGauge() {
    const g = $('gTicks');
    if (!g || tickEls.length) return;
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const l = document.createElementNS(SVG, 'line');
      l.setAttribute('x1', '120'); l.setAttribute('y1', major ? '13' : '16');
      l.setAttribute('x2', '120'); l.setAttribute('y2', major ? '27' : '24');
      l.setAttribute('transform', `rotate(${i * 6} 120 120)`);
      l.setAttribute('class', 'g-tick' + (major ? ' major' : ''));
      g.appendChild(l);
      tickEls.push(l);
    }
  }
  /* Lighting travels round the bezel in order. On open it sweeps up to where
     the job is; finishing sweeps the rest of the way. */
  function lightTicks(n, sweep) {
    tickEls.forEach((t, i) => {
      const on = i < n;
      t.style.transitionDelay = sweep && !reduced && on && !t.classList.contains('lit') ? `${i * 9}ms` : '';
      t.classList.toggle('lit', on);
    });
    if (sweep) setTimeout(() => tickEls.forEach(t => { t.style.transitionDelay = ''; }), 60 * 9 + 400);
  }

  let numShape = '';
  function roll(text) {
    const el = $('gNum');
    const shape = text.replace(/\d/g, '#');
    if (shape !== numShape) {
      numShape = shape;
      el.innerHTML = '<span class="strips" aria-hidden="true">' + [...text].map(ch => /\d/.test(ch)
        ? '<span class="dg"><span class="roll">' + '0123456789'.split('').map(d => `<i>${d}</i>`).join('') + '</span></span>'
        : `<span class="sep">${ch}</span>`).join('') + '</span>';
    }
    const strips = el.querySelectorAll('.dg .roll');
    let i = 0;
    for (const ch of text) if (/\d/.test(ch)) strips[i++].style.setProperty('--n', ch);
  }

  function paintHero(c, opening) {
    const view = $('v-job');
    const s = c.sum;
    view.dataset.stage = s.stage;
    $('gState').textContent = STAGE_WORD[s.stage];
    roll(String(s.done));
    $('gNum').setAttribute('aria-label', `${s.done} of ${s.total} steps done`);
    $('gOf').textContent = `of ${plural(s.total, 'step')}`;
    const lit = s.stage === 'done' ? 60 : s.total ? Math.round(60 * s.done / s.total) : 0;
    const finishing = prevStage && prevStage !== 'done' && s.stage === 'done';
    if (opening) {
      tickEls.forEach(t => { t.style.transitionDelay = ''; t.classList.remove('lit'); });
      $('gArc').style.transition = 'none';
      $('gArc').setAttribute('stroke-dashoffset', String(ARC));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        $('gArc').style.transition = '';
        $('gArc').setAttribute('stroke-dashoffset', String(ARC * (1 - lit / 60)));
        lightTicks(lit, true);
      }));
    } else {
      $('gArc').setAttribute('stroke-dashoffset', String(ARC * (1 - lit / 60)));
      lightTicks(lit, finishing);
    }
    prevStage = s.stage;
    const j = c.j;
    $('jvTitle').textContent = j.customer || j.car || 'Job';
    const sub = [j.customer ? j.car : '', j.suburb].filter(Boolean).join(', ');
    $('jvSub').textContent = sub ? `${sub}. ${dayName(j.date)}` : dayName(j.date);
    const tags = (j.services || []).map(x => `<span class="tag">${esc(x)}</span>`).join('');
    put($('jvTags'), tags);
    paintGoal(c);
  }

  function jobGoal(j) { return (j.meta && j.meta.goal) || S.goal(j.services, model.settings); }
  // How long against the goal: so far while it's on, how long it took once it's done.
  function goalLine(j, st) {
    const g = jobGoal(j), tm = S.timing(st, j, nowIso());
    const gt = g ? `Goal: ${S.goalText(g)}.` : '';
    if (!tm) return { text: g ? `${gt} The clock starts at the first tick on the day.` : '', tone: '' };
    const over = g && tm.minutes > g[1];
    if (tm.finished) return { text: `Took ${S.duration(tm.minutes)}. ${gt}`.trim(), tone: over ? 'over' : 'good' };
    return { text: `${S.duration(tm.minutes)} so far. ${gt}`.trim(), tone: over ? 'over' : '' };
  }
  function paintGoal(c) {
    const el = $('jvGoal');
    if (!el || !c || !c.j) return;
    const g = goalLine(c.j, c.st);
    el.hidden = !g.text;
    if (el.textContent !== g.text) el.textContent = g.text;
    if (el.dataset.tone !== g.tone) el.dataset.tone = g.tone;
  }

  /* ========================================================= stage tracking == */
  let observer = null;
  function watchStages() {
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const seen = new Map();
    observer = new IntersectionObserver(entries => {
      for (const e of entries) seen.set(e.target.dataset.stageKey || 'signoff', e.isIntersecting ? e.boundingClientRect.top : null);
      let best = null, top = Infinity;
      for (const [k, v] of seen) if (v !== null && v < top) { top = v; best = k; }
      if (best) markRail(best);
    }, { rootMargin: '-80px 0px -55% 0px' });
    for (const s of $('jvBody').querySelectorAll('.stage')) observer.observe(s);
  }
  function markRail(key) {
    const rail = $('jvRail');
    for (const b of rail.children) {
      const on = b.dataset.goto === key;
      if ((b.getAttribute('aria-current') === 'true') === on) continue;
      b.setAttribute('aria-current', String(on));
      if (on) rail.scrollTo({ left: Math.max(0, b.offsetLeft - 24), behavior: reduced ? 'auto' : 'smooth' });
    }
  }
  function goStage(key) {
    const el = $('stage-' + key);
    if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
  function goRow(id, flash) {
    const el = document.querySelector(`[data-b="row:${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    if (flash) {
      const item = el.firstElementChild;
      if (item) { item.removeAttribute('data-flash'); void item.offsetWidth; item.setAttribute('data-flash', ''); setTimeout(() => item.removeAttribute('data-flash'), 1500); }
    }
  }

  /* ========================================================= open & close == */
  // Some preview windows refuse history changes; the back button then just isn't wired.
  function pushHistory(state) { try { history.pushState(state, ''); } catch {} }

  function openJob(id) {
    if (!model.jobs[id]) return;
    if (H.tab() !== 'jobs') {
      H.showTab('jobs');
      setTimeout(() => { if (H.tab() === 'jobs') openJob(id); }, reduced ? 20 : 220);
      return;
    }
    if (openId !== id) listScroll = scrollY;
    openId = id;
    openSet = new Set();
    form = null;
    overrideText = '';
    overrideOpen = false;
    prevStage = '';
    $('v-jobs').hidden = true;
    $('v-job').hidden = false;
    document.body.setAttribute('data-jobview', '');
    if (!history.state || history.state.job !== id) pushHistory({ job: id });
    buildJobView();
    paintJob(true);
    paintStrip();
    scrollTo({ top: 0 });
    if (mode === 'sheet') refreshJob(id, !model.jobs[id].lists).then(flush);
  }
  function closeJob() {
    if (!openId) return;
    openId = null;
    if (observer) observer.disconnect();
    $('v-job').hidden = true;
    document.body.removeAttribute('data-jobview');
    if (H.tab() === 'jobs') $('v-jobs').hidden = false;
    paintList();
    requestAnimationFrame(() => scrollTo({ top: listScroll }));
  }
  function leaveJob() {
    if (history.state && history.state.job) history.back();
    else closeJob();
  }

  /* =============================================================== actions == */
  function needWho() {
    if (who()) return false;
    H.toast('Pick your name first, so the tick has a name on it.');
    H.openWho();
    return true;
  }
  const lockedNote = () => H.toast(admin()
    ? 'This job is signed off. Reopen it at the bottom to change it.'
    : 'This job is signed off. Admin can reopen it if something was missed.');

  function onTick(id) {
    const c = ctxNow();
    const { it } = idx[id] || {};
    if (!it) return;
    if (c.locked) return lockedNote();
    if (it.type === 'signoff' && !c.sign.ok) {
      if (c.sign.reason === 'steps') return H.toast(`Finish the steps first. ${plural(c.sign.left, 'step')} to go.`);
      if (c.sign.reason === 'same') return H.toast(`${esc(c.sign.main)} did most of this job, so someone else does the check.`);
      return needWho();
    }
    if (needWho()) return;
    const patch = S.tickPatch(c.st, id, who(), nowIso());
    if (patch['s:' + id].done) { just.set(id, Date.now()); H.buzz(14); }
    commit({ t: 'patch', id: openId, set: patch });
    const after = ctxNow();
    // A stage finished, or the whole list: one firmer buzz to say so.
    const t = idx[id].t;
    const k = S.counts(t, after.st);
    if (patch['s:' + id].done && ((k.total && k.done === k.total) || (k.signTotal && k.signDone === k.signTotal))) H.buzz([16, 50, 16]);
  }

  function toggleHow(id) {
    const el = document.querySelector(`[data-b="row:${CSS.escape(id)}"]`);
    const item = el && el.firstElementChild;
    if (!item) return;
    const open = !openSet.has(id);
    if (open) openSet.add(id); else openSet.delete(id);
    if (!open && form && form.id === id) { form = null; blocks.delete('row:' + id); paintJob(); return; }
    // Flip it in place so the fold can animate, then tell the cache what is on screen.
    item.toggleAttribute('data-open', open);
    const btn = item.querySelector('[data-how]');
    if (btn) btn.setAttribute('aria-expanded', String(open));
    const wrap = item.querySelector('.how-wrap');
    if (wrap) wrap.toggleAttribute('inert', !open);
    blocks.set('row:' + id, rowHtml(id, ctxNow()));
  }

  function openForm(id, kind) {
    const x = S.item(ctxNow().st, id);
    form = { id, kind, text: kind === 'note' ? (x && x.note) || '' : '' };
    openSet.add(id);
    paintJob();
    const ta = document.getElementById('f-' + id);
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }
  function saveForm() {
    if (!form) return;
    if (needWho()) return;
    const c = ctxNow();
    let patch;
    try {
      patch = form.kind === 'skip'
        ? S.skipPatch(c.st, form.id, who(), form.text, nowIso())
        : S.notePatch(c.st, form.id, who(), form.text, nowIso());
    } catch (err) { return H.toast(esc(err.message), 'bad'); }
    form = null;
    if (document.activeElement) document.activeElement.blur();
    commit({ t: 'patch', id: openId, set: patch });
  }

  function setValue(key, v) {
    if (needWho()) return;
    const cur = S.val(ctxNow().st[key]);
    commit({ t: 'patch', id: openId, set: S.valuePatch(key, cur === v ? '' : v, who(), nowIso()) });
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
    }
    H.toast('Copied. Paste it into a text.');
  }
  function copyScript(key) {
    const c = ctxNow();
    const line = S.scripts(c.j.lists, c.meta, c.j).find(x => x.key === key);
    if (line) copyText(line.text);
  }

  function signOff() {
    const c = ctxNow();
    if (needWho()) return;
    const patch = S.signOffPatch(c.meta, c.st, who(), nowIso());
    if (!patch) {
      if (!c.sign.ok) return onTick(c.meta.signoffs[0]);
      return H.toast(`Tick every check first. ${plural(c.sign.left, 'check')} to go.`);
    }
    commit({ t: 'patch', id: openId, set: patch });
    H.buzz([12, 40, 12]);
    H.toast(`Signed off by <b>${esc(who())}</b>. Mark the job done when the customer has it.`);
  }

  function letThrough() {
    try {
      const patch = S.overridePatch(admin(), who() || 'Admin', overrideText, nowIso());
      overrideText = '';
      overrideOpen = false;
      if (document.activeElement) document.activeElement.blur();
      commit({ t: 'patch', id: openId, set: patch });
      H.toast('Let through. The reason is kept on the job.');
    } catch (err) { H.toast(esc(err.message), 'bad'); }
  }

  function finish() {
    const c = ctxNow();
    const patch = S.finishPatch(c.meta, c.st, who(), nowIso());
    if (!patch) return;
    scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    setTimeout(() => {
      commit({ t: 'patch', id: openId, set: patch });
      H.buzz([20, 60, 20, 60, 40]);
      H.toast('Job done. Good work.');
    }, reduced ? 0 : 420);
  }

  async function reopen() {
    if (!admin()) return;
    if (!await H.ask('Reopen this job?', 'The sign-off and the finish are taken back, so steps can be ticked again.', 'Reopen')) return;
    try { commit({ t: 'patch', id: openId, set: S.reopenPatch(true, who() || 'Admin', nowIso()) }); } catch {}
  }

  /* ====================================================== new / edit job == */
  let jd = { id: null, services: [], date: '' };

  function openJobDlg(id) {
    const j = id ? model.jobs[id] : null;
    if (!model.sops.length) return H.toast('The SOPs are still loading. Try again in a moment.', 'bad');
    jd = { id: j ? j.id : null, services: j ? (j.services || []).slice() : [], date: j ? j.date : today(), was: j ? (j.services || []).join('|') : '' };
    $('jdTitle').textContent = j ? 'Job details' : 'Start a job';
    $('jdSave').textContent = j ? 'Save changes' : 'Start the job';
    $('jdName').value = j ? j.customer || '' : '';
    $('jdCar').value = j ? j.car || '' : '';
    $('jdSuburb').value = j ? j.suburb || '' : '';
    $('jdClock').checked = false;
    $('jdErr').hidden = true;
    $('jdFoot').hidden = !(j && admin());
    renderJd();
    $('jobDlg').showModal();
    if (mode === 'sheet' && !j) refreshSops().then(() => { if ($('jobDlg').open) renderJd(); });
  }

  function renderJd() {
    const names = S.serviceNames(model.settings);
    $('jdSvc').innerHTML = names.map(n => `<button type="button" data-svc="${esc(n)}" aria-pressed="${jd.services.includes(n)}">${esc(n)}</button>`).join('');
    const t = today(), tm = S.addDays(t, 1);
    const other = jd.date !== t && jd.date !== tm;
    $('jdDays').innerHTML = [[t, 'Today'], [tm, 'Tomorrow']].map(([d, l]) => `<button class="chip" type="button" data-jday="${d}" aria-pressed="${jd.date === d}">${l}</button>`).join('') +
      `<button class="chip" type="button" data-jday="pick" aria-pressed="${other}">${other ? esc(dayName(jd.date)) : 'Another day'}</button>`;
    $('jdDate').value = jd.date;
    const canClock = !jd.id && !!who() && !H.running() && jd.date === t;
    $('jdClockWrap').hidden = !canClock;
    const changed = jd.id && jd.services.join('|') !== jd.was;
    if (jd.services.length) {
      const b = S.build(jd.services, model.sops, model.settings);
      $('jdPreview').innerHTML = `This job gets <b>${plural(b.meta.steps.length, 'step')}</b>, <b>${plural(b.meta.clips.length, 'clip')}</b> to film and <b>${plural(b.meta.signoffs.length, 'check')}</b> at the end.` +
        (b.meta.goal ? ` Goal: <b>${S.goalText(b.meta.goal)}</b>.` : '') +
        (changed ? ' The checklist is rebuilt from today’s SOPs. Ticks already made are kept.' : '');
    } else {
      $('jdPreview').textContent = 'Pick a service to see what the checklist holds.';
    }
    $('jdSave').disabled = !jd.services.length;
  }

  function saveJd() {
    const customer = $('jdName').value.trim(), car = $('jdCar').value.trim(), suburb = $('jdSuburb').value.trim();
    const err = m => { $('jdErr').textContent = m; $('jdErr').hidden = false; };
    if (!jd.services.length) return err('Pick at least one service.');
    if (!car && !customer) return err('Add the car or the customer’s name, so the job can be found.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jd.date)) return err('Pick the day.');
    const now = nowIso(), rv = rev();
    if (jd.id) {
      const j = model.jobs[jd.id];
      if (!j) return $('jobDlg').close();
      const job = {
        id: j.id, date: jd.date, customer, car, suburb, services: jd.services.slice(),
        createdBy: j.createdBy || '', createdAt: j.createdAt || now, updatedAt: now, rev: rv,
      };
      if (jd.services.join('|') !== jd.was) {
        const b = S.build(jd.services, model.sops, model.settings);
        job.meta = { ...b.meta, rev: rv };
        $('jobDlg').close();
        commit({ t: 'put', job, lists: b.lists });
        if (openId === j.id) { buildJobView(); paintJob(); }
      } else {
        job.meta = { ...(j.meta || {}), rev: rv };
        $('jobDlg').close();
        commit({ t: 'put', job });
      }
      return H.toast('Saved.');
    }
    const b = S.build(jd.services, model.sops, model.settings);
    const id = uid();
    const job = {
      id, date: jd.date, customer, car, suburb, services: jd.services.slice(),
      createdBy: who(), createdAt: now, updatedAt: now, rev: rv, meta: { ...b.meta, rev: rv },
    };
    const clockOn = !$('jdClockWrap').hidden && $('jdClock').checked;
    $('jobDlg').close();
    commit({ t: 'put', job, lists: b.lists, state: {} });
    if (clockOn) H.clockOn(`${customer || car}, ${jd.services.join(' + ')}`);
    H.buzz(18);
    openJob(id);
  }

  async function deleteJob() {
    if (!admin() || !jd.id) return;
    const j = model.jobs[jd.id];
    if (!j) return;
    $('jobDlg').close();
    if (!await H.ask('Delete this job?', `${j.customer || j.car}, ${dayName(j.date).toLowerCase()}. Its checklist and every tick go too. It can’t be undone.`)) return;
    if (openId === j.id) leaveJob();
    commit({ t: 'remove', id: j.id });
    H.toast('Job deleted.');
  }

  /* ========================================================= paint readings == */
  function paintPanelRow(key) {
    const row = document.querySelector(`.pr[data-panel="${key}"]`);
    if (!row) return;
    const vals = [...row.querySelectorAll('input')].map(i => i.value.trim());
    const f = S.paintFlags({ r: vals }, model.settings);
    const set = S.settings(model.settings);
    row.querySelectorAll('input').forEach((inp, i) => inp.toggleAttribute('data-low', f.low.includes(i)));
    const flag = row.querySelector('.pr-head span');
    flag.className = f.light ? 'warn' : '';
    flag.textContent = !f.count ? 'No readings yet'
      : f.light ? (f.low.length ? `Light touch: under ${set.paintMin}` : `Light touch: jump of ${f.spread}`)
      : `${plural(f.count, 'reading')}, about ${f.average}`;
  }
  function openPaint() {
    const st = ctxNow().st;
    const set = S.settings(model.settings);
    $('paintRule').textContent = `At least 5 readings a panel, in microns. Under ${set.paintMin}, or a jump of more than ${set.paintSpread} between readings, means light touch: finishing polish only, or skip it.`;
    $('paintList').innerHTML = S.PANELS.map(p => {
      const r = (st['p:' + p.key] && st['p:' + p.key].r) || [];
      const n = BIG_PANELS.has(p.key) ? 10 : 5;
      return `<div class="pr" data-panel="${p.key}"><div class="pr-head"><b>${esc(p.label)}</b><span></span></div><div class="pr-in">` +
        Array.from({ length: n }, (_, i) => `<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" aria-label="${esc(p.label)} reading ${i + 1}" value="${esc(r[i] == null ? '' : r[i])}">`).join('') +
        '</div></div>';
    }).join('');
    S.PANELS.forEach(p => paintPanelRow(p.key));
    $('paintDlg').showModal();
  }
  function savePanel(key) {
    const row = document.querySelector(`.pr[data-panel="${key}"]`);
    if (!row || needWho()) return;
    const r = [...row.querySelectorAll('input')].map(i => i.value.replace(/[^\d]/g, ''));
    while (r.length && r[r.length - 1] === '') r.pop();
    const cur = ctxNow().st['p:' + key];
    if (JSON.stringify((cur && cur.r) || []) === JSON.stringify(r)) return;
    commit({ t: 'patch', id: openId, set: { ['p:' + key]: { r, by: who(), at: nowIso() } } });
  }

  /* ============================================================== warranty == */
  const W_FIELDS = ['customer', 'car', 'rego', 'date', 'package', 'product', 'batch', 'layers', 'photos', 'annualCheck'];
  function openWarranty() {
    const c = ctxNow();
    const w = c.st.warranty || S.warrantyDefaults(c.j, today());
    for (const f of W_FIELDS) $('w-' + f).value = w[f] || '';
    $('warDlg').showModal();
  }
  function saveWarranty() {
    if (needWho()) return;
    const w = {};
    for (const f of W_FIELDS) w[f] = $('w-' + f).value.trim();
    w.by = who();
    w.at = nowIso();
    $('warDlg').close();
    commit({ t: 'patch', id: openId, set: { warranty: w } });
    H.toast('Warranty record saved.');
  }

  /* ======================================================= job summary == */
  /* A picture of the job for the Imperium group chat: the car and the
     service, steps done out of steps, each stage, the skips and the notes.
     Drawn straight onto a canvas, so it looks the same on every phone and
     needs nothing from the internet. */
  const C = {
    bg: '#121113', panel: '#1A181B', line: 'rgba(244, 241, 236, 0.10)', steel: '#35323A',
    ivory: '#F4F1EC', ash: '#C3BEB8', slate: '#928D89',
    amber: '#FFB020', amberLit: '#FFCB63', good: '#57D08A', warn: '#FF7A66',
  };
  const FONT = { display: "'Big Shoulders Display', 'Instrument Sans', sans-serif", sans: "'Instrument Sans', system-ui, sans-serif" };
  const CARD_W = 1080, PAD = 72, INNER = CARD_W - PAD * 2;

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
  function loadImage(src) {
    return new Promise((ok, no) => {
      if (!src) return no(new Error('no image'));
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = no;
      img.src = src;
    });
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

  // Lays the card out from the top. Run once to measure and once to paint.
  function drawCard(ctx, d, logo, height) {
    const text = (str, x, y, font, color, align) => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(str, x, y);
    };
    const block = (str, y, font, color, lh, max) => {
      ctx.font = font;
      const lines = wrapLines(ctx, str, max || INNER);
      lines.forEach((l, i) => text(l, PAD, y + lh * (i + 1) - Math.round(lh * 0.22), font, color));
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

    // Brand and date.
    if (logo) {
      const h = 50, w = Math.round(logo.width * (h / logo.height));
      ctx.drawImage(logo, PAD, y, w, h);
    }
    text(d.when, CARD_W - PAD, y + 36, `500 30px ${FONT.sans}`, C.slate, 'right');
    y += 50 + 58;

    // The car, then the service.
    y = block(d.title, y, `700 112px ${FONT.display}`, C.ivory, 106);
    y += 10;
    y = block(d.services, y, `600 44px ${FONT.sans}`, C.amber, 56);
    if (d.sub) y = block(d.sub, y + 6, `400 34px ${FONT.sans}`, C.slate, 46);
    y += 44;

    // Steps done out of steps, with the gauge.
    const panelH = 320;
    if (height) {
      rounded(ctx, PAD, y, INNER, panelH, 28);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      const cx = PAD + 40 + 120, cy = y + panelH / 2, r = 120;
      const lit = d.full ? 60 : d.total ? Math.round(60 * d.done / d.total) : 0;
      ctx.lineCap = 'round';
      for (let i = 0; i < 60; i++) {
        const a = (i * 6 - 90) * Math.PI / 180, major = i % 5 === 0;
        const r1 = r - (major ? 30 : 22);
        ctx.strokeStyle = i < lit ? (major || d.full ? C.amberLit : C.amber) : C.steel;
        ctx.lineWidth = major ? 6 : 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.stroke();
      }
      if (d.full) {
        ctx.strokeStyle = C.amber;
        ctx.lineWidth = 10;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 38, cy + 2);
        ctx.lineTo(cx - 10, cy + 30);
        ctx.lineTo(cx + 42, cy - 28);
        ctx.stroke();
      } else {
        text(`${d.total ? Math.round(100 * d.done / d.total) : 0}%`, cx, cy + 22, `700 64px ${FONT.display}`, C.ivory, 'center');
      }
      const tx = PAD + 360, room = PAD + INNER - 32 - tx;
      // Shrinks a line until it fits inside the panel, so nothing runs off the edge.
      const fit = (str, weight, size, family) => {
        ctx.font = `${weight} ${size}px ${family}`;
        while (size > 22 && ctx.measureText(str).width > room) ctx.font = `${weight} ${size -= 2}px ${family}`;
        return ctx.font;
      };
      const top = d.skippedText ? y + 136 : y + 152;
      ctx.font = `700 140px ${FONT.display}`;
      const doneW = ctx.measureText(String(d.done)).width;
      text(String(d.done), tx, top, `700 140px ${FONT.display}`, C.ivory);
      text(`/${d.total}`, tx + doneW + 6, top, `700 84px ${FONT.display}`, C.slate);
      text('steps done', tx, top + 56, `600 40px ${FONT.sans}`, C.ash);
      text(d.status, tx, top + 108, fit(d.status, 600, 32, FONT.sans), d.statusColor);
      if (d.skippedText) text(d.skippedText, tx, top + 150, fit(d.skippedText, 600, 30, FONT.sans), C.warn);
    }
    y += panelH + 56;

    // Each stage, then the clips and the second check.
    const bar = (name, value, frac, color, valueColor) => {
      if (height) {
        text(name, PAD, y + 40, `600 36px ${FONT.sans}`, C.ivory);
        text(value, CARD_W - PAD, y + 42, `700 46px ${FONT.display}`, valueColor, 'right');
        rounded(ctx, PAD, y + 62, INNER, 8, 4);
        ctx.fillStyle = 'rgba(244, 241, 236, 0.08)';
        ctx.fill();
        if (frac > 0) {
          rounded(ctx, PAD, y + 62, Math.max(8, INNER * Math.min(1, frac)), 8, 4);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
      y += 100;
    };
    const row = (name, done, total, color) => bar(name, `${done}/${total}`, total ? done / total : 0, color, done >= total ? C.amber : C.ivory);
    for (const s of d.stages) row(s.name, s.done, s.total, C.amber);
    if (d.clipsTotal) row('Clips filmed', d.clipsDone, d.clipsTotal, C.amberLit);
    if (d.checksTotal) row('Second check', d.checksDone, d.checksTotal, C.good);
    if (d.time) bar(d.time.label, d.time.value, d.time.frac, d.time.over ? C.warn : C.good, d.time.over ? C.warn : C.ivory);
    y += 12;

    const heading = (str, color) => {
      if (height) {
        ctx.fillStyle = C.line;
        ctx.fillRect(PAD, y, INNER, 2);
      }
      y += 40;
      y = block(str, y, `700 56px ${FONT.display}`, color, 60);
      y += 14;
    };
    if (d.skipped.length) {
      heading(`Skipped (${d.skipped.length})`, C.warn);
      for (const k of d.skipped) {
        y = block(k.step, y, `600 34px ${FONT.sans}`, C.ivory, 46);
        y = block(`${k.reason} (${k.by})`, y, `400 32px ${FONT.sans}`, C.ash, 44);
        y += 22;
      }
    }
    heading(d.notes.length ? `Notes (${d.notes.length})` : 'Notes', C.ivory);
    if (!d.notes.length) y = block('No notes on this job.', y, `400 32px ${FONT.sans}`, C.slate, 44) + 22;
    for (const n of d.notes) {
      y = block(n.step, y, `600 30px ${FONT.sans}`, C.amber, 42);
      y = block(n.note, y, `400 34px ${FONT.sans}`, C.ivory, 48);
      y = block(n.by, y, `400 28px ${FONT.sans}`, C.slate, 40);
      y += 24;
    }

    // Who.
    if (height) { ctx.fillStyle = C.line; ctx.fillRect(PAD, y, INNER, 2); }
    y += 34;
    if (d.who) y = block(d.who, y, `400 30px ${FONT.sans}`, C.ash, 44);
    y = block('Imperium Detailing job checklist', y + 6, `400 26px ${FONT.sans}`, C.slate, 38);
    return y + PAD - 20;
  }

  function summaryFacts(c) {
    const j = c.j;
    const r = S.report(j.lists, c.meta, c.st);
    const s = r.sum;
    const full = s.stage === 'signed' || s.stage === 'done';
    const status = s.stage === 'done' ? (s.signedBy ? `Job done. Checked by ${s.signedBy}.` : 'Job done. Let through without a check.')
      : s.stage === 'signed' ? (s.signedBy ? `Signed off by ${s.signedBy}` : 'Let through without a check')
      : s.stage === 'ready' ? 'Every step done. Waiting on the second check.'
      : `${s.total - s.done} to go`;
    const names = list => (list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0] || '');
    const who = [r.crew.length ? `Worked by ${names(r.crew)}.` : '', s.signedBy ? `Checked by ${s.signedBy}.` : '',
      s.overrideBy ? `Let through by ${s.overrideBy}: ${s.overrideReason}` : '',
      s.ceramicPitched ? `Pitched: ${{ Yes: 'ceramic', Detail: 'a detail', No: 'nothing' }[s.ceramicPitched] || s.ceramicPitched}.` : '',
      s.planPitched ? `Plan pitched: ${s.planPitched}.` : ''].filter(Boolean).join(' ');
    const [y, m, dd] = j.date.split('-').map(Number);
    return {
      title: j.car || j.customer || 'Job',
      services: (j.services || []).join(' + '),
      sub: [j.car ? j.customer : '', j.suburb].filter(Boolean).join(', '),
      when: new Date(y, m - 1, dd).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }),
      done: s.done, total: s.total, full,
      status,
      skippedText: s.skipped ? `${plural(s.skipped, 'step')} skipped` : '',
      statusColor: s.stage === 'done' || s.stage === 'signed' ? C.good : s.stage === 'ready' ? '#4E9BE8' : C.amber,
      stages: r.stages.map(x => ({ ...x, name: SHORT[x.key] || x.name })),
      clipsDone: r.clipsDone, clipsTotal: r.clipsTotal, checksDone: r.checksDone, checksTotal: r.checksTotal,
      skipped: r.skipped,
      notes: r.notes.map(x => ({ ...x, by: [x.by, SHORT[x.stage] || x.stage].filter(Boolean).join(', ') })),
      who,
      time: (() => {
        const g = jobGoal(j), tm = S.timing(c.st, j, nowIso());
        if (!tm) return null;
        return {
          label: g ? `Time (goal ${S.goalText(g)})` : 'Time',
          value: S.duration(tm.minutes),
          frac: g ? tm.minutes / g[1] : 0,
          over: !!g && tm.minutes > g[1],
        };
      })(),
    };
  }

  async function summaryCanvas() {
    const c = ctxNow();
    const d = summaryFacts(c);
    try {
      await Promise.all([`700 112px ${FONT.display}`, `600 40px ${FONT.sans}`, `400 34px ${FONT.sans}`]
        .map(f => (document.fonts && document.fonts.load ? document.fonts.load(f) : null)));
    } catch {}
    const brand = document.querySelector('.head img');
    let logo = null;
    try { logo = await loadImage(brand && brand.src); } catch {}
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
    const j = model.jobs[openId];
    if (!j || !j.lists) return;
    sumBlob = null;
    if (sumUrl) URL.revokeObjectURL(sumUrl);
    sumUrl = '';
    $('sumImg').hidden = true;
    $('sumWait').hidden = false;
    for (const id of ['sumCopy', 'sumShare', 'sumSave']) $(id).disabled = true;
    sumSay('');
    $('sumDlg').showModal();
    try {
      const canvas = await summaryCanvas();
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
    const file = new File([sumBlob], sumName, { type: 'image/png' });
    $('sumShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    for (const id of ['sumCopy', 'sumShare', 'sumSave']) $(id).disabled = false;
  }
  /* The picture is ready before the tap, so the copy happens inside the tap:
     Safari only lets a page write to the clipboard straight after one. */
  async function copySummary() {
    if (!sumBlob) return;
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no clipboard');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': sumBlob })]);
      sumSay('Copied. Open the Imperium group chat and paste it.');
      H.buzz(14);
    } catch {
      sumSay('This phone won’t copy a picture from here. Hold your finger on the picture and tap Copy, or use Share.');
    }
  }
  async function shareSummary() {
    if (!sumBlob) return;
    const file = new File([sumBlob], sumName, { type: 'image/png' });
    try { await navigator.share({ files: [file], title: 'Job summary' }); }
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

  /* ================================================================= admin == */
  function paintAdmin() {
    const host = $('jobsAdmin');
    if (!host) return;
    if (!admin()) { put(host, ''); return; }
    const jobs = Object.values(model.jobs).filter(j => j && j.sum);
    const t = today();
    const st = S.stats(jobs, t, 30);
    const un = S.unsigned(jobs, S.ymd(CFG.weekStart(0)), t);
    const pct = v => (v == null ? '&mdash;' : `${Math.round(v * 100)}<small>%</small>`);
    const stat = (k, v) => `<div class="stat"><div class="k">${k}</div><div class="v tnum">${v}</div></div>`;
    const where = mode === 'sheet' ? 'Checklists sync to the Google Sheet, in the Jobs, Job lists and SOPs tabs.'
      : why === 'old' ? 'Checklists are on each phone only. Paste the new apps-script.gs into the Google Sheet and redeploy (see the README) to share them.'
      : 'Checklists are on this phone only.';
    const keptNames = upgradeKept.map(k => (k === '_settings' ? 'Services' : SHORT[k] || k));
    const keptNote = keptNames.length
      ? `<p style="font-size:14px;color:var(--slate)">New SOP wording came in, but these were edited here so they were kept: <b>${esc(keptNames.join(', '))}</b>. New services, goals and prices were added. <b>Back to the original SOPs</b> in the editor brings in the new wording.</p>` : '';
    const html = `<h3 class="sub">Jobs, last 30 days</h3>
      <div class="stats">${stat('Jobs', st.jobs)}${stat('Steps skipped a job', st.skippedPerJob == null ? '&mdash;' : st.skippedPerJob.toFixed(1))}${stat('Clips filmed', st.clipsExpected ? pct(st.clipsFilmed / st.clipsExpected) : '&mdash;')}</div>
      <div class="stats">${stat('Detail pitched', pct(st.detailPitchedRate))}${stat('Ceramic pitched', pct(st.ceramicPitchedRate))}${stat('Plan pitched', pct(st.planPitchedRate))}</div>
      <div class="stats">${stat('Signed off', pct(st.signedRate))}</div>
      <h3 class="sub">Not signed off this pay week</h3>
      ${un.length ? un.map(j => `<button class="admin-row" type="button" data-open-job="${esc(j.id)}"><b>${esc(j.customer || j.car)}</b><span>${esc(dayName(j.date))}</span><span>${j.sum.stage === 'ready' ? 'Needs the check' : `${j.sum.done} of ${j.sum.total}`}</span></button>`).join('')
        : '<div class="empty">Every job before today is signed off.</div>'}
      <h3 class="sub">Job SOPs</h3>
      <p style="font-size:14px;color:var(--slate)">Change the steps, the How to do it notes, and which lists each service gets. A job that has started keeps the lists it started with.</p>
      ${keptNote}<div class="btn-wrap"><button class="btn key" type="button" data-sop-edit>Edit the SOPs</button><button class="btn" type="button" data-sop-export>Download the SOPs</button></div>
      <p style="font-size:14px;color:var(--slate);margin-top:14px">${where}</p>`;
    put(host, html);
  }

  async function exportSops() {
    const md = S.markdown(model.sops);
    const filename = `imperium-sops-${today()}.md`;
    try {
      const dl = typeof claude !== 'undefined' && claude.use ? await claude.use('downloads') : null;
      if (dl) { await dl.save({ filename, data: md }); return H.toast(`Saved ${filename}.`); }
    } catch { return H.toast('The download was cancelled.', 'bad'); }
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    H.toast(`Saved ${filename}.`);
  }

  /* ============================================================ SOP editor == */
  let ed = null;            // { sops, settings, tab, dirty: Set }

  function openSop() {
    if (!admin()) return;
    seedFile().catch(() => {});
    ed = { sops: clone(model.sops), settings: clone(S.settings(model.settings)), tab: (model.sops[0] || {}).key || '_services', dirty: new Set() };
    $('v-admin').hidden = true;
    $('v-sop').hidden = false;
    document.body.setAttribute('data-jobview', '');
    pushHistory({ sop: true });
    renderEd();
    scrollTo({ top: 0 });
  }
  function closeSop() {
    if (!ed) return;
    ed = null;
    $('v-sop').hidden = true;
    document.body.removeAttribute('data-jobview');
    if (H.tab() === 'admin') $('v-admin').hidden = false;
    paintAdmin();
  }
  async function leaveSop() {
    if (ed && ed.dirty.size && !await H.ask('Leave without saving?', 'Your changes to the SOPs will be lost.', 'Leave')) return;
    if (ed) ed.dirty.clear();
    if (history.state && history.state.sop) history.back(); else closeSop();
  }

  function edItemHtml(it, si, ii, s) {
    const f = (name, label, value, area) => `<div><label class="lab" for="ed-${si}-${ii}-${name}">${label}</label>` +
      (area ? `<textarea id="ed-${si}-${ii}-${name}" data-ed="${si}:${ii}:${name}">${esc(value || '')}</textarea>`
        : `<input id="ed-${si}-${ii}-${name}" type="text" data-ed="${si}:${ii}:${name}" value="${esc(value || '')}">`) + '</div>';
    let fields;
    if (it.type === 'clip') {
      fields = `<div><label class="lab" for="ed-${si}-${ii}-when">When</label><select id="ed-${si}-${ii}-when" data-ed="${si}:${ii}:when">` +
        ['before', 'during', 'after', 'later'].map(w => `<option value="${w}"${it.when === w ? ' selected' : ''}>${cap(w)}</option>`).join('') + '</select></div>' +
        f('title', 'Clip', it.title) + `<div class="two">${f('length', 'Length', it.length)}${f('purpose', 'What it’s for', it.purpose)}</div>`;
    } else if (it.type === 'script') {
      fields = f('title', 'Title', it.title) + f('detail', 'Words', it.detail, true);
    } else if (it.type === 'step') {
      fields = f('title', 'Step name (bold)', it.title) + f('detail', 'The step', it.detail, true) + f('more', 'How to do it', it.more, true);
    } else {
      fields = f('detail', it.type === 'signoff' ? 'The check' : 'The rule', it.detail, true) + f('more', it.type === 'rule' ? 'Why' : 'How to do it', it.more, true);
    }
    const label = s.style === 'numbered' ? String(ii + 1) : it.type === 'clip' ? cap(it.when) : '';
    return `<div class="ed-item"><div class="ed-top"><b>${esc(label)}</b><span class="ed-acts">
      <button class="btn" type="button" data-ed-move="${si}:${ii}:-1" aria-label="Move up"${ii === 0 ? ' disabled' : ''}>&uarr;</button>
      <button class="btn" type="button" data-ed-move="${si}:${ii}:1" aria-label="Move down"${ii === s.items.length - 1 ? ' disabled' : ''}>&darr;</button>
      <button class="btn danger" type="button" data-ed-del="${si}:${ii}">Remove</button></span></div>${fields}</div>`;
  }

  function renderEd() {
    if (!ed) return;
    $('edPills').innerHTML = ed.sops.map(t => `<button type="button" data-ed-tab="${esc(t.key)}" aria-pressed="${ed.tab === t.key}"${ed.dirty.has(t.key) ? ' data-dirty' : ''}>${esc(shortName(t))}</button>`).join('') +
      `<button type="button" data-ed-tab="_services" aria-pressed="${ed.tab === '_services'}"${ed.dirty.has('_settings') ? ' data-dirty' : ''}>Services</button>`;
    $('edSave').disabled = !ed.dirty.size;
    $('edSave').textContent = ed.dirty.size ? 'Save changes' : 'No changes yet';
    const body = $('edBody');
    if (ed.tab === '_services') {
      const set = ed.settings;
      body.innerHTML = `<h2 style="font-size:var(--t-2);margin-top:14px">Services</h2>
        <p style="font-size:14px;color:var(--slate);margin-top:6px">Which lists each service gets. Paint correction and ceramic coating stop the exterior steps at the rinse after clay.</p>` +
        Object.entries(set.services).map(([name, m]) => `<div class="ed-svc"><b>${esc(name)}</b><div class="seg">` +
          ed.sops.map(t => `<button type="button" data-ed-svc="${esc(name)}" data-ed-tpl="${esc(t.key)}" aria-pressed="${(m.templates || []).includes(t.key)}">${esc(shortName(t))}</button>`).join('') +
          `</div><div class="two"><div><label class="lab" for="pitch-${esc(name)}">Pitch at the car</label><select id="pitch-${esc(name)}" data-ed-pitch="${esc(name)}">
            <option value="ceramic"${m.pitch === 'ceramic' || !m.pitch ? ' selected' : ''}>A detail, or ceramic</option><option value="plan"${m.pitch === 'plan' ? ' selected' : ''}>Maintenance plan</option><option value="none"${m.pitch === 'none' ? ' selected' : ''}>No pitch</option></select></div>
            <div style="align-self:end"><button class="btn danger" type="button" data-ed-rmsvc="${esc(name)}">Remove</button></div></div>
            <div class="two"><div><label class="lab" for="gmin-${esc(name)}">Goal, from (min)</label><input id="gmin-${esc(name)}" type="number" inputmode="numeric" min="0" data-ed-goal="${esc(name)}" data-i="0" value="${m.goal ? m.goal[0] : ''}"></div>
            <div><label class="lab" for="gmax-${esc(name)}">Goal, up to (min)</label><input id="gmax-${esc(name)}" type="number" inputmode="numeric" min="0" data-ed-goal="${esc(name)}" data-i="1" value="${m.goal ? m.goal[1] : ''}"></div></div></div>`).join('') +
        `<div class="add-staff" style="grid-template-columns:1fr auto"><div><label class="lab" for="edNewSvc">Add a service</label><input id="edNewSvc" type="text" placeholder="e.g. Engine bay"></div><button class="btn" type="button" data-ed-addsvc>Add</button></div>
        <h3 class="sub">Paint gauge</h3>
        <div class="two"><div><label class="lab" for="edMin">Thinnest paint (microns)</label><input id="edMin" type="number" inputmode="numeric" data-ed-num="paintMin" value="${set.paintMin}"></div>
        <div><label class="lab" for="edSpread">Biggest jump (microns)</label><input id="edSpread" type="number" inputmode="numeric" data-ed-num="paintSpread" value="${set.paintSpread}"></div></div>
        <h3 class="sub">Start again</h3>
        <p style="font-size:14px;color:var(--slate)">Put every SOP and service back to the latest wording that came with the app, then Save.</p>
        <div class="btn-wrap"><button class="btn danger" type="button" data-ed-reset>Back to the original SOPs</button></div>`;
      return;
    }
    const t = ed.sops.find(x => x.key === ed.tab);
    if (!t) { body.innerHTML = ''; return; }
    body.innerHTML = `<h2 style="font-size:var(--t-2);margin-top:14px">${esc(t.name)}</h2>
      <div style="margin-top:12px"><label class="lab" for="ed-intro">Intro</label><textarea id="ed-intro" data-ed="intro">${esc(t.intro || '')}</textarea></div>` +
      t.sections.map((s, si) => `<h3 class="sub">${esc(s.heading === false ? 'Steps' : s.name)}</h3>` +
        s.items.map((it, ii) => edItemHtml(it, si, ii, s)).join('') +
        `<div class="ed-add"><button class="btn" type="button" data-ed-add="${si}">+ Add ${s.style === 'clips' ? 'a clip' : s.style === 'bullets' ? 'a rule' : s.style === 'checks' ? 'a check' : s.style === 'scripts' ? 'a script' : 'a step'}</button></div>`).join('');
  }

  function edTemplate() { return ed && ed.sops.find(x => x.key === ed.tab); }
  /* Touches the page only when something visible changes: Safari drops a tap
     on a button that is rewritten between finger down and finger up, and the
     change event of the field being left fires right in between. */
  function edDirty(key) {
    ed.dirty.add(key);
    const b = $('edSave');
    if (b.disabled) { b.disabled = false; b.textContent = 'Save changes'; }
    const p = document.querySelector(`[data-ed-tab="${CSS.escape(key === '_settings' ? '_services' : key)}"]`);
    if (p && !p.hasAttribute('data-dirty')) p.setAttribute('data-dirty', '');
  }

  function edInput(e) {
    const el = e.target;
    if (!ed) return;
    if (el.dataset.ed) {
      const t = edTemplate();
      if (!t) return;
      if (el.dataset.ed === 'intro') t.intro = el.value;
      else {
        const [si, ii, name] = el.dataset.ed.split(':');
        t.sections[+si].items[+ii][name] = el.value;
      }
      edDirty(t.key);
    } else if (el.dataset.edNum) {
      const v = Number(el.value);
      if (Number.isFinite(v) && v >= 0) { ed.settings[el.dataset.edNum] = v; edDirty('_settings'); }
    } else if (el.dataset.edPitch) {
      ed.settings.services[el.dataset.edPitch].pitch = el.value;
      edDirty('_settings');
    } else if (el.dataset.edGoal) {
      const m = ed.settings.services[el.dataset.edGoal];
      const v = Number(el.value);
      if (!Number.isFinite(v) || v < 0) return;
      m.goal = (m.goal || [0, 0]).slice();
      m.goal[Number(el.dataset.i)] = Math.round(v);
      edDirty('_settings');
    }
  }

  async function edClick(t) {
    if (t.dataset.edTab) { ed.tab = t.dataset.edTab; renderEd(); return; }
    const tpl = edTemplate();
    if (t.dataset.edMove) {
      const [si, ii, d] = t.dataset.edMove.split(':').map(Number);
      const items = tpl.sections[si].items;
      if (ii + d < 0 || ii + d >= items.length) return;
      [items[ii], items[ii + d]] = [items[ii + d], items[ii]];
      edDirty(tpl.key); renderEd(); return;
    }
    if (t.dataset.edDel) {
      const [si, ii] = t.dataset.edDel.split(':').map(Number);
      const it = tpl.sections[si].items[ii];
      if (!await H.ask('Remove this?', (it.title ? it.title + ' ' : '') + (it.detail || ''), 'Remove')) return;
      tpl.sections[si].items.splice(ii, 1);
      edDirty(tpl.key); renderEd(); return;
    }
    if (t.dataset.edAdd !== undefined) {
      const s = tpl.sections[Number(t.dataset.edAdd)];
      const type = { clips: 'clip', bullets: 'rule', checks: 'signoff', scripts: 'script' }[s.style] || 'step';
      const it = { id: `${s.id}-x${Date.now().toString(36)}`, type, title: '', detail: '', subs: [], required: type === 'step' || type === 'signoff', more: '' };
      if (type === 'clip') Object.assign(it, { when: 'during', length: '3s', purpose: '' });
      s.items.push(it);
      edDirty(tpl.key); renderEd();
      const last = $('edBody').querySelectorAll('.ed-item');
      const box = last[last.length - 1];
      if (box) { box.scrollIntoView({ block: 'center' }); const first = box.querySelector('input,textarea'); if (first) first.focus({ preventScroll: true }); }
      return;
    }
    if (t.dataset.edSvc) {
      const m = ed.settings.services[t.dataset.edSvc];
      const k = t.dataset.edTpl;
      m.templates = m.templates || [];
      m.templates = m.templates.includes(k) ? m.templates.filter(x => x !== k) : m.templates.concat([k]);
      edDirty('_settings'); renderEd(); return;
    }
    if (t.dataset.edRmsvc) {
      if (!await H.ask(`Remove ${t.dataset.edRmsvc}?`, 'It stops being offered for new jobs. Jobs that have it keep their checklists.', 'Remove')) return;
      delete ed.settings.services[t.dataset.edRmsvc];
      edDirty('_settings'); renderEd(); return;
    }
    if (t.dataset.edAddsvc !== undefined) {
      const name = $('edNewSvc').value.trim();
      if (!name || ed.settings.services[name]) return $('edNewSvc').focus();
      ed.settings.services[name] = { templates: ['every_job', 'handover', 'signoff'].filter(k => ed.sops.some(x => x.key === k)), pitch: 'ceramic' };
      edDirty('_settings'); renderEd(); return;
    }
    if (t.dataset.edReset !== undefined) {
      if (!await H.ask('Back to the original SOPs?', 'Every SOP and service goes back to the wording that came with the app. Nothing changes until you press Save.', 'Put them back')) return;
      try {
        const s = await seedFile();
        ed.sops = s.sops;
        ed.settings = S.settings(s.settings);
        ed.sops.forEach(x => ed.dirty.add(x.key));
        ed.dirty.add('_settings');
        renderEd();
      } catch { H.toast('Couldn’t load the original SOPs.', 'bad'); }
    }
  }

  /* Saving marks an SOP as edited here, so a newer version of the SOPs will
     never write over it. Saving the original wording unmarks it again. */
  function marked(x, isSettings) {
    const { edited, seed, ...rest } = x;
    const v = seedCache && seedCache.version;
    const orig = seedCache && (isSettings ? seedCache.settings : seedCache.sops.find(t => t.key === x.key));
    const same = orig && S.fingerprint(rest, isSettings) === S.fingerprint(orig, isSettings);
    // Remember which version it was edited from, so only a later one asks before replacing it.
    return same ? { ...rest, seed: v } : { ...rest, seed: v, edited: true };
  }
  function saveEd() {
    if (!ed || !ed.dirty.size) return;
    for (const key of ed.dirty) {
      if (key === '_settings') commit({ t: 'settings', settings: stamp(marked({ ...(model.settings || {}), ...ed.settings }, true)) });
      else { const sop = ed.sops.find(x => x.key === key); if (sop) commit({ t: 'sop', sop: stamp(marked(sop)) }); }
    }
    upgradeKept = upgradeKept.filter(k => !ed.dirty.has(k));
    ed.dirty.clear();
    ed.sops = clone(model.sops);
    renderEd();
    H.toast('Saved. New jobs get these SOPs.');
  }

  /* =============================================================== paint all == */
  function paintAll() {
    paintList();
    if (openId) paintJob();
    paintAdmin();
    paintStrip();
  }

  /* ================================================================ wiring == */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-open-job],[data-tick],[data-how],[data-goto],[data-next],[data-next-step],[data-val],[data-copy],[data-paint],[data-warranty],' +
      '[data-note],[data-skip],[data-unskip],[data-form-save],[data-form-cancel],[data-signoff],[data-override],[data-finish],[data-reopen],[data-pickwho],' +
      '[data-jback],[data-summary],[data-qv],[data-qs],[data-svc],[data-jday],[data-sop-edit],[data-sop-export],[data-ed-tab],[data-ed-move],[data-ed-del],[data-ed-add],[data-ed-svc],[data-ed-rmsvc],[data-ed-addsvc],[data-ed-reset]');
    if (!t) return;
    const d = t.dataset;
    if (d.openJob) openJob(d.openJob);
    else if (d.tick) onTick(d.tick);
    else if (d.how) toggleHow(d.how);
    else if (d.goto) goStage(d.goto);
    else if (d.next) goRow(d.next, true);
    else if (d.nextStep !== undefined) { const n = S.nextStep(ctxNow().j.lists, ctxNow().st); if (n) goRow(n.item.id, true); }
    else if (d.val) setValue(d.val, d.v);
    else if (d.copy) copyScript(d.copy);
    else if (d.paint !== undefined) openPaint();
    else if (d.warranty !== undefined) openWarranty();
    else if (d.note) openForm(d.note, 'note');
    else if (d.skip) openForm(d.skip, 'skip');
    else if (d.unskip) { if (!needWho()) { const x = S.item(ctxNow().st, d.unskip) || {}; commit({ t: 'patch', id: openId, set: { ['s:' + d.unskip]: { done: false, by: who(), at: nowIso(), ...(x.note ? { note: x.note, noteBy: x.noteBy || '' } : {}) } } }); } }
    else if (d.formSave !== undefined) saveForm();
    else if (d.formCancel !== undefined) { form = null; paintJob(); }
    else if (d.signoff !== undefined) signOff();
    else if (d.override !== undefined) letThrough();
    else if (d.finish !== undefined) finish();
    else if (d.reopen !== undefined) reopen();
    else if (d.pickwho !== undefined) H.openWho();
    else if (d.jback !== undefined) leaveJob();
    else if (d.summary !== undefined) openSummary();
    else if (d.qv) pickQuote('vehicle', d.qv);
    else if (d.qs) pickQuote('service', d.qs);
    else if (d.svc) {
      jd.services = jd.services.includes(d.svc) ? jd.services.filter(x => x !== d.svc) : jd.services.concat([d.svc]);
      $('jdErr').hidden = true;
      renderJd();
    } else if (d.jday) {
      if (d.jday === 'pick') {
        $('jdDate').hidden = false;
        $('jdDate').focus();
        if ($('jdDate').showPicker) { try { $('jdDate').showPicker(); } catch {} }
      } else { jd.date = d.jday; $('jdDate').hidden = true; renderJd(); }
    }
    else if (d.sopEdit !== undefined) openSop();
    else if (d.sopExport !== undefined) exportSops();
    else if (ed) edClick(t);
  });

  document.addEventListener('input', e => {
    const el = e.target;
    if (el.hasAttribute('data-form-text') && form) form.text = el.value;
    else if (el.hasAttribute('data-override-text')) overrideText = el.value;
    else if (el.closest('#paintList')) { const row = el.closest('.pr'); if (row) paintPanelRow(row.dataset.panel); }
    else if (el.closest('#edBody')) edInput(e);
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.closest('#paintList')) { const row = el.closest('.pr'); if (row) savePanel(row.dataset.panel); }
    else if (el.closest('#edBody')) edInput(e);
  });
  document.addEventListener('toggle', e => {
    if (e.target.matches && e.target.matches('[data-override-box]')) overrideOpen = e.target.open;
  }, true);

  $('newJobBtn').addEventListener('click', () => openJobDlg(null));
  $('jvEdit').addEventListener('click', () => openJobDlg(openId));
  $('jvShare').addEventListener('click', openSummary);
  $('quoteBtn').addEventListener('click', () => { put($('quoteBody'), quoteHtml()); $('quoteDlg').showModal(); });
  $('quoteClose').addEventListener('click', () => $('quoteDlg').close());
  $('sumCopy').addEventListener('click', copySummary);
  $('sumShare').addEventListener('click', shareSummary);
  $('sumSave').addEventListener('click', saveSummary);
  $('sumClose').addEventListener('click', () => $('sumDlg').close());
  $('jvBack').addEventListener('click', leaveJob);
  $('jdCancel').addEventListener('click', () => $('jobDlg').close());
  $('jdSave').addEventListener('click', saveJd);
  $('jdDelete').addEventListener('click', deleteJob);
  $('jdDate').addEventListener('change', e => { if (e.target.value) { jd.date = e.target.value; renderJd(); } });
  $('paintDone').addEventListener('click', () => {
    for (const row of document.querySelectorAll('#paintList .pr')) savePanel(row.dataset.panel);
    $('paintDlg').close();
  });
  $('warCancel').addEventListener('click', () => $('warDlg').close());
  $('warSave').addEventListener('click', saveWarranty);
  $('w-date').addEventListener('change', e => { if (e.target.value) $('w-annualCheck').value = S.addYear(e.target.value); });
  $('sopBack').addEventListener('click', leaveSop);
  $('edSave').addEventListener('click', saveEd);
  for (const id of ['jobsLink', 'jvLink']) {
    $(id).addEventListener('click', async () => {
      if (mode === 'local') { await probe(); paintStrip(); return; }
      H.toast('Reconnecting…');
      await flush();
      await (openId ? refreshJob(openId, false) : refreshList());
      H.toast(linkOk ? '' : 'Still can’t reach the sheet.', linkOk ? null : 'bad');
    });
  }

  addEventListener('popstate', () => {
    const s = history.state || {};
    if (openId && !s.job) closeJob();
    if (ed && !s.sop) {
      if (ed.dirty.size) { pushHistory({ sop: true }); leaveSop(); }
      else closeSop();
    }
  });
  addEventListener('online', () => { flush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !H.role()) return;
    if (mode === 'sheet') { flush(); if (openId) refreshJob(openId, false); else refreshList(); refreshSops(); }
    else probe();
  });

  setInterval(() => {
    if (document.hidden || !H.role() || mode !== 'sheet' || !openId) return;
    refreshJob(openId, false).then(flush);
  }, JOB_POLL_MS);
  setInterval(() => {
    if (document.hidden || !H.role() || mode !== 'sheet' || openId) return;
    refreshList().then(flush);
  }, LIST_POLL_MS);
  setInterval(() => { if (!document.hidden) probe(); }, PROBE_MS);
  setInterval(() => { if (mode === 'sheet' && queue.length) paintStrip(); }, 4000);
  setInterval(() => { if (openId && !document.hidden) paintGoal(ctxNow()); }, 30000);

  /* What app.js says after it draws: a lock closes the checklist, and a new
     name or a new tab is redrawn. */
  let seen = '';
  H.onRender(() => {
    const role = H.role();
    if (!role) { if (openId) closeJob(); if (ed) { ed.dirty.clear(); closeSop(); } }
    const now = `${who()}|${role}|${H.tab()}`;
    if (now !== seen) { seen = now; paintAll(); }
  });

  buildGauge();
  paintAll();
  start();
})();
