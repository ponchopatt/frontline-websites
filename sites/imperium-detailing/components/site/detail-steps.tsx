"use client";

import { useEffect, useRef, useState } from "react";
import { detailSteps, type DetailStep, type StepId } from "@/lib/detail-steps";
import { SectionHeading } from "@/components/site/section-heading";
import { WashWipe } from "@/components/site/wash-wipe";

// The clips are 16:9 and the cards are tall, so each one is cropped to where
// the work is happening in its frame.
const focus: Partial<Record<StepId, string>> = {
  prewash: "40% 50%",
  iron: "72% 50%",
  clay: "50% 50%",
  coat: "45% 50%",
};

const PlayIcon = ({ playing }: { playing: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />}
  </svg>
);

// One step's card media. The poster is always there underneath, which covers a
// slow load, a failed load and reduced motion with the same markup. The video
// has no poster attribute of its own: it would be the same picture, and a
// poster attribute is fetched at once, far down the page, while the lazy <img>
// waits until the section is near. The video stays clear until its first frame. The clip is
// only created once its step has been played, so nothing loads for a step
// nobody opened, and it runs only while the section is on screen.
function StepMedia({ step, playing, reduced, onScreen, onToggle }: { step: DetailStep; playing: boolean; reduced: boolean; onScreen: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(playing);
  const [broken, setBroken] = useState(false);
  if (playing && !mounted) setMounted(true);

  useEffect(() => {
    const v = ref.current;
    if (!v || reduced) return;
    if (playing && onScreen) void v.play().catch(() => {});
    else v.pause();
  }, [playing, onScreen, reduced, mounted]);

  if (step.widget === "wash") {
    // The two-bucket wash is a hands-on panel rather than footage: it wipes itself
    // clean while the section is on screen, and a finger or mouse can take over.
    return <WashWipe live={onScreen} reduced={reduced} fill />;
  }

  const canPlay = Boolean(step.video && !broken && !reduced);
  return (
    <>
      <img
        src={step.poster}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: focus[step.id] }}
      />
      {canPlay && mounted && (
        <video
          ref={ref}
          muted
          loop
          playsInline
          preload="none"
          aria-label={step.alt}
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: focus[step.id] }}
        >
          <source src={step.video!} type="video/mp4" />
        </video>
      )}
      {canPlay && (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={playing}
          aria-label={`${playing ? "Pause" : "Play"} the ${step.label.toLowerCase()} clip`}
          className="group absolute inset-0 flex items-end justify-start p-3 text-foreground focus-visible:outline-offset-[-4px]"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-background/70 backdrop-blur transition-colors group-hover:bg-background/90">
            <PlayIcon playing={playing} />
          </span>
        </button>
      )}
      {!step.video && !step.widget && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
          Footage coming soon
        </span>
      )}
    </>
  );
}

// The five stages as five tall cards in a row on a laptop, a swipe row on a
// phone. One clip plays at a time: the first starts when the section comes into
// view, and tapping another card switches to it (tap the playing one to pause).
export function DetailSteps() {
  const firstClip = detailSteps.find((s) => s.video)?.id ?? null;
  const [playing, setPlaying] = useState<StepId | null>(firstClip);
  const [reduced, setReduced] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Nothing plays or downloads until the section is actually near the screen.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="in-a-detail" className="section-y border-t border-border">
      <div className="container-x mx-auto max-w-6xl">
        <SectionHeading
          title="What's included in a detail."
          intro="Five stages, in the order they happen. Pick one to see it on the car. Most of it is invisible by the time you get the keys back, which is exactly why people think a detail is just a wash."
        />
      </div>
      <div className="mx-auto max-w-6xl lg:container-x">
        <ol
          aria-label="Stages of a detail"
          className="m-0 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] md:scroll-px-[4vw] md:px-[4vw] lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {detailSteps.map((s, i) => (
            <li key={s.id} className="w-[200px] shrink-0 snap-start md:w-[240px] lg:w-auto">
              <div className="relative h-[300px] overflow-hidden rounded-xl border border-border bg-[#0a0e14] lg:h-[340px]">
                <StepMedia
                  step={s}
                  playing={playing === s.id}
                  reduced={reduced}
                  onScreen={onScreen}
                  onToggle={() => setPlaying((p) => (p === s.id ? null : s.id))}
                />
              </div>
              <p className="m-0 mt-3 flex items-baseline gap-2.5 md:mt-4">
                <span className="display-caps text-lg text-accent md:text-[22px]">{String(i + 1).padStart(2, "0")}</span>
                <span className="display-caps text-[26px] xl:text-[28px]">{s.label}</span>
              </p>
              <p className="m-0 mt-1.5 text-[13px] text-muted-foreground md:mt-2 md:text-sm">{s.short}</p>
            </li>
          ))}
        </ol>
      </div>
      <p className="container-x m-0 mt-3.5 text-[13px] text-muted-foreground lg:hidden">Swipe through all five stages.</p>
    </section>
  );
}
