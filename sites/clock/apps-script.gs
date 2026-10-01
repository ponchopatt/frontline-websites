/**
 * Imperium Detailing — timesheet backend.
 *
 * A Google Apps Script web app in front of one Google Sheet. The crew's phones
 * talk to it; the hours land in a spreadsheet Pat can read, fix and hand to an
 * accountant. Free, no card, and nobody needs an account to clock on.
 *
 * Setup is in README.md. Short version: paste this into Extensions > Apps
 * Script on a new Sheet, deploy as a web app with access set to "Anyone", and
 * put the deployment URL into ENDPOINT at the top of app.js.
 *
 * Version 2 adds the job checklists (the Jobs tab). Everything the timesheet
 * already did is unchanged, and every reply now says `v: 2` so the app knows
 * it can send checklists here. Updating an existing deployment: paste this
 * file over the old one, Save, then Deploy > Manage deployments > edit >
 * Version: New version > Deploy. The URL stays the same.
 */

var SHIFTS = 'Shifts';
var STAFF = 'Staff';
var SETTINGS = 'Settings';

// 'hours' is set only for a day nobody clocked on for, logged as a number
// because there are no real times to keep. See dayShift() in config.js.
var SHIFT_COLS = ['id', 'staffId', 'staffName', 'start', 'end', 'job', 'hours'];
var STAFF_COLS = ['id', 'name', 'rate'];

/** Writes from different phones can land in the same instant, so every write
 *  takes a short document lock. Without it two people clocking together can
 *  each read the same last row and overwrite one another. */
function withLock(fn) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function sheet(name, cols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (cols) sh.appendRow(cols);
    sh.setFrozenRows(1);
  }
  if (cols && sh.getLastRow() === 0) sh.appendRow(cols);
  // A sheet made before a column existed is missing it from the header row.
  // Put the full header back so a person reading the tab knows what is what.
  if (cols && sh.getLastColumn() < cols.length) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
  }
  return sh;
}

function readRows(name, cols) {
  var sh = sheet(name, cols);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;                       // blank or deleted line
    var obj = {};
    for (var c = 0; c < cols.length; c++) {
      var v = row[c];
      // Dates come back as Date objects; the app wants ISO strings.
      obj[cols[c]] = v instanceof Date ? v.toISOString() : v;
    }
    if (obj.end === '' || obj.end === null) obj.end = null;
    if (cols === STAFF_COLS) obj.rate = Number(obj.rate) || 0;
    if (cols === SHIFT_COLS) obj.hours = Number(obj.hours) || 0;
    out.push(obj);
  }
  return out;
}

function findRow(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return 0;
}

function upsert(name, cols, value) {
  return withLock(function () {
    var sh = sheet(name, cols);
    var row = [];
    for (var c = 0; c < cols.length; c++) {
      var v = value[cols[c]];
      // Every string is written with a leading apostrophe, which Sheets reads
      // as "this is text" and does not store. Without it a job note beginning
      // with "=" becomes a live formula, a phone number becomes a number, and
      // an ISO timestamp becomes a Date that reads back an hour off.
      row.push(v === null || v === undefined ? '' : (typeof v === 'string' ? "'" + v : v));
    }
    var at = findRow(sh, value.id);
    if (at) sh.getRange(at, 1, 1, cols.length).setValues([row]);
    else sh.appendRow(row);
    return true;
  });
}

function remove(name, cols, id) {
  return withLock(function () {
    var sh = sheet(name, cols);
    var at = findRow(sh, id);
    if (at) sh.deleteRow(at);
    return true;
  });
}

function readSettings() {
  var sh = sheet(SETTINGS, ['key', 'value']);
  var last = sh.getLastRow();
  var out = {};
  if (last < 2) return out;
  var rows = sh.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0]) out[String(rows[i][0])] = String(rows[i][1]);
  }
  return out;
}

function writeSettings(value) {
  return withLock(function () {
    var sh = sheet(SETTINGS, ['key', 'value']);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
    var rows = [];
    for (var k in value) {
      if (Object.prototype.hasOwnProperty.call(value, k)) rows.push([k, "'" + String(value[k])]);
    }
    if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
    return true;
  });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'jobs') return json({ ok: true, v: 2, jobs: listJobs(String(p.from || '')) });
    if (p.action === 'job') return json({ ok: true, v: 2, job: getJob(String(p.id || ''), p.lists !== '0') });
    if (p.action === 'sops') {
      var sops = readSops();
      return json({ ok: true, v: 2, sops: sops.sops, settings: sops.settings });
    }
    return json({
      ok: true,
      v: 2,
      staff: readRows(STAFF, STAFF_COLS),
      shifts: readRows(SHIFTS, SHIFT_COLS),
      settings: readSettings(),
    });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'settings') {
      writeSettings(body.value || {});
    } else if (body.action === 'upsert') {
      if (body.kind === 'staff') upsert(STAFF, STAFF_COLS, body.value);
      else upsert(SHIFTS, SHIFT_COLS, body.value);
    } else if (body.action === 'remove') {
      var id = body.value ? body.value.id : body.id;
      if (body.kind === 'staff') remove(STAFF, STAFF_COLS, id);
      else remove(SHIFTS, SHIFT_COLS, id);
    } else if (body.action === 'jobs') {
      writeJob(body);
    } else if (body.action === 'sops') {
      writeSop(body);
    } else {
      return json({ ok: false, error: 'unknown action' });
    }
    return json({ ok: true, v: 2 });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ========================================================= job checklists ==
 * Version 2. Three more tabs in the same spreadsheet, made the first time
 * they are needed:
 *
 *   Jobs        one row per job: the day, the customer, the car, the services,
 *               how far along it is and who signed it off. Those columns are
 *               for a person reading the sheet. The last three (sum, meta,
 *               state) are the app's own: the ids on its checklist and every
 *               tick, as JSON.
 *   Job lists   each job's own copy of its SOP lists, one list per row. A job
 *               keeps the lists it started with, whatever is edited later.
 *   SOPs        the SOP templates, one per row, plus a _settings row for which
 *               lists each service gets and the paint gauge limits.
 *
 * Ticks are merged here, key by key, under the document lock, and the later
 * tick wins whichever order they arrive in. So two phones ticking the same job
 * never overwrite each other's work.
 */

