import type { Metadata } from "next";
import { researchPage } from "@/content/marketing/research";

export const metadata: Metadata = researchPage.meta;

export default function ResearchPage() {
  return (
    <div className="m-wrap m-page">
      <h1>{researchPage.headline}</h1>
      <p className="m-lede">{researchPage.lede}</p>
      <ul className="m-grid-3" role="list">
        {researchPage.entries.map((entry) => (
          <li key={entry.title} className="m-card">
            {entry.status === "coming_soon" && <p><span className="m-tag">Coming soon</span></p>}
            <h2 className="m-h3">{entry.title}</h2>
            <p>{entry.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
