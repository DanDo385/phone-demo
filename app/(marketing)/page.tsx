import type { Metadata } from "next";
import Link from "next/link";
import { ConsultForm } from "@/components/marketing/ConsultForm";
import { OpportunityCalculator } from "@/components/marketing/OpportunityCalculator";
import { ScribePreview } from "@/components/marketing/ScribePreview";
import { SquirePreview } from "@/components/marketing/SquirePreview";
import { UpgradeForm } from "@/components/marketing/UpgradeForm";
import { home } from "@/content/marketing/home";
import { cta } from "@/content/marketing/site";
import { industries } from "@/content/marketing/timeline";
import { brand, formatPrice, plans } from "@/lib/brand";

export const metadata: Metadata = { title: home.meta.title, description: home.meta.description };

export default function HomePage() {
  return (
    <>
      <section className="m-hero">
        <div className="m-wrap">
          <p className="m-eyebrow">{home.hero.eyebrow}</p>
          <h1>{home.hero.headline}</h1>
          <p className="m-lede">{home.hero.subhead}</p>
          <div className="m-cta-row">
            <Link className="m-btn" href={cta.upgrade.href}>{cta.upgrade.label}</Link>
            <Link className="m-btn m-btn-secondary" href={cta.receptionist.href}>{cta.receptionist.label}</Link>
          </div>
        </div>
      </section>

      <section className="m-section" aria-labelledby="upgrade-heading">
        <div className="m-wrap m-split">
          <div>
            <h2 id="upgrade-heading">{home.upgrade.heading}</h2>
            <p>{home.upgrade.body}</p>
          </div>
          <UpgradeForm />
        </div>
      </section>

      <section className="m-section m-section-alt" aria-labelledby="scribe-heading">
        <div className="m-wrap">
          <h2 id="scribe-heading">{home.scribe.heading}</h2>
          <p>{home.scribe.body}</p>
          <ScribePreview product={brand.products.scribe} />
          <p className="m-fine"><span className="m-tag">Sample</span> {home.scribe.caption}</p>
        </div>
      </section>

      <section className="m-section" aria-labelledby="squire-heading">
        <div className="m-wrap">
          <h2 id="squire-heading">{home.squire.heading}</h2>
          <p>{home.squire.body}</p>
          <SquirePreview />
          <p className="m-fine"><span className="m-tag">Illustrative</span> {home.squire.caption}</p>
        </div>
      </section>

      <section className="m-section m-section-alt" aria-labelledby="industries">
        <div className="m-wrap">
          <h2 id="industries">{home.industries.heading}</h2>
          <p>{home.industries.body}</p>
          <ul className="m-grid-3" role="list">
            {industries.map((item) => (
              <li key={item.name} className="m-card"><h3>{item.name}</h3><p>{item.detail}</p></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="m-section" aria-labelledby="evidence">
        <div className="m-wrap">
          <h2 id="evidence">{home.evidence.heading}</h2>
          <p>{home.evidence.sourceNote}</p>
          <p><a href={home.evidence.sourceUrl}>{home.evidence.sourceName}</a></p>
          <ul className="m-stats" role="list">
            {home.evidence.stats.map((stat) => (
              <li key={stat.value} className="m-card"><strong>{stat.value}</strong><span>{stat.label}</span></li>
            ))}
          </ul>
          <p>{home.evidence.limit}</p>
          <OpportunityCalculator />
        </div>
      </section>

      <section className="m-section m-section-alt" aria-labelledby="compare">
        <div className="m-wrap">
          <h2 id="compare">{home.comparison.heading}</h2>
          <p>{home.comparison.body}</p>
          <ul className="m-plans" role="list">
            {plans.map((item) => (
              <li key={item.key} className="m-card m-plan">
                <h3 className="m-plan-name">{item.name}</h3>
                <p className="m-price">{formatPrice(item)}</p>
                <p>{item.summary}</p>
              </li>
            ))}
          </ul>
          <p className="m-cta-row"><Link href="/pricing">Compare what each service includes</Link></p>
        </div>
      </section>

      <section className="m-section" aria-labelledby="ownership">
        <div className="m-wrap">
          <h2 id="ownership">{home.ownership.heading}</h2>
          <p className="m-promise-text">{home.ownership.promise}</p>
          <ul className="m-bullets">
            {home.ownership.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
          <p><Link href="/ownership">How hosting, DNS, and handoff work</Link></p>
        </div>
      </section>

      <section className="m-section m-section-alt" aria-labelledby="consult-heading">
        <div className="m-wrap m-split">
          <div>
            <h2 id="consult-heading">{home.consult.heading}</h2>
            <p>{home.consult.body}</p>
            <p className="m-fine">{cta.preview}</p>
          </div>
          <ConsultForm />
        </div>
      </section>
    </>
  );
}
