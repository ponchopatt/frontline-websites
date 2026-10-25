/* Detailer landing page: spots, video, calendar, phone book bar, pixel.
   Everything you'd change is in CONFIG. Leave a value empty and the page does without it
   (see README, "Detailer offer page"). The full version, with the calculators and the
   4-question form, is in drafts/frontline-main-site. */
const CONFIG = {
  bookingUrl: 'https://api.leadconnectorhq.com/widget/booking/YpAx9beLYyqM5mSxezDC', // the GHL calendar
  vslUrl: 'https://youtu.be/tM1K19JjLHE', // the video: a YouTube, Vimeo or Loom link, or an .mp4
  vslPoster: '',    // for an .mp4 only: the picture shown before it plays
  pixelId: '1627215515512140', // Meta Pixel ID (Frontline Systems website)
  spots: 3,         // spots in this round
  spotsTaken: 0,    // add one each time a detailer signs up
};

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const live = /(^|\.)(getfrontlinesystems\.com|frontlinesystems\.com\.au)$/.test(location.hostname);

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
  $$('[data-spots-short]').forEach((el) => { el.textContent = left ? `${left} ${word} left` : 'Next round'; });

  /* ---- Video ---------------------------------------------------------- */
  // The host's own player, embedded as it is (as on Syncova's page): one tap to play on any
  // phone, where a picture that loads the player on tap needs a second tap on iPhones.
  function embed(url) {
    let m;
    if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/))) return { src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1&playsinline=1` };
    if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return { src: `https://player.vimeo.com/video/${m[1]}?title=0&byline=0&portrait=0` };
    if ((m = url.match(/loom\.com\/(?:share|embed)\/([\w]+)/))) return { src: `https://www.loom.com/embed/${m[1]}?hide_owner=true&hide_share=true&hide_title=true` };
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { video: url };
    return { src: url };
  }
  const vsl = $('[data-vsl]'), frame = $('#vslFrame');
  if (vsl && CONFIG.vslUrl) {
    const e = embed(CONFIG.vslUrl);
    let el;
    if (e.video) {
      el = document.createElement('video');
      el.src = e.video; el.controls = true; el.playsInline = true; el.preload = 'metadata';
      if (CONFIG.vslPoster) el.poster = CONFIG.vslPoster;
      el.addEventListener('play', () => track('ViewContent', { content_name: 'VSL' }), { once: true });
    } else {
      el = document.createElement('iframe');
      el.src = e.src; el.title = 'Video: how the system works';
      el.allow = 'fullscreen; picture-in-picture; encrypted-media';
      el.allowFullscreen = true;
      // A tap into another site's player only shows here as the page losing focus to it.
      const played = () => { if (document.activeElement === el) { track('ViewContent', { content_name: 'VSL' }); window.removeEventListener('blur', played); } };
      window.addEventListener('blur', played);
    }
    frame.replaceChildren(el);
    vsl.hidden = false;
  } else if (vsl && !live) {
    vsl.hidden = false; // previews show the empty spot; the live site leaves it out
  }

  /* ---- Calendar ------------------------------------------------------- */
  // GHL's booking widget, with the ad's tracking tags carried through. The qualifying
  // questions are fields in the calendar's own booking form, set up in GHL.
  const cal = $('#cal');
  if (cal && /^https:\/\//.test(CONFIG.bookingUrl)) {
    let src = CONFIG.bookingUrl;
    try {
      const u = new URL(CONFIG.bookingUrl);
      new URLSearchParams(location.search).forEach((v, k) => { if (/^(utm_|fbclid$)/.test(k)) u.searchParams.set(k, v); });
      src = u.toString();
    } catch { /* use the link as given */ }
    const f = document.createElement('iframe');
    f.src = src;
    f.title = 'Book your free strategy call';
    f.id = 'ghl-booking';
    f.scrolling = 'auto'; // if sizing ever fails, the form can still be scrolled to its button
    f.loading = 'lazy';
    cal.replaceChildren(f);
    const sc = document.createElement('script');
    sc.src = 'https://link.msgsndr.com/js/form_embed.js'; // GHL's own script sizes the calendar to fit
    sc.async = true;
    document.body.append(sc);

    // Our own sizing, so "Schedule meeting" is never cut off. The calendar is 2 steps and
    // the form step is far taller than the date picker. GHL's script resizes the frame, but
    // ad blockers often block its domain, and then the frame stays date-picker sized. The
    // widget speaks iframe-resizer: it says Ready, waits for a parent to answer, then sends
    // its height on every change. We answer if GHL's script hasn't within 2 seconds, and
    // always add room under the content for anything that grows late (the "are you human"
    // check on the form).
    const ROOM = 40;
    let sized = false;
    // A minimum height, so GHL's script setting the exact height can't take the room away.
    const fit = (h) => { if (h > 0) f.style.minHeight = (h + ROOM) + 'px'; };
    window.addEventListener('message', (e) => {
      let host = '';
      try { host = new URL(e.origin).hostname; } catch { return; }
      if (!/(^|\.)(leadconnectorhq\.com|msgsndr\.com)$/.test(host) || e.source !== f.contentWindow) return;
      const d = e.data;
      if (typeof d === 'string') {
        const m = /^\[iFrameSizer\][^:]*:(\d+)(?:\.\d+)?:/.exec(d);
        if (m) { sized = true; fit(+m[1]); return; }
        if (d.indexOf('[iFrameResizerChild]Ready') === 0) {
          setTimeout(() => {
            if (!sized) e.source.postMessage(`[iFrameSizer]${f.id}:8:false:false:32:true:true:null:bodyOffset:null:null:0:false:parent:scroll:true`, e.origin);
          }, 2000);
          return;
        }
      }
      // GHL's own height message: ["highlevel.setHeight", {height}], sometimes sent as text.
      let a = d;
      if (typeof a === 'string' && a.charAt(0) === '[') { try { a = JSON.parse(a); } catch { a = null; } }
      if (Array.isArray(a) && a[0] === 'highlevel.setHeight' && a[1]) fit(+a[1].height);
    });
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
    new IntersectionObserver((es) => { es.forEach((e) => { seen.hero = e.isIntersecting; }); set(); }).observe(hero);
    new IntersectionObserver((es) => { es.forEach((e) => { seen.book = e.isIntersecting; }); set(); }, { rootMargin: '0px 0px -30% 0px' }).observe(book);
  }
})();
