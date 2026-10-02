// The checklist rules. Run from sites/clock with: node --test test/*.test.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// sop.js is a plain browser script; run it the way the page does.
process.env.TZ = 'Australia/Sydney';
const here = f => new URL(f, import.meta.url);
vm.runInThisContext(readFileSync(here('../sop.js'), 'utf8'));
const J = globalThis.ImpSop;
const seed = () => JSON.parse(readFileSync(here('../sops.json'), 'utf8'));
const set = (s = seed()) => ({ ...s.settings, services: s.services });
const build = (services, s = seed()) => J.build([].concat(services), s.templates, set(s));
const itemsOf = (lists, key) => lists.find(t => t.key === key).sections.flatMap(s => s.items);
const stepTitles = (lists, key) => itemsOf(lists, key).filter(i => i.type === 'step').map(i => i.title || i.detail);
const NOW = '2026-10-01T09:00:00.000Z';

test('the SOPs are the Appendix word for word', () => {
  assert.equal(J.markdown(seed().templates), readFileSync(here('fixtures/sop-appendix.md'), 'utf8'));
});

test('every step, rule and sign-off check has a How to do it', () => {
  let n = 0;
  J.eachItem(seed().templates, it => {
    if (!['step', 'rule', 'signoff'].includes(it.type)) return;
    n++;
    assert.ok(typeof it.more === 'string' && it.more.length > 40, it.id);
    assert.ok(it.more.length < 520, `${it.id} is too long to read on a phone`);
  });
  assert.equal(n, 105);
});

test('each service gets its lists in order, without repeats', () => {
  const keys = s => build(s).meta.templateKeys;
  assert.deepEqual(keys('Exterior detail'), ['every_job', 'exterior', 'handover', 'signoff']);
  assert.deepEqual(keys('Interior detail'), ['every_job', 'interior', 'handover', 'signoff']);
  assert.deepEqual(keys('Full detail'), ['every_job', 'exterior', 'interior', 'handover', 'signoff']);
  assert.deepEqual(keys('Paint correction'), ['every_job', 'exterior', 'correction', 'handover', 'signoff']);
  assert.deepEqual(keys('Ceramic coating'), ['every_job', 'exterior', 'correction', 'ceramic', 'handover', 'signoff']);
  // Two services: combined, no repeats, in the templates' own order.
  assert.deepEqual(keys(['Interior detail', 'Paint correction']),
    ['every_job', 'exterior', 'interior', 'correction', 'handover', 'signoff']);
  // A service nobody has mapped gets everything rather than nothing.
  assert.deepEqual(keys('Something new'), seed().templates.map(t => t.key));
});

test('correction and ceramic stop the exterior steps at the rinse after clay', () => {
  for (const s of ['Paint correction', 'Ceramic coating']) {
    const ext = stepTitles(build(s).lists, 'exterior');
    assert.equal(ext.length, 7, s);
    assert.deepEqual(ext.slice(-2), ['Clay.', 'Rinse'], s);
    assert.ok(!ext.includes('Ceramic sealant.'), s);
  }
  assert.equal(stepTitles(build('Exterior detail').lists, 'exterior').length, 14);
  assert.equal(itemsOf(build('Ceramic coating').lists, 'exterior').filter(i => i.type === 'clip').length, 11);
  assert.equal(seed().services['Ceramic coating'].stopAfter.exterior, 'ext-steps-7');
});

test('sign-off shows only what applies to the service', () => {
  const sign = s => itemsOf(build(s).lists, 'signoff').map(i => i.detail);
  const ext = sign('Exterior detail');
  assert.ok(ext.includes('Tape all removed') && !ext.includes('No strong smell'));
  assert.ok(!ext.some(d => /\((correction and coating|coating)( jobs)?\)$/.test(d)), ext.join('; '));
  assert.equal(ext.length, 7);
  assert.ok(sign('Interior detail').includes('No strong smell') && !sign('Interior detail').includes('Tape all removed'));
  const cor = sign('Paint correction');
  assert.ok(cor.includes('LED check done on every panel (correction and coating jobs)'));
  assert.ok(cor.includes('Paint readings and stages written down (correction and coating)'));
  assert.ok(!cor.includes('Warranty record done (coating)') && !cor.includes('No strong smell'));
  assert.ok(sign('Ceramic coating').includes('Warranty record done (coating)'));
  assert.equal(sign('Interior detail').length, 7);
  assert.equal(sign('Full detail').length, 12);
  assert.equal(sign('Paint correction').length, 9);
  assert.equal(sign('Ceramic coating').length, 10);
  assert.equal(build('Ceramic coating').meta.signoffs.length, 10);
});

