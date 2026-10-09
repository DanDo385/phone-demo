import { redirect } from "next/navigation";

// The old fictional lobby is retired. The active demonstration lives on the public site.
export default function RetiredDemoLobby() {
  redirect("/examples");
}
