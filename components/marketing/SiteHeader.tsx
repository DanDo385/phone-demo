import Link from "next/link";
import { cta, nav } from "@/content/marketing/site";
import { brand } from "@/lib/brand";

// The mobile menu is a <details> element, so it works without JavaScript.
export function SiteHeader() {
  return (
    <header className="m-header">
      <div className="m-wrap m-header-row">
        <Link href="/" className="m-wordmark">{brand.company.name}</Link>
        <nav aria-label="Main" className="m-nav-wide">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
          <Link className="m-btn m-btn-small" href={cta.report.href}>Free report</Link>
        </nav>
        <details className="m-nav-narrow">
          <summary>Menu</summary>
          <nav aria-label="Main">
            {nav.map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
            <Link href={cta.report.href}>Free report</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
