"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { site, smsHref, telHref } from "@/lib/site";
import { buttonClass } from "@/components/site/link-button";

// Other pages whose phone hero has no buttons of its own (the 2026 redesign:
// /maintenance/ and the area pages), so the bar is there from the first screen.
const barFromTop = /^\/(maintenance|service-areas\/[^/]+)\/?$/;

// Phones only: Text and Call pinned to the bottom. On the home page it is there
// from the first screen, because the home hero has no buttons of its own on a
// phone; elsewhere it arrives once the hero (and its buttons) has scrolled away.
// It steps aside while the quote form is on screen, which on the home page now
// sits near the bottom, just above the areas and the footer.
//
// Its height (12 + 52 + 12px, plus the home-indicator inset) is --phone-bar-h
// in globals.css, which is also what lifts the chat bubble clear of it.
export function MobileBar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const targets = ["#book"].map((s) => document.querySelector(s)).filter((el): el is Element => el !== null);
    // The observer reports each target as soon as it is observed, so a route change resets the state.
    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        setCovered(visible.size > 0);
      },
      { threshold: 0.1 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [pathname]);

  const show = (pathname === "/" || barFromTop.test(pathname) || scrolled) && !covered;

  return (
    <>
      <div aria-hidden="true" className="h-[var(--phone-bar-h)] md:hidden" />
      <div
        id="phone-bar"
        inert={!show}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/[0.92] transition-transform duration-300 ease-out motion-reduce:transition-none md:hidden ${
          show ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <nav aria-label="Quick contact" className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2 px-4 py-3">
          <a href={smsHref()} className={`${buttonClass("primary")} px-3`}>
            Text us your car
          </a>
          <a href={telHref} aria-label={`Call ${site.phoneDisplay}`} className={`${buttonClass("ghost")} px-3`}>
            Call
          </a>
        </nav>
      </div>
    </>
  );
}
