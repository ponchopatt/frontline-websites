/* Driven Detailing demo: price picker, before/after slider, booking steps, text links.
   The package lists, add-ons, photos and words are Driven's own, from drivendetailing.com.au.
   The prices are the new prices we're proposing to Seb (see the README), not his current ones. */
const PHONE = '+61404714415';
const SIZES = ['hatch or sedan', 'SUV or ute', '4x4 or 7-seater'];
// Full and interior details can cost up to this much more for a car in bad condition,
// agreed before Seb starts. Exterior and maintenance are set prices.
const RANGE = 60;
// Driven+ members pay this share of the normal price (10% off).
const MEMBER = 0.9;

const PACKAGES = [
  {
    id: 'full', name: 'Full Detail', time: '1.5 to 2 hrs', tag: 'Most popular', ranged: true, plan: true,
    desc: 'Complete interior and exterior detail', prices: [225, 260, 290],
    inc: ['Premium pH-balanced wash', 'Wheels, rims and tyres detailed', 'Premium tyre shine', 'Wheel arches and mudguards', 'Wipers and blades cleaned', 'Exterior glass cleaned', 'Door jambs cleaned', 'Vacuum: seats, carpets and boot', 'Dashboard, console and wheel', 'Door trims and high-touch areas', 'Foot pedals deep cleaned', 'Leather seats shampooed', 'Interior glass cleaned', 'Odour neutraliser and freshener', 'Final inspection and finish'],
  },
  {
    id: 'int', name: 'Interior Detail', time: 'About 1 hr', ranged: true,
    desc: 'Complete interior detail', prices: [140, 165, 170],
    inc: ['Vacuum: seats, carpets and boot', 'Dashboard, console and wheel', 'Door trims and high-touch areas', 'Foot pedals deep cleaned', 'Leather seats shampooed', 'Interior glass cleaned', 'Odour neutraliser and freshener', 'Final inspection and finish'],
  },
  {
    id: 'ext', name: 'Exterior Detail',
    desc: 'Complete exterior detail', prices: [110, 125, 140],
    inc: ['Premium pH-balanced wash', 'Wheels, rims and tyres detailed', 'Premium tyre shine', 'Wheel arches and mudguards', 'Wipers and blades cleaned', 'Exterior glass cleaned', 'Door jambs cleaned', 'Final inspection and finish'],
  },
  {
    id: 'maint', name: 'Maintenance Detail', time: '45 to 60 min', plan: true,
    desc: 'Quick, regular upkeep', prices: [165, 185, 200],
    inc: ['Premium pH-balanced wash', 'Wheels, rims and tyres cleaned', 'Light interior wipe-down', 'Interior vacuum', 'Interior and exterior glass', 'Microfibre towel dry'],
  },
];

const BA = {
  exterior: { cap: 'Mercedes-Benz GLE, full exterior.', a: 'Mercedes-Benz GLE after detailing, paintwork clean and glossy', b: 'The same Mercedes-Benz GLE before, covered in dirt and road spray' },
  interior: { cap: 'Mercedes-Benz GLE, interior detail.', a: 'Mercedes-Benz GLE cabin after detailing, carpets and leather cleaned', b: 'The same cabin before, with leaves and dirt in the footwell' },
  wheel: { cap: 'BMW alloy wheel, wheels and tyres.', a: 'BMW alloy wheel after detailing, cleaned and polished', b: 'The same wheel before, coated in brake dust and road grime' },
};

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = (n) => '$' + (n % 1 ? n.toFixed(2) : n);
  const state = { size: 0, pack: 'full', plus: false };
  const pick = () => PACKAGES.find((p) => p.id === state.pack) || PACKAGES[0];
  const price = (p) => p.prices[state.size];
  // "$260 to $320" for a job with a condition range, "$125" for a set price.
  const priceText = (p) => money(price(p)) + (p.ranged ? ' to ' + money(price(p) + RANGE) : '');
  // Driven+ is a plan for the full and maintenance details. Interior and exterior show the full detail's.
  const plan = () => (pick().plan ? pick() : PACKAGES[0]);

  /* ---- Text links: open a text to Seb with the current pick filled in ---- */
  const smsHref = (body) => `sms:${PHONE}?&body=${encodeURIComponent(body)}`;
  const quoteText = () => `Hi Seb, I'd like a price for a ${pick().name} on my ${SIZES[state.size]}.\nCar: \nSuburb: `;
  const syncSms = () => $$('[data-sms]').forEach((a) => { a.href = smsHref(quoteText()); });

  /* ---- Price picker --------------------------------------------------- */
  const packs = $('#packs');
  function renderPacks() {
    packs.replaceChildren(...PACKAGES.map((p) => {
      const card = document.createElement('div');
      card.className = 'pack' + (p.id === state.pack ? ' on' : '');
      card.dataset.id = p.id;
      card.innerHTML =
        `<label><input type="radio" name="pack" value="${p.id}"${p.id === state.pack ? ' checked' : ''}>` +
        `<span class="pack-row"><span class="pack-name">${p.tag ? `<span class="pack-tag">${p.tag}</span>` : ''}${p.name}</span>` +
        `<span class="pack-desc">${p.desc}${p.time ? '. ' + p.time : ''}.</span>` +
        `<span class="pack-price"><b>${money(price(p))}</b><small>${p.ranged ? 'to ' + money(price(p) + RANGE) + ', by condition' : 'Set price'}</small></span></span></label>` +
        `<details><summary>What&rsquo;s included</summary><ul>${p.inc.map((i) => `<li>${i}</li>`).join('')}</ul></details>`;
      return card;
    }));
    update();
  }
  function update() {
    const p = pick(), m = plan();
    $$('.pack', packs).forEach((c) => c.classList.toggle('on', c.dataset.id === state.pack));
    $('#totalName').textContent = `${p.name}, ${SIZES[state.size]}`;
    $('#totalPrice').textContent = priceText(p);
    $('#bkSum').textContent = state.plus
      ? `Driven+ ${m.name}, ${SIZES[state.size]}, ${money(price(m) * MEMBER)} a visit`
      : `${p.name}, ${SIZES[state.size]}, ${priceText(p)}`;
    $('#plusName').textContent = `${m.name}, ${SIZES[state.size]}`;
    $('#plusPrice').textContent = money(price(m) * MEMBER);
    $('#plusWas').textContent = money(price(m));
    syncSms();
  }
  $$('input[name="size"]').forEach((r) => r.addEventListener('change', () => { state.size = +r.value; renderPacks(); }));
  packs.addEventListener('change', (e) => {
    if (e.target.name === 'pack') { state.pack = e.target.value; update(); }
  });
  // The prices in the hero pick that car size for the full detail.
  $$('[data-size]').forEach((a) => a.addEventListener('click', () => {
    state.size = +a.dataset.size; state.pack = 'full';
    $(`input[name="size"][value="${state.size}"]`).checked = true;
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
    const m = plan();
    const want = state.plus
      ? `to join Driven+ with the ${m.name} plan for my ${SIZES[state.size]} (${money(price(m) * MEMBER)} a visit)`
      : `to book a ${p.name} for my ${SIZES[state.size]} (${priceText(p)})`;
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
