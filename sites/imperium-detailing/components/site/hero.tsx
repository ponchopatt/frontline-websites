"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { preload } from "react-dom";
import { site, smsHref, telHref, prices } from "@/lib/site";
import { services } from "@/lib/services";
import { Marquee } from "@/components/site/marquee";

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

// Pick the size for this screen; WebM first, MP4 as the fallback. Only ever
// called once the page has loaded or someone pressed play.
function attachSources(video: HTMLVideoElement) {
  if (video.querySelector("source")) return;
  const base = window.matchMedia("(min-width: 900px)").matches ? "/media/hero-1080" : "/media/hero-720";
  for (const [ext, type] of [
    ["webm", "video/webm"],
    ["mp4", "video/mp4"],
  ] as const) {
    const s = document.createElement("source");
    s.src = `${base}.${ext}`;
    s.type = type;
    video.appendChild(s);
  }
  video.load();
}

export function Hero() {
  preload("/media/hero-poster.webp", { as: "image", fetchPriority: "high" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayState>("waiting");
  const held = useSyncExternalStore(onHoldChange, holdClip, () => false);

  // The clip is 1.8MB on a phone. It used to preload in full, straight away,
  // racing the page's own CSS, fonts and scripts for a 1.6Mbps connection (and it
  // did so even for people who had asked for reduced motion). Now the poster
  // carries the first screen and the clip starts once the page has loaded and the
  // browser has a free moment. Reduced motion and Save-Data never fetch it.
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

  // Otherwise the hero keeps decoding the whole way down the page: a full video
  // stream's worth of work while you are looking at something else entirely. On a
  // phone that is the difference between the gallery scrolling smoothly and not.
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

  // The entrance itself is CSS (globals.css, "The hero is the intro"): it starts on
  // first paint rather than after hydration, and it cannot leave anything hidden.

  const playLabel = state === "blocked" || (held && state !== "playing") ? "Play the clip" : null;
  const strip = [...services.map((s) => s.name), "Mobile across Canberra and Queanbeyan", "No call-out fee"];
  // Both buttons are the same one: the quote form on a laptop, a text on a phone.
  // `translate` is what hover:-translate-y-0.5 sets in Tailwind 4, so that is the
  // property to transition; the entrance animates `transform` and never collides.
  const primary =
    "min-h-[54px] items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-accent-foreground no-underline shadow-[0_0_40px_rgba(58,143,224,0.35)] transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_0_60px_rgba(58,143,224,0.5)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

  return (
    <section aria-label="Imperium Detailing" className="relative overflow-hidden">
      {/* Full-bleed backdrop: a blurred frame of the footage, so the header floats over it. */}
      <div aria-hidden="true" className="absolute inset-x-0 -top-[72px] bottom-0 -z-10 hidden md:block">
        <img src="/media/hero-poster.webp" width={720} height={1280} alt="" className="h-full w-full scale-125 object-cover opacity-40 blur-3xl saturate-125" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_40%,rgba(31,111,196,0.22),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,6,8,0.55),rgba(5,6,8,0.15)_35%,rgba(5,6,8,0.6)_75%,#050608_100%)]" />
      </div>

      {/* Phones: the clip is the background and the copy sits at the bottom on a scrim.
          Tablets (md): copy first, then the clip as its own panel, so no text is ever on it.
          Laptops (lg): side by side, the copy in its own column with a 40px gutter. */}
      <div className="container-x relative mx-auto grid min-h-[calc(100svh-72px)] max-w-6xl items-end pb-10 md:min-h-0 md:items-start md:gap-10 md:py-12 lg:min-h-[calc(92vh-72px)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-10 lg:gap-y-0 lg:py-0 lg:pt-6">
        {/* Video: a glowing panel on tablets and laptops, the full background on phones. */}
        <div className="hero-panel absolute inset-0 md:relative md:row-start-2 md:aspect-[16/10] md:w-full lg:col-start-2 lg:row-start-1 lg:aspect-[9/16] lg:h-[min(76vh,780px)] lg:w-auto">
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="none"
            poster="/media/hero-poster.webp"
            aria-label="Washing and drying a green BMW M4 in a Canberra driveway, ending on an Imperium Detailing towel"
            className="panel-glow absolute inset-0 h-full w-full bg-card object-cover md:rounded-xl"
          >
            {/* No <source> here on purpose. The effect above picks the right size
                for the screen and appends its own pair once the page has loaded.
                Without JS the poster stands in, which is what a preload="none"
                video with no autoplay would show anyway. */}
          </video>
          {playLabel && (
            <button
              type="button"
              onClick={replay}
              className="absolute right-4 top-4 z-10 min-h-11 rounded-full border border-white/20 bg-background/60 px-4 py-2 text-sm text-foreground backdrop-blur hover:bg-background/80"
            >
              {playLabel}
            </button>
          )}
          {/* Phones only. Dark enough across the whole headline (the top line sits
              about 55% of the way up) that white type holds at least 3:1 even on
              the white snow foam. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 md:hidden"
            style={{
              background:
                "linear-gradient(to top, rgba(5,6,8,.96) 0%, rgba(5,6,8,.84) 45%, rgba(5,6,8,.72) 58%, rgba(5,6,8,.3) 74%, rgba(5,6,8,0) 90%)",
            }}
          />
        </div>

        {/* Copy. On laptops the headline is sized to its own column (cqi), so the
            longest line always ends short of the panel, whatever the window. */}
        <div className="relative z-10 pt-[40vh] md:row-start-1 md:pt-0 lg:col-start-1 lg:@container">
          <h1 className="display-caps text-[clamp(2.5rem,5.7vw,6.1rem)] max-[399px]:text-[8.6vw] lg:text-[min(6.1rem,11cqi)]">
            <span className="hero-line block overflow-x-visible overflow-y-clip pb-[.06em] -mb-[.06em] md:text-secondary-foreground">
              <span className="inline-block whitespace-nowrap">Not the cheapest</span>
            </span>
            <span className="hero-line block overflow-x-visible overflow-y-clip pb-[.06em] -mb-[.06em] md:text-secondary-foreground">
              <span className="inline-block whitespace-nowrap">detailer in Canberra.</span>
            </span>
            <span className="hero-line block overflow-x-visible overflow-y-clip pb-[.06em] -mb-[.06em]">
              <span className="inline-block whitespace-nowrap">The most careful one.</span>
            </span>
          </h1>
          <p className="hero-sub mt-6 max-w-[32rem] text-base text-secondary-foreground md:mt-8 md:text-lg">
            Ceramic coating from <b className="font-semibold text-foreground">${prices.ceramic}</b>. Paint correction from{" "}
            <b className="font-semibold text-foreground">${prices.correction}</b>. Full detail from{" "}
            <b className="font-semibold text-foreground">${prices.full}</b>. We come to your driveway or office car park, anywhere in {site.area}.
          </p>
          {/* Phones text; laptops can't, so there the main button jumps to the quote form. */}
          <div className="hero-cta mt-7 flex flex-col gap-3 sm:flex-row md:mt-8">
            <a href="#book" className={`${primary} hidden md:inline-flex`}>
              Get a quote
            </a>
            <a href={smsHref()} className={`${primary} inline-flex md:hidden`}>
              Text us your car
            </a>
            <a
              href={telHref}
              className="inline-flex min-h-[54px] items-center justify-center rounded-full border border-white/20 bg-background/40 px-7 text-base font-semibold text-foreground no-underline backdrop-blur transition-colors hover:border-white/50"
            >
              Call {site.phoneDisplay}
            </a>
          </div>
          <p className="hero-note mt-4 text-[15px] text-muted-foreground">{site.quotePromise}</p>
        </div>
      </div>

      <div className="hero-strip relative border-t border-white/10 py-4">
        <Marquee items={strip} />
      </div>
    </section>
  );
}
