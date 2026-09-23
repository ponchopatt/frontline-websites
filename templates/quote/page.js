/**
 * quote template — runtime.
 *
 * Inlined into the page at build time. Everything it knows about the business
 * arrives in window.__CFG, written by bin/build.js from clients/<slug>/config.json.
 *
 * Two rules:
 *
 *   EVERY SECTION GUARDS ITSELF. A block whose markup was not rendered leaves
 *   no element behind, so each one starts by looking for its own root and
 *   returns if it is not there. One missing section must never take the rest
 *   of the page down with it.
 *
 *   CSS DEFAULTS ARE THE FINAL STATE. GSAP only ever sets a temporary
 *   from-state. If GSAP never loads, or a scroll trigger never fires, or motion
 *   is reduced, the content is simply there. Nothing can end up stuck invisible.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var all = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };
  var html = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CFG = window.__CFG || {};
  var SITE = CFG.site || {};
  var CALC = CFG.calculator || null;
  var COLOURS = CFG.colours || [];
  var REVIEWS = CFG.reviews || [];
  var OWNER = SITE.ownerFirstName || 'us';

  /* ---------- analytics: fires only if a tag is actually on the page ---------- */
  function track(ev, params) {
    try {
      if (window.gtag) gtag('event', ev, params || {});
      if (window.fbq) fbq('trackCustom', ev, params || {});
    } catch (e) { /* a missing tag is not an error */ }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest("a[href^='tel:'],a[href^='sms:']");
    if (a) track('generate_lead', { method: a.getAttribute('href').slice(0, 3) });
  });

  /* ---------- text-us links, pre-written so they only fill the blanks ---------- */
  var chosenColour = '', lastAutoNote = '';
  function smsHref(body) {
    if (!/^\+614\d{8}$/.test(SITE.phoneE164 || '')) return ''; // only a mobile takes a text
    return 'sms:' + SITE.phoneE164 + '?&body=' + encodeURIComponent(body);
  }
  function defaultSms() {
    return (SITE.smsBody || 'Hi ' + OWNER + ", I'd like a quote.\nSuburb: \n")
      + (chosenColour ? '\nColour: ' + chosenColour : '');
  }
  function setSmsLinks() {
    all('[data-sms]').forEach(function (a) {
      var k = a.getAttribute('data-sms');
      // "pg" links carry the price guide's own message; pgCalc owns those.
      if (k !== 'pg' && k !== 'pg2') { var h = smsHref(defaultSms()); if (h) a.href = h; }
    });
  }
  setSmsLinks();

  if ($('readReviews') && SITE.googleReviewsUrl) $('readReviews').href = SITE.googleReviewsUrl;
  if ($('writeReview') && SITE.googleWriteReviewUrl) $('writeReview').href = SITE.googleWriteReviewUrl;

  /* ---------- header + sticky call bar ---------- */
  (function () {
    var top = $('topbar');
    if (top) {
      var ticking = false;
      var onScroll = function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          top.classList.toggle('scrolled', window.scrollY > 40);
          ticking = false;
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    var bar = $('sticky'), heroEl = $('hero'), quoteEl = $('quote');
    if (!bar) return;
    var heroIn = true, quoteIn = false;
    function barSync() {
      var on = !heroIn && !quoteIn;
      bar.classList.toggle('on', on);
      // The bar is fixed, so the document needs its height back or it sits on
      // top of the form's send button and the footer links.
      document.body.classList.toggle('pad', on);
    }
    if ('IntersectionObserver' in window && heroEl && quoteEl) {
      new IntersectionObserver(function (e) { heroIn = e[0].isIntersecting; barSync(); }, { threshold: 0.05 }).observe(heroEl);
      new IntersectionObserver(function (e) { quoteIn = e[0].isIntersecting; barSync(); }, { threshold: 0.15 }).observe(quoteEl);
    } else { heroIn = false; barSync(); }
  })();

  /* ---------- price guide ----------------------------------------------------
     Generic over job type, unit and options, all from config.calculator:

       job.mode "per-unit"  price = quantity x tier range, plus optional extra
                            per unit (pulling out the old one) and any add-ons
       job.mode "fixed"     price comes straight from the chosen option
       job.mode "quote"     no number at all — we do not guess

     Any range the client has not confirmed carries _check, and the panel says
     "Guide only, confirmed on site" rather than pretending to be a quote. */
  var pgSummary = '', pgRange = '', pgLast = null, pgTween = null;
  var pgState = function () { return null; };

  (function () {
    var root = $('pricing');
    if (!root || !CALC || !CALC.jobs || !CALC.jobs.length) return;

    var jobsById = {};
    CALC.jobs.forEach(function (j) { jobsById[j.id] = j; });

    function checked(name) {
      var el = document.querySelector('input[name=' + name + ']:checked');
      return el ? el.value : '';
    }

    pgState = function () {
      var job = jobsById[checked('pgJob')] || CALC.jobs[0];
      var qtyEl = $('pgQty');
      var q = qtyEl ? parseInt(qtyEl.value, 10) : 0;
      if (!(q > 0)) q = 0;
      if (job.quantity && job.quantity.max) q = Math.min(job.quantity.max, q);
      return { job: job, tier: checked('pgTier'), addon: checked('pgAddon'), q: q };
    };

    function round(n) { return Math.round(n / (CALC.roundTo || 50)) * (CALC.roundTo || 50); }
    function money(n) { return '$' + round(n).toLocaleString('en-AU'); }

    function tierFor(job, id) {
      var tiers = (job.tiers || []);
      for (var i = 0; i < tiers.length; i++) if (tiers[i].id === id) return tiers[i];
      return tiers[0] || null;
    }
    function optionFor(list, id) {
      for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i];
      return null;
    }

    /** True if any part of this price is a range nobody has confirmed. */
    function unconfirmed(parts) {
      return parts.some(function (p) { return p && p._check === true; });
    }

    function calc() {
      var s = pgState(), job = s.job;
      var lo = 0, hi = 0, eyebrow = '', note = job.note || '', parts = [];

      // Show only the controls this job actually uses.
      var tierWrap = $('pgTierWrap'), qtyWrap = $('pgQtyWrap'), addonWrap = $('pgAddonWrap');
      if (tierWrap) tierWrap.hidden = !(job.tiers && job.tiers.length);
      if (qtyWrap) qtyWrap.hidden = !job.quantity;
      if (addonWrap) addonWrap.hidden = !(CALC.addons && CALC.addons.options && job.addons !== false);

      if (job.mode === 'quote') {
        eyebrow = job.quoteEyebrow || 'Priced from a photo';
      } else if (job.mode === 'fixed') {
        var opt = optionFor(job.options, s.addon) || (job.options || [])[0];
        if (opt && opt.range) {
          lo = opt.range[0]; hi = opt.range[1]; parts.push(opt);
          eyebrow = (job.eyebrow || 'Guide price for {option}').replace('{option}', opt.label);
        }
      } else {
        var tier = tierFor(job, s.tier);
        if (tier && tier.range && s.q > 0) {
          lo = s.q * tier.range[0]; hi = s.q * tier.range[1]; parts.push(tier);
          if (job.extraPerUnit) {
            lo += s.q * job.extraPerUnit.range[0];
            hi += s.q * job.extraPerUnit.range[1];
            parts.push(job.extraPerUnit);
          }
          var addon = CALC.addons && optionFor(CALC.addons.options, s.addon);
          if (addon && addon.range && (addon.range[0] || addon.range[1])) {
            lo += addon.range[0]; hi += addon.range[1]; parts.push(addon);
          }
          if (CALC.minimum) { lo = Math.max(lo, CALC.minimum[0]); hi = Math.max(hi, CALC.minimum[1]); }
          eyebrow = (job.eyebrow || 'Guide price for {qty} {unit} of {tier}')
            .replace('{qty}', s.q)
            .replace('{unit}', job.quantity ? (job.quantity.unit || '') : '')
            .replace('{tier}', tier.label || '')
            .replace('{addon}', addon && addon.range && addon.range[1] ? addon.label : '')
            .replace(/\s+/g, ' ').trim();
        } else {
          eyebrow = job.quantity ? (CALC.emptyEyebrow || 'Add a quantity to see a price') : '';
        }
      }

      var eyebrowEl = $('pgEyebrow'), noteEl = $('pgNote'), priceEl = $('pgPrice'), flagEl = $('pgFlag');
      if (eyebrowEl) eyebrowEl.textContent = eyebrow;
      if (noteEl) noteEl.innerHTML = note;

      var hasPrice = hi > 0;
      function paint(a, b) {
        priceEl.innerHTML = money(a) + ' <span class="nw"><small>to</small> ' + money(b) + '</span>';
      }
      if (pgTween) { pgTween.kill(); pgTween = null; }
      if (priceEl) {
        if (job.mode === 'quote') priceEl.textContent = job.quoteLabel || 'Send a photo';
        else if (!hasPrice) priceEl.textContent = CALC.emptyPrice || 'Add a quantity';
        else if (window.gsap && !reduce && pgLast) {
          var o = { a: pgLast.lo, b: pgLast.hi };
          pgTween = gsap.to(o, { a: lo, b: hi, duration: .5, ease: 'expo.out', onUpdate: function () { paint(o.a, o.b); } });
        } else paint(lo, hi);
      }
      if (hasPrice) pgLast = { lo: lo, hi: hi };

      // Say so when the numbers behind this are still guesses.
      if (flagEl) flagEl.hidden = !(hasPrice && unconfirmed(parts));

      pgRange = hasPrice ? money(lo) + ' to ' + money(hi) : '';
      pgSummary = eyebrow + (pgRange ? ', guide ' + pgRange : '');

      var body = hasPrice
        ? 'Hi ' + OWNER + ", I'd like to lock in a quote.\n" + eyebrow + '\nGuide price ' + pgRange
          + '\nSuburb: ' + (chosenColour ? '\nColour: ' + chosenColour : '')
        : defaultSms();
      all('[data-sms=pg],[data-sms=pg2]').forEach(function (a) { var h = smsHref(body); if (h) a.href = h; });
    }

    function syncChips() {
      all('.chip').forEach(function (l) {
        var i = l.querySelector('input');
        l.classList.toggle('on', !!(i && i.checked));
      });
    }
    function changed() { syncChips(); calc(); }

    ['pgJob', 'pgTier', 'pgAddon'].forEach(function (n) {
      all('input[name=' + n + ']').forEach(function (r) { r.addEventListener('change', changed); });
    });

    var qty = $('pgQty');
    if (qty) {
      var lim = function (v) {
        var min = Number(qty.min) || 1, max = Number(qty.max) || 9999;
        return Math.max(min, Math.min(max, v));
      };
      qty.addEventListener('input', changed);
      qty.addEventListener('blur', function () {
        var v = parseInt(qty.value, 10);
        if (v > (Number(qty.max) || 9999)) { qty.value = qty.max; changed(); }
      });
      if ($('pgMinus')) $('pgMinus').addEventListener('click', function () { qty.value = lim((parseInt(qty.value, 10) || 0) - 1); changed(); });
      if ($('pgPlus')) $('pgPlus').addEventListener('click', function () { qty.value = lim((parseInt(qty.value, 10) || 0) + 1); changed(); });
    }

    syncChips();
    calc();
  })();

  /* ---------- colour picker (only where a colour range is part of the sell) --- */
  (function () {
    var sw = $('swatches');
    if (!sw || !COLOURS.length) return;
    var fenceA = $('swatchA'), fenceB = $('swatchB'), photo = document.querySelector('.swatch-photo');
    var current = 0, swapped = false, cycle = null, userPicked = false;
    var phone = window.matchMedia('(max-width:899px)').matches;
    function srcFor(c) { return phone && c.small ? c.small : c.src; }

    COLOURS.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      var chip = document.createElement('span');
      chip.className = 'c';
      chip.style.background = c.hex;
      var name = document.createElement('b');
      name.textContent = c.name;
      b.appendChild(chip); b.appendChild(name);
      b.addEventListener('click', function () { stopCycle(); pick(i); });
      sw.appendChild(b);
    });

    function paintPhoto(c) {
      if (!fenceA || !fenceB || !photo) return;
      var next = swapped ? fenceA : fenceB, shown = swapped ? fenceB : fenceA;
      next.onload = function () {
        photo.classList.toggle('swap', !swapped);
        swapped = !swapped;
        shown.setAttribute('aria-hidden', 'true'); shown.alt = '';
        next.removeAttribute('aria-hidden');
        next.alt = (CFG.colourAltPrefix || 'Shown in ') + c.name;
      };
      // A leftover srcset would win over the new src.
      next.removeAttribute('srcset'); next.removeAttribute('sizes');
      next.src = srcFor(c);
    }

    function pick(i) {
      var c = COLOURS[i];
      if (!c) return;
      current = i; chosenColour = c.name;
      [].forEach.call(sw.children, function (el, k) { el.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      paintPhoto(c);
      all('.tintable').forEach(function (svg) { svg.style.setProperty('--sheet', c.hex); });
      if ($('swatchName')) $('swatchName').textContent = c.name;
      if ($('swatchHint')) $('swatchHint').textContent = c.hint || '';
      if ($('qColour')) $('qColour').value = c.name;
      setSmsLinks();
      var msg = $('qMsg');
      if (msg && (!msg.value.trim() || msg.value === lastAutoNote)) {
        lastAutoNote = 'Colour: ' + c.name;
        msg.value = lastAutoNote;
      }
    }

    function stopCycle() { userPicked = true; if (cycle) { clearInterval(cycle); cycle = null; } }

    all('.tintable').forEach(function (svg) { svg.style.setProperty('--sheet', COLOURS[0].hex); });
    if ($('qColour')) $('qColour').value = COLOURS[0].name;
    chosenColour = COLOURS[0].name;

    // Fetch the rest once the page is idle, so switching is instant.
    (window.requestIdleCallback || function (f) { setTimeout(f, 2500); })(function () {
      COLOURS.forEach(function (c, i) { if (i) { var im = new Image(); im.src = srcFor(c); } });
    });

    // They show themselves off until someone chooses, then stop for good.
    var section = $('colours');
    if (!reduce && 'IntersectionObserver' in window && section) {
      new IntersectionObserver(function (e) {
        if (userPicked) return;
        if (e[0].isIntersecting) {
          if (!cycle) cycle = setInterval(function () { pick((current + 1) % COLOURS.length); }, 2600);
        } else if (cycle) { clearInterval(cycle); cycle = null; }
      }, { threshold: .4 }).observe(section);
    }
    sw.addEventListener('pointerdown', stopCycle);
    sw.addEventListener('focusin', stopCycle);
  })();

  /* ---------- "what's included" stepper ---------- */
  (function () {
    var parts = $('parts');
    if (!parts || !parts.children.length) return;
    function showPart(li) {
      [].forEach.call(parts.children, function (el) {
        var on = el === li;
        el.classList.toggle('open', on);
        var btn = el.querySelector('button');
        if (btn) btn.setAttribute('aria-expanded', String(on));
      });
      var p = li.getAttribute('data-part');
      all('#anatomySvg [data-part]').forEach(function (el) {
        el.classList.toggle('hl', el.getAttribute('data-part') === p);
      });
    }
    [].forEach.call(parts.children, function (li) {
      var btn = li.querySelector('button');
      if (btn) btn.addEventListener('click', function () { showPart(li); });
    });
    showPart(parts.children[0]);
  })();

  /* ---------- gallery lightbox ---------- */
  (function () {
    var lb = $('lb'), img = $('lbImg'), cap = $('lbCap');
    var items = all('.gallery button');
    if (!lb || !img || !items.length) return;
    var idx = 0;
    function show(i) {
      idx = (i + items.length) % items.length;
      var b = items[idx];
      img.src = b.getAttribute('data-src');
      var thumb = b.querySelector('img');
      img.alt = thumb ? thumb.alt : '';
      if (cap) cap.textContent = b.getAttribute('data-cap') || '';
    }
    items.forEach(function (b, i) {
      b.addEventListener('click', function () {
        show(i);
        if (lb.showModal) { lb.showModal(); if ($('lbNext')) $('lbNext').focus(); }
        else window.open(b.getAttribute('data-src'));
      });
    });
    if ($('lbPrev')) $('lbPrev').addEventListener('click', function () { show(idx - 1); });
    if ($('lbNext')) $('lbNext').addEventListener('click', function () { show(idx + 1); });
    if ($('lbClose')) $('lbClose').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  })();

  /* ---------- motion: one hero moment, then quiet scroll reveals ---------- */
  if (window.gsap && window.ScrollTrigger && !reduce) {
    gsap.registerPlugin(ScrollTrigger);
    html.classList.add('gsap');
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('.hero img.bg', { scale: 1.12 }, { scale: 1, duration: 2.2 }, 0)
      .to('.hero .line>span', { y: 0, yPercent: 0, duration: 1.1, stagger: .13 }, .15)
      .to('.rule', { scaleX: 1, duration: .8 }, .7)
      .from('[data-hero]', { y: 22, opacity: 0, duration: .9, stagger: .1 }, .55);
    gsap.to('.hero img.bg', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
    if (document.querySelector('.quote .bgimg')) {
      gsap.to('.quote .bgimg', { yPercent: -8, ease: 'none', scrollTrigger: { trigger: '#quote', start: 'top bottom', end: 'bottom top', scrub: true } });
    }
    all('[data-reveal]').forEach(function (el) {
      var targets = el.getAttribute('data-reveal') === 'stagger' ? el.children : el;
      gsap.from(targets, { y: 28, opacity: 0, duration: .9, stagger: .09, ease: 'power3.out', immediateRender: false, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    var track_ = document.querySelector('.track');
    if (track_) gsap.fromTo(track_, { scaleX: 0 }, { scaleX: 1, ease: 'none', immediateRender: false, scrollTrigger: { trigger: '.steps', start: 'top 75%', end: 'bottom 55%', scrub: true } });
  } else {
    html.classList.add('ready');
  }

  /* ---------- count-up stats ----------------------------------------------
     The final figure is already in the HTML. This only animates over the top of
     it, so with no JS, no GSAP or reduced motion the right number is on screen. */
  all('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (!isFinite(target)) return;                       // never render "NaN"
    var raw = el.getAttribute('data-count');
    var dec = (raw.split('.')[1] || '').length;
    var suffix = el.getAttribute('data-suffix') || '';
    var fmt = function (v) {
      return v.toLocaleString('en-AU', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
    };
    if (reduce || !('IntersectionObserver' in window)) { el.textContent = fmt(target); return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      var start = null, dur = 1600;
      (function step(now) {
        if (start === null) start = now;
        var t = Math.min(1, (now - start) / dur);
        el.textContent = fmt(target * (1 - Math.pow(1 - t, 3)));   // power3.out
        if (t < 1) requestAnimationFrame(step); else el.textContent = fmt(target);
      })(performance.now());
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
  });

  /* ---------- quote form ---------- */
  (function () {
    var f = $('quoteForm');
    if (!f) return;

    var FIELDS = [
      ['qSuburb', 'qSuburbErr', function (v) { return !!v.trim(); }],
      ['qName', 'qNameErr', function (v) { return !!v.trim(); }],
      ['qPhone', 'qPhoneErr', function (v) { return digits(v) >= 8; }],
    ];
    function digits(v) { return (v.match(/\d/g) || []).length; }
    function setErr(el, errEl, bad) {
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (errEl) errEl.hidden = !bad;
    }
    function val(id) { var el = $(id); return el ? el.value.trim() : ''; }

    function composed(d) {
      return ['Hi ' + OWNER + ', quote request from the website.',
        d.service ? 'Need: ' + d.service : '',
        d.when ? 'When: ' + d.when : '',
        d.qty ? 'Size: about ' + d.qty : '',
        d.guide ? 'Price guide: ' + d.guide : '',
        'Suburb: ' + d.suburb,
        d.colour ? 'Colour: ' + d.colour : '',
        'Name: ' + d.name,
        'Mobile: ' + d.phone,
        d.email ? 'Email: ' + d.email : '',
        d.message ? 'Notes: ' + d.message : ''].filter(Boolean).join('\n');
    }

    // Clear an error as soon as the field becomes valid, never add one on typing.
    FIELDS.forEach(function (t) {
      var el = $(t[0]);
      if (!el) return;
      el.addEventListener('input', function () {
        if (el.getAttribute('aria-invalid') === 'true' && t[2](el.value)) setErr(el, $(t[1]), false);
      });
    });

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if ($('qCompany') && $('qCompany').value) return;   // honeypot: silent no-op

      var first = null;
      FIELDS.forEach(function (t) {
        var el = $(t[0]);
        if (!el) return;
        var bad = !t[2](el.value);
        setErr(el, $(t[1]), bad);
        if (bad && !first) first = el;
      });
      var err = $('formErr');
      if (first) { if (err) err.hidden = false; first.focus(); return; }
      if (err) err.hidden = true;

      var d = {
        service: val('qService'), when: val('qWhen'), qty: val('qQty'),
        suburb: val('qSuburb'), colour: val('qColour'), guide: val('qGuide'),
        name: val('qName'), phone: val('qPhone'), email: val('qEmail'), message: val('qMsg'),
      };
      var text = composed(d), btn = $('qSend'), firstName = d.name.split(' ')[0];

      function finish(mode) {
        var head = $('thanksHead'), body = $('thanksBody'), note = $('thanksNote'), sms = $('thanksSms');
        if (sms) { var h = smsHref(text); if (h) sms.href = h; }
        if (head) head.textContent = (mode === 'error' ? (CFG.form.errorHeading || 'That did not send.') : 'Thank you, ' + firstName + '.');
        if (body) {
          body.textContent =
            mode === 'sent' ? tmpl(CFG.form.successBody, { owner: OWNER, phone: d.phone })
            : mode === 'demo' ? (CFG.form.demoBody || 'Your enquiry has been received.')
            : tmpl(CFG.form.errorBody, { owner: OWNER, phone: SITE.phoneDisplay });
        }
        if (note) {
          note.hidden = mode !== 'demo';
          if (mode === 'demo') note.textContent = tmpl(CFG.demo.formNote, { owner: OWNER });
        }
        if ($('thanksSmsWrap')) $('thanksSmsWrap').hidden = (mode === 'demo') || !smsHref('');
        f.hidden = true;
        var thanks = $('thanks');
        if (thanks) {
          thanks.hidden = false;
          thanks.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        }
        track('generate_lead', { method: mode === 'sent' ? 'form' : mode, service: d.service });
      }

      function tmpl(s, vars) {
        return String(s || '').replace(/\{(\w+)\}/g, function (_, k) { return vars[k] == null ? '' : vars[k]; });
      }

      // No key: validate, show the real success state, say plainly that nothing
      // was sent, and make no network call at all.
      if (!SITE.formAccessKey) { finish('demo'); return; }

      if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = CFG.form.sendingLabel || 'Sending…'; }
      // A dead network otherwise leaves the button on "Sending…" for ever.
      var giveUp = new AbortController();
      var timer = setTimeout(function () { giveUp.abort(); }, 12000);

      fetch(SITE.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: SITE.formAccessKey,
          subject: 'Quote request: ' + (d.service || 'enquiry') + ' in ' + d.suburb,
          from_name: (SITE.name || '') + ' website',
          replyto: d.email || undefined,
          name: d.name, phone: d.phone, email: d.email, suburb: d.suburb,
          service: d.service, when: d.when, size: d.qty, colour: d.colour,
          guide: d.guide, message: text,
        }),
        signal: giveUp.signal,
      })
        .then(function (r) {
          // Web3Forms answers 200 with {success:false} for a rejected send, so
          // the status code on its own is not enough to call it delivered.
          return r.json().catch(function () { return {}; }).then(function (body) {
            if (!r.ok || body.success === false) throw new Error(body.message || r.status);
          });
        })
        .then(function () { finish('sent'); })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = CFG.form.submitLabel || 'Send enquiry'; }
          finish('error');
        })
        .then(function () { clearTimeout(timer); });
    });

    // Carry the price guide's answer into the form, so nobody retypes it.
    all('[data-toform]').forEach(function (a) {
      a.addEventListener('click', function () {
        var st = pgState();
        if (st && st.job) {
          if ($('qService')) $('qService').value = st.job.formService || st.job.label;
          if (st.q > 0 && $('qQty')) $('qQty').value = st.q;
        }
        if (pgSummary) {
          var line = 'Price guide: ' + pgSummary + (chosenColour ? ', colour ' + chosenColour : '');
          var msg = $('qMsg');
          if (msg && (!msg.value.trim() || msg.value === lastAutoNote)) { lastAutoNote = line; msg.value = line; }
          if ($('qGuide')) $('qGuide').value = pgSummary;
        }
        setTimeout(function () { if ($('qSuburb')) $('qSuburb').focus({ preventScroll: true }); }, 600);
      });
    });
  })();

  /* ---------- reviews marquee ---------- */
  (function () {
    var rows = $('rvRows');
    if (!rows || !REVIEWS.length) return;
    var star = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.7 5.9 21l1.3-6.8-5-4.7 6.8-.8z"/></svg>';
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function card(r, dup) {
      // Reviews are typed in by hand from a Google profile, but they are still
      // someone else's words arriving as data, so they are escaped.
      return '<blockquote class="rv' + (dup ? ' dup' : '') + '"' + (dup ? ' aria-hidden="true"' : '') + '>'
        + '<div class="stars" aria-label="5 out of 5 stars">' + star + star + star + star + star + '</div>'
        + '<p>' + esc(r.text) + '</p>'
        + '<footer><b>' + esc(r.name) + '</b><span>Google review</span></footer></blockquote>';
    }
    var half = Math.ceil(REVIEWS.length / 2);
    var r1 = REVIEWS.slice(0, half), r2 = REVIEWS.slice(half);
    function row(list, cls) {
      if (!list.length) return '';
      // Printed twice so translateX(-50%) lands on an identical frame.
      return '<div class="rv-row' + cls + '">'
        + list.map(function (r) { return card(r, false); }).join('')
        + list.map(function (r) { return card(r, true); }).join('') + '</div>';
    }
    rows.innerHTML = row(r1, '') + row(r2, ' rev');
  })();

  /* ---------- demo banner ----------
     ?clean=1 shows the page exactly as a real visitor would see it. */
  (function () {
    var bar = $('demobar');
    if (!bar) return;
    var key = 'fl-demobar-' + (CFG.slug || 'demo');
    var dismissed = false;
    try { dismissed = sessionStorage.getItem(key) === 'off'; } catch (e) { /* private mode */ }
    if (html.classList.contains('fl-clean')) return;
    document.body.classList.add('has-demobar');
    function size() { html.style.setProperty('--demobar-h', bar.offsetHeight + 'px'); }
    size();
    window.addEventListener('resize', size, { passive: true });
    var close = $('demoClose');
    if (close) close.addEventListener('click', function () {
      html.classList.add('fl-clean');
      document.body.classList.remove('has-demobar');
      html.style.setProperty('--demobar-h', '0px');
      try { sessionStorage.setItem(key, 'off'); } catch (e) { /* private mode */ }
    });
  })();
})();
