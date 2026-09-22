/**
 * Before/after drag slider.
 *
 * The whole control is one transparent <input type="range"> laid over the pair,
 * with clip-path on the top image. That is Imperium's approach and it is worth
 * copying exactly: it gets touch, mouse, arrow keys, Home/End and screen
 * readers for free, where a pointer-event implementation gets none of them.
 *
 * The handle and the Before/After pills are aria-hidden and pointer-events:none
 * so they can never steal the gesture from the input underneath.
 *
 * Optional: most trades have no matched pairs, so with none in config this
 * renders nothing at all.
 */
import { html, raw, when, each, present } from '../render.js';

export function beforeAfter(cfg, { title, intro } = {}) {
  const pairs = (cfg.photos?.beforeAfter ?? []).filter((p) => present(p?.before) && present(p?.after));
  if (pairs.length === 0) return '';

  return html`
<section class="fl-ba" id="before-after">
  <div class="wrap">
    ${when(title, (t) => html`<div class="head" data-reveal>
      <h2>${t}</h2>${when(intro, (i) => html`<p class="lede">${i}</p>`)}
    </div>`)}
    <div class="fl-ba-grid" data-reveal="stagger">
      ${each(pairs, (pair, i) => slider(pair, i))}
    </div>
  </div>
</section>`;
}

function slider(pair, i) {
  const id = `ba-${i}`;
  const beforeAlt = pair.beforeAlt || 'Before';
  const afterAlt = pair.afterAlt || 'After';
  return html`<figure class="fl-ba-item">
  <div class="fl-ba-frame">
    <img class="fl-ba-img" src="${pair.before}" alt="${beforeAlt}" loading="lazy" decoding="async" draggable="false"${
      raw(pair.width ? ` width="${pair.width}"` : '')}${raw(pair.height ? ` height="${pair.height}"` : '')}>
    <img class="fl-ba-img fl-ba-after" src="${pair.after}" alt="${afterAlt}" loading="lazy" decoding="async" draggable="false"${
      raw(pair.width ? ` width="${pair.width}"` : '')}${raw(pair.height ? ` height="${pair.height}"` : '')}>
    <span class="fl-ba-tag fl-ba-tag-l" aria-hidden="true">${pair.beforeLabel || 'Before'}</span>
    <span class="fl-ba-tag fl-ba-tag-r" aria-hidden="true">${pair.afterLabel || 'After'}</span>
    <div class="fl-ba-handle" aria-hidden="true">
      <span class="fl-ba-knob">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg>
      </span>
    </div>
    <input class="fl-ba-range" id="${id}" type="range" min="0" max="100" value="50"
      aria-label="${pair.label ? `Drag to compare ${pair.label} before and after` : 'Drag to compare before and after'}">
  </div>
  ${when(pair.caption, (c) => html`<figcaption>${c}</figcaption>`)}
</figure>`;
}

/** Runtime, inlined once per page. Keeps the clip in step with the input. */
export const beforeAfterScript = `
  /* before/after: the range input IS the control. Everything else follows it. */
  [].slice.call(document.querySelectorAll('.fl-ba-frame')).forEach(function(frame){
    var range=frame.querySelector('.fl-ba-range');
    var after=frame.querySelector('.fl-ba-after');
    var handle=frame.querySelector('.fl-ba-handle');
    if(!range||!after) return;
    var touched=false;
    function apply(v){
      after.style.clipPath='inset(0 0 0 '+v+'%)';
      if(handle) handle.style.left=v+'%';
    }
    apply(range.value);
    range.addEventListener('input',function(){ touched=true; apply(range.value); });
    range.addEventListener('pointerdown',function(){ touched=true; });
    /* A small nudge the first time it scrolls in, so it reads as draggable.
       Abandoned the instant anyone touches it. */
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window){
      var io=new IntersectionObserver(function(e){
        if(!e[0].isIntersecting) return;
        io.disconnect();
        var start=null;
        (function step(now){
          if(touched) return;
          if(start===null) start=now;
          var t=Math.min(1,(now-start)/1400);
          var v=50-16*Math.sin(t*Math.PI);
          range.value=Math.round(v); apply(v);
          if(t<1) requestAnimationFrame(step);
        })(performance.now());
      },{threshold:.4});
      io.observe(frame);
    }
  });`;
