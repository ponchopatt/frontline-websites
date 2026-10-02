// The Google Apps Script backend, run in Node against a pretend spreadsheet.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const here = f => new URL(f, import.meta.url);
const SCRIPT = readFileSync(here('../apps-script.gs'), 'utf8');
vm.runInThisContext(readFileSync(here('../sop.js'), 'utf8'));
const J = globalThis.ImpSop;
const seed = JSON.parse(readFileSync(here('../sops.json'), 'utf8'));
const settings = { ...seed.settings, services: seed.services };
const plain = x => JSON.parse(JSON.stringify(x));

/* Just enough of SpreadsheetApp to run the script. Like the real thing, a
   leading apostrophe marks text and is not part of the value read back. */
function fakeGoogle() {
  const sheets = new Map();
  const cell = v => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v);
  function makeSheet(name) {
    const rows = [];
    const sh = {
      name, rows,
      appendRow(r) { rows.push(r.slice()); },
      getLastRow() { return rows.length; },
      getLastColumn() { return rows.reduce((n, r) => Math.max(n, r.length), 0); },
      setFrozenRows() {},
      deleteRow(n) { rows.splice(n - 1, 1); },
      getRange(r, c, nr = 1, nc = 1) {
        return {
          getValues() {
            const out = [];
            for (let i = 0; i < nr; i++) {
              const row = rows[r - 1 + i] || [];
              const vals = [];
              for (let j = 0; j < nc; j++) vals.push(row[c - 1 + j] === undefined ? '' : cell(row[c - 1 + j]));
              out.push(vals);
            }
            return out;
          },
          setValues(v) {
            for (let i = 0; i < nr; i++) {
              while (rows.length < r + i) rows.push([]);
              for (let j = 0; j < nc; j++) rows[r - 1 + i][c - 1 + j] = v[i][j];
            }
          },
          clearContent() { for (let i = 0; i < nr; i++) if (rows[r - 1 + i]) rows[r - 1 + i] = []; },
        };
      },
    };
    return sh;
  }
  const ss = {
    getSheetByName: n => sheets.get(n) || null,
    insertSheet: n => { const s = makeSheet(n); sheets.set(n, s); return s; },
    getSpreadsheetTimeZone: () => 'Australia/Sydney',
  };
  return {
    sheets,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: s => ({ body: s, setMimeType() { return this; } }),
    },
    Utilities: { formatDate: d => d.toISOString().slice(0, 10) },
  };
}

function load(source = SCRIPT) {
  const g = fakeGoogle();
  const ctx = vm.createContext({ ...g, JSON, Object, String, Number, Date, Math, Error });
  vm.runInContext(source, ctx);
  const get = params => JSON.parse(ctx.doGet({ parameter: params || {} }).body);
  const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).body);
  const table = name => {
    const sh = g.sheets.get(name);
    return sh ? plain(sh.rows.map(r => r.map(v => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v)))) : null;
  };
  return { ctx, get, post, table, sheets: g.sheets };
}

function newJob(services, extra = {}) {
  const b = J.build(services, seed.templates, settings);
  return {
    job: {
      id: 'j1', date: '2026-10-01', customer: 'Jo Smith', car: 'Tesla Model 3', suburb: 'Kambah',
      services, createdBy: 'AJ', createdAt: '2026-10-01T08:00:00.000Z', rev: 'r1', meta: b.meta, ...extra,
    },
    lists: b.lists,
    meta: b.meta,
  };
}

test('the timesheet works exactly as before, and now says v: 2', () => {
  const s = load();
  const shift = { id: 's1', staffId: 'a', staffName: 'AJ', start: '2026-10-01T08:00:00.000Z', end: null, job: '=SUM(1)', hours: '' };
  assert.deepEqual(s.post({ action: 'upsert', kind: 'shift', value: shift }), { ok: true, v: 2 });
  assert.deepEqual(s.post({ action: 'upsert', kind: 'staff', value: { id: 'a', name: 'AJ', rate: 27 } }), { ok: true, v: 2 });
  const load1 = s.get({ action: 'load' });
  assert.equal(load1.v, 2);
  assert.equal(load1.shifts.length, 1);
  assert.equal(load1.shifts[0].job, '=SUM(1)');
  assert.equal(s.sheets.get('Shifts').rows[1][5], "'=SUM(1)");          // kept as text, never a formula
  assert.equal(load1.staff[0].rate, 27);
  s.post({ action: 'remove', kind: 'shift', id: 's1' });
  assert.equal(s.get().shifts.length, 0);
  assert.deepEqual(s.post({ action: 'nonsense' }), { ok: false, error: 'unknown action' });
});