var JOBS = 'Jobs';
var JOB_COLS = ['id', 'date', 'customer', 'car', 'suburb', 'services', 'createdBy', 'createdAt',
  'updatedAt', 'progress', 'status', 'sum', 'meta', 'state'];
var LISTS = 'Job lists';
var LIST_COLS = ['id', 'jobId', 'template', 'json'];
var SOPS = 'SOPs';
var SOP_COLS = ['id', 'name', 'sort', 'updatedAt', 'by', 'json'];
var CELL_MAX = 49000;            // a cell holds 50,000 characters

function asText(v) {
  return v === null || v === undefined ? '' : (typeof v === 'string' ? "'" + v : v);
}
function parse(s, fallback) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch (err) { return fallback; }
}
function ymdOf(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '');
}
function rowObject(cols, values) {
  var o = {};
  for (var c = 0; c < cols.length; c++) {
    var v = values[c];
    o[cols[c]] = v instanceof Date ? v.toISOString() : (v === undefined ? '' : v);
  }
  return o;
}
function toRow(cols, o) {
  var row = [];
  for (var c = 0; c < cols.length; c++) row.push(asText(o[cols[c]]));
  return row;
}
function fits(text, what) {
  if (String(text).length > CELL_MAX) throw new Error(what + ' is too big for one cell');
  return text;
}
// Row numbers whose column `col` (1-based) equals `value`, top to bottom.
function rowsWhere(sh, col, value) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, col, last - 1, 1).getValues(), out = [];
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) out.push(i + 2);
  return out;
}

function statusText(sum) {
  if (sum.stage === 'done') return 'Done';
  if (sum.stage === 'signed') return sum.signedBy ? 'Signed off by ' + sum.signedBy : 'Let through by ' + sum.overrideBy;
  if (sum.stage === 'ready') return 'Ready for sign-off';
  return 'In progress';
}

function jobOut(o, full) {
  var job = {
    id: String(o.id),
    date: ymdOf(o.date),
    customer: String(o.customer || ''),
    car: String(o.car || ''),
    suburb: String(o.suburb || ''),
    services: String(o.services || '').split(', ').filter(function (x) { return x; }),
    createdBy: String(o.createdBy || ''),
    createdAt: String(o.createdAt || ''),
    updatedAt: String(o.updatedAt || ''),
    sum: parse(o.sum, null),
  };
  if (full) {
    job.meta = parse(o.meta, {});
    job.state = parse(o.state, {});
    if (job.meta.services) job.services = job.meta.services;
  }
  return job;
}

/* The list the Jobs tab shows. Reads only up to the sum column, never the
   ticks, so it stays quick as the sheet grows. */
function listJobs(from) {
  var sh = sheet(JOBS, JOB_COLS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var n = JOB_COLS.indexOf('sum') + 1;
  var values = sh.getRange(2, 1, last - 1, n).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (!values[i][0]) continue;
    var job = jobOut(rowObject(JOB_COLS.slice(0, n), values[i]), false);
    if (from && job.date < from) continue;
    out.push(job);
  }
  return out;
}

function readJobRow(sh, at) {
  return rowObject(JOB_COLS, sh.getRange(at, 1, 1, JOB_COLS.length).getValues()[0]);
}

function getJob(id, withLists) {
  if (!id) return null;
  var sh = sheet(JOBS, JOB_COLS);
  var at = findRow(sh, id);
  if (!at) return null;
  var job = jobOut(readJobRow(sh, at), true);
  if (withLists) {
    var lsh = sheet(LISTS, LIST_COLS), order = job.meta.templateKeys || [], lists = [];
    var rows = rowsWhere(lsh, 2, id);
    for (var i = 0; i < rows.length; i++) {
      var r = rowObject(LIST_COLS, lsh.getRange(rows[i], 1, 1, LIST_COLS.length).getValues()[0]);
      var list = parse(r.json, null);
      if (list) lists.push(list);
    }
    lists.sort(function (a, b) { return order.indexOf(a.key) - order.indexOf(b.key); });
    job.lists = lists;
  }
  return job;
}

