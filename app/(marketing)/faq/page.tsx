import type { Metadata } from "next";
import { faqPage } from "@/content/marketing/faq";

export const metadata: Metadata = faqPage.meta;

export default function FaqPage() {
  return (
    <div className="m-wrap m-page m-narrow">
      <h1>{faqPage.headline}</h1>
      {faqPage.items.map((item) => (
        <section key={item.q} className="m-faq">
          <h2>{item.q}</h2>
          {item.a.map((p) => <p key={p}>{p}</p>)}
          {"list" in item && (
            <ul className="m-bullets">
              {item.list.map((li) => <li key={li}>{li}</li>)}
            </ul>
          )}
          {"after" in item && <p>{item.after}</p>}
        </section>
      ))}
    </div>
  );
}
