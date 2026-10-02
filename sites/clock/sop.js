/* Imperium Clock — the job checklist rules.

   Plain logic only: no page, no storage. The page loads it as window.ImpSop and
   the tests load it in Node, so what the crew sees and what is tested is the
   same code. summary() is also copied into apps-script.gs, so the sheet works
   out a job's progress the same way the phone does; a test holds them equal.

   A job, as the sheet and the phone both keep it:

     header   id, date (YYYY-MM-DD), customer, car, suburb, services[],
              createdBy, createdAt, updatedAt
     meta     what its checklist was built with: templateKeys, pitch, and the
              ids of its steps, clips and sign-off checks
     lists    its own frozen copy of the SOP templates. Editing an SOP later
              never reaches a job that has already started.
     state    one key per thing ticked, so two phones never overwrite each
              other. Every value carries `at`, and the later `at` wins:
                s:<itemId>   { done, skipped, reason, note, noteBy, by, at }
                p:<panel>    { r: [5 readings], by, at }
                combo, ceramicPitched, planPitched   { v, by, at }
                correction   { stages, note, by, at }
                warranty     { customer, car, rego, ..., by, at }
                signoff, override, done   { by, at, reason?, off? }
*/
(function (root) {
  'use strict';

  var PANELS = [
    ['bonnet', 'Bonnet'], ['roof', 'Roof'], ['boot', 'Boot'],
    ['front-left-guard', 'Front left guard'], ['front-right-guard', 'Front right guard'],
    ['front-left-door', 'Front left door'], ['front-right-door', 'Front right door'],
    ['rear-left-door', 'Rear left door'], ['rear-right-door', 'Rear right door'],
    ['rear-left-quarter', 'Rear left quarter'], ['rear-right-quarter', 'Rear right quarter'],
  ].map(function (p) { return { key: p[0], label: p[1] }; });
  var DEFAULTS = { paintMin: 80, paintSpread: 30 };
  var STAGES = ['Single stage', 'Two stage'];

  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function sorted(sops) {
    return (sops || []).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  }
  function byKey(list) {
    var m = {};
    (list || []).forEach(function (x) { m[x.key] = x; });
    return m;
  }

  function settings(saved) {
    var s = saved || {};
    return {
      services: s.services || {},
      paintMin: typeof s.paintMin === 'number' ? s.paintMin : DEFAULTS.paintMin,
      paintSpread: typeof s.paintSpread === 'number' ? s.paintSpread : DEFAULTS.paintSpread,
      prices: s.prices || null,
    };
  }

  /* Whether a section or item belongs on a job with these lists. "a|b" means
     the job has a or b; "!a" means it doesn't have a. No needs: always. */
  function fits(needs, keys) {
    if (!needs) return true;
    var pos = [], neg = [];
    String(needs).split('|').forEach(function (p) {
      if (p.charAt(0) === '!') neg.push(p.slice(1)); else pos.push(p);
    });
    if (neg.some(function (k) { return keys.indexOf(k) !== -1; })) return false;
    return !pos.length || pos.some(function (k) { return keys.indexOf(k) !== -1; });
  }
  function serviceNames(set) { return Object.keys(settings(set).services); }

  /* The templates a job gets: every service's list, combined without repeats,
     in the templates' own order. stopAfter cuts a template's steps after one
     item (correction and ceramic stop the exterior steps at the rinse after
     clay). The plan pitch wins if any service asks for it. */
  function plan(services, sops, set) {
    var mapping = settings(set).services;
    var everything = { templates: sorted(sops).map(function (t) { return t.key; }) };
    var want = {}, stopAfter = {}, pitch = null;
    (services || []).forEach(function (sv) {
      var m = mapping[sv] || everything;
      (m.templates || []).forEach(function (k) { want[k] = true; });
      Object.keys(m.stopAfter || {}).forEach(function (k) { stopAfter[k] = m.stopAfter[k]; });
      if (m.pitch === 'plan' || !pitch) pitch = m.pitch || pitch;
    });
    var keys = sorted(sops).map(function (t) { return t.key; }).filter(function (k) { return want[k]; });
    return { keys: keys, stopAfter: stopAfter, pitch: pitch || 'ceramic' };
  }

  /* The job's own copy of its lists, and the ids the sheet needs to count
     progress without reading the lists. */
  function build(services, sops, set) {
    var p = plan(services, sops, set);
    var tpls = byKey(sops);
    var keep = function (x) { return fits(x.needs, p.keys); };
    var lists = p.keys.map(function (k) {
      var t = tpls[k], stop = p.stopAfter[k], stopped = false;
      var sections = (t.sections || []).filter(keep).map(function (s) {
        var items = (s.items || []).filter(keep).filter(function (it) {
          if (it.type !== 'step') return true;
          if (stopped) return false;
          if (stop && it.id === stop) stopped = true;
          return true;
        }).map(clone);
        var c = clone(s);
        c.items = items;
        return c;
      }).filter(function (s) { return s.items.length || s.intro; });
      var list = { key: t.key, name: t.name, intro: t.intro || '', outro: t.outro || '', sections: sections };
      if (t.optional) list.optional = true;
      return list;
    });
    var steps = [], clips = [], signoffs = [];
    lists.forEach(function (t) {
      t.sections.forEach(function (s) {
        s.items.forEach(function (it) {
          if (it.type === 'step' && it.required !== false) steps.push(it.id);
          if (it.type === 'clip') clips.push(it.id);
          if (it.type === 'signoff') signoffs.push(it.id);
        });
      });
    });
    var meta = { templateKeys: p.keys, pitch: p.pitch, steps: steps, clips: clips, signoffs: signoffs };
    var g = goal(services, set);
    if (g) meta.goal = g;
    return { lists: lists, meta: meta };
  }

  /* ---------------------------------------------------------------- state */

  // Later `at` wins, key by key, whichever order the writes arrive in.
  function merge(state, set) {
    var out = {}, k;
    for (k in state || {}) if (Object.prototype.hasOwnProperty.call(state, k)) out[k] = state[k];
    for (k in set || {}) {
      if (!Object.prototype.hasOwnProperty.call(set, k)) continue;
      var a = out[k], b = set[k];
      if (!a || !b || String(b.at || '') >= String(a.at || '')) out[k] = b;
    }
    return out;
  }
  function item(state, id) { return (state && state['s:' + id]) || null; }
  function settled(x) { return !!(x && (x.done || x.skipped)); }
  function val(x) { return x && !x.off ? x.v : undefined; }

  /* Everything the job list, the gauge and the dashboard need, from the ids in
     meta and the ticks in state. Copied into apps-script.gs word for word. */
  function summary(meta, state) {
    meta = meta || {};
    state = state || {};
    var steps = meta.steps || [], clips = meta.clips || [], signs = meta.signoffs || [];
    var done = 0, skipped = 0, clipsDone = 0, signDone = 0, count = {}, last = {}, i, s;
    for (i = 0; i < steps.length; i++) {
      s = state['s:' + steps[i]];
      if (!s || !(s.done || s.skipped)) continue;
      done++;
      if (s.skipped && !s.done) skipped++;
      if (s.by) {
        count[s.by] = (count[s.by] || 0) + 1;
        if (!last[s.by] || String(s.at || '') > last[s.by]) last[s.by] = String(s.at || '');
      }
    }
    for (i = 0; i < clips.length; i++) { s = state['s:' + clips[i]]; if (s && s.done) clipsDone++; }
    for (i = 0; i < signs.length; i++) { s = state['s:' + signs[i]]; if (s && s.done) signDone++; }
    // Whoever settled the most steps. On a tie, whoever did so last.
    var main = null;
    for (var p in count) {
      if (!main || count[p] > count[main] || (count[p] === count[main] && last[p] > last[main])) main = p;
    }
    var live = function (x) { return x && !x.off ? x : null; };
    var signed = live(state.signoff), over = live(state.override), fin = live(state.done);
    var pitched = function (x) { return x && !x.off && x.v ? x.v : ''; };
    return {
      done: done,
      total: steps.length,
      skipped: skipped,
      clipsDone: clipsDone,
      clipsTotal: clips.length,
      signDone: signDone,
      signTotal: signs.length,
      main: main,
      signedBy: signed ? signed.by : '',
      signedAt: signed ? signed.at : '',
      overrideBy: over ? over.by : '',
      overrideReason: over ? over.reason || '' : '',
      finishedBy: fin ? fin.by : '',
      finishedAt: fin ? fin.at : '',
      stage: fin && (signed || over) ? 'done' : signed || over ? 'signed' : done >= steps.length ? 'ready' : 'working',
      pitch: meta.pitch || 'ceramic',
      ceramicPitched: pitched(state.ceramicPitched),
      planPitched: pitched(state.planPitched),
    };
  }

  // Signed off (or let through) means the checklist is closed for ticking.
  function locked(state) {
    var st = summary({}, state).stage;
    return st === 'signed' || st === 'done';
  }

  function tickPatch(state, id, who, now) {
    var cur = item(state, id) || {};
    var next = { done: !cur.done, by: who, at: now };
    if (cur.note) { next.note = cur.note; next.noteBy = cur.noteBy || ''; }
    return { ['s:' + id]: next };
  }
  function skipPatch(state, id, who, reason, now) {
    var r = String(reason || '').trim();
    if (!r) throw new Error('Say why it was skipped.');
    var cur = item(state, id) || {};
    var next = { done: false, skipped: true, reason: r, by: who, at: now };
    if (cur.note) { next.note = cur.note; next.noteBy = cur.noteBy || ''; }
    return { ['s:' + id]: next };
  }
  // A note leaves the tick, and who ticked it, exactly as they were.
  function notePatch(state, id, who, note, now) {
    var cur = clone(item(state, id)) || { done: false, by: '' };
    cur.note = String(note || '').trim().slice(0, 500);
    cur.noteBy = who;
    cur.at = now;
    return { ['s:' + id]: cur };
  }
  function valuePatch(key, v, who, now) {
    return { [key]: { v: v, by: who, at: now } };
  }

  function canSignOff(meta, state, who) {
    var s = summary(meta, state);
    if (s.stage === 'signed' || s.stage === 'done') return { ok: false, reason: 'signed', main: s.main };
    if (s.done < s.total) return { ok: false, reason: 'steps', left: s.total - s.done, main: s.main };
    if (!who) return { ok: false, reason: 'who', main: s.main };
    if (s.main && who === s.main) return { ok: false, reason: 'same', main: s.main };
    return { ok: true, main: s.main, left: s.signTotal - s.signDone };
  }
  function signOffPatch(meta, state, who, now) {
    var c = canSignOff(meta, state, who);
    if (!c.ok || c.left > 0) return null;
    return { signoff: { by: who, at: now } };
  }
  // Admin can let a job through without the second check, with a reason.
  function overridePatch(admin, who, reason, now) {
    if (!admin) throw new Error('Only admin (code 1906) can let a job through without a sign-off.');
    var r = String(reason || '').trim();
    if (!r) throw new Error('Write why.');
    return { override: { by: who || 'Admin', reason: r, at: now } };
  }
  function finishPatch(meta, state, who, now) {
    if (summary(meta, state).stage !== 'signed') return null;
    return { done: { by: who || '', at: now } };
  }
  // Admin only: take the sign-off and the finish back, so ticking opens again.
  function reopenPatch(admin, who, now) {
    if (!admin) throw new Error('Only admin can reopen a job.');
    var off = { off: true, by: who || 'Admin', at: now };
    return { signoff: off, override: off, done: off };
  }

  /* ----------------------------------------------------------- the screen */

  function eachItem(lists, fn) {
    (lists || []).forEach(function (t) {
      (t.sections || []).forEach(function (s) {
        (s.items || []).forEach(function (it, n) { fn(it, s, t, n); });
      });
    });
  }
  /* Where each clip and job photo shows: just above or right under the step
     it belongs to, so it's filmed then and there instead of from a list at
     the end. `at` is a priority list of step ids and the first one on this job
     wins, so a clip still lands right when the exterior is cut short for a
     correction or ceramic job. A clip with no place stays in its own list. */
  function placements(lists) {
    var present = {}, before = {}, after = {}, placed = {}, photos = [];
    var keys = (lists || []).map(function (t) { return t.key; });
    eachItem(lists, function (it) { if (it.type === 'step') present[it.id] = true; });
    var put = function (cue, pos, at) {
      var target = (at || []).filter(function (id) { return present[id]; })[0];
      if (!target) return false;
      var m = pos === 'before' ? before : after;
      (m[target] = m[target] || []).push(cue);
      return true;
    };
    eachItem(lists, function (it) {
      (it.photos || []).forEach(function (p) {
        var cue = { photo: p };
        if (fits(p.needs, keys) && put(cue, p.pos, p.at)) photos.push(cue);
      });
      if (it.type === 'clip' && it.at && put({ clip: it.id, pos: it.pos || 'after', when: it.when }, it.pos, it.at)) placed[it.id] = true;
    });
    // In each spot: what you film while doing the step, then the photos, then the rest.
    var rank = function (c) { return c.when === 'during' ? 0 : c.photo ? 1 : 2; };
    [before, after].forEach(function (m) {
      Object.keys(m).forEach(function (k) {
        m[k] = m[k].map(function (c, i) { return [rank(c), i, c]; })
          .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; })
          .map(function (x) { return x[2]; });
      });
    });
    // Photos are counted for this job: an exterior job has fewer than 12.
    photos.sort(function (a, b) { return a.photo.n - b.photo.n; });
    photos.forEach(function (c, i) { c.i = i + 1; c.of = photos.length; });
    return { before: before, after: after, placed: placed, photos: photos.length };
  }

  // The first required step not done or skipped, in checklist order.
  function nextStep(lists, state) {
    var hit = null;
    eachItem(lists, function (it, s, t) {
      if (hit || it.type !== 'step' || it.required === false || settled(item(state, it.id))) return;
      hit = { item: it, section: s, template: t };
    });
    return hit;
  }
  function counts(tpl, state) {
    var c = { done: 0, total: 0, clipsDone: 0, clipsTotal: 0, signDone: 0, signTotal: 0 };
    eachItem([tpl], function (it) {
      var x = item(state, it.id);
      if (it.type === 'step' && it.required !== false) { c.total++; if (settled(x)) c.done++; }
      if (it.type === 'clip') { c.clipsTotal++; if (x && x.done) c.clipsDone++; }
      if (it.type === 'signoff') { c.signTotal++; if (x && x.done) c.signDone++; }
    });
    return c;
  }

  // A short name for a step, for places with no room for the whole line.
  function label(it) {
    if (it.title) return it.title.replace(/[.:,]$/, '');
    var first = String(it.detail || '').split(/[.:](\s|$)/)[0];      // up to the first full stop or colon
    var w = first.split(/\s+/).filter(Boolean);
    return w.slice(0, 8).join(' ').replace(/[.:,]$/, '') + (w.length > 8 ? '\u2026' : '');
  }

  /* What the job summary picture shows: progress by stage, every note and
     every skip in checklist order, who worked the job and who checked it. */
  function report(lists, meta, state) {
    var sum = summary(meta, state);
    var stages = [], notes = [], skipped = [], crew = [], clipsDone = 0, clipsTotal = 0;
    (lists || []).forEach(function (t) {
      var k = counts(t, state);
      clipsDone += k.clipsDone;
      clipsTotal += k.clipsTotal;
      if (t.key !== 'signoff' && k.total) stages.push({ key: t.key, name: t.name, done: k.done, total: k.total });
    });
    eachItem(lists, function (it, s, t) {
      var x = item(state, it.id);
      if (!x) return;
      if (it.type === 'step' && x.by && (x.done || x.skipped) && crew.indexOf(x.by) === -1) crew.push(x.by);
      if (x.skipped && !x.done) skipped.push({ step: label(it), stage: t.key, reason: x.reason || '', by: x.by || '' });
      if (x.note) notes.push({ step: label(it), stage: t.key, note: x.note, by: x.noteBy || x.by || '' });
    });
    return {
      sum: sum, stages: stages, notes: notes, skipped: skipped, crew: crew,
      clipsDone: clipsDone, clipsTotal: clipsTotal,
      checksDone: sum.signDone, checksTotal: sum.signTotal,
    };
  }

  function paintFlags(reading, set) {
    var s = settings(set);
    var r = ((reading && reading.r) || []).map(function (v) {
      return v === '' || v == null || isNaN(Number(v)) ? null : Number(v);
    });
    var vals = r.filter(function (v) { return v !== null; });
    var low = [];
    r.forEach(function (v, i) { if (v !== null && v < s.paintMin) low.push(i); });
    var spread = vals.length >= 2 ? Math.max.apply(null, vals) - Math.min.apply(null, vals) : 0;
    return {
      count: vals.length,
      low: low,
      spread: spread,
      bigJump: spread > s.paintSpread,
      light: low.length > 0 || spread > s.paintSpread,
      average: vals.length ? Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) : null,
    };
  }

  function addYear(date) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
    if (!m) return '';
    var d = m[3];
    if (m[2] === '02' && d === '29') d = '28';
    return (Number(m[1]) + 1) + '-' + m[2] + '-' + d;
  }
  function warrantyDefaults(job, today) {
    var date = (job && job.date) || today || '';
    return {
      customer: (job && job.customer) || '', car: (job && job.car) || '', rego: '', date: date,
      package: '', product: '', batch: '', layers: '', photos: '', annualCheck: addYear(date),
    };
  }

  function quoted(text) {
    var m = /"([^"]+)"/.exec(text || '');
    return m ? m[1] : text || '';
  }
  // What to say at the car: the right pitch for this job, the referral line, the review ask.
  function scripts(lists, meta, job) {
    var want = (meta && meta.pitch) || 'ceramic', pitch = null, referral = null, review = null;
    eachItem(lists, function (it) {
      if (it.type === 'script' && it.pitch === want) pitch = it;
      if (it.script === 'referral') referral = it;
      if (it.script === 'review') review = it;
    });
    var out = [];
    if (pitch) {
      var text = quoted(pitch.detail);
      if (job && job.car) text = text.split('[car]').join(job.car);
      out.push({ key: 'pitch', label: pitch.title.replace(/:$/, ''), text: text });
    }
    if (referral) out.push({ key: 'referral', label: 'Referral line', text: quoted(referral.detail) });
    if (review) out.push({ key: 'review', label: 'Review ask', text: quoted(review.detail) });
    return out;
  }

  /* --------------------------------------------------------------- timing */

  // The time a job should take, in minutes: each service's goal, added up.
  function goal(services, set) {
    var m = settings(set).services, lo = 0, hi = 0, any = false;
    (services || []).forEach(function (sv) {
      var g = m[sv] && m[sv].goal;
      if (g && g.length === 2) { lo += g[0]; hi += g[1]; any = true; }
    });
    return any ? [lo, hi] : null;
  }
  function hours(min) {
    var h = Math.round(min / 15) / 4;
    return String(h);
  }
  function goalText(g) {
    if (!g) return '';
    if (g[0] < 60) return g[0] + ' min to ' + hours(g[1]) + (g[1] === 60 ? ' hour' : ' hours');
    return hours(g[0]) + ' to ' + hours(g[1]) + ' hours';
  }
  function duration(min) {
    min = Math.max(0, Math.round(min));
    if (min < 60) return min + ' min';
    return Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '');
  }
  /* How long the job has taken: from the first tick on the day of the job
     (the day-before texts don't count) to Mark job done, or to now. */
  function timing(state, job, nowIso) {
    var start = null;
    for (var k in state || {}) {
      if (k.indexOf('s:') !== 0) continue;
      var x = state[k];
      if (!x || !(x.done || x.skipped) || !x.at) continue;
      var d = new Date(x.at);
      if (isNaN(d) || ymd(d) !== (job && job.date)) continue;
      if (!start || x.at < start) start = x.at;
    }
    if (!start) return null;
    var fin = state.done && !state.done.off ? state.done.at : null;
    var end = fin || nowIso;
    return { start: start, end: end, finished: !!fin, minutes: Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60000)) };
  }

  /* ---------------------------------------------------------------- quote */

  // The instant quote: the price for a car size and a service, with the condition range.
  function quote(prices, vehicle, service) {
    var v = ((prices && prices.vehicles) || []).filter(function (x) { return x.key === vehicle; })[0];
    if (!v) return null;
    if (v.note && !Object.keys(v.prices || {}).length) return { note: v.note };
    var p = (v.prices || {})[service];
    if (typeof p !== 'number') return null;
    var c = (prices && prices.condition) || {};
    var ranged = (c.services || []).indexOf(service) !== -1 && c.range;
    return { from: p, to: ranged ? p + c.range : p };
  }

  /* -------------------------------------------------------------- upgrade */

  // A short, stable fingerprint of what an SOP says, ignoring when and who saved it.
  function fingerprint(x, settingsShape) {
    var body = settingsShape
      ? JSON.stringify({ services: x.services, paintMin: x.paintMin, paintSpread: x.paintSpread })
      : JSON.stringify({ key: x.key, name: x.name, sort: x.sort, intro: x.intro, outro: x.outro, sections: x.sections });
    var h = 0x811c9dc5;
    for (var i = 0; i < body.length; i++) {
      h ^= body.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  /* Brings stored SOPs up to a newer seed. An SOP nobody has edited is
     replaced with the new wording; one edited in the app is kept as it is and
     named in `kept`, so admin can decide. New SOPs are added. Saved jobs are
     never touched: they keep their own copy. */
  function upgrade(stored, storedSettings, seed) {
    var v = seed.version || 1, prev = seed.previous || {};
    var have = byKey(stored || []), sops = [], changed = [], kept = [];
    var pristine = function (cur, prints, isSettings) {
      if (cur.edited) return false;
      if (cur.seed) return true;
      return (prints || []).indexOf(fingerprint(cur, isSettings)) !== -1;
    };
    (seed.sops || []).forEach(function (t) {
      var cur = have[t.key];
      if (!cur) { sops.push(clone(t)); changed.push(t.key); return; }
      if (cur.seed === v) { sops.push(cur); return; }
      if (pristine(cur, prev[t.key])) { sops.push(clone(t)); changed.push(t.key); }
      else { sops.push(cur); kept.push(t.key); }
    });
    (stored || []).forEach(function (t) { if (!(seed.sops || []).some(function (x) { return x.key === t.key; })) sops.push(t); });
    sops.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });

    var cur = storedSettings, out = cur, settingsChanged = false;
    if (!cur || (cur.seed !== v && pristine(cur, prev._settings, true))) {
      out = clone(seed.settings);
      settingsChanged = true;
    } else if (cur.seed !== v) {
      // Edited services stay; anything new in the seed is added beside them.
      out = clone(cur);
      out.services = out.services || {};
      Object.keys(seed.settings.services || {}).forEach(function (name) {
        var mine = out.services[name], theirs = seed.settings.services[name];
        if (!mine) out.services[name] = clone(theirs);
        else if (!mine.goal && theirs.goal) mine.goal = theirs.goal.slice();
      });
      if (!out.prices) out.prices = clone(seed.settings.prices);
      out.seed = v;
      settingsChanged = true;
      kept.push('_settings');
    }
    return { sops: sops, settings: out, changed: changed, kept: kept, settingsChanged: settingsChanged };
  }

  /* ------------------------------------------------------------ dashboard */

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(day, n) {
    var p = day.split('-').map(Number);
    return ymd(new Date(p[0], p[1] - 1, p[2] + n));
  }
  // Jobs from `from` up to yesterday still waiting on the second check. Today's are still under way.
  function unsigned(jobs, from, today) {
    return (jobs || []).filter(function (j) {
      var st = j.sum && j.sum.stage;
      return j.date >= from && j.date < today && (st === 'working' || st === 'ready');
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });
  }
  function stats(jobs, today, days) {
    days = days || 30;
    var from = addDays(today, -(days - 1));
    var list = (jobs || []).filter(function (j) { return j.sum && j.date >= from && j.date <= today; });
    var skipped = 0, filmed = 0, clips = 0, cerAsked = 0, cerYes = 0, planAsked = 0, planYes = 0, past = 0, closed = 0;
    list.forEach(function (j) {
      var s = j.sum;
      skipped += s.skipped;
      filmed += s.clipsDone;
      clips += s.clipsTotal;
      if (s.pitch === 'plan') { planAsked++; if (s.planPitched === 'Yes') planYes++; }
      else if (s.pitch !== 'none') { cerAsked++; if (s.ceramicPitched === 'Yes') cerYes++; }
      if (j.date < today) { past++; if (s.stage === 'signed' || s.stage === 'done') closed++; }
    });
    return {
      jobs: list.length,
      skippedPerJob: list.length ? skipped / list.length : null,
      clipsFilmed: filmed,
      clipsExpected: clips,
      ceramicPitchedRate: cerAsked ? cerYes / cerAsked : null,
      planPitchedRate: planAsked ? planYes / planAsked : null,
      signedRate: past ? closed / past : null,
    };
  }

  /* --------------------------------------------------------------- export */

  // The SOPs as markdown, in exactly the layout of the original Appendix. The
  // How to do it notes are the app's own and are not part of it.
  function markdown(sops) {
    var out = [];
    var cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; };
    sorted(sops).forEach(function (t) {
      out.push('## ' + t.name, '');
      if (t.intro) out.push(t.intro, '');
      (t.sections || []).forEach(function (s) {
        if (s.heading !== false) out.push('**' + s.name + '**' + (s.headingNote ? ' ' + s.headingNote : ''), '');
        if (s.intro) out.push(s.intro, '');
        var items = s.items || [];
        if (s.style === 'clips') {
          out.push("| When | Clip | Length | What it's for |", '| --- | --- | --- | --- |');
          items.forEach(function (it) {
            out.push('| ' + cap(it.when) + ' | ' + it.title + ' | ' + (it.length || '') + ' | ' + (it.purpose || '') + ' |');
          });
          out.push('');
        } else if (s.style === 'scripts') {
          items.forEach(function (it) { out.push(it.title, it.detail, ''); });
        } else if (items.length) {
          items.forEach(function (it, n) {
            var text = it.title ? '**' + it.title + '**' + (it.detail ? ' ' + it.detail : '') : it.detail;
            if (s.style === 'checks') out.push('- [ ] ' + text);
            else if (s.style === 'bullets') out.push('- ' + text);
            else out.push(n + 1 + '. ' + text);
            (it.subs || []).forEach(function (sub) { out.push('    - ' + sub); });
          });
          out.push('');
        }
      });
      if (t.outro) out.push(t.outro, '');
    });
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n') + '\n';
  }

  var api = {
    PANELS: PANELS,
    DEFAULTS: DEFAULTS,
    STAGES: STAGES,
    settings: settings,
    fits: fits,
    serviceNames: serviceNames,
    plan: plan,
    build: build,
    merge: merge,
    item: item,
    settled: settled,
    val: val,
    summary: summary,
    locked: locked,
    tickPatch: tickPatch,
    skipPatch: skipPatch,
    notePatch: notePatch,
    valuePatch: valuePatch,
    canSignOff: canSignOff,
    signOffPatch: signOffPatch,
    overridePatch: overridePatch,
    finishPatch: finishPatch,
    reopenPatch: reopenPatch,
    eachItem: eachItem,
    placements: placements,
    nextStep: nextStep,
    counts: counts,
    label: label,
    report: report,
    goal: goal,
    goalText: goalText,
    duration: duration,
    timing: timing,
    quote: quote,
    fingerprint: fingerprint,
    upgrade: upgrade,
    paintFlags: paintFlags,
    addYear: addYear,
    warrantyDefaults: warrantyDefaults,
    scripts: scripts,
    ymd: ymd,
    addDays: addDays,
    unsigned: unsigned,
    stats: stats,
    markdown: markdown,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ImpSop = api;
})(typeof window !== 'undefined' ? window : this);
