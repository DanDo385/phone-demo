import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UpgradeReport } from "@/components/marketing/UpgradeReport";
import { brand } from "@/lib/brand";
import { upgradeById, upgradeView } from "@/lib/upgrade/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Website assessment", robots: { index: false, follow: false } };

export default async function UpgradePage({ params }: { params: Promise<{ id: string }> }) {
  const row = upgradeById((await params).id);
  if (!row) notFound();
  return <UpgradeReport initial={upgradeView(row)} />;
}
