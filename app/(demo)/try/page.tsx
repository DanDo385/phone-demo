import { AnalyzerEntry } from "@/components/AnalyzerEntry";
import { brand } from "@/lib/brand";

export default function TryIntake() {
  return (
    <main className="try-wrap">
      <div className="try-brand">
        <span className="try-dot" /> {brand.company.name} demo
      </div>
      <h1>Hear an AI receptionist answer as your business.</h1>
      <p className="try-lede">
        Enter your website and Google Business Profile. In about a minute you get a receptionist trained on your services,
        a report of what callers can&apos;t find today, and a number to call.
      </p>
      <AnalyzerEntry variant="full" />
    </main>
  );
}
