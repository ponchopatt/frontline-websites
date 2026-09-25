import Link from "next/link";
import { reviews } from "@/lib/reviews";
import { site } from "@/lib/site";
import { buttonClass } from "@/components/site/link-button";

/**
 * Five real Google reviews, picked by name. A long one is shortened only by
 * leaving out whole sentences (`keep` lists the ones shown, by position), never
 * by rewording, so every word on the card is the customer's own.
 */
const picks: { name: string; keep?: number[] }[] = [
  { name: "Bradley", keep: [0] },
  { name: "Simon Wilson", keep: [0, 1] },
  { name: "SoyBean Sensei", keep: [1, 2] },
  { name: "Hammad Kamal" },
  { name: "Matt Yannopoulos", keep: [1] },
];

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/);

const featured = picks.map(({ name, keep }) => {
  const r = reviews.find((x) => x.name === name);
  if (!r) throw new Error(`Review by "${name}" is not in lib/reviews.json`);
  const all = sentences(r.quote);
  return { name, quote: keep ? keep.map((i) => all[i]).join(" ") : r.quote };
});

// Static, so it can be read at your own pace (it replaced the scrolling marquee
// on the home page). Phones get the first three and the link to the rest.
export function ReviewsGrid() {
  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="section-y border-t border-border bg-card/40">
      <div className="container-x mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-12">
          <h2 id="reviews-heading" className="display-caps max-w-[820px] text-[clamp(3.375rem,6.4vw,5.75rem)]" data-reveal="lines">
            Trusted by Canberra&apos;s most particular owners.
          </h2>
          <div className="flex items-baseline gap-2.5 md:mb-1.5 md:block md:shrink-0 md:text-right">
            <span className="display-caps text-[40px] leading-none md:text-[56px]">{site.stats.rating}</span>
            <p className="m-0 text-sm text-muted-foreground md:mt-1.5">
              <span className="sr-only">stars from </span>
              {site.stats.reviewCount} Google reviews
            </p>
            <Link href="/reviews/" className="hidden text-sm text-secondary-foreground underline-offset-4 hover:text-foreground hover:underline md:inline">
              Read them all
            </Link>
          </div>
        </div>

        <ul className="m-0 mt-6 grid list-none gap-3 p-0 md:mt-14 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {featured.map((r, i) => (
            <li key={r.name} className={i >= 3 ? "hidden md:block" : undefined}>
              <figure className="m-0 h-full rounded-xl border border-border bg-card p-6 md:p-8">
                <blockquote className="m-0 text-[17px] leading-normal md:text-[19px]">&ldquo;{r.quote}&rdquo;</blockquote>
                <figcaption className="mt-3.5 text-[13px] text-muted-foreground md:mt-5 md:text-sm">{r.name}</figcaption>
              </figure>
            </li>
          ))}
          <li className="hidden md:block">
            <div className="flex h-full flex-col justify-between rounded-xl border border-accent/40 p-8">
              <p className="m-0 text-[19px] text-secondary-foreground">
                {site.stats.reviewCount} reviews on Google, every one from a real customer.
              </p>
              <Link href="/reviews/" className={`${buttonClass("ghost")} mt-6 self-start`}>
                See all reviews
              </Link>
            </div>
          </li>
        </ul>
        <Link href="/reviews/" className={`${buttonClass("ghost")} mt-4 w-full md:hidden`}>
          See all {site.stats.reviewCount} reviews
        </Link>
      </div>
    </section>
  );
}
