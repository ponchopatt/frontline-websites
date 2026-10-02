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

test('the SOPs export word for word as their source', () => {
  assert.equal(J.markdown(seed().templates), readFileSync(here('fixtures/sops.md'), 'utf8'));
});

test('every step, rule and sign-off check has a How to do it', () => {
  let n = 0;
  J.eachItem(seed().templates, it => {
    if (!['step', 'rule', 'signoff'].includes(it.type)) return;
    n++;
    assert.ok(typeof it.more === 'string' && it.more.length > 40, it.id);
    assert.ok(it.more.length < 520, `${it.id} is too long to read on a phone`);
  });
  assert.equal(n, 138);
});

test('each service gets its lists in order, without repeats', () => {
  const keys = s => build(s).meta.templateKeys;
  assert.deepEqual(keys('Exterior detail'), ['every_job', 'exterior', 'door_knock', 'handover', 'signoff']);
  assert.deepEqual(keys('Interior detail'), ['every_job', 'interior', 'door_knock', 'handover', 'signoff']);
  assert.deepEqual(keys('Full detail'), ['every_job', 'exterior', 'interior', 'door_knock', 'handover', 'signoff']);
  assert.deepEqual(keys('Paint correction'), ['every_job', 'exterior', 'correction', 'door_knock', 'handover', 'signoff']);
  assert.deepEqual(keys('Ceramic coating'), ['every_job', 'exterior', 'correction', 'ceramic', 'door_knock', 'handover', 'signoff']);
  assert.deepEqual(keys('Maintenance wash'), ['every_job', 'maintenance', 'door_knock', 'handover', 'signoff']);
  assert.deepEqual(Object.keys(seed().services),
    ['Exterior detail', 'Interior detail', 'Full detail', 'Paint correction', 'Ceramic coating', 'Maintenance wash']);
  // Two services: combined, no repeats, in the templates' own order.
  assert.deepEqual(keys(['Interior detail', 'Paint correction']),
    ['every_job', 'exterior', 'interior', 'correction', 'door_knock', 'handover', 'signoff']);
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
  // A ceramic job gets no sealant, so it has no sealant beading clip.
  assert.equal(itemsOf(build('Ceramic coating').lists, 'exterior').filter(i => i.type === 'clip').length, 15);
  assert.equal(itemsOf(build('Paint correction').lists, 'exterior').filter(i => i.type === 'clip').length, 16);
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
  // Maintenance is inside and out: both lists, no LED or coating checks.
  assert.equal(sign('Maintenance wash').length, 12);
  assert.ok(sign('Maintenance wash').includes('Tape all removed') && sign('Maintenance wash').includes('No strong smell'));
});

test('the extra boxes are hung off the right steps', () => {
  const tools = {};
  J.eachItem(seed().templates, it => { if (it.tool) tools[it.tool] = it.title; if (it.combos) tools.combos = it.title; });
  assert.deepEqual(tools, { paint: 'Measure paint', combos: 'Test spot.', correction: 'Record', warranty: 'Record for the warranty:', quote: 'Price it' });
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
  assert.equal(s.clipsTotal, 16);          // 5 story videos and 11 reel clips
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
  assert.deepEqual([r.clipsDone, r.clipsTotal, r.checksDone, r.checksTotal], [0, 31, 0, 12]);
  assert.equal(J.label({ detail: 'Send the on-our-way text with a real arrival time.' }), 'Send the on-our-way text with a real arrival\u2026');
});

const stepsOf = (lists, key) => itemsOf(lists, key).filter(i => i.type === 'step');
const find = (lists, key, re) => itemsOf(lists, key).find(i => re.test((i.title || '') + ' ' + i.detail));

