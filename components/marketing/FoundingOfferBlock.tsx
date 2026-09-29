import Link from "next/link";
import { cta } from "@/content/marketing/site";
import { foundingOffer } from "@/lib/brand";
import { Icon } from "./Icon";

export function FoundingOfferBlock({ showCta = true }: { showCta?: boolean }) {
  return (
    <section className="m-card m-founding" aria-labelledby="founding-heading">
      <h2 id="founding-heading">{foundingOffer.headline}</h2>
      <p className="m-slots">{foundingOffer.slotsRemaining} of {foundingOffer.totalSlots} founding spots open</p>
      <ul className="m-checks" role="list">
        {foundingOffer.terms.map((term) => (
          <li key={term}><Icon name="check" size={18} /> <span>{term}</span></li>
        ))}
      </ul>
      {showCta && <Link className="m-btn" href={cta.founding.href}>{cta.founding.label}</Link>}
    </section>
  );
}
