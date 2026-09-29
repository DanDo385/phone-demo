import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";
import { privacyPage } from "@/content/marketing/legal";

export const metadata: Metadata = privacyPage.meta;

export default function PrivacyPage() {
  return <LegalPage page={privacyPage} />;
}