test('the new wording: acid only without chrome, the Green Star mix, polish technique, cards', () => {
  const full = build(['Full detail', 'Paint correction']).lists;
  const wheels = find(full, 'exterior', /^Wheels and tyres/);
  assert.deepEqual(wheels.subs, [
    'Dirty rims with no chrome: use the acid wheel cleaner. Never acid on chrome.',
    "Wheels bucket: 1 or 2 capfuls of Green Star, measured with the bottle's lid.",
  ]);
  // Green Star: 1:3 with the touch wash chemical in the foam cannon, a capful or two in each bucket.
  assert.equal(find(full, 'exterior', /^Pre-wash/).subs[0], 'Foam cannon: Green Star and the touch wash chemical, 1:3, 100 ml in total, the rest water. It neutralises any acid from the wheels.');
  assert.equal(find(full, 'exterior', /^Touch wash/).subs[0], "Touch wash bucket: 1 or 2 capfuls of Green Star, measured with the bottle's lid.");
  // The polish technique sits on the first polishing step: the 50/50 on the worst panel.
  const polish = find(full, 'correction', /^50\/50 on the worst panel/);
  assert.match(polish.detail, /Run one strip of tape down the middle\. Polish one side/);
  assert.match(find(full, 'correction', /^Do the whole car/).detail, /starting with the other half of the worst panel/);
  assert.deepEqual(polish.subs, [
    'Polish on the pad: 4 to 5 pea-sized drops, north, south, east and west of the centre, or in a star shape.',
    "Stamp the pad on the panel or area you're doing first. Spread it on the lowest speed, then go up to normal speed.",
    'Normal speed: microfibre pad speed 4, foam pad speed 5.',
  ]);
  assert.match(find(full, 'interior', /^Finish/).detail, /review card and business card inside the cover or on the middle console/);
  assert.match(find(full, 'handover', /^Review ask/).detail, /New customer\? Check the review card and business card are on the steering wheel cover or the middle console\. Not there yet\? Leave them now\./);
  assert.match(full.find(t => t.key === 'correction').intro, /Goal: 2 to 3 hours, exterior included\.$/);
  assert.match(build('Ceramic coating').lists.find(t => t.key === 'ceramic').intro, /Goal: 4 to 5 hours on site\.$/);
  // Story videos, before the reel clips.
  const ext = full.find(t => t.key === 'exterior').sections.map(s => s.name);
  assert.deepEqual(ext.slice(1), ['Exterior story videos', 'Exterior clips to film']);
  assert.deepEqual(itemsOf(full, 'exterior').filter(i => i.type === 'clip').slice(0, 3).map(i => i.title),
    ['Front 3/4 of the whole car, slow pan', 'Same angle, foamed up', 'Same angle, exterior done']);
  assert.match(itemsOf(full, 'interior').find(i => i.type === 'clip' && i.when === 'after').title, /steering wheel cover on/);
});

test('maintenance: its own steps, both sign-off lists, and no pitch or review asks', () => {
  const { lists, meta } = build('Maintenance wash');
  const m = lists.find(t => t.key === 'maintenance');
  assert.deepEqual(m.sections.map(s => s.name), ['Outside', 'Inside', 'Maintenance story videos']);
  assert.deepEqual(m.sections[0].items.map(i => i.title), ['Wheels and tyres,', 'Spray down', 'Foam it up.', 'Rinse', 'Clay', 'Rinse.', 'Look around', 'Ceramic sealant', 'Dry, blower, glass and tyre shine,']);
  assert.match(m.sections[0].items[4].detail, /front only, where the bugs are, plus the windscreen and mirrors/);
  assert.match(m.sections[1].items[4].detail, /wipe down with no chemical/);
  assert.match(m.sections[1].items[5].detail, /No review card or business card/);
  const hand = itemsOf(lists, 'handover').map(i => i.title || i.detail);
  assert.ok(!hand.some(t => /Review ask|Pitch, 20 seconds|Send the review text|Day 3, no review/.test(t)), hand.join('; '));
  assert.ok(hand.includes('Referral line:') && hand.includes('Take payment'));
  assert.ok(!lists.find(t => t.key === 'handover').sections.some(s => s.name === 'Pitch scripts'));
  assert.equal(meta.pitch, 'none');
  assert.equal(J.scripts(lists, meta, {}).filter(x => x.key === 'pitch').length, 0);
  assert.equal(meta.steps.length, 9 + 15 + 5 + 2);       // every job, maintenance, handover without the pitch and review bits
  // A full detail still has them all.
  const full = itemsOf(build('Full detail').lists, 'handover').map(i => i.title || i.detail);
  assert.ok(full.includes('Review ask:') && full.includes('Pitch, 20 seconds.'));
});

