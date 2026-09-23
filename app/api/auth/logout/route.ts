import { cookies } from "next/headers";
import { logout, ownerCookieName } from "@/lib/auth";
import { json } from "@/lib/http";

export async function POST() {
  const jar = await cookies();
  logout(jar.get(ownerCookieName())?.value);
  const response = json({ ok: true });
  response.cookies.delete(ownerCookieName());
  return response;
}
