import type { Metadata } from "next";
import { FoundingOfferBlock } from "@/components/marketing/FoundingOfferBlock";
import { OwnershipTable } from "@/components/marketing/OwnershipTable";
import { PlanCards } from "@/components/marketing/PlanCards";
import { pricingPage } from "@/content/marketing/pricing";

export const metadata: Metadata = pricingPage.meta;

export default function PricingPage() {
  return (
    <div className="m-wrap m-page">
      <h1>{pricingPage.headline}</h1>
      <p className="m-lede">{pricingPage.lede}</p>
      <PlanCards headingLevel={2} />
      <p className="m-note">{pricingPage.fairUse}</p>
      <FoundingOfferBlock />
      <section className="m-block" aria-labelledby="not-yet">
        <h2 id="not-yet">{pricingPage.notIncludedYet.heading}</h2>
        <ul className="m-bullets">
          {pricingPage.notIncludedYet.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <section className="m-block" aria-labelledby="own">
        <h2 id="own">{pricingPage.ownershipHeading}</h2>
        <OwnershipTable />
      </section>
    </div>
  );
}