test('door knocking is optional: it never counts, and Up next skips it', () => {
  const { lists, meta } = build('Exterior detail');
  const door = lists.find(t => t.key === 'door_knock');
  assert.equal(door.optional, true);
  assert.deepEqual(J.counts(door, {}), { done: 0, total: 0, clipsDone: 0, clipsTotal: 0, signDone: 0, signTotal: 0 });
  assert.ok(!meta.steps.some(id => id.startsWith('door-')));
  let st = {};
  meta.steps.filter(id => !id.startsWith('hand-')).forEach(id => { st = J.merge(st, J.tickPatch(st, id, 'AJ', '1')); });
  assert.equal(J.nextStep(lists, st).template.key, 'handover');
  assert.deepEqual(itemsOf(lists, 'door_knock').filter(i => i.type === 'rule').slice(0, 3).map(i => i.detail),
    ['Detail booked and paid: $25.', 'Paint correction booked and paid: $40.', 'Ceramic coating booked and paid: $75.']);
  const lines = itemsOf(lists, 'door_knock').filter(i => i.type === 'script');
  assert.equal(lines.filter(i => /^Ice breaker/.test(i.title)).length, 3);
  assert.ok(lines.every(i => /^".+"$/.test(i.detail)));
  // The handover helper still only picks the handover words.
  assert.deepEqual(J.scripts(lists, meta, {}).map(x => x.key), ['pitch', 'referral', 'review']);
});

test('the instant quote matches the price menu', () => {
  const p = seed().settings.prices;
  assert.deepEqual(J.quote(p, 'sedan', 'Full detail'), { from: 225, to: 300 });
  assert.deepEqual(J.quote(p, 'sedan', 'Exterior detail'), { from: 110, to: 110 });
  assert.deepEqual(J.quote(p, 'suv', 'Interior detail'), { from: 165, to: 240 });
  assert.deepEqual(J.quote(p, 'suv', 'Paint correction'), { from: 497, to: 497 });
  assert.deepEqual(J.quote(p, 'large', 'Ceramic coating, 7 year'), { from: 1597, to: 1597 });
  assert.deepEqual(J.quote(p, 'large', 'Full detail'), { from: 270, to: 345 });
  assert.deepEqual(J.quote(p, 'bike', 'Coating, 3 year (no paint correction)'), { from: 245, to: 245 });
  assert.deepEqual(J.quote(p, 'bike', 'Full detail'), { from: 135, to: 210 });
  assert.equal(J.quote(p, 'bike', 'Paint correction'), null);
  assert.match(J.quote(p, 'truck', 'Full detail').note, /Angus/);
  const table = Object.fromEntries(p.vehicles.map(v => [v.key, v.prices]));
  assert.deepEqual(table.sedan, { 'Full detail': 225, 'Exterior detail': 110, 'Interior detail': 140, 'Paint correction': 397, 'Ceramic coating, 3 year': 997, 'Ceramic coating, 5 year': 1197, 'Ceramic coating, 7 year': 1347 });
  assert.deepEqual(Object.values(table.suv), [250, 120, 165, 497, 1097, 1297, 1447]);
  assert.deepEqual(Object.values(table.large), [270, 140, 170, 547, 1147, 1347, 1597]);
  assert.deepEqual(Object.values(table.bike), [135, 245, 325, 400]);
});

