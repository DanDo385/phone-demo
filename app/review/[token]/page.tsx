import { ReviewForm } from "@/components/ReviewForm";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ platform?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  return (
    <main className="lobby">
      <ReviewForm token={token} platform={query.platform || "local"} />
    </main>
  );
}
