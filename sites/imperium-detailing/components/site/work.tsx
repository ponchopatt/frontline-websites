import { Picture } from "@/components/site/picture";
import { LoopVideo } from "@/components/site/loop-video";
import { site } from "@/lib/site";

// Every photo is shot on a phone in portrait. Laptops: a 4-up grid of tall
// cards, two rows. Phones and tablets: one row you swipe through.
//
// A tile is a photo unless it carries `video`, in which case it's a silent loop
// with the same frame. LoopVideo keeps each one on its poster until it is on
// screen and plays at most two at a time. Ordinary cars are deliberately mixed
// in with the supercars: the price guide quotes on a Corolla or a RAV4, so the
// gallery should show one.
type Frame = { name: string; alt: string; title: string; video?: { base: string; poster: string } };

const frames: Frame[] = [
  { name: "mclaren-650s", alt: "White McLaren 650S after a full detail in a Canberra driveway", title: "McLaren 650S" },
  { name: "huracan-driveway", alt: "Lamborghini Huracán after an exterior detail", title: "Lamborghini Huracán" },
  {
    name: "r8",
    alt: "Black Audi R8 detailed on a driveway: snow foam, the wash, the wheels and the finished car",
    title: "Audi R8",
    video: { base: "/media/r8-detail-720", poster: "/media/r8-detail-poster.webp" },
  },
  { name: "ranger-wildtrak", alt: "Ford Ranger Wildtrak, detailed and parked in a shed", title: "Ford Ranger Wildtrak" },
  {
    name: "m3-gtr",
    alt: "A black BMW M3 CS and a black Nissan GT-R, finished and parked together",
    title: "M3 CS and GT-R",
    video: { base: "/media/m3-gtr-720", poster: "/media/m3-gtr-poster.webp" },
  },
  {
    name: "m3-comp",
    alt: "White BMW M3 Competition, snow foamed and then finished, parked beside a red Audi R8",
    title: "BMW M3 Competition",
    video: { base: "/media/m3-comp-720", poster: "/media/m3-comp-poster.webp" },
  },
  {
    name: "x6",
    alt: "Black BMW X6 finished in a driveway: the flank, the boot, the red leather interior and the wheels",
    title: "BMW X6",
    video: { base: "/media/x6-detail-360", poster: "/media/x6-detail-poster.webp" },
  },
  { name: "lambo-interior", alt: "Detailed leather interior of a Lamborghini", title: "Huracán interior" },
];

const media = "absolute inset-0 h-full w-full object-cover";

export function Work() {
  return (
    <section id="work" aria-labelledby="work-heading" className="section-y border-t border-border">
      <div className="container-x mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="work-heading" className="display-caps max-w-[760px] text-[clamp(3.375rem,6.4vw,5.75rem)]" data-reveal="lines">
            Finishes that speak for themselves.
          </h2>
          <a
            href={site.instagram}
            rel="noopener"
            className="link-slide hidden text-[15px] text-secondary-foreground no-underline hover:text-foreground lg:mb-2.5 lg:inline-block"
          >
            More on Instagram, {site.instagramHandle}
          </a>
        </div>
      </div>

      {/* One list at every size: a swipe row until there is room for four across.
          The row runs to the screen edge on the right so the next card peeks in. */}
      <div className="mx-auto max-w-6xl lg:container-x">
        <ul
          aria-label="Recent work"
          tabIndex={0}
          className="m-0 mt-7 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] md:scroll-px-[4vw] md:px-[4vw] lg:mt-14 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {frames.map((f) => (
            <li key={f.name} className="w-[240px] shrink-0 snap-start md:w-[280px] lg:w-auto">
              <figure className="m-0">
                <div className="zoom-media relative h-[400px] overflow-hidden rounded-xl bg-card lg:h-[480px]">
                  {f.video ? (
                    <LoopVideo base={f.video.base} poster={f.video.poster} label={f.alt} className={media} />
                  ) : (
                    <Picture name={f.name} alt={f.alt} sizes="(min-width: 1024px) 300px, 280px" className={media} />
                  )}
                </div>
                <figcaption className="mt-3 text-sm text-muted-foreground">{f.title}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>

      <p className="container-x m-0 mt-3.5 text-[13px] text-muted-foreground lg:hidden">
        Swipe for more.{" "}
        <a href={site.instagram} rel="noopener" className="text-foreground underline underline-offset-4">
          More on Instagram, {site.instagramHandle}
        </a>
      </p>
    </section>
  );
}
