import { CustomerPortal } from "@/components/CustomerPortal";

export default async function ContinuationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="lobby">
      <CustomerPortal token={token} />
    </main>
  );
}
