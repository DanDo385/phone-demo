import type { Metadata } from "next";
import { OwnershipTable } from "@/components/marketing/OwnershipTable";
import { ownershipPage } from "@/content/marketing/ownership";

export const metadata: Metadata = ownershipPage.meta;

export default function OwnershipPage() {
  return (
    <div className="m-wrap m-page">
      <h1>{ownershipPage.headline}</h1>
      <p className="m-lede m-promise-text">{ownershipPage.promise}</p>
      <p>{ownershipPage.body}</p>
      <OwnershipTable />
      <section className="m-block" aria-labelledby="leaving">
        <h2 id="leaving">{ownershipPage.leaving.heading}</h2>
        <ul className="m-bullets">
          {ownershipPage.leaving.points.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </section>
    </div>
  );
}
