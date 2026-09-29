import Link from "next/link";
import { formatPrice, plans } from "@/lib/brand";
import { Icon } from "./Icon";

// The three plans, straight from lib/brand.ts.
// headingLevel keeps the outline valid: 2 directly under a page h1, 3 under a section h2.
export function PlanCards({ compact = false, headingLevel = 3 }: { compact?: boolean; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <ul className="m-plans" role="list">
      {plans.map((p) => (
        <li key={p.key} className="m-card m-plan">
          <Heading className="m-plan-name">{p.name}</Heading>
          <p className="m-price">{formatPrice(p)}</p>
          <p>{p.summary}</p>
          {!compact && (
            <ul className="m-checks" role="list">
              {p.includes.map((item) => (
                <li key={item}><Icon name="check" size={18} /> <span>{item}</span></li>
              ))}
            </ul>
          )}
        </li>
      ))}
      {compact && (
        <li className="m-plans-more"><Link href="/pricing">Compare plans and founding terms</Link></li>
      )}
    </ul>
  );
}
