import { Star } from "lucide-react";
import { BookingForm } from "@/components/site/booking-form";
import { SectionHeading } from "@/components/site/section-heading";
import { site, telHref } from "@/lib/site";

type Props = { title?: string; headingAs?: "h1" | "h2"; defaultService?: string };

const steps = ["You send the car and your suburb.", "We text back a fixed price and the next open days.", "You pick a day. For coatings and correction we call to confirm the details."];

// Phones: heading, then straight into the form, with the three steps as one line
// under it (the full list used to push the first field below the fold on /book/).
// Laptops: the heading and the details on the left, the form on the right.
export function Booking({ title = "Book your detail.", headingAs = "h2", defaultService }: Props) {
  return (
    <section id="book" className="border-t border-border py-16 md:py-24">
      <div className="container-x mx-auto grid max-w-6xl gap-x-12 gap-y-2 md:grid-cols-12 md:grid-rows-[auto_1fr] md:gap-y-0">
        <div className="md:col-span-5">
          <SectionHeading as={headingAs} title={title} intro="Tell us about the car and we'll come back with availability and a fixed quote." />
        </div>

        <div className="md:col-span-7 md:col-start-6 md:row-span-2 md:row-start-1 md:self-start">
          <p className="m-0 mb-3 flex items-center gap-2 text-[15px] text-secondary-foreground">
            <Star aria-hidden="true" className="size-4 fill-accent text-accent" strokeWidth={1.5} />
            <span>
              <b className="font-semibold text-foreground">{site.stats.rating}</b> from {site.stats.reviewCount} Google reviews
            </span>
          </p>
          <div className="rounded-lg border border-border bg-card p-6 md:p-8">
            <BookingForm defaultService={defaultService} />
          </div>
        </div>

        <div className="mt-6 md:col-span-5 md:col-start-1 md:row-start-2 md:mt-0">
          <p className="m-0 text-[15px] text-secondary-foreground md:hidden">
            <span className="text-foreground">How it works:</span> you send the car and your suburb, we text back a fixed price, you pick a day.
          </p>
          <ol className="m-0 hidden list-none gap-3 p-0 text-[15px] text-secondary-foreground md:grid">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span aria-hidden="true" className="display-caps mt-px w-5 shrink-0 text-xl leading-none text-accent">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <ul className="m-0 mt-6 grid list-none gap-3 p-0 text-[15px] text-secondary-foreground">
            <li>{site.notice}</li>
            <li>Mobile service across Canberra and Queanbeyan, no call-out fee</li>
            <li>Fully insured and finish-guaranteed</li>
            <li>
              Prefer to talk?{" "}
              <a href={telHref} className="text-foreground underline underline-offset-4">
                {site.phoneDisplay}
              </a>
              , {site.hours}
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
