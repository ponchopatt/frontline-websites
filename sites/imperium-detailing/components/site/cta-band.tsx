import { LinkButton } from "@/components/site/link-button";
import { QuoteCta } from "@/components/site/quote-cta";
import { site, smsHref, telHref } from "@/lib/site";

export function CtaBand({ title = "Ready when you are." }: { title?: string }) {
  return (
    <section className="border-t border-border bg-card/40 py-14 md:py-20">
      <div className="container-x mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="display-caps text-4xl md:text-6xl">{title}</h2>
          <p className="mt-4 max-w-[52ch] text-muted-foreground">{site.quotePromise}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          {/* A text on a phone; on a laptop, where sms: does nothing, the quote form. */}
          <QuoteCta sms={smsHref()} formHref="/book/" />
          <LinkButton href={telHref} variant="ghost">
            Call {site.phoneDisplay}
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
