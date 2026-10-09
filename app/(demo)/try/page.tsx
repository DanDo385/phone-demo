import { AnalyzerEntry } from "@/components/AnalyzerEntry";
import { brand } from "@/lib/brand";

export default function TryIntake() {
  return (
    <main className="try-wrap">
      <div className="try-brand">
        <span className="try-dot" /> {brand.company.name} demo
      </div>
      <h1>Hear your own business answer the phone.</h1>
      <p className="try-lede">
        Search for your business, confirm it&apos;s the right listing, then call a receptionist built from your public website
        and Google profile. This is a demo built from public information.
      </p>
      <AnalyzerEntry />
    </main>
  );
}