function writeJobRow(sh, at, o) {
  var row = toRow(JOB_COLS, o);
  if (at) sh.getRange(at, 1, 1, JOB_COLS.length).setValues([row]);
  else sh.appendRow(row);
}

function writeJob(body) {
  return withLock(function () {
    var sh = sheet(JOBS, JOB_COLS);
    if (body.op === 'remove') {
      var gone = findRow(sh, body.id);
      if (gone) sh.deleteRow(gone);
      var lsh = sheet(LISTS, LIST_COLS), rows = rowsWhere(lsh, 2, body.id);
      for (var i = rows.length - 1; i >= 0; i--) lsh.deleteRow(rows[i]);
      return true;
    }

    if (body.op === 'patch') {
      var at = findRow(sh, body.id);
      if (!at) throw new Error('no job ' + body.id);
      var o = readJobRow(sh, at);
      var meta = parse(o.meta, {});
      var state = merge(parse(o.state, {}), body.set || {});
      var sum = summary(meta, state);
      o.updatedAt = new Date().toISOString();
      o.progress = sum.done + '/' + sum.total;
      o.status = statusText(sum);
      o.sum = JSON.stringify(sum);
      o.state = fits(JSON.stringify(state), 'This job');
      o.meta = JSON.stringify(meta);
      writeJobRow(sh, at, o);
      return true;
    }

    if (body.op === 'put') {
      var j = body.job || {};
      if (!j.id || !/^\d{4}-\d{2}-\d{2}$/.test(String(j.date || ''))) throw new Error('a job needs an id and a date');
      var where = findRow(sh, j.id);
      var old = where ? readJobRow(sh, where) : null;
      var m = j.meta || (old ? parse(old.meta, {}) : {});
      m.services = j.services || [];
      m.rev = j.rev || '';
      var st = merge(old ? parse(old.state, {}) : {}, body.state || {});
      var su = summary(m, st);
      // The lists go in before the row: a row carrying this rev means its lists are there too.
      if (body.lists) {
        var ls = sheet(LISTS, LIST_COLS), mine = rowsWhere(ls, 2, j.id);
        for (var k = mine.length - 1; k >= 0; k--) ls.deleteRow(mine[k]);
        for (var t = 0; t < body.lists.length; t++) {
          var list = body.lists[t];
          ls.appendRow(toRow(LIST_COLS, {
            id: j.id + '|' + list.key, jobId: j.id, template: list.key,
            json: fits(JSON.stringify(list), 'The ' + list.name + ' list'),
          }));
        }
      }
      writeJobRow(sh, where, {
        id: j.id,
        date: j.date,
        customer: j.customer || '',
        car: j.car || '',
        suburb: j.suburb || '',
        services: (j.services || []).join(', '),
        createdBy: old ? old.createdBy : (j.createdBy || ''),
        createdAt: old ? old.createdAt : (j.createdAt || new Date().toISOString()),
        updatedAt: new Date().toISOString(),
        progress: su.done + '/' + su.total,
        status: statusText(su),
        sum: JSON.stringify(su),
        meta: fits(JSON.stringify(m), 'This job'),
        state: fits(JSON.stringify(st), 'This job'),
      });
      return true;
    }
    throw new Error('unknown job op');
  });
}

function readSops() {
  var sh = sheet(SOPS, SOP_COLS);
  var last = sh.getLastRow(), sops = [], settings = null;
  if (last < 2) return { sops: sops, settings: settings };
  var values = sh.getRange(2, 1, last - 1, SOP_COLS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var o = rowObject(SOP_COLS, values[i]);
    if (!o.id) continue;
    var v = parse(o.json, null);
    if (!v) continue;
    if (String(o.id) === '_settings') settings = v;
    else sops.push(v);
  }
  sops.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  return { sops: sops, settings: settings };
}

function writeSop(body) {
  return withLock(function () {
    var sh = sheet(SOPS, SOP_COLS);
    if (body.op === 'remove') {
      var at = findRow(sh, body.key);
      if (at) sh.deleteRow(at);
      return true;
    }
    var v = body.op === 'settings' ? body.settings : body.sop;
    if (!v || (body.op === 'put' && !v.key)) throw new Error('nothing to save');
    var id = body.op === 'settings' ? '_settings' : v.key;
    var row = toRow(SOP_COLS, {
      id: id,
      name: body.op === 'settings' ? 'Services and paint limits' : v.name,
      sort: body.op === 'settings' ? 0 : (v.sort || 0),
      updatedAt: v.updatedAt || new Date().toISOString(),
      by: v.by || '',
      json: fits(JSON.stringify(v), 'That SOP'),
    });
    var where = findRow(sh, id);
    if (where) sh.getRange(where, 1, 1, SOP_COLS.length).setValues([row]);
    else sh.appendRow(row);
    return true;
  });
}

/* The two rules below are copied word for word from sop.js, so the sheet and
   the phones count a job the same way. A test fails if they ever differ. */

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
