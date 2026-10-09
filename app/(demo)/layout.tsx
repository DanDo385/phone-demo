import type { Metadata } from "next";
import { brandCssVariables } from "@/lib/brand";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

// Operations screens and the prospect preview. The retired sample lobby redirects to /examples.
export const metadata: Metadata = {
  title: "Operations",
  description: "Staff screens and a fictional sample workflow.",
  robots: { index: false, follow: false },
};

export default function DemoRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={brandCssVariables() as React.CSSProperties}>
      <body className={fontVariables}>{children}</body>
    </html>
  );
}
