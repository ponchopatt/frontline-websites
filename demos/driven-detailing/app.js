/* Driven Detailing demo: price picker, before/after slider, booking steps, text links.
   Every price and package list here is Driven's own, from drivendetailing.com.au. */
const PHONE = '+61404714415';
const SIZES = ['sedan', 'SUV', '7-seater'];
const SIZE_LABELS = ['Sedan or small', 'SUV or large', '7-seater or XL'];

const PACKAGES = {
  full: [
    {
      id: 'maint', name: 'Maintenance Detail', short: 'Maintenance', time: '45 to 60 min',
      desc: 'Quick, regular upkeep', prices: [80, 90, 100], member: [72, 81, 90],
      inc: ['Premium pH-balanced wash', 'Wheels, rims and tyres cleaned', 'Light interior wipe-down', 'Interior vacuum', 'Interior and exterior glass', 'Microfibre towel dry'],
    },
    {
      id: 'sig', name: 'Signature Detail', short: 'Signature', time: '1.5 to 2 hrs', tag: 'Most popular',
      desc: 'Complete interior and exterior detail', prices: [120, 140, 160], member: [108, 126, 144],
      inc: ['Premium pH-balanced wash', 'Wheels, rims and tyres detailed', 'Premium tyre shine', 'Wheel arches and mudguards', 'Wipers and blades cleaned', 'Exterior glass cleaned', 'Door jambs cleaned', 'Vacuum: seats, carpets and boot', 'Dashboard, console and wheel', 'Door trims and high-touch areas', 'Foot pedals deep cleaned', 'Leather seats shampooed', 'Interior glass cleaned', 'Odour neutraliser and freshener', 'Final inspection and finish'],
    },
    {
      id: 'pres', name: 'Prestige Detail', short: 'Prestige', time: '3 to 4 hrs',
      desc: 'Decontaminate, protect and preserve', prices: [260, 300, 320], member: [234, 270, 288],
      plus: 'Everything in Signature, plus:',
      inc: ['Clay bar decontamination', 'Carnauba wax protection', 'Premium tyre dressing', 'Deep carpet shampoo', 'Targeted steam cleaning', 'Stain and odour treatment', 'Leather conditioned and coated'],
    },
  ],
  int: [
    {
      id: 'sigint', name: 'Signature Interior', short: 'Signature Interior', time: 'About 1 hr',
      desc: 'Complete interior detail', prices: [100, 120, 140],
      inc: ['Vacuum: seats, carpets and boot', 'Dashboard, console and wheel', 'Door trims and high-touch areas', 'Foot pedals deep cleaned', 'Leather seats shampooed', 'Interior glass cleaned', 'Odour neutraliser and freshener', 'Final inspection and finish'],
      note: 'Add the full exterior for $20 more with the Signature Detail.',
    },
    {
      id: 'presint', name: 'Prestige Interior', short: 'Prestige Interior', time: '2 to 2.5 hrs',
      desc: 'Deep clean, restore and protect', prices: [200, 240, 260],
      plus: 'Everything in Signature Interior, plus:',
      inc: ['Deep carpet shampoo', 'Targeted steam cleaning', 'Stain and odour treatment', 'Leather conditioned and coated', 'Interior trim restored and protected', 'Headliner, seatbelts and seat rails detailed'],
      note: 'Add the full exterior, with clay bar and carnauba wax, for $60 more with the Prestige Detail.',
    },
  ],
};