test('the extra boxes are hung off the right steps', () => {
  const tools = {};
  J.eachItem(seed().templates, it => { if (it.tool) tools[it.tool] = it.title; if (it.combos) tools.combos = it.title; });
  assert.deepEqual(tools, { paint: 'Measure paint', combos: 'Test spot.', correction: 'Record', warranty: 'Record for the warranty:' });
});

test('editing an SOP never changes a job that has started', () => {
  const s = seed();
  const old = build('Exterior detail', s);
  const before = JSON.stringify(old.lists);
  const ext = s.templates.find(t => t.key === 'exterior');
  ext.sections[0].items[0].title = 'Wheels, tyres and arches.';
  ext.sections[0].items[0].more = 'New words.';
  ext.sections[0].items.splice(1, 1);
  assert.equal(JSON.stringify(old.lists), before);
  assert.equal(itemsOf(old.lists, 'exterior')[0].title, 'Wheels and tyres.');
  const fresh = build('Exterior detail', s);
  assert.equal(itemsOf(fresh.lists, 'exterior')[0].title, 'Wheels, tyres and arches.');
  assert.equal(stepTitles(fresh.lists, 'exterior').length, 13);
});

test('progress counts steps done or skipped; clips and sign-off are counted apart', () => {
  const { meta } = build('Exterior detail');
  let st = {};
  assert.equal(J.summary(meta, st).total, 3 + 1 + 5 + 14 + 7 + 4);
  st = J.merge(st, J.tickPatch(st, meta.steps[0], 'AJ', '1'));
  st = J.merge(st, J.skipPatch(st, meta.steps[1], 'AJ', 'No tap', '2'));
  st = J.merge(st, J.tickPatch(st, meta.clips[0], 'AJ', '3'));
  const s = J.summary(meta, st);
  assert.equal(s.done, 2);
  assert.equal(s.skipped, 1);
  assert.equal(s.clipsDone, 1);
  assert.equal(s.clipsTotal, 11);
  assert.equal(s.stage, 'working');
  assert.throws(() => J.skipPatch(st, meta.steps[2], 'AJ', '  ', '4'), /why/);
  // A second tap takes the tick back.
  st = J.merge(st, J.tickPatch(st, meta.steps[0], 'AJ', '5'));
  assert.equal(J.summary(meta, st).done, 1);
});

test('a note keeps the tick and who did it', () => {
  const { meta } = build('Interior detail');
  const id = meta.steps[4];
  let st = J.merge({}, J.tickPatch({}, id, 'Nick', '2026-10-01T01:00:00Z'));
  st = J.merge(st, J.notePatch(st, id, 'Lucas', ' Coffee stain on the rear seat ', '2026-10-01T02:00:00Z'));
  assert.deepEqual(st['s:' + id], { done: true, by: 'Nick', at: '2026-10-01T02:00:00Z', note: 'Coffee stain on the rear seat', noteBy: 'Lucas' });
  st = J.merge(st, J.tickPatch(st, id, 'Nick', '2026-10-01T03:00:00Z'));
  assert.equal(st['s:' + id].note, 'Coffee stain on the rear seat');
});

test('the later tick wins, whatever order the writes arrive in', () => {
  const a = { 's:x': { done: true, by: 'AJ', at: '2026-10-01T01:00:00Z' } };
  const b = { 's:x': { done: false, by: 'Gus', at: '2026-10-01T02:00:00Z' } };
  assert.deepEqual(J.merge(J.merge({}, a), b), J.merge(J.merge({}, b), a));
  assert.equal(J.merge(J.merge({}, b), a)['s:x'].by, 'Gus');
});

const allDone = (meta, by) => {
  let st = {};
  meta.steps.forEach((id, n) => { st = J.merge(st, J.tickPatch(st, id, by, '2026-10-01T00:' + String(n).padStart(2, '0') + ':00Z')); });
  return st;
};

test('the person who did most of the job cannot sign it off', () => {
  const { meta } = build('Interior detail');
  assert.equal(J.canSignOff(meta, {}, 'Nick').reason, 'steps');
  let st = allDone(meta, 'AJ');
  st['s:' + meta.steps[0]].by = 'Nick';
  assert.equal(J.summary(meta, st).main, 'AJ');
  assert.equal(J.summary(meta, st).stage, 'ready');
  assert.equal(J.canSignOff(meta, st, 'AJ').reason, 'same');
  assert.equal(J.canSignOff(meta, st, '').reason, 'who');
  assert.equal(J.canSignOff(meta, st, 'Nick').ok, true);
  assert.equal(J.signOffPatch(meta, st, 'Nick', NOW), null);       // the checks aren't ticked yet
  meta.signoffs.forEach(id => { st = J.merge(st, J.tickPatch(st, id, 'Nick', NOW)); });
  assert.deepEqual(J.signOffPatch(meta, st, 'Nick', NOW), { signoff: { by: 'Nick', at: NOW } });
  assert.equal(J.signOffPatch(meta, st, 'AJ', NOW), null);
  st = J.merge(st, J.signOffPatch(meta, st, 'Nick', NOW));
  assert.equal(J.summary(meta, st).stage, 'signed');
  assert.equal(J.locked(st), true);
  assert.equal(J.canSignOff(meta, st, 'Gus').reason, 'signed');
  // A tie goes to whoever ticked last.
  let t = J.merge({}, J.tickPatch({}, meta.steps[0], 'AJ', '2026-10-01T01:00:00Z'));
  t = J.merge(t, J.tickPatch(t, meta.steps[1], 'Nick', '2026-10-01T02:00:00Z'));
  assert.equal(J.summary(meta, t).main, 'Nick');
});

