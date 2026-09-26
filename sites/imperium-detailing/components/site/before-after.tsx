import { CompareSlider } from "@/components/site/compare-slider";
import { SectionHeading } from "@/components/site/section-heading";
import { LinkButton } from "@/components/site/link-button";

type Props = {
  before: string;
  after: string;
  caption: string;
  title?: string;
  intro?: string;
  /** A plain-spoken line under the caption. Replaces the "drag the handle" hint. */
  note?: string;
  /** A ghost button under the words, e.g. to the service page. */
  cta?: { href: string; label: string };
};

// The proof block: one real panel, swirls on one side, the corrected finish on the other.
// Laptops: the words on the left (5 of 12), the slider on the right (7 of 12).
// Phones: heading, then the slider, then the words, so the picture comes first.
export function BeforeAfter({ before, after, caption, title = "Before and after.", intro, note, cta }: Props) {
  return (
    <section id="before-after" className="section-y relative border-t border-border">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_40%_at_80%_50%,rgba(31,111,196,0.14),transparent_70%)]" />
      <div className="container-x relative mx-auto grid max-w-6xl md:grid-cols-12 md:grid-rows-[auto_auto] md:gap-x-12 lg:gap-x-20">
        <div className="md:col-span-5 md:row-start-1 md:self-end [&>div]:mb-7 md:[&>div]:mb-0">
          <SectionHeading title={title} />
        </div>
        <div className="md:col-span-7 md:col-start-6 md:row-span-2 md:row-start-1 md:self-center" data-reveal="up">
          <CompareSlider
            before={before}
            after={after}
            beforeAlt="Tailgate before paint correction: swirl marks and wash scratches under the inspection light"
            afterAlt="The same tailgate after a two-step paint correction and ceramic coating: a clear, mirror-flat reflection"
          />
        </div>
        <div className="mt-4 md:col-span-5 md:row-start-2 md:mt-7 md:self-start">
          <p className="m-0 max-w-[44ch] text-[15px] text-secondary-foreground md:text-lg" data-reveal="up">
            {intro ?? caption}
          </p>
          <p className="m-0 mt-2.5 max-w-[46ch] text-sm text-muted-foreground md:mt-4 md:text-[15px]" data-reveal="up">
            {note ?? "Drag the handle. Same tailgate, same light. Two-step correction, then a ceramic coating."}
          </p>
          {cta && (
            <LinkButton href={cta.href} variant="ghost" className="mt-6 md:mt-8">
              {cta.label}
            </LinkButton>
          )}
        </div>
      </div>
    </section>
  );
}
