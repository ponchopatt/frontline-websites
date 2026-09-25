"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { site, smsHref, telHref, prices } from "@/lib/site";
import { getService } from "@/lib/services";
import { hasWebm } from "@/lib/media";
import { QuoteCta } from "@/components/site/quote-cta";
import { buttonVariants, pill } from "@/components/site/link-button";

// TODO(pat): swap for one calm continuous shot of a finished car.
// The brief's placeholder, m3-gtr-720, turned out to be a fast-cut reel (six
// shots of two cars in nine seconds), which is exactly what the hero is meant
// to stop doing. This is the calmest single-car clip in public/media: one
// unbroken pan along a corrected black Mercedes. There is no 1080 cut of it,
// so `hd` is empty and laptops get the 720 file too; add one here when there is.
const clip = {
  base: "/media/paint-correction-720",
  hd: null as string | null,
  poster: "/media/paint-correction-poster.webp",
  // Phones show the clip as a short landscape band (412x259 on a Lighthouse
  // phone), so they get a 720x540 cut of the 720x1280 poster instead: cropped
  // around the same 58% line the band's object-position shows, so the pixels
  // on screen are the same ones, at under half the bytes (34KB against 74KB).
  // Cut from the full poster with sharp; recut it if the poster changes.
  posterPhone: "/media/paint-correction-poster-phone.webp",
  label: "A slow pan along a black Mercedes after paint correction, the garage lights reflected sharp in the paint",
};

// waiting: page still loading, the poster shows. playing: the clip runs.
// blocked: the browser refused autoplay.
type PlayState = "waiting" | "playing" | "blocked";

// Reduced motion or Save-Data: the clip is never fetched unless they press play.
const REDUCE = "(prefers-reduced-motion: reduce)";
const holdClip = () =>
  window.matchMedia(REDUCE).matches || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
const onHoldChange = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

// Pick the size for this screen; WebM first when it is the smaller file, MP4 as
// the fallback. Only ever called once the page has loaded or someone pressed play.
function attachSources(video: HTMLVideoElement) {
  if (video.querySelector("source")) return;
  const base = clip.hd && window.matchMedia("(min-width: 900px)").matches ? clip.hd : clip.base;
  const pairs = hasWebm(base)
    ? ([
        ["webm", "video/webm"],
        ["mp4", "video/mp4"],
      ] as const)
    : ([["mp4", "video/mp4"]] as const);
  for (const [ext, type] of pairs) {
    const s = document.createElement("source");
    s.src = `${base}.${ext}`;
    s.type = type;
    video.appendChild(s);
  }
  video.load();
}

const strip = [
  { slug: "ceramic-coating-canberra", price: prices.ceramic },
  { slug: "paint-correction-canberra", price: prices.correction },
  { slug: "full-car-detail-canberra", price: prices.full },
].map((p) => ({ ...p, service: getService(p.slug)! }));

