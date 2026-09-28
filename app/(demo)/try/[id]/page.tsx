import ProspectReport from "@/components/ProspectReport";

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProspectReport id={(await params).id} />;
}
