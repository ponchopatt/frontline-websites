/**
 * Hero media — the photo, or a video that falls back to the photo.
 *
 * Imperium's hero video is the model for the mechanics: muted, loop,
 * playsinline, preload="none", and the <source> children injected by JS so a
 * browser that will never play it does not fetch two megabytes first.
 *
 * What Imperium does NOT have, and we add because Pat asked for it: a
 * slow-connection fallback. Grepping their tree for navigator.connection,
 * saveData and effectiveType returns nothing. A tradie's customer opening a
 * texted link on 4G in a paddock should get the photo, not a 2MB download.
 *
 * With no JS the poster is what shows, which is the same picture the photo
 * fallback would have shown, so the hero is never empty.
 */
import { html, raw, sampleTag, when, present } from '../render.js';

export function heroMedia(cfg, { className = 'bg', sizes = '100vw' } = {}) {
  const hero = cfg.photos?.hero;
  if (!present(hero?.src)) return '';

  const video = cfg.heroVideo;
  const hasVideo = present(video?.mp4) || present(video?.webm);
  const poster = video?.poster || hero.src;

  const img = html`<img class="${className}" src="${hero.src}"${
    raw(hero.srcset ? ` srcset="${hero.srcset}" sizes="${sizes}"` : '')
  }${raw(hero.width ? ` width="${hero.width}"` : '')}${raw(hero.height ? ` height="${hero.height}"` : '')
  } fetchpriority="high" decoding="async" alt="${hero.alt ?? ''}">`;

  if (!hasVideo) return html`${img}${sampleTag(hero)}`;

  // The <img> stays in the markup as the thing that paints first and the thing
  // that remains if the video is never started.
  return html`<div class="fl-hero-media" data-hero-video
  ${raw(video.mp4 ? ` data-mp4="${video.mp4}"` : '')}${raw(video.webm ? ` data-webm="${video.webm}"` : '')}>
  ${img}
  <video class="${className} fl-hero-video" muted loop playsinline preload="none" poster="${poster}"
    aria-label="${video.alt || hero.alt || ''}"></video>
</div>`;
}

/** Runtime, inlined once per page. Only starts a video worth starting. */
export const heroVideoScript = `
  /* Hero video: only for a screen that wants motion and a connection that can
     afford it. Everything else keeps the photograph, which is already painted. */
  (function(){
    var host=document.querySelector('[data-hero-video]');
    if(!host) return;
    var video=host.querySelector('video');
    if(!video) return;

    var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    var thin=!!(c&&(c.saveData===true||/^(slow-)?2g$/.test(c.effectiveType||'')||(c.effectiveType==='3g')));
    if(reduce||thin) return;                       /* the photo stands */

    host.classList.add('on');
    var mp4=host.getAttribute('data-mp4'), webm=host.getAttribute('data-webm');
    /* WebM first: smaller for the same quality where it is supported. */
    [[webm,'video/webm'],[mp4,'video/mp4']].forEach(function(pair){
      if(!pair[0]) return;
      var s=document.createElement('source');
      s.src=pair[0]; s.type=pair[1];
      video.appendChild(s);
    });
    video.preload='auto';
    video.load();
    video.play().then(function(){ host.classList.add('playing'); }).catch(function(){
      host.classList.remove('on');                 /* autoplay refused: photo stands */
    });

    /* Stop decoding once it scrolls away. On a phone this is the difference
       between the rest of the page scrolling smoothly and not. */
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(e){
        if(e[0].isIntersecting) video.play().catch(function(){});
        else video.pause();
      },{threshold:.1}).observe(video);
    }
  })();`;
