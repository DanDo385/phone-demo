import { login, ownerCookieName } from "@/lib/auth";
import { boot, json } from "@/lib/http";

export async function POST(request: Request) {
  boot();
  const body = await request.json();
  const result = login(String(body.email || ""), String(body.password || ""));
  if (!result) return json({ error: "Invalid credentials" }, 401);
  const response = json({ ok: true });
  response.cookies.set(ownerCookieName(), result.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}