test('time goals for each service, and how long a job took', () => {
  const set = { ...seed().settings, services: seed().services };
  const g = s => J.goalText(J.goal([].concat(s), set));
  assert.equal(g('Exterior detail'), '45 min to 1 hour');
  assert.equal(g('Interior detail'), '1 to 1.5 hours');
  assert.equal(g('Full detail'), '2 to 3 hours');
  assert.equal(g('Maintenance wash'), '1 to 1.5 hours');
  assert.equal(g('Paint correction'), '2 to 3 hours');
  assert.equal(g('Ceramic coating'), '4 to 5 hours');
  assert.equal(g(['Interior detail', 'Paint correction']), '3 to 4.5 hours');
  assert.equal(J.goal(['Something else'], set), null);
  assert.deepEqual([J.duration(45), J.duration(60), J.duration(155)], ['45 min', '1 h', '2 h 35 min']);

  const job = { date: '2026-10-01' };
  let st = J.merge({}, J.tickPatch({}, 'job-day-before-1', 'AJ', '2026-09-30T08:00:00.000Z'));   // the day before
  assert.equal(J.timing(st, job, '2026-09-30T23:30:00.000Z'), null);
  st = J.merge(st, J.tickPatch(st, 'job-on-arrival-1', 'AJ', '2026-09-30T23:00:00.000Z'));       // 9am in Canberra
  assert.deepEqual(J.timing(st, job, '2026-10-01T00:30:00.000Z'), { start: '2026-09-30T23:00:00.000Z', end: '2026-10-01T00:30:00.000Z', finished: false, minutes: 90 });
  st = J.merge(st, { done: { by: 'AJ', at: '2026-10-01T01:35:00.000Z' } });
  assert.equal(J.timing(st, job, '2026-10-01T05:00:00.000Z').minutes, 155);
  assert.equal(J.timing(st, job, '2026-10-01T05:00:00.000Z').finished, true);
});

test('phones holding the first SOPs get the new ones, unless they were edited', async () => {
  const { execFileSync } = await import('node:child_process');
  const v1 = JSON.parse(execFileSync('git', ['show', '8ed4471:sites/clock/sops.json'], { cwd: here('..') }).toString());
  const v1Settings = { ...v1.settings, services: v1.services };
  const s2 = seed();
  const newSeed = { version: s2.version, previous: s2.previous, sops: s2.templates, settings: { ...s2.settings, services: s2.services } };

  // Untouched, as a phone kept them, and as the sheet kept them (stamped).
  for (const stamp of [x => x, x => ({ ...x, updatedAt: '2026-10-01T00:00:00.000Z', by: 'Admin', rev: 'r' })]) {
    const u = J.upgrade(v1.templates.map(stamp), stamp(v1Settings), newSeed);
    assert.deepEqual(u.kept, []);
    assert.deepEqual(u.changed.sort(), s2.templates.map(t => t.key).sort());
    assert.equal(J.markdown(u.sops), readFileSync(here('fixtures/sops.md'), 'utf8'));
    assert.equal(u.settings.services['Maintenance wash'].templates.includes('maintenance'), true);
    assert.equal(u.settings.prices.vehicles.length, 5);
    // Once upgraded, nothing more happens.
    const again = J.upgrade(u.sops, u.settings, newSeed);
    assert.deepEqual([again.changed, again.kept, again.settingsChanged], [[], [], false]);
  }

  // An SOP edited in the app is kept; the others still upgrade.
  const edited = v1.templates.map(t => (t.key === 'interior' ? { ...t, intro: 'Our own words.' } : t));
  const settings = { ...v1Settings, paintMin: 85 };
  const u = J.upgrade(edited, settings, newSeed);
  assert.deepEqual(u.kept, ['interior', '_settings']);
  assert.equal(u.sops.find(t => t.key === 'interior').intro, 'Our own words.');
  assert.match(u.sops.find(t => t.key === 'exterior').sections[0].items[0].subs[0], /acid wheel cleaner/);
  assert.ok(u.sops.some(t => t.key === 'maintenance') && u.sops.some(t => t.key === 'door_knock'));
  assert.equal(u.settings.paintMin, 85);                                   // their edit stays
  assert.deepEqual(u.settings.services['Maintenance wash'].goal, [60, 90]); // the new bits arrive
  assert.equal(u.settings.prices.vehicles[0].prices['Full detail'], 225);
  // Something saved in the app on this version is never replaced by a later one.
  const mine = { ...s2.templates[1], intro: 'Changed after the upgrade.', edited: true };
  assert.deepEqual(J.upgrade([mine], null, newSeed).kept, []);
  const later = { ...newSeed, version: s2.version + 1 };
  assert.deepEqual(J.upgrade([mine], null, later).kept, ['exterior']);
  assert.equal(J.upgrade([mine], null, later).sops.find(t => t.key === 'exterior').intro, 'Changed after the upgrade.');
});


