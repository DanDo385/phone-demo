import type { Metadata } from "next";
import { brandCssVariables } from "@/lib/brand";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

// Root layout for the demo surfaces: the fictional Palmetto Coast screens (/demo, /call,
// /c, /review, /renew, /login, /dashboard) and the prospect demo (/try). Each page or
// nested layout labels itself as a demo.
export const metadata: Metadata = {
  title: "Palmetto Coast — fictional receptionist demo",
  description: "A fictional multilingual AI receptionist demo for independent contractors.",
  robots: { index: false, follow: false },
};

export default function DemoRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={brandCssVariables() as React.CSSProperties}>
      <body className={fontVariables}>{children}</body>
    </html>
  );
}
