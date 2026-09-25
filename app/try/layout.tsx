import type { Metadata } from "next";
import "./try.css";

export const metadata: Metadata = {
  title: "AI Receptionist Demo",
  description: "Enter your website and Google Business Profile, then call an AI receptionist that answers as your business.",
};

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return <div className="try">{children}</div>;
}
