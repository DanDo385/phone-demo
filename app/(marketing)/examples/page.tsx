import type { Metadata } from "next";
import { ShowcaseDesk } from "@/components/marketing/ShowcaseDesk";
import { ScribePreview } from "@/components/marketing/ScribePreview";
import { brand } from "@/lib/brand";
import { channelReports } from "@/lib/channels";
import { showcaseSnapshot } from "@/lib/ops/showcase";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Examples",
  description: "Fictional receptionist and job examples. Not clients.",
  robots: { index: false, follow: false },
};

export default function ExamplesPage() {
  const snap = showcaseSnapshot();
  const channels = channelReports();
  return (
    <div className="m-wrap m-page">
      <p className="m-eyebrow">Fictional demonstration</p>
      <h1>One inquiry, then the job</h1>
      <p className="m-lede">Cedarline Roofing and Northmill Facilities are not real businesses. Amounts are illustrative. Messages, bookings, and publications on this page are stored in the application and marked simulated unless a provider actually accepted them.</p>
      <ScribePreview product={brand.products.scribe} />
      <h2>What is connected</h2>
      <ul className="m-bullets">
        {channels.map((item) => (
          <li key={item.id}><strong>{item.label}: {item.state.replaceAll("_", " ")}.</strong> {item.next}</li>
        ))}
      </ul>
      <h2>Records</h2>
      <ul className="m-bullets">
        {snap.inquiries.map((inquiry) => (
          <li key={inquiry.id}>{inquiry.summary} · {inquiry.priority} · {inquiry.priority_reason}</li>
        ))}
      </ul>
      <ShowcaseDesk initial={snap} />
    </div>
  );
}
