import type { Metadata } from "next";
import { brand, brandCssVariables } from "@/lib/brand";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { fontVariables } from "@/lib/fonts";
import "./marketing.css";

// Root layout for the public site. Pages in this group are statically
// rendered, mobile-first, and WCAG 2.2 AA. Brand values come from lib/brand.ts only.
export const metadata: Metadata = {
  metadataBase: new URL(`https://${brand.domain}`),
  title: { default: brand.company.name, template: `%s · ${brand.company.name}` },
};

export default function MarketingRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={brandCssVariables() as React.CSSProperties}>
      <body className={fontVariables}>
        <a className="skip-link" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
