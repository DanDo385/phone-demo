"use client";

import { useEffect, useState } from "react";

type Payload = {
  language: "en" | "es";
  summary: string;
  appointment?: string;
  messages: Array<{ speaker: string; text: string }>;
  fictional: string;
};

export function CustomerPortal({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");

  async function load() {
    const response = await fetch(`/api/customer/${token}`);
    if (!response.ok) {
      setError(response.status === 401 ? "This link is expired or revoked." : "The page could not be opened.");
      return;
    }
    setData(await response.json());
  }

  useEffect(() => {
    void load();
  }, [token]);

  if (error) {
    return (
      <div className="portal">
        <p className="demo-flag">{error}</p>
        {error.includes("expired") ? <p><a href="/renew">Request a fresh link</a></p> : null}
      </div>
    );
  }
  if (!data) return <div className="portal">Loading…</div>;
  const es = data.language === "es";

  return (
    <div className="portal">
      <div className="demo-flag">{data.fictional}</div>
      <h1 className="wordmark">{es ? "Continúe su solicitud" : "Continue your request"}</h1>
      <p>{data.summary}</p>
      {data.appointment && (
        <p>
          <b>{es ? "Reserva de demostración" : "Local demo hold"}:</b> {data.appointment}
          <span className="muted"> · {es ? "no es un envío de técnico" : "not a dispatch"}</span>
        </p>
      )}
      <div className="seg">
        <button className={!es ? "on" : ""} onClick={() => setLanguage("en")}>English</button>
        <button className={es ? "on" : ""} onClick={() => setLanguage("es")}>Español</button>
      </div>
      <div className="captions" style={{ marginTop: 12 }}>
        {data.messages.map((message, index) => (
          <p key={index}><b>{message.speaker}:</b> {message.text}</p>
        ))}
      </div>
      <div className="actions" style={{ marginTop: 12 }}>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder={es ? "Escriba un mensaje" : "Write a message"} style={{ flex: 1, borderRadius: 999, border: "1px solid var(--line)", padding: "10px 14px" }} />
        <button className="btn" onClick={async () => {
          await fetch(`/api/customer/${token}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
          setText("");
          await load();
        }}>{es ? "Enviar" : "Send"}</button>
      </div>
      <label className="muted" style={{ display: "block", marginTop: 12 }}>
        {es ? "Subir una foto (JPG, PNG o WebP, hasta 5 MB)" : "Upload a photo (JPG, PNG, or WebP, up to 5 MB)"}
        {uploadError ? <div className="demo-flag">{uploadError}</div> : null}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const body = new FormData();
          body.set("file", file);
          const response = await fetch(`/api/customer/${token}/upload`, { method: "POST", body });
          if (!response.ok) {
            setUploadError(es ? "No se pudo guardar la foto." : "The photo could not be saved.");
            return;
          }
          setUploadError("");
          await load();
        }} />
      </label>
      <button className="btn-quiet" onClick={async () => {
        await fetch(`/api/customer/${token}/followup`, { method: "POST" });
        await load();
      }}>{es ? "Pedir seguimiento del propietario" : "Request owner follow-up"}</button>
    </div>
  );

  async function setLanguage(language: "en" | "es") {
    await fetch(`/api/customer/${token}/language`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language }) });
    await load();
  }
}
