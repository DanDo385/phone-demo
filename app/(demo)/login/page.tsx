"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
        });
        if (!response.ok) setError("Those owner credentials were not accepted.");
        else router.push("/dashboard");
      }}>
        <div className="kicker">Owner sign-in</div>
        <h1 className="wordmark">Alex Rivera</h1>
        <p className="muted">The local demo owner is alex.rivera@palmetto-coast.demo. The password comes from DEMO_OWNER_PASSWORD, defaulting to palmetto-demo.</p>
        <label>Email<br /><input name="email" defaultValue="alex.rivera@palmetto-coast.demo" style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid var(--line)" }} /></label>
        <label>Password<br /><input name="password" type="password" defaultValue="palmetto-demo" style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid var(--line)" }} /></label>
        {error && <p className="demo-flag">{error}</p>}
        <button className="btn" type="submit">Enter the dashboard</button>
      </form>
    </main>
  );
}
