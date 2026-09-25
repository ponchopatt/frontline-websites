import Link from "next/link";
import { pill, buttonVariants } from "@/components/site/link-button";

/**
 * The primary button above the fold on the service pages was an sms: link. On a
 * phone that opens the messages app with the job already written; on a Windows
 * or Linux laptop it does nothing at all — and a service page reached from a
 * Google search for "ceramic coating canberra" is very often opened on one.
 *
 * So the same button in the same place goes to the quote form on a desktop and
 * to the messages app on a phone. This is what the home page hero already does;
 * the pattern just was not shared. The display classes are written out rather
 * than passed to LinkButton, because its base class sets inline-flex and two
 * display utilities on one element resolve by stylesheet order, not by the
 * order they appear in the attribute.
 */
const base = `${pill} ${buttonVariants.primary}`;

type Props = {
  sms: string;
  /** Where the laptop button goes: the form on this page, or /book/ (optionally with ?service=). */
  formHref?: string;
  /** Replaces the look (not the display rules), for a band that styles its buttons differently. */
  className?: string;
  /** The phone button's words. */
  smsLabel?: string;
};

export function QuoteCta({ sms, formHref = "#book", className = base, smsLabel = "Text us your car" }: Props) {
  return (
    <>
      <Link href={formHref} className={`${className} hidden md:inline-flex`}>
        Get a quote
      </Link>
      <a href={sms} className={`${className} inline-flex md:hidden`}>
        {smsLabel}
      </a>
    </>
  );
}
