"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { site, smsHref, telHref } from "@/lib/site";
import { formatPrice } from "@/lib/services";
import { sizes, jobs, tiers, ceramicTiers, guidePrice, type JobId, type SizeId, type Tier } from "@/lib/pricing";
import { SectionHeading } from "@/components/site/section-heading";
import { buttonClass, buttonVariants, pill } from "@/components/site/link-button";

const chip = (on: boolean) =>
  `flex cursor-pointer flex-col gap-0.5 rounded-[10px] border px-3.5 py-3 text-left md:px-4 md:py-3.5 transition-[border-color,background-color,transform] duration-200 active:scale-[0.985] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
    on ? "border-accent bg-accent/10 text-foreground" : "border-border text-secondary-foreground hover:border-secondary-foreground/50"
  }`;

// Pick the vehicle and the job, get the real price, take it to a text message.
export function PriceGuide({ title = "Your price in ten seconds." }: { title?: string }) {
  const [size, setSize] = useState<SizeId>("sedan");
  const [job, setJob] = useState<JobId>("full");
  const [tier, setTier] = useState<Tier>(3);
  const panel = useRef<HTMLDivElement>(null);

  const guide = guidePrice(job, size, tier);
  const jobMeta = jobs.find((j) => j.id === job)!;
  // The quote form's dropdown uses these names. Everything matches except the
  // plan, which the form spells out in full.
  const formService = jobMeta.label === "Maintenance plan" ? "Regular maintenance plan" : jobMeta.label;
  const sizeMeta = sizes.find((s) => s.id === size)!;

  // The number rolls to its new value instead of snapping (or snaps, for reduced motion).
  const [display, setDisplay] = useState(guide.price ?? 0);
  const last = useRef(guide.price ?? 0);
  useEffect(() => {
    const target = guide.price;
    if (target === null || target === last.current) return;
    const o = { v: last.current };
    last.current = target;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tween = gsap.to(o, { v: target, duration: instant ? 0 : 0.5, ease: "expo.out", onUpdate: () => setDisplay(Math.round(o.v)) });
    return () => {
      tween.kill();
    };
  }, [guide.price]);

  // On a phone the answer sits below the choices, so picking the job brings it into view.
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.current?.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "start" });
  }, [job, tier]);

  const formHref = `/book/?service=${encodeURIComponent(formService)}`;
  const label = jobMeta.label.toLowerCase();
  const vehicle = sizeMeta.label.toLowerCase();
  const sms =
    guide.price === null
      ? smsHref(`Hi Imperium, I'd like a quote for a ${label} on my ${vehicle}.\nVehicle: \nSuburb: `)
      : smsHref(`Hi Imperium, I'd like to lock in a ${label} for my ${vehicle}. Guide price ${formatPrice(guide.price)}${guide.suffix}.\nVehicle: \nSuburb: `);

  return (
    <section id="price-guide" className="section-y border-t border-border">
      <div className="container-x mx-auto max-w-6xl">
        {/* Choices on the left under the heading, the answer on the right, held in
            view while you pick (the panel is sticky on tablets and laptops). */}
        <div className="grid gap-6 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-7">
            <SectionHeading title={title} intro="Pick the vehicle and the job. That's the number, not a hook to get you on the phone." />
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-3 text-sm font-semibold text-foreground">Your vehicle</legend>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {sizes.map((s) => (
                  <label key={s.id} className={chip(size === s.id)}>
                    <input type="radio" name="pg-size" value={s.id} checked={size === s.id} onChange={() => setSize(s.id)} className="sr-only" />
                    <span className="text-[15px] font-semibold">{s.label}</span>
                    <span className="text-xs text-muted-foreground">{s.eg}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2.5 text-sm text-muted-foreground">Trucks are quoted by phone.</p>
            </fieldset>

            <fieldset className="m-0 mt-6 min-w-0 border-0 p-0 md:mt-8">
              <legend className="mb-3 text-sm font-semibold text-foreground">The job</legend>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {jobs.map((j) => (
                  <label key={j.id} className={chip(job === j.id)}>
                    <input
                      type="radio"
                      name="pg-job"
                      value={j.id}
                      checked={job === j.id}
                      onChange={() => {
                        picked.current = true;
                        setJob(j.id);
                      }}
                      className="sr-only"
                    />
                    <span className="text-[15px] font-semibold">{j.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {job === "ceramic" && (
              <fieldset className="m-0 mt-6 min-w-0 border-0 p-0 md:mt-8">
                <legend className="mb-3 text-sm font-semibold text-foreground">Warranty</legend>
                <div className="grid grid-cols-3 gap-2">
                  {tiers.map((t) => (
                    <label key={t} className={chip(tier === t)}>
                      <input
                        type="radio"
                        name="pg-tier"
                        value={t}
                        checked={tier === t}
                        onChange={() => {
                          picked.current = true;
                          setTier(t);
                        }}
                        className="sr-only"
                      />
                      <span className="text-[15px] font-semibold">{t} years</span>
                      <span className="text-xs text-muted-foreground">{formatPrice(ceramicTiers[size][t])}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          <div className="md:col-span-5 md:pt-6">
            <div ref={panel} style={{ scrollMarginTop: 88 }} className="panel-glow rounded-[14px] border border-border bg-card p-6 md:sticky md:top-24 md:p-9">
              <p className="m-0 text-sm text-muted-foreground">
                {jobMeta.label}, {vehicle}
              </p>
              {guide.price === null ? (
                <p key="quoted" className="price-in display-caps m-0 mt-3 text-5xl md:text-[64px]">
                  Quoted for you
                </p>
              ) : (
                <p key={`${guide.price}${guide.suffix}`} className="price-in m-0 mt-1.5 flex items-baseline gap-2 md:mt-2.5 md:gap-2.5">
                  <span className="text-sm text-muted-foreground md:text-[15px]">from</span>
                  <span aria-hidden="true" className="display-caps text-[72px] tabular-nums md:text-8xl">
                    {formatPrice(display)}
                  </span>
                  {guide.suffix && <span className="text-lg text-muted-foreground">{guide.suffix.trim()}</span>}
                  <span className="sr-only" aria-live="polite">
                    From {formatPrice(guide.price)}
                    {guide.suffix}
                  </span>
                </p>
              )}
              <p className="mt-3.5 text-[15px] text-secondary-foreground md:mt-5">{guide.why}</p>
              <p className="mt-2 text-[15px] text-muted-foreground">{jobMeta.note}</p>
              <div className="mt-7 flex flex-col gap-3">
                {/* On a laptop a tel: and an sms: link both do nothing, so there the
                    text button goes and the form link, with the service carried
                    across, becomes the filled one. Phones keep the text first, and
                    the call button lives in the phone bar at the bottom. */}
                <a href={sms} className={`${buttonClass("primary")} md:hidden`}>
                  {guide.cta}
                </a>
                <Link href={formHref} className={`${buttonClass("ghost")} md:hidden`}>
                  Send it through the form
                </Link>
                <Link href={formHref} className={`${pill} ${buttonVariants.primary} hidden md:inline-flex`}>
                  Send it through the form
                </Link>
                <a href={telHref} className={`${pill} ${buttonVariants.ghost} hidden md:inline-flex`}>
                  Call {site.phoneDisplay}
                </a>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {site.quotePromise}{" "}
                <Link href={jobMeta.slug} className="text-foreground underline underline-offset-4">
                  What&apos;s included
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