test('clips and job photos show at the step they belong to, on every kind of job', () => {
  const s = seed();
  const services = Object.keys(s.services);
  const everywhere = new Set();
  for (const sv of services) {
    const { lists } = build(sv);
    const p = J.placements(lists);
    const steps = new Set(), clips = [];
    J.eachItem(lists, it => { if (it.type === 'step') steps.add(it.id); if (it.type === 'clip') clips.push(it.id); });
    const cues = [...Object.entries(p.before), ...Object.entries(p.after)];
    for (const [at, list] of cues) {
      assert.ok(steps.has(at), `${sv}: ${at} is not on the job`);
      for (const c of list) if (c.clip) everywhere.add(c.clip);
    }
    const shown = cues.flatMap(([, list]) => list.filter(c => c.clip).map(c => c.clip));
    assert.equal(new Set(shown).size, shown.length, `${sv}: a clip shows twice`);
    assert.deepEqual(Object.keys(p.placed).sort(), [...new Set(shown)].sort());
    const photos = cues.flatMap(([, list]) => list.filter(c => c.photo).map(c => c.photo.n));
    assert.equal(new Set(photos).size, photos.length, `${sv}: a photo shows twice`);
  }
  // Every clip has a place on at least one kind of job, except the ones left for Pat.
  const all = [];
  J.eachItem(s.templates, it => { if (it.type === 'clip') all.push(it.id); });
  assert.deepEqual(all.filter(id => !everywhere.has(id)), ['cer-ceramic-clips-to-film-6', 'cer-ceramic-clips-to-film-7']);
});

test('where clips land: befores first, the foam with the foam, and the finish where the job really finishes', () => {
  const at = (sv, pos, step) => (J.placements(build(sv).lists)[pos][step] || []).map(c => c.clip || 'photo ' + c.photo.n);
  assert.deepEqual(at('Exterior detail', 'before', 'ext-steps-1').slice(0, 3), ['photo 1', 'photo 2', 'photo 3']);
  assert.ok(at('Exterior detail', 'before', 'ext-steps-1').includes('ext-exterior-story-videos-1'));
  assert.ok(at('Exterior detail', 'after', 'ext-steps-2').includes('ext-exterior-clips-to-film-5'));
  assert.ok(at('Exterior detail', 'after', 'ext-steps-2').includes('photo 5'));
  assert.ok(at('Exterior detail', 'after', 'ext-steps-14').includes('ext-exterior-story-videos-3'));
  // Correction: the exterior stops at the rinse, so "done" moves to the end of the correction.
  assert.ok(at('Paint correction', 'after', 'cor-steps-13').includes('ext-exterior-story-videos-3'));
  // Ceramic: it moves to the final walk after coating.
  // Ceramic: it moves to the finish after coating, once the tape is off and the tyres are dressed.
  assert.ok(at('Ceramic coating', 'after', 'cer-applying-11').includes('ext-exterior-story-videos-3'));
  assert.ok(!itemsOf(build('Ceramic coating').lists, 'correction').some(i => i.id === 'cor-steps-13'));
  assert.ok(at('Maintenance wash', 'before', 'mnt-inside-1').includes('photo 4'));
  assert.ok(at('Interior detail', 'before', 'int-steps-1').includes('photo 1'));
  assert.ok(at('Interior detail', 'after', 'int-steps-3').includes('int-interior-clips-to-film-5'));
  // The 50/50 has its own step: the tape line is filmed as it starts, and the reveal, the photo and
  // the peel come straight after it, before the rest of the car is polished.
  assert.deepEqual(at('Paint correction', 'before', 'cor-steps-6'), ['cor-paint-correction-clips-to-film-3']);
  assert.deepEqual(at('Paint correction', 'after', 'cor-steps-6'),
    ['cor-paint-correction-clips-to-film-5', 'photo 8', 'cor-paint-correction-clips-to-film-6', 'cor-paint-correction-clips-to-film-7']);
  assert.deepEqual(at('Paint correction', 'after', 'cor-steps-11'), []);
  // Sealant beading: on a correction-only job at the protect step, never on a ceramic job (no sealant).
  for (const x of ['ext-exterior-clips-to-film-8', 'photo 11']) {
    assert.ok(at('Paint correction', 'after', 'cor-steps-12').includes(x), x);
    assert.ok(!at('Ceramic coating', 'after', 'cor-steps-12').includes(x), x);
    assert.ok(!at('Ceramic coating', 'after', 'cer-applying-11').includes(x), x);
  }
  // The beading is taken on the wet car, before the finish dries it and the wheel after.
  assert.deepEqual(at('Paint correction', 'after', 'cor-steps-13').filter(x => x.startsWith('photo')), ['photo 9', 'photo 12']);
  // Nothing to extract on a maintenance wash, so no extraction photo.
  assert.ok(!at('Maintenance wash', 'after', 'mnt-inside-1').includes('photo 6'));
  // The coated car can't get wet for days, so those clips are for later, not placed on the day.
  for (const id of ['cer-ceramic-clips-to-film-6', 'cer-ceramic-clips-to-film-7']) {
    assert.equal(itemsOf(build('Ceramic coating').lists, 'ceramic').find(i => i.id === id).when, 'later');
  }
});

