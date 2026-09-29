import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";
import { termsPage } from "@/content/marketing/legal";

export const metadata: Metadata = termsPage.meta;

export default function TermsPage() {
  return <LegalPage page={termsPage} />;
}
