"use client";

import { useEffect, useState } from "react";

export function ReviewForm({ token, platform }: { token: string; platform: string }) {
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [body, setBody] = useState("");
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`/api/review/${token}?platform=${platform}`).then(async (response) => {
      if (!response.ok) {
        setError("This review link is expired or revoked.");
        return;
      }
      const payload = await response.json();
      setLanguage(payload.language);
    });
  }, [token, platform]);

  const es = language === "es";
  if (error) return <div className="review-card"><p>{error}</p></div>;

  return (
    <div className="review-card">
      <div className="demo-flag">{es ? "Vista previa local · no es Google ni Facebook" : "Local preview · not Google or Facebook"}</div>
      <h1 className="wordmark">{es ? "Escriba su reseña" : "Write your review"}</h1>
      <p>{es
        ? "Palmetto Coast Home Services es un negocio ficticio. Usted escribe la reseña. No hay incentivo y no pedimos solo opiniones positivas. Abrir esta página no significa que una reseña se haya publicado."
        : "Palmetto Coast Home Services is fictional. You write the review. There is no incentive, and we do not ask only for positive reviews. Opening this page does not mean a review was submitted."}</p>
      <p className="muted">{es ? "Plataforma de vista previa" : "Preview platform"}: {platform}</p>
      {done ? <p>{done}</p> : (
        <>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} style={{ width: "100%", borderRadius: 16, border: "1px solid var(--line)", padding: 12 }} />
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => post({ body, platform }, es ? "Guardamos su reseña solo en esta demostración." : "Your review is stored only in this demo.")}>{es ? "Enviar reseña" : "Submit review"}</button>
            <button className="btn-secondary" onClick={() => post({ alreadyReviewed: true }, es ? "Gracias. No enviaremos el recordatorio." : "Thank you. The reminder will not be sent.")}>{es ? "Ya reseñé" : "Already reviewed"}</button>
            <button className="btn-quiet" onClick={() => post({ optOut: true }, es ? "No enviaremos más recordatorios." : "No more reminders will be sent.")}>{es ? "No más recordatorios" : "No more reminders"}</button>
          </div>
        </>
      )}
    </div>
  );

  async function post(payload: unknown, message: string) {
    const response = await fetch(`/api/review/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) setError(es ? "No se pudo guardar." : "That could not be saved.");
    else setDone(message);
  }
}
