import type { Metadata } from "next";
import Link from "next/link";
import { bookPage } from "@/content/marketing/book";
import { cta } from "@/content/marketing/site";

export const metadata: Metadata = bookPage.meta;

// Stub until walkthrough scheduling (WALKTHROUGH_CALENDAR_ID, bookings_walkthrough) is built.
export default function BookPage() {
  return (
    <div className="m-wrap m-page m-narrow">
      <h1>{bookPage.headline}</h1>
      <p className="m-lede">{bookPage.body}</p>
      <div className="m-cta-row">
        <Link className="m-btn" href={cta.founding.href}>{cta.founding.label}</Link>
        <Link className="m-btn m-btn-secondary" href={cta.report.href}>{cta.report.label}</Link>
      </div>
    </div>
  );
}
