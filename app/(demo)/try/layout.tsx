import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import "./try.css";

export const metadata: Metadata = {
  title: `Try it on your business · ${brand.company.name}`,
  description: "Enter your website and Google Business Profile, then call a demo receptionist that answers as your business.",
};

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return <div className="try">{children}</div>;
}
