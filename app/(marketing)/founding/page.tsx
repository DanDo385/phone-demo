import type { Metadata } from "next";
import { FoundingForm } from "@/components/marketing/FoundingForm";
import { FoundingOfferBlock } from "@/components/marketing/FoundingOfferBlock";
import { foundingPage } from "@/content/marketing/founding";

export const metadata: Metadata = foundingPage.meta;

export default function FoundingPage() {
  return (
    <div className="m-wrap m-page">
      <h1>{foundingPage.headline}</h1>
      <p className="m-lede">{foundingPage.lede}</p>
      <div className="m-split">
        <FoundingOfferBlock showCta={false} />
        <FoundingForm />
      </div>
    </div>
  );
}
