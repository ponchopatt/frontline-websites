import { BookingForm } from "@/components/site/booking-form";
import { SectionHeading } from "@/components/site/section-heading";
import { site, smsHref, telHref } from "@/lib/site";

type Props = { title?: string; headingAs?: "h1" | "h2"; defaultService?: string };

// What the details column lists on a laptop. Phones skip it and go straight to
// the form: the number is in the phone bar and the header menu.
const details = [
  { term: "Hours", value: site.hours },
  { term: "Notice", value: site.notice },
  {
    term: "On the day, we need",
    value: "An outdoor tap and a 240V power point within reach. Correction and coating also need a garage or covered space.",
  },
];

// Phones: heading, one line saying a text is quicker, then straight into the
// form (the full details list used to push the first field below the fold on
// /book/). Laptops: the heading and the details on the left, the form in a card
// on the right.
export function Booking({ title = "Book your detail.", headingAs = "h2", defaultService }: Props) {
  return (
    <section id="book" className="section-y border-t border-border">
      <div className="container-x mx-auto grid max-w-6xl gap-y-6 md:grid-cols-12 md:gap-x-12 lg:gap-x-20">
        {/* SectionHeading's own bottom margin is for a section of text; here the
            form follows straight on, so it is tightened on phones. */}
        <div className="md:col-span-5 [&>div:first-child]:mb-0 md:[&>div:first-child]:mb-12">
          <SectionHeading
            as={headingAs}
            title={title}
            intro={
              <>
                <span className="hidden md:inline">{site.quotePromise}</span>
                {/* TODO(pat): confirm this line (new copy for the redesign). */}
                <span className="md:hidden">
                  Texting is quicker:{" "}
                  <a href={smsHref()} className="text-foreground underline underline-offset-4">
                    text us your car
                  </a>
                  . Or fill this in.
                </span>
              </>
            }
          />
          <dl className="m-0 hidden gap-5 text-[15px] md:grid">
            <div>
              <dt className="text-muted-foreground">Text or call</dt>
              <dd className="m-0 mt-1">
                <a href={telHref} className="text-xl font-semibold text-foreground no-underline hover:underline hover:underline-offset-4">
                  {site.phoneDisplay}
                </a>
              </dd>
            </div>
            {details.map((d) => (
              <div key={d.term}>
                <dt className="text-muted-foreground">{d.term}</dt>
                <dd className="m-0 mt-1 text-foreground">{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="md:col-span-7 md:self-start">
          <div className="rounded-[14px] md:border md:border-border md:bg-card md:p-10">
            <BookingForm defaultService={defaultService} />
          </div>
        </div>
      </div>
    </section>
  );
}
