"use client";

import { useState } from "react";

export default function RenewPage() {
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  return (
    <main className="lobby">
      <form className="login-card" onSubmit={async (event) => {
        event.preventDefault();
        const email = new FormData(event.currentTarget).get("email");
        const response = await fetch("/api/customer/renew", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const body = await response.json();
        setMessage(body.message || body.error || "");
        setLink(body.link || "");
      }}>
        <div className="demo-flag">Fictional demo</div>
        <h1 className="wordmark">Request a fresh link</h1>
        <p className="muted">Enter the email from your request. The old link is revoked.</p>
        <input name="email" type="email" required style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid var(--line)" }} />
        <button className="btn" type="submit">Request link</button>
        {message && <p>{message}</p>}
        {link && <p><a href={link}>Open the simulated link</a></p>}
      </form>
    </main>
  );
}