test('a new job lands as a readable row, with its own lists', () => {
  const s = load();
  const { job, lists, meta } = newJob(['Full detail']);
  assert.deepEqual(s.post({ action: 'jobs', op: 'put', job, lists }), { ok: true, v: 2 });
  const rows = s.table('Jobs');
  assert.deepEqual(rows[0], ['id', 'date', 'customer', 'car', 'suburb', 'services', 'createdBy', 'createdAt', 'updatedAt', 'progress', 'status', 'sum', 'meta', 'state']);
  assert.deepEqual(rows[1].slice(0, 6), ['j1', '2026-10-01', 'Jo Smith', 'Tesla Model 3', 'Kambah', 'Full detail']);
  assert.equal(rows[1][9], '0/' + meta.steps.length);
  assert.equal(rows[1][10], 'In progress');
  assert.equal(s.table('Job lists').length, 1 + lists.length);

  const full = s.get({ action: 'job', id: 'j1' });
  assert.equal(full.v, 2);
  assert.deepEqual(full.job.lists.map(l => l.key), meta.templateKeys);
  assert.deepEqual(full.job.lists, plain(lists));
  assert.deepEqual(full.job.services, ['Full detail']);
  assert.equal(full.job.meta.rev, 'r1');
  assert.deepEqual(full.job.state, {});
  const light = s.get({ action: 'job', id: 'j1', lists: '0' });
  assert.equal(light.job.lists, undefined);
  assert.equal(s.get({ action: 'job', id: 'nope' }).job, null);
});

test('the job list is light: no ticks, no lists, filtered by date', () => {
  const s = load();
  s.post({ action: 'jobs', op: 'put', ...newJob(['Exterior detail'], { id: 'old', date: '2026-08-01' }) });
  s.post({ action: 'jobs', op: 'put', ...newJob(['Interior detail'], { id: 'new', date: '2026-09-30' }) });
  const r = s.get({ action: 'jobs', from: '2026-09-01' });
  assert.equal(r.v, 2);
  assert.deepEqual(r.jobs.map(j => j.id), ['new']);
  assert.equal(r.jobs[0].state, undefined);
  assert.equal(r.jobs[0].meta, undefined);
  assert.equal(r.jobs[0].sum.stage, 'working');
  assert.deepEqual(r.jobs[0].services, ['Interior detail']);
  assert.equal(s.get({ action: 'jobs' }).jobs.length, 2);
});

test('ticks from two phones merge, and the later one wins in any order', () => {
  const s = load();
  const { job, lists, meta } = newJob(['Interior detail']);
  s.post({ action: 'jobs', op: 'put', job, lists });
  const [a, b, c] = meta.steps;
  const early = { ['s:' + a]: { done: true, by: 'AJ', at: '2026-10-01T09:00:00.000Z' } };
  const late = { ['s:' + a]: { done: false, by: 'Nick', at: '2026-10-01T09:05:00.000Z' } };
  s.post({ action: 'jobs', op: 'patch', id: 'j1', set: { ['s:' + b]: { done: true, by: 'Nick', at: '2026-10-01T09:01:00.000Z' } } });
  s.post({ action: 'jobs', op: 'patch', id: 'j1', set: late });
  s.post({ action: 'jobs', op: 'patch', id: 'j1', set: early });           // arrives last, but is older
  s.post({ action: 'jobs', op: 'patch', id: 'j1', set: { ['s:' + c]: { skipped: true, reason: 'No mats', by: 'AJ', at: '2026-10-01T09:02:00.000Z' } } });
  const st = s.get({ action: 'job', id: 'j1', lists: '0' }).job.state;
  assert.equal(st['s:' + a].by, 'Nick');
  assert.equal(st['s:' + a].done, false);
  assert.equal(st['s:' + b].done, true);
  const row = s.table('Jobs')[1];
  assert.equal(row[9], '2/' + meta.steps.length);
  assert.deepEqual(JSON.parse(row[11]), plain(J.summary(meta, st)));
  assert.equal(s.post({ action: 'jobs', op: 'patch', id: 'missing', set: {} }).ok, false);
});

test('editing a job keeps its ticks; removing it takes its lists too', () => {
  const s = load();
  const first = newJob(['Exterior detail']);
  s.post({ action: 'jobs', op: 'put', ...first });
  s.post({ action: 'jobs', op: 'patch', id: 'j1', set: { 's:job-day-before-1': { done: true, by: 'AJ', at: '2026-10-01T09:00:00.000Z' } } });
  const second = newJob(['Exterior detail', 'Interior detail'], { car: 'Ford Ranger', rev: 'r2' });
  s.post({ action: 'jobs', op: 'put', ...second });
  const got = s.get({ action: 'job', id: 'j1' }).job;
  assert.equal(got.car, 'Ford Ranger');
  assert.equal(got.createdBy, 'AJ');
  assert.equal(got.meta.rev, 'r2');
  assert.equal(got.state['s:job-day-before-1'].done, true);
  assert.deepEqual(got.lists.map(l => l.key), ['every_job', 'exterior', 'interior', 'door_knock', 'handover', 'signoff']);
  assert.equal(s.table('Job lists').length, 7);
  assert.equal(s.table('Jobs')[1][5], 'Exterior detail, Interior detail');

  s.post({ action: 'jobs', op: 'put', ...newJob(['Exterior detail'], { id: 'j2' }) });
  s.post({ action: 'jobs', op: 'remove', id: 'j1' });
  assert.equal(s.get({ action: 'job', id: 'j1' }).job, null);
  assert.deepEqual(s.table('Job lists').slice(1).map(r => r[1]), ['j2', 'j2', 'j2', 'j2', 'j2']);
});

