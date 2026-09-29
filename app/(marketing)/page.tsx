import type { Metadata } from "next";
import Link from "next/link";
import { AnalyzerEntry } from "@/components/AnalyzerEntry";
import { JobJourneyDemo } from "@/components/JobJourneyDemo";
import { Icon } from "@/components/marketing/Icon";
import { PlanCards } from "@/components/marketing/PlanCards";
import { TrackedLink } from "@/components/marketing/TrackedLink";
import { home } from "@/content/marketing/home";
import { cta } from "@/content/marketing/site";

export const metadata: Metadata = { title: home.meta.title, description: home.meta.description };

export default function HomePage() {
  return (
    <>
      <section className="m-hero">
        <div className="m-wrap">
          <p className="m-eyebrow">{home.hero.eyebrow}</p>
          <h1>{home.hero.headline}</h1>
          <p className="m-lede">{home.hero.subhead}</p>
          <AnalyzerEntry variant="hero" ctaLabel={cta.report.label} note={home.hero.reportNote} />
          <div className="m-cta-row">
            <TrackedLink className="m-btn m-btn-secondary" href={cta.hearYourBusiness.href} event="cta_click" props={{ cta: "hear_your_business" }}>
              <Icon name="phone" size={20} /> {cta.hearYourBusiness.label}
            </TrackedLink>
            <TrackedLink className="m-link" href={cta.demoBusiness.href} event="cta_click" props={{ cta: "demo_business" }}>
              {cta.demoBusiness.label}
            </TrackedLink>
          </div>
        </div>
      </section>

      <section className="m-section" aria-labelledby="problem">
        <div className="m-wrap">
          <h2 id="problem">{home.problem.heading}</h2>
          <ul className="m-grid-3" role="list">
            {home.problem.points.map((p, i) => (
              <li key={p.title} className="m-card">
                <span className="m-icon"><Icon name={(["voicemail", "phone", "search"] as const)[i]} /></span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="m-section m-section-alt" aria-labelledby="value">
        <div className="m-wrap m-split">
          <div>
            <h2 id="value">{home.value.heading}</h2>
            <p>{home.value.body}</p>
          </div>
          <ul className="m-checks m-checks-lg" role="list">
            {home.value.points.map((p) => (
              <li key={p}><Icon name="check" size={20} /> <span>{p}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="m-section" aria-labelledby="proof">
        <div className="m-wrap">
          <h2 id="proof">{home.proof.heading}</h2>
          <p>{home.proof.body}</p>
          <JobJourneyDemo label={home.proof.caption} />
        </div>
      </section>

      <section className="m-section m-section-alt" aria-labelledby="offer">
        <div className="m-wrap">
          <h2 id="offer">{home.offer.heading}</h2>
          <PlanCards compact />
          <p className="m-founding-line">{home.offer.founding}</p>
          <div className="m-card m-promise">
            <span className="m-icon"><Icon name="key" /></span>
            <div>
              <h3>{home.offer.ownershipHeading}</h3>
              <p>{home.offer.ownershipPromise}</p>
              <Link href="/ownership">How ownership works</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="m-section m-action" aria-labelledby="action">
        <div className="m-wrap">
          <h2 id="action">{home.action.heading}</h2>
          <p>{home.action.body}</p>
          <div className="m-cta-row">
            <TrackedLink className="m-btn" href={cta.report.href} event="cta_click" props={{ cta: "report_footer" }}>{cta.report.label}</TrackedLink>
            <TrackedLink className="m-btn m-btn-secondary" href={cta.walkthrough.href} event="cta_click" props={{ cta: "walkthrough" }}>{cta.walkthrough.label}</TrackedLink>
          </div>
        </div>
      </section>
    </>
  );
}