export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayState>("waiting");
  const held = useSyncExternalStore(onHoldChange, holdClip, () => false);

  // The poster carries the first screen and the clip starts once the page has
  // loaded and the browser has a free moment, so it never races the page's own
  // CSS, fonts and scripts. Reduced motion and Save-Data never fetch it. This is
  // the only video the first screen loads.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || held) return;
    let idle = 0;
    const start = () => {
      const go = () => {
        attachSources(video);
        video.play().then(() => setState("playing")).catch(() => setState("blocked"));
      };
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(go, { timeout: 1500 });
      else idle = window.setTimeout(go, 200);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [held]);

  // Stop decoding once the hero has scrolled away.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || state !== "playing") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.1 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [state]);

  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    attachSources(v);
    v.currentTime = 0;
    v.play().then(() => setState("playing")).catch(() => setState("blocked"));
  };

  const playLabel = state === "blocked" || (held && state !== "playing") ? "Play the clip" : null;

  // The entrance is CSS (globals.css, "The hero is the intro"): it starts on first
  // paint rather than after hydration, and it cannot leave anything hidden. The
  // headline itself is not animated, so it paints with the HTML.
  //
  // Phones: the clip is a band across the top with the car's face in its top
  // third, fading into the page (280px on a 390x844 phone, shorter on a shorter
  // screen so the prices still clear the phone bar); the headline and the price strip sit under it,
  // all above the phone bar, which is the call to action (no buttons here).
  // Tablets: the same, with the buttons back (there is no phone bar).
  // Laptops: two columns, the words on the left and one tall 9:16 panel on the
  // right. The bottom-right corner stays empty for the chat bubble (60px, 20px
  // in from the corner): below 1400px wide the panel reaches into the last
  // 100px on the right, so there it is also capped by the screen's height, to
  // end 100px above the bottom of the first screen (72px header + 72px top
  // padding + 8px + 100px, plus 8px to spare = 260px). From 1400px up it clears the corner anyway.
  return (
    <section aria-label="Imperium Detailing" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[120px] top-10 -z-10 hidden size-[900px] bg-[radial-gradient(closest-side,rgba(31,111,196,0.30),rgba(15,61,110,0.12),rgba(5,6,8,0)_70%)] lg:block"
      />
      <div className="mx-auto max-w-6xl lg:container-x lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(300px,29.2vw,420px)] lg:gap-x-20 lg:max-[1400px]:grid-cols-[minmax(0,1fr)_min(clamp(300px,29.2vw,420px),max(240px,calc((100svh-260px)*9/16)))] lg:pb-[120px] lg:pt-[72px]">
        <div className="hero-panel relative lg:col-start-2 lg:row-start-1 lg:pt-2">
          <div className="relative h-[clamp(170px,calc(100svh-564px),280px)] overflow-hidden bg-card md:h-[440px] lg:aspect-[9/16] lg:h-auto lg:rounded-[14px] lg:shadow-[0_30px_80px_rgba(0,0,0,0.7),0_0_120px_rgba(31,111,196,0.25)]">
            {/* The poster is a real <picture> under the video rather than the
                video's poster attribute, so phones can be sent their own crop.
                It is the first screen's largest paint, so it loads eagerly at
                high priority straight from the HTML. The video has no poster
                of its own and stays transparent until its first frame covers
                this; if autoplay is refused or held, this is what stays. */}
            <picture>
              <source media="(min-width: 768px)" srcSet={clip.poster} width={720} height={1280} />
              <img
                src={clip.posterPhone}
                width={720}
                height={540}
                alt=""
                fetchPriority="high"
                className="absolute inset-0 h-full w-full object-cover object-[50%_58%] lg:object-center"
              />
            </picture>
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              preload="none"
              aria-label={clip.label}
              className="absolute inset-0 h-full w-full object-cover object-[50%_58%] lg:object-center"
            >
              {/* No <source> here on purpose. The effect above picks the file and
                  appends it once the page has loaded. Without JS the picture
                  above stands in. */}
            </video>
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[90px] bg-gradient-to-b from-background/0 to-background lg:hidden" />
            {playLabel && (
              <button
                type="button"
                onClick={replay}
                className="absolute right-4 top-4 z-10 min-h-11 rounded-full border border-white/20 bg-background/60 px-4 py-2 text-sm text-foreground backdrop-blur hover:bg-background/80"
              >
                {playLabel}
              </button>
            )}
          </div>
        </div>

        <div className="container-x relative z-10 -mt-2.5 md:mt-8 lg:col-start-1 lg:row-start-1 lg:mt-0 lg:flex lg:flex-col lg:justify-center lg:px-0">
          <h1 className="display-caps max-w-[800px] text-[min(12vw,2.9375rem)] md:text-[clamp(2.9375rem,7.2vw,6.5rem)]">{site.tagline}</h1>
          {/* TODO(pat): confirm this line. It is new wording for the redesign,
              put together from sentences already on the site. */}
          <p className="hero-sub mt-[18px] max-w-[54ch] text-base text-secondary-foreground md:mt-8 md:text-[19px]">
            Mobile detailing at your driveway or office car park<span className="hidden md:inline">, anywhere in {site.area}</span>. No call-out
            fee.<span className="hidden md:inline"> The number you&apos;re quoted is the number you pay.</span>
          </p>

          <ul className="hero-strip m-0 mt-5 grid max-w-[660px] list-none grid-cols-3 border-y border-border p-0 md:mt-9">
            {strip.map((p, i) => (
              <li key={p.slug} className={i > 0 ? "border-l border-border" : ""}>
                <Link
                  href={`/services/${p.slug}/`}
                  className={`flex h-full flex-col gap-0.5 py-3 text-foreground no-underline hover:text-white md:py-[18px] ${i > 0 ? "pl-3.5 md:pl-6" : ""}`}
                >
                  <span className="text-xs text-muted-foreground md:text-sm">
                    <span className="md:hidden">{p.service.short}</span>
                    <span className="hidden md:inline">{p.service.name}</span>
                  </span>
                  <span className="text-[15px]">
                    <span className="sr-only md:not-sr-only">from </span>
                    <span className="display-caps text-[30px] leading-none md:text-4xl">${p.price}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="hero-note m-0 mt-2 text-xs text-muted-foreground md:hidden">From-prices for a hatch or sedan.</p>

          {/* No buttons on a phone: the bar pinned to the bottom is the call to action. */}
          <div className="hero-cta mt-9 hidden gap-3 md:flex">
            <QuoteCta sms={smsHref()} />
            <a href={telHref} className={`inline-flex ${pill} ${buttonVariants.ghost}`}>
              Call {site.phoneDisplay}
            </a>
          </div>
          <p className="hero-note m-0 mt-4 hidden text-[15px] text-muted-foreground md:block">{site.quotePromise}</p>
        </div>
      </div>
    </section>
  );
}