test('sign-off and done show in the status column', () => {
  const s = load();
  const { job, lists, meta } = newJob(['Exterior detail']);
  s.post({ action: 'jobs', op: 'put', job, lists });
  const set = {};
  meta.steps.forEach((id, n) => { set['s:' + id] = { done: true, by: 'AJ', at: '2026-10-01T09:' + String(n).padStart(2, '0') + ':00.000Z' }; });
  s.post({ action: 'jobs', op: 'patch', id: 'j1', set });
  assert.equal(s.table('Jobs')[1][10], 'Ready for sign-off');
  s.post({ action: 'jobs', op: 'patch', id: 'j1', set: { signoff: { by: 'Nick', at: '2026-10-01T11:00:00.000Z' } } });
  assert.equal(s.table('Jobs')[1][10], 'Signed off by Nick');
  s.post({ action: 'jobs', op: 'patch', id: 'j1', set: { done: { by: 'AJ', at: '2026-10-01T11:05:00.000Z' } } });
  assert.equal(s.table('Jobs')[1][10], 'Done');
});

test('a job that will not fit in a cell is refused, not cut short', () => {
  const s = load();
  s.post({ action: 'jobs', op: 'put', ...newJob(['Exterior detail']) });
  const r = s.post({ action: 'jobs', op: 'patch', id: 'j1', set: { 's:x': { note: 'x'.repeat(60000), at: '1' } } });
  assert.equal(r.ok, false);
  assert.match(r.error, /too big/);
  assert.equal(s.post({ action: 'jobs', op: 'put', job: { id: 'bad' } }).ok, false);
});

test('SOPs and their settings are kept in their own tab', () => {
  const s = load();
  assert.deepEqual(s.get({ action: 'sops' }), { ok: true, v: 2, sops: [], settings: null });
  for (const t of seed.templates.slice().reverse()) {
    s.post({ action: 'sops', op: 'put', sop: { ...t, updatedAt: '2026-10-01T00:00:00.000Z', by: 'Admin', rev: 'a' } });
  }
  s.post({ action: 'sops', op: 'settings', settings: { ...settings, rev: 's1' } });
  let r = s.get({ action: 'sops' });
  assert.deepEqual(r.sops.map(t => t.key), seed.templates.map(t => t.key));
  assert.equal(J.markdown(r.sops), readFileSync(here('fixtures/sops.md'), 'utf8'));
  assert.equal(r.settings.paintMin, 80);
  assert.equal(r.settings.rev, 's1');
  s.post({ action: 'sops', op: 'remove', key: 'ceramic' });
  r = s.get({ action: 'sops' });
  assert.ok(!r.sops.some(t => t.key === 'ceramic'));
  assert.equal(s.table('SOPs').find(row => row[0] === '_settings')[1], 'Services and paint limits');
});

test('the sheet counts a job with the same rules as the phone', () => {
  const body = (src, name) => {
    const at = src.indexOf('function ' + name + '(');
    let depth = 0, i = src.indexOf('{', at);
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      if (src[i] === '}' && --depth === 0) break;
    }
    return src.slice(at, i + 1).split('\n').map(l => l.trim()).join('\n');
  };
  const phone = readFileSync(here('../sop.js'), 'utf8');
  for (const name of ['merge', 'summary']) assert.equal(body(SCRIPT, name), body(phone, name), name);
});

test('the old script answers without v: 2, and files nothing for a job', () => {
  // This is why the app checks for v: 2 before it sends a checklist anywhere.
  const old = execFileSync('git', ['show', '0dc0464:sites/clock/apps-script.gs'], { cwd: new URL('..', import.meta.url) }).toString();
  const s = load(old);
  assert.equal(s.get({ action: 'sops' }).v, undefined);
  assert.equal(s.get({ action: 'jobs' }).v, undefined);
  const r = s.post({ action: 'jobs', op: 'put', ...newJob(['Exterior detail']) });
  assert.equal(r.ok, false);
  assert.equal(s.get().shifts.length, 0);
  assert.equal(s.sheets.get('Jobs'), undefined);
});
