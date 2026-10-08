"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// The running Lenis instance, if any, so a page change can reset it.
let lenis: Lenis | null = null;

// True from a page change until the visitor next scrolls, taps, clicks or types.
let holdTop = false;

/**
 * Put the page at the very top at once. Lenis keeps its own target, so a page
 * change mid-glide would otherwise ease back down to the old spot, and the CSS
 * smooth scroll would animate the jump; both are skipped here.
 */
function toTop() {
  lenis?.scrollTo(0, { immediate: true, force: true });
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

function jumpToTop() {
  holdTop = true;
  toTop();
}

// Smooth scrolling driven by GSAP's ticker so ScrollTrigger and Lenis agree on position.
// Off for reduced motion and for touch screens, where native scrolling feels better.
export function SmoothScroll() {
  const pathname = usePathname();
  const firstPage = useRef(true);

  // Every new page opens at the top. Next.js only scrolls when it judges the new
  // page's first element to be off screen, and on a phone a footer link clicked
  // mid-page left the next page where the last one was. A link to a section
  // (/#work) is left to Next.js, and the first page of a visit to the browser.
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    if (window.location.hash) return;
    jumpToTop();
  }, [pathname]);

  // ScrollTrigger (scroll-fx.tsx) re-measures each new page once it has rendered
  // and, when it is done, puts back the scroll position it recorded, which can be
  // the last page's: on a phone, a footer link opened the next page 6,000px down.
  // So until the visitor moves the page themselves, a finished re-measure puts it
  // back at the top.
  useEffect(() => {
    const release = () => {
      holdTop = false;
    };
    const onRefresh = () => {
      if (holdTop) toTop();
    };
    const inputs = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    ScrollTrigger.addEventListener("refresh", onRefresh);
    inputs.forEach((e) => window.addEventListener(e, release, { passive: true }));
    return () => {
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      inputs.forEach((e) => window.removeEventListener(e, release));
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const instance = new Lenis({ lerp: 0.14, anchors: { offset: -72 } });
    lenis = instance;
    instance.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      instance.destroy();
      if (lenis === instance) lenis = null;
    };
  }, []);
  return null;
}
