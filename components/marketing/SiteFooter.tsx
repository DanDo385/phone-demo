import Link from "next/link";
import { footer } from "@/content/marketing/site";
import { brand } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="m-footer">
      <div className="m-wrap">
        <p className="m-wordmark">{brand.company.name}</p>
        <p>{footer.tagline}</p>
        <p><strong>{footer.founding}.</strong></p>
        <nav aria-label="Footer" className="m-footer-links">
          {footer.links.map((link) => (
            <Link key={link.href} href={link.href}>{link.label}</Link>
          ))}
        </nav>
        <p className="m-fine">{footer.demoNote}</p>
      </div>
    </footer>
  );
}