const BA = {
  exterior: { cap: 'Mercedes-Benz GLE, full exterior.', a: 'Mercedes-Benz GLE after detailing, paintwork clean and glossy', b: 'The same Mercedes-Benz GLE before, covered in dirt and road spray' },
  interior: { cap: 'Mercedes-Benz GLE, interior detail.', a: 'Mercedes-Benz GLE cabin after detailing, carpets and leather cleaned', b: 'The same cabin before, with leaves and dirt in the footwell' },
  wheel: { cap: 'BMW alloy wheel, wheels and tyres.', a: 'BMW alloy wheel after detailing, cleaned and polished', b: 'The same wheel before, coated in brake dust and road grime' },
};

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = (n) => '$' + n;
  const state = { size: 0, kind: 'full', pack: 'sig', plus: false };
  const pick = () => PACKAGES[state.kind].find((p) => p.id === state.pack) || PACKAGES[state.kind][0];

  /* ---- Text links: open a text to Seb with the current pick filled in ---- */
  const smsHref = (body) => `sms:${PHONE}?&body=${encodeURIComponent(body)}`;
  const quoteText = () => {
    const p = pick();
    return `Hi Seb, I'd like a price for a ${p.name} on my ${SIZES[state.size]}.\nCar: \nSuburb: `;
  };
  const syncSms = () => $$('[data-sms]').forEach((a) => { a.href = smsHref(quoteText()); });

  /* ---- Price picker --------------------------------------------------- */
  const packs = $('#packs');
  function renderPacks() {
    const list = PACKAGES[state.kind];
    if (!list.some((p) => p.id === state.pack)) state.pack = state.kind === 'int' ? 'sigint' : 'sig';
    packs.replaceChildren(...list.map((p) => {
      const card = document.createElement('div');
      card.className = 'pack' + (p.id === state.pack ? ' on' : '');
      card.dataset.id = p.id;
      const items = (p.plus ? `<li class="plus">${p.plus}</li>` : '') + p.inc.map((i) => `<li>${i}</li>`).join('');
      card.innerHTML =
        `<label><input type="radio" name="pack" value="${p.id}"${p.id === state.pack ? ' checked' : ''}>` +
        `<span class="pack-row"><span class="pack-name">${p.tag ? `<span class="pack-tag">${p.tag}</span>` : ''}${p.name}</span>` +
        `<span class="pack-desc">${p.desc}. ${p.time}.</span>` +
        `<span class="pack-price"><small>from</small><b>${money(p.prices[state.size])}</b></span></span></label>` +
        `<details><summary>What&rsquo;s included</summary><ul>${items}</ul>${p.note ? `<p class="small" style="padding-bottom:16px">${p.note}</p>` : ''}</details>`;
      return card;
    }));
    update();
  }
  function update() {
    const p = pick();
    $$('.pack', packs).forEach((c) => c.classList.toggle('on', c.dataset.id === state.pack));
    $('#totalName').textContent = `${p.name}, ${SIZES[state.size]}`;
    $('#totalPrice').textContent = money(p.prices[state.size]);
    // Driven+ shows the member price of the same package for the same car. Interior-only
    // isn't a Driven+ plan, so it shows the Signature plan instead.
    const m = state.kind === 'full' ? p : PACKAGES.full[1];
    $('#bkSum').textContent = state.plus
      ? `Driven+ ${m.short}, ${SIZES[state.size]}, ${money(m.member[state.size])} a visit`
      : `${p.name}, ${SIZES[state.size]}, from ${money(p.prices[state.size])}`;
    $('#plusName').textContent = `${m.short}, ${SIZES[state.size]}`;
    $('#plusPrice').textContent = money(m.member[state.size]);
    $('#plusWas').textContent = money(m.prices[state.size]);
    syncSms();
  }
  $$('input[name="size"]').forEach((r) => r.addEventListener('change', () => { state.size = +r.value; renderPacks(); }));
  $$('input[name="kind"]').forEach((r) => r.addEventListener('change', () => {
    state.kind = r.value;
    state.pack = r.value === 'int' ? 'sigint' : 'sig';
    renderPacks();
  }));
  packs.addEventListener('change', (e) => {
    if (e.target.name === 'pack') { state.pack = e.target.value; update(); }
  });
  // The prices in the hero pick that package in the picker.
  $$('[data-pick]').forEach((a) => a.addEventListener('click', () => {
    state.kind = 'full'; state.pack = a.dataset.pick;
    $('input[name="kind"][value="full"]').checked = true;
    renderPacks();
  }));
  // Join Driven+ books the plan; every other way into the booking form books a one-off detail.
  $$('a[href="#book"]').forEach((a) => a.addEventListener('click', () => { state.plus = a.hasAttribute('data-plus'); update(); }));
  renderPacks();

  /* ---- Before and after ----------------------------------------------- */
  const ba = $('#ba');
  const range = $('.ba-range', ba);
  const setPos = (v) => { v = Math.max(0, Math.min(100, v)); ba.style.setProperty('--pos', v + '%'); range.value = String(Math.round(v)); };
  range.addEventListener('input', () => setPos(+range.value));
  let drag = false;
  const at = (e) => { const r = ba.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
  ba.addEventListener('pointerdown', (e) => { drag = true; ba.setPointerCapture?.(e.pointerId); setPos(at(e)); });
  ba.addEventListener('pointermove', (e) => { if (drag) setPos(at(e)); });
  const stop = () => { drag = false; };
  ba.addEventListener('pointerup', stop);
  ba.addEventListener('pointercancel', stop);
  $$('[data-ba]').forEach((t) => t.addEventListener('click', () => {
    const k = t.dataset.ba, d = BA[k];
    $$('[data-ba]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    const src = (s) => `assets/${k}-${s}-1000.webp`;
    const set = (img, s, alt) => { img.srcset = `assets/${k}-${s}-600.webp 600w, assets/${k}-${s}-1000.webp 1000w`; img.src = src(s); img.alt = alt; };
    set($('.ba-after', ba), 'after', d.a);
    set($('.ba-before', ba), 'before', d.b);
    $('#baCap').textContent = d.cap;
    setPos(50);
  }));

  /* ---- Booking steps -------------------------------------------------- */
  const form = $('#bk');
  const steps = $$('.bk-step', form);
  const dots = $$('.bk-steps li', form);
  const err = $('#bkErr');
  let step = 1;

  // The next 7 days as chips: today, tomorrow, then the weekday and date.
  const days = $('#days');
  const fmt = new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const parts = fmt.formatToParts(d);
    const wd = parts.find((x) => x.type === 'weekday').value;
    const dm = `${parts.find((x) => x.type === 'day').value} ${parts.find((x) => x.type === 'month').value}`;
    const top = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : wd;
    const label = document.createElement('label');
    label.innerHTML = `<input type="radio" name="day" value="${top === wd ? wd + ' ' + dm : top + ' (' + wd + ' ' + dm + ')'}"><span>${top}<small>${dm}</small></span>`;
    days.append(label);
  }

  const show = (n) => {
    step = n;
    steps.forEach((s) => { s.hidden = +s.dataset.step !== n; });
    dots.forEach((d, i) => { d.classList.toggle('on', i === n - 1); d.classList.toggle('done', i < n - 1); });
    err.hidden = true;
    if (form.getBoundingClientRect().top < 0) form.scrollIntoView({ block: 'start' });
  };
  const fail = (msg, el) => {
    err.textContent = msg; err.hidden = false;
    if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
  };
  $$('input, textarea', form).forEach((i) => i.addEventListener('input', () => i.removeAttribute('aria-invalid')));
  form.addEventListener('change', () => { err.hidden = true; });
  const check = (n) => {
    const f = form.elements;
    if (n === 1) {
      if (!f.car.value.trim()) return fail('Add your car, so Seb knows the size and the job.', f.car), false;
      if (!f.suburb.value.trim()) return fail('Add your suburb, so Seb can check the travel.', f.suburb), false;
    }
    if (n === 2 && !form.querySelector('input[name="day"]:checked')) return fail('Pick a day that suits you.'), false;
    if (n === 3) {
      if (!f.name.value.trim()) return fail('Add your name.', f.name), false;
      const digits = f.mobile.value.replace(/\D/g, '');
      if (!/^(04\d{8}|614\d{8})$/.test(digits)) return fail('Check your mobile. It should look like 0412 345 678.', f.mobile), false;
    }
    return true;
  };
  $$('[data-next]', form).forEach((b) => b.addEventListener('click', () => { if (check(step)) show(step + 1); }));
  $$('[data-back]', form).forEach((b) => b.addEventListener('click', () => show(step - 1)));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!check(3)) return;
    const f = form.elements, p = pick();
    const day = form.querySelector('input[name="day"]:checked').value;
    const time = form.querySelector('input[name="time"]:checked');
    const plan = state.kind === 'full' ? p : PACKAGES.full[1];
    const want = state.plus
      ? `to join Driven+ with the ${plan.short} plan for my ${SIZES[state.size]} (${money(plan.member[state.size])} a visit)`
      : `to book a ${p.name} for my ${SIZES[state.size]} (from ${money(p.prices[state.size])})`;
    const lines = [
      `Hi Seb, I'd like ${want}.`,
      `Car: ${f.car.value.trim()}`,
      `Suburb: ${f.suburb.value.trim()}`,
      `When: ${day}${time ? ', ' + time.value.toLowerCase() : ''}`,
      `Name: ${f.name.value.trim()}`,
      `Mobile: ${f.mobile.value.trim()}`,
    ];
    if (f.note.value.trim()) lines.push(`Note: ${f.note.value.trim()}`);
    const msg = lines.join('\n');
    $('#bkMsg').textContent = msg;
    err.hidden = true;
    steps.forEach((s) => { s.hidden = true; });
    $('.bk-steps', form).hidden = true;
    const done = $('#bkDone');
    done.hidden = false; done.focus();
    // Open the texts app with the booking filled in.
    const go = document.createElement('a');
    go.href = smsHref(msg);
    document.body.append(go); go.click(); go.remove();
  });
  $('#bkCopyBtn').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText($('#bkMsg').textContent); e.target.textContent = 'Copied'; }
    catch { e.target.textContent = 'Select the text above to copy it'; }
  });
})();
