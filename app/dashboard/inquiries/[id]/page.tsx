import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { currentOwner } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  const { id } = await params;
  return <Dashboard inquiryId={id} />;
}
