import { redirect } from "next/navigation";
import { CallScreen } from "@/components/CallScreen";
import { currentOwner } from "@/lib/http";
import { elevenConfigured } from "@/lib/providers/status";

export const dynamic = "force-dynamic";

export default async function CallPage() {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  return (
    <main className="lobby">
      <CallScreen elevenlabs={elevenConfigured()} />
    </main>
  );
}
