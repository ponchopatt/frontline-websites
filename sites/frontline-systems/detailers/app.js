/* Detailer offer page: spots, video, two calculators, booking, sticky bar, pixel.
   Everything you'd change is in CONFIG. Leave a value empty and the page does
   without it (see README, "Detailer offer page"). */
const CONFIG = {
  bookingUrl: '',   // GHL booking widget link, https://api.leadconnectorhq.com/widget/booking/...
  vslUrl: '',       // the video: a YouTube, Vimeo or Loom link, or an .mp4
  vslPoster: '',    // optional picture shown before the video plays
  pixelId: '',      // Meta Pixel ID, digits only
  spots: 3,         // spots in this round
  spotsTaken: 0,    // add one each time a detailer signs up
  formEndpoint: '', // where the backup form posts JSON. Empty: it opens an email to EMAIL.
  email: 'patrick@frontlinesystems.com.au',
};

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const live = /(^|\.)frontlinesystems\.com\.au$/.test(location.hostname);
  const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
  const aud2 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 });
  const money = (n) => aud.format(Math.round(n)).replace('A$', '$');
  const cents = (n) => aud2.format(n).replace('A$', '$');

  /* ---- Meta Pixel ---------------------------------------------------- */
  const track = (ev, data) => { if (window.fbq) window.fbq('track', ev, data || {}); };
  if (/^\d{6,20}$/.test(CONFIG.pixelId)) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', CONFIG.pixelId);
    window.fbq('track', 'PageView');
  }

  /* ---- Spots ---------------------------------------------------------- */
  const total = Math.max(1, CONFIG.spots | 0);
  const left = Math.max(0, total - (CONFIG.spotsTaken | 0));
  const word = left === 1 ? 'spot' : 'spots';
  $$('[data-spots-line]').forEach((el) => { el.textContent = left ? `${left} ${word} open.` : 'All spots are taken for now.'; });
  $$('[data-spots-text]').forEach((el) => { el.textContent = left ? `${left} of ${total} spots open.` : `All ${total} spots are taken. Book a call to get first pick of the next round.`; });
  $$('[data-spots-short]').forEach((el) => { el.textContent = left ? `${left} ${word} left` : 'Next round'; });
  $$('[data-spot-boxes]').forEach((el) => {
    el.innerHTML = '';
    for (let i = 0; i < total; i++) { const b = document.createElement('i'); if (i >= left) b.className = 'taken'; el.append(b); }
  });

  /* ---- Video ---------------------------------------------------------- */
  // An embed link for the usual hosts. Anything else is used as given.
  function embed(url) {
    let m;
    if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/))) return { src: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1`, poster: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
    if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return { src: `https://player.vimeo.com/video/${m[1]}?autoplay=1&title=0&byline=0&portrait=0` };
    if ((m = url.match(/loom\.com\/(?:share|embed)\/([\w]+)/))) return { src: `https://www.loom.com/embed/${m[1]}?autoplay=1&hide_owner=true&hide_share=true&hide_title=true` };
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { video: url };
    return { src: url };
  }
  const vsl = $('[data-vsl]'), frame = $('#vslFrame');
  if (vsl && CONFIG.vslUrl) {
    const e = embed(CONFIG.vslUrl);
    const poster = CONFIG.vslPoster || e.poster || '';
    frame.innerHTML = '';
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'play';
    play.setAttribute('aria-label', 'Play the video');
    if (poster) play.style.backgroundImage = `url("${poster.replace(/"/g, '%22')}")`;
    play.innerHTML = '<span class="play-btn"></span><span class="play-label">Watch the video</span>';
    play.addEventListener('click', () => {
      let el;
      if (e.video) {
        el = document.createElement('video');
        el.src = e.video; el.controls = true; el.autoplay = true; el.playsInline = true;
      } else {
        el = document.createElement('iframe');
        el.src = e.src; el.title = 'Video: how the system works';
        el.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
        el.allowFullscreen = true;
      }
      frame.replaceChildren(el);
      track('ViewContent', { content_name: 'VSL' });
    }, { once: true });
    frame.append(play);
    vsl.hidden = false;
  } else if (vsl && !live) {
    vsl.hidden = false; // previews show the empty spot; the live site leaves it out
  }

  /* ---- Calculators ---------------------------------------------------- */
  function calc(root, show, run) {
    if (!root) return;
    const inputs = $$('input[type=range]', root);
    const update = () => {
      const v = {};
      inputs.forEach((i) => {
        v[i.dataset.k] = Number(i.value);
        const p = ((i.value - i.min) / (i.max - i.min)) * 100;
        i.style.setProperty('--p', p + '%');
      });
      const out = { ...show(v), ...run(v) };
      $$('[data-show],[data-out]', root).forEach((el) => {
        const k = el.dataset.show || el.dataset.out;
        if (k in out) el.textContent = out[k];
      });
    };
    inputs.forEach((i) => i.addEventListener('input', update));
    update();
  }

  calc($('#leakCalc'),
    (v) => ({ leads: String(v.leads), cold: v.cold + '%', rate: v.rate + '%', job: money(v.job) }),
    (v) => {
      const cold = Math.round(v.leads * v.cold / 100);
      const jobs = cold * v.rate / 100;
      const month = jobs * v.job;
      return {
        coldLeads: String(cold),
        lostJobs: num.format(Math.round(jobs * 10) / 10),
        lostMonth: money(month),
        lostYear: money(month * 12),
        leakSum: `${cold} cold leads × ${v.rate}% would book × ${money(v.job)} = ${money(month)} a month.`,
      };
    });

  calc($('#adCalc'),
    (v) => ({ week: money(v.week), cpl: money(v.cpl), rate: v.rate + '%', job: money(v.job) }),
    (v) => {
      // Rounded at each step, so the docket adds up as printed.
      const spend = v.week * 4, leads = Math.round(spend / v.cpl), jobs = Math.round(leads * v.rate / 100), work = jobs * v.job;
      return {
        spendMonth: spend.toLocaleString('en-AU'),
        spend: money(spend),
        leads: String(leads),
        jobs: String(jobs),
        work: money(work),
        ret: cents(work / spend),
      };
    });

  /* ---- Booking: 4 quick questions, then the calendar ------------------ */
  // Step 1 is the video. With no video on the page, the booking isn't "Step 2".
  if (!vsl || vsl.hidden) $$('[data-step2]').forEach((el) => el.remove());
  const form = $('#form'), cal = $('#cal'), grid = $('.apply-grid');
  if (form) {
    const qs = $$('.q', form), err = $('#formErr'), next = $('[data-next]', form), back = $('[data-back]', form);
    const hasCal = /^https:\/\//.test(CONFIG.bookingUrl);
    let at = 0, started = false;

    // The calendar, greyed out until the questions are done.
    if (hasCal) {
      cal.hidden = false;
      grid.classList.add('two');
      const ghost = $('[data-ghost]'), now = new Date(), y = now.getFullYear(), m = now.getMonth();
      const html = [`<b>${now.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</b>`];
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d) => html.push(`<span class="dow">${d}</span>`));
      for (let i = 0; i < (new Date(y, m, 1).getDay() + 6) % 7; i++) html.push('<span></span>');
      for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) html.push(`<span>${d}</span>`);
      ghost.innerHTML = html.join('');
    } else {
      $('[data-tab-cal]').textContent = 'We text you';
      $('[data-book-sub]').textContent = 'Answer 4 quick questions and Patrick will text you to set a time. It’s a short call to see if we’re a fit. No pressure.';
    }

    const show = (i, focus) => {
      at = i;
      qs.forEach((q, k) => { q.hidden = k !== i; });
      $('[data-qnum]').textContent = i + 1;
      $('[data-qbar]').style.width = ((i + 1) / qs.length) * 100 + '%';
      back.hidden = i === 0;
      next.textContent = i < qs.length - 1 ? 'Continue' : hasCal ? 'Open the calendar' : 'Send my answers';
      err.hidden = true;
      if (focus) { const el = $('input', qs[i]); if (el) el.focus({ preventScroll: true }); }
    };
    // The first answer that isn't right yet on a question, or null.
    const wrong = (q) => {
      for (const el of $$('input', q)) {
        if (el.type === 'radio') {
          if (!$$(`input[name="${el.name}"]`, q).some((r) => r.checked)) return el;
          continue;
        }
        const v = el.value.trim();
        const ok = !!v && (el.type !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) && (el.type !== 'tel' || v.replace(/\D/g, '').length >= 8);
        el.setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (!ok) return el;
      }
      return null;
    };
    const say = (el) => {
      if (el.type === 'radio') err.textContent = 'Please pick one.';
      else {
        const what = $(`label[for="${el.id}"]`).textContent.toLowerCase();
        err.textContent = el.value.trim() ? `Please check your ${what.replace(/^your /, '')}.` : `Please fill in ${what}.`;
      }
      err.hidden = false;
      el.focus();
    };
    const answers = (stage) => {
      const d = {};
      new FormData(form).forEach((v, k) => { d[k] = String(v).trim(); });
      return { ...d, stage, page: 'detailers', from: location.href };
    };
    const post = (d) => fetch(CONFIG.formEndpoint, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(d), keepalive: true });
    const done = (title, msg) => {
      const box = document.createElement('div');
      box.className = 'sent';
      box.setAttribute('role', 'status');
      box.innerHTML = '<h3></h3><p></p>';
      $('h3', box).textContent = title;
      $('p', box).textContent = msg;
      form.replaceWith(box);
      return box;
    };
    const openCal = (d) => {
      const first = d.name.split(/\s+/)[0], last = d.name.split(/\s+/).slice(1).join(' ');
      let src = CONFIG.bookingUrl;
      try {
        const u = new URL(CONFIG.bookingUrl);
        // Fill in what they've told us, and carry the ad's tracking through.
        Object.entries({ first_name: first, last_name: last, full_name: d.name, email: d.email, phone: d.phone }).forEach(([k, v]) => { if (v) u.searchParams.set(k, v); });
        new URLSearchParams(location.search).forEach((v, k) => { if (/^(utm_|fbclid$)/.test(k)) u.searchParams.set(k, v); });
        src = u.toString();
      } catch { /* use the link as given */ }
      const f = document.createElement('iframe');
      f.src = src;
      f.title = 'Pick a time for your call';
      f.id = 'ghl-booking';
      f.scrolling = 'no';
      cal.replaceChildren(f);
      const sc = document.createElement('script');
      sc.src = 'https://link.msgsndr.com/js/form_embed.js'; // GHL's own script sizes the calendar to fit
      sc.async = true;
      document.body.append(sc);
      $('[data-tab="form"]').classList.remove('on');
      $('[data-tab-cal]').classList.add('on');
      done(`Thanks, ${first}. Now pick a time.`, 'Choose a time on the calendar. You’ll get a text and an email to confirm it.');
      if (!matchMedia('(min-width: 900px)').matches) cal.scrollIntoView({ block: 'start' });
    };

    back.addEventListener('click', () => show(Math.max(0, at - 1), true));
    // Tapping an answer moves on by itself, except on the last question.
    $$('.opt input', form).forEach((r) => r.addEventListener('change', () => {
      if (at < qs.length - 1 && r.closest('.q') === qs[at]) setTimeout(() => show(at + 1, true), 160);
    }));

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const bad = wrong(qs[at]);
      if (bad) return say(bad);
      // Name, email and mobile are enough to follow up, even if they stop here.
      if (at === 0 && !started && CONFIG.formEndpoint) { started = true; post(answers('started')).catch(() => {}); }
      if (at < qs.length - 1) return show(at + 1, true);

      const d = answers('answered');
      track('Lead', { content_name: 'Detailer offer' });
      if (hasCal) {
        if (CONFIG.formEndpoint) post(d).catch(() => {});
        return openCal(d);
      }
      if (!CONFIG.formEndpoint) {
        const body = ['name', 'email', 'phone', 'business', 'area', 'jobs', 'budget'].map((k) => `${k}: ${d[k] || ''}`).join('\n');
        location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Detailer offer: ' + d.business)}&body=${encodeURIComponent(body)}`;
        done('Almost done', 'Your email app should open with your answers in it. Hit send and Patrick will text you to set a time.');
        return;
      }
      next.disabled = true;
      next.textContent = 'Sending';
      try {
        const res = await post(d);
        if (!res.ok) throw new Error(res.status);
        location.href = '/detailers/booked/?via=form';
      } catch {
        next.disabled = false;
        next.textContent = 'Send my answers';
        err.innerHTML = `That didn’t send. Please try again, or email <a href="mailto:${CONFIG.email}">${CONFIG.email}</a>.`;
        err.hidden = false;
      }
    });

    show(0, false);
  }

  /* ---- Sticky book bar on phones ------------------------------------- */
  const bar = $('#bar'), hero = $('#heroCta'), book = $('#book');
  if (bar && hero && book && 'IntersectionObserver' in window) {
    const seen = { hero: true, book: false };
    const set = () => {
      const on = !seen.hero && !seen.book;
      bar.classList.toggle('show', on);
      bar.setAttribute('aria-hidden', on ? 'false' : 'true');
      $('a', bar).tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver((es) => { es.forEach((e) => { seen[e.target === hero ? 'hero' : 'book'] = e.isIntersecting; }); set(); }).observe(hero);
    new IntersectionObserver((es) => { es.forEach((e) => { seen.book = e.isIntersecting; }); set(); }, { rootMargin: '0px 0px -30% 0px' }).observe(book);
  }
})();