test('no job is done without a sign-off, unless admin lets it through', () => {
  const { meta } = build('Exterior detail');
  let st = allDone(meta, 'AJ');
  assert.equal(J.finishPatch(meta, st, 'AJ', NOW), null);
  assert.throws(() => J.overridePatch(false, 'AJ', 'Customer had to leave', NOW), /Only admin/);
  assert.throws(() => J.overridePatch(true, 'Gus', '   ', NOW), /Write why/);
  st = J.merge(st, J.overridePatch(true, 'Gus', 'Customer had to leave', NOW));
  assert.equal(J.summary(meta, st).stage, 'signed');
  assert.equal(J.summary(meta, st).overrideReason, 'Customer had to leave');
  st = J.merge(st, J.finishPatch(meta, st, 'AJ', '2026-10-01T09:30:00.000Z'));
  assert.equal(J.summary(meta, st).stage, 'done');
  assert.equal(J.summary(meta, st).finishedBy, 'AJ');
  // Reopening is admin only and puts it back to waiting on the check.
  assert.throws(() => J.reopenPatch(false, 'AJ', NOW), /Only admin/);
  st = J.merge(st, J.reopenPatch(true, 'Gus', '2026-10-01T10:00:00.000Z'));
  assert.equal(J.summary(meta, st).stage, 'ready');
  assert.equal(J.locked(st), false);
});

test('up next is the first step not done, in checklist order', () => {
  const { meta, lists } = build('Exterior detail');
  assert.equal(J.nextStep(lists, {}).item.id, 'job-day-before-1');
  let st = {};
  meta.steps.slice(0, 9).forEach(id => { st = J.merge(st, J.tickPatch(st, id, 'AJ', '1')); });
  const n = J.nextStep(lists, st);
  assert.equal(n.item.title, 'Wheels and tyres.');
  assert.equal(n.template.key, 'exterior');
  assert.deepEqual(J.counts(lists[0], st), { done: 9, total: 9, clipsDone: 0, clipsTotal: 0, signDone: 0, signTotal: 0 });
  assert.equal(J.nextStep(lists, allDone(meta, 'AJ')), null);
});

test('paint readings: under 80 or a jump over 30 is a light-touch panel, and both limits come from settings', () => {
  const f = J.paintFlags({ r: [110, 95, 78, '', 120] }, set());
  assert.deepEqual([f.low, f.spread, f.bigJump, f.light, f.count, f.average], [[2], 42, true, true, 4, 101]);
  const ok = J.paintFlags({ r: [110, 95, 100, 105, 120] }, set());
  assert.equal(ok.light, false);
  assert.equal(J.paintFlags({ r: [110, 95, 78] }, { paintMin: 70, paintSpread: 40 }).light, false);
});

test('handover: the right pitch for the service, with the car filled in', () => {
  const job = { car: 'Raptor' };
  const full = build('Full detail');
  const s = J.scripts(full.lists, full.meta, job);
  assert.deepEqual(s.map(x => x.key), ['pitch', 'referral', 'review']);
  assert.equal(s[0].label, 'Ceramic pitch (full detail customers)');
  assert.match(s[0].text, /^So it looks like this now\..*Want me to send you a price for the Raptor\?$/);
  assert.equal(s[1].text, 'If a mate books, you get $50 off your next one.');
  const cer = build('Ceramic coating');
  assert.equal(J.scripts(cer.lists, cer.meta, job)[0].label, 'Maintenance plan pitch (ceramic customers)');
  assert.equal(build(['Full detail', 'Ceramic coating']).meta.pitch, 'plan');
});

test('warranty fills from the job, annual check a year on', () => {
  assert.deepEqual(J.warrantyDefaults({ customer: 'Jo Smith', car: 'Raptor', date: '2026-10-01' }), {
    customer: 'Jo Smith', car: 'Raptor', rego: '', date: '2026-10-01', package: '', product: '', batch: '',
    layers: '', photos: '', annualCheck: '2027-10-01',
  });
  assert.equal(J.addYear('2028-02-29'), '2029-02-28');
});

