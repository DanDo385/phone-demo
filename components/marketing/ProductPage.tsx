import { Icon } from "./Icon";
import { TrackedLink } from "./TrackedLink";
import { cta } from "@/content/marketing/site";

type Product = {
  headline: string;
  lede: string;
  price: string;
  priceNote?: string;
  status?: string;
  includes: readonly string[];
  sections: ReadonlyArray<{ heading: string; body: string }>;
};

export function ProductPage({ product, id }: { product: Product; id: string }) {
  return (
    <div className="m-wrap m-page">
      <h1>{product.headline}</h1>
      {product.status && <p><span className="m-tag">{product.status}</span></p>}
      <p className="m-lede">{product.lede}</p>
      <div className="m-split">
        <div className="m-card">
          <p className="m-price">{product.price}</p>
          {product.priceNote && <p>{product.priceNote}</p>}
          <ul className="m-checks" role="list">
            {product.includes.map((item) => (
              <li key={item}><Icon name="check" size={18} /> <span>{item}</span></li>
            ))}
          </ul>
        </div>
        <div>
          {product.sections.map((s) => (
            <section key={s.heading} className="m-block">
              <h2>{s.heading}</h2>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
      </div>
      <div className="m-cta-row">
        <TrackedLink className="m-btn" href={cta.report.href} event="cta_click" props={{ cta: `report_${id}` }}>{cta.report.label}</TrackedLink>
        <TrackedLink className="m-btn m-btn-secondary" href={cta.walkthrough.href} event="cta_click" props={{ cta: `walkthrough_${id}` }}>{cta.walkthrough.label}</TrackedLink>
      </div>
    </div>
  );
}