test('job photos are counted for the job and numbered in the order the crew meets them', () => {
  // Going down the list the way the screen draws it: each step's befores, the step, its afters.
  const walk = sv => {
    const { lists } = build(sv), p = J.placements(lists), out = [];
    J.eachItem(lists, it => { if (it.type === 'step') out.push(...(p.before[it.id] || []), ...(p.after[it.id] || [])); });
    return out.filter(c => c.photo);
  };
  const ext = walk('Exterior detail');
  assert.deepEqual(ext.map(c => c.photo.n), [1, 2, 3, 5, 11, 9, 12]);   // beading at the sealant, before the wheel after
  assert.deepEqual(ext.map(c => `${c.i}/${c.of}`), ['1/7', '2/7', '3/7', '4/7', '5/7', '6/7', '7/7']);
  const all = { 'Interior detail': 6, 'Full detail': 10, 'Maintenance wash': 9, 'Paint correction': 9, 'Ceramic coating': 8 };
  for (const [sv, k] of Object.entries(all)) {
    assert.deepEqual(walk(sv).map(c => c.i), Array.from({ length: k }, (_, i) => i + 1), sv);
    assert.ok(walk(sv).every(c => c.of === k), sv);
  }
  assert.equal(J.placements(build(['Full detail', 'Paint correction']).lists).photos, 12);
});

test('phones and sheets on the last version move to this one; edits made since stay', () => {
  const s3 = seed();
  const newSeed = { version: s3.version, previous: s3.previous, sops: s3.templates, settings: { ...s3.settings, services: s3.services } };
  const older = s3.templates.map(t => ({ ...t, seed: s3.version - 1, sections: JSON.parse(JSON.stringify(t.sections)).map(x => ({ ...x, intro: x.intro })) }));
  const u = J.upgrade(older, { ...newSeed.settings, seed: s3.version - 1 }, newSeed);
  assert.deepEqual(u.kept, []);
  assert.equal(u.changed.length, s3.templates.length);
  const mine = { ...s3.templates[1], seed: s3.version - 1, edited: true, intro: 'Ours.' };
  assert.deepEqual(J.upgrade([mine], null, newSeed).kept, ['exterior']);
});