test('dashboard: jobs not signed off, and the 30-day numbers', () => {
  const job = (id, date, sum) => ({ id, date, sum: { skipped: 0, clipsDone: 0, clipsTotal: 0, pitch: 'ceramic', stage: 'working', ...sum } });
  const jobs = [
    job('wed', '2026-09-30'), job('signed', '2026-09-29', { stage: 'signed' }), job('ready', '2026-09-28', { stage: 'ready' }),
    job('old', '2026-09-20'), job('today', '2026-10-01'), job('tomorrow', '2026-10-02'),
  ];
  assert.deepEqual(J.unsigned(jobs, '2026-09-24', '2026-10-01').map(j => j.id), ['ready', 'wed']);

  const a = build('Full detail'), b = build('Ceramic coating');
  let sa = {};
  sa = J.merge(sa, J.skipPatch(sa, a.meta.steps[0], 'AJ', 'x', '1'));
  sa = J.merge(sa, J.skipPatch(sa, a.meta.steps[1], 'AJ', 'y', '2'));
  sa = J.merge(sa, J.tickPatch(sa, a.meta.clips[0], 'AJ', '3'));
  sa = J.merge(sa, J.valuePatch('ceramicPitched', 'Yes', 'AJ', '4'));
  let sb = J.merge({}, J.tickPatch({}, b.meta.clips[0], 'AJ', '3'));
  sb = J.merge(sb, J.valuePatch('planPitched', 'No', 'AJ', '4'));
  const st = J.stats([
    { date: '2026-09-20', sum: J.summary(a.meta, sa) },
    { date: '2026-10-01', sum: J.summary(b.meta, sb) },
    { date: '2026-08-01', sum: J.summary(a.meta, {}) },
  ], '2026-10-01', 30);
  assert.equal(st.jobs, 2);
  assert.equal(st.skippedPerJob, 1);
  assert.equal(st.clipsFilmed, 2);
  assert.equal(st.clipsExpected, a.meta.clips.length + b.meta.clips.length);
  assert.equal(st.ceramicPitchedRate, 1);
  assert.equal(st.planPitchedRate, 0);
  assert.equal(st.signedRate, 0);
});

test('a job list fits in a Google Sheet cell, one list per cell', () => {
  for (const t of build(['Full detail', 'Ceramic coating']).lists) {
    assert.ok(JSON.stringify(t).length < 45000, t.key);
  }
});

test('the summary picture: steps by stage, notes and skips in order, who did it', () => {
  const { meta, lists } = build('Full detail');
  let st = allDone(meta, 'AJ');
  st = J.merge(st, J.tickPatch(st, 'int-steps-1', 'Lucas', '2026-10-01T05:00:00Z'));
  st = J.merge(st, J.tickPatch(st, 'int-steps-1', 'Lucas', '2026-10-01T05:01:00Z'));
  st = J.merge(st, J.skipPatch(st, 'ext-steps-12', 'Lucas', 'Customer asked for no tyre shine', '2026-10-01T05:02:00Z'));
  st = J.merge(st, J.notePatch(st, 'ext-steps-6', 'Lucas', 'Heavy sap on the roof', '2026-10-01T05:03:00Z'));
  st = J.merge(st, J.notePatch(st, 'job-on-arrival-2', 'AJ', 'Kerbed rear left wheel, photo taken', '2026-10-01T05:04:00Z'));
  const r = J.report(lists, meta, st);
  assert.equal(r.sum.done, 46);          // a skip still settles the step
  assert.equal(r.sum.total, 46);
  assert.equal(r.sum.skipped, 1);
  assert.deepEqual(r.stages.map(s => [s.name, s.done, s.total]), [
    ['Rules for every job', 9, 9], ['Exterior detail', 14, 14], ['Interior detail', 12, 12], ['Handover and after', 11, 11],
  ]);
  assert.deepEqual(r.notes.map(n => [n.step, n.note, n.by]), [
    ['Walk around the car with the customer', 'Kerbed rear left wheel, photo taken', 'AJ'],
    ['Clay', 'Heavy sap on the roof', 'Lucas'],
  ]);
  assert.deepEqual(r.skipped, [{ step: 'Tyre shine', stage: 'exterior', reason: 'Customer asked for no tyre shine', by: 'Lucas' }]);
  assert.deepEqual(r.crew, ['AJ', 'Lucas']);
  assert.deepEqual([r.clipsDone, r.clipsTotal, r.checksDone, r.checksTotal], [0, 22, 0, 12]);
  assert.equal(J.label({ detail: 'Send the on-our-way text with a real arrival time.' }), 'Send the on-our-way text with a real arrival\u2026');
});

