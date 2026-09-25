"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { imageSrc, imageSrcSet, imageSize } from "@/components/site/picture";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type Props = { before: string; after: string; beforeAlt: string; afterAlt: string; className?: string };

// Before on the left, after on the right, a handle you drag between them. The control is a
// real range input laid over the photos, so fingers, mice and keyboards all work, and the
// handle gives one small nudge the first time it scrolls into view so people know to drag.
export function CompareSlider({ before, after, beforeAlt, afterAlt, className = "" }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const touched = useRef(false);
  const nudge = useRef<gsap.core.Tween | null>(null);

  // Any hand on the control (pointer, key or focus) ends the nudge for good,
  // so it can never pull the handle away from where someone has put it.
  const takeOver = () => {
    touched.current = true;
    nudge.current?.kill();
    nudge.current = null;
  };

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const state = { v: 50 };
      nudge.current = gsap.to(state, {
        v: 34,
        duration: 0.7,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut",
        scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
        onUpdate: () => {
          if (!touched.current) setPos(state.v);
        },
      });
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className={`relative aspect-[4/5] select-none overflow-hidden rounded-xl bg-card shadow-[0_30px_80px_rgba(0,0,0,0.7)] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background md:rounded-[14px] ${className}`}
    >
      <img
        src={imageSrc(before, 960)}
        srcSet={imageSrcSet(before)}
        sizes="(min-width: 1440px) 640px, (min-width: 768px) 55vw, 100vw"
        {...imageSize(before)}
        alt={beforeAlt}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <img
        src={imageSrc(after, 960)}
        srcSet={imageSrcSet(after)}
        sizes="(min-width: 1440px) 640px, (min-width: 768px) 55vw, 100vw"
        {...imageSize(after)}
        alt={afterAlt}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      />

      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: `${pos}%` }}>
        <span className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background shadow-[0_6px_20px_rgba(0,0,0,0.5)] md:size-14">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </span>
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-background/75 px-3 py-1.5 text-[13px] font-semibold text-foreground md:bottom-5 md:left-5">
        Before
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-background/75 px-3 py-1.5 text-[13px] font-semibold text-foreground md:bottom-5 md:right-5">
        After
      </span>

      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        onPointerDown={takeOver}
        onKeyDown={takeOver}
        onFocus={takeOver}
        aria-label="Drag to compare the paint before and after correction"
        className="absolute inset-0 m-0 h-full w-full cursor-ew-resize opacity-0 [touch-action:pan-y]"
      />
    </div>
  );
}
