"use client";

import { useState } from "react";
import { scribeScript, showcaseBusiness } from "@/content/marketing/timeline";

const slots = ["Tuesday, 10:00", "Tuesday, 14:00", "Wednesday, 10:00"];

export function ScribePreview({ product }: { product: string }) {
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [step, setStep] = useState<"call" | "message" | "photo" | "book">("call");
  const [fileName, setFileName] = useState("");
  const [booked, setBooked] = useState("");

  return (
    <div className="m-demo" id="receptionist">
      <div className="m-demo-bar">
        <span className="m-tag">Fictional</span>
        <strong>{showcaseBusiness.name}</strong>
        <span className="m-fine">Inquiry {showcaseBusiness.inquiry} stays the same if the language or the channel changes.</span>
      </div>
      <div className="m-seg" role="tablist" aria-label={`${product} demonstration`}>
        {([["call", "Call"], ["message", "Message"], ["photo", "Photo"], ["book", "Book"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={step === id} className={step === id ? "on" : ""} onClick={() => setStep(id)}>{label}</button>
        ))}
      </div>
      {step === "call" && (
        <div>
          <div className="m-seg">
            <button type="button" className={language === "en" ? "on" : ""} onClick={() => setLanguage("en")}>English</button>
            <button type="button" className={language === "es" ? "on" : ""} onClick={() => setLanguage("es")}>Español</button>
          </div>
          <ol className="m-transcript">
            {scribeScript[language].map((line) => (
              <li key={line.text}><b>{line.who}</b> {line.text}</li>
            ))}
          </ol>
          <p className="m-fine">English and Spanish are configured. These lines are sample copy, not a tested live call. Emergency language would stop the booking and direct the caller to 911 or the gas utility.</p>
        </div>
      )}
      {step === "message" && (
        <div className="m-card">
          <p><b>Website chat, same inquiry.</b> The facilities manager adds: "Drawings are in the shared folder. Priya Shah also needs the proposal."</p>
          <p className="m-fine">A name, a phone number, or an invoice number does not open the account. Private records wait for a one-time code.</p>
        </div>
      )}
      {step === "photo" && (
        <div className="m-card">
          <label htmlFor="sample-photo">Add a photo or document</label>
          <input id="sample-photo" type="file" accept="image/*,.pdf" onChange={(event) => setFileName(event.target.files?.[0]?.name || "")} />
          <p className="m-fine">{fileName ? `${fileName} stays on this device in the homepage preview. The examples page stores a file with the inquiry.` : "Nothing is uploaded from this preview."}</p>
        </div>
      )}
      {step === "book" && (
        <div className="m-card">
          <p>Sample openings. They are not read from a live calendar.</p>
          <div className="m-cta-row">
            {slots.map((slot) => (
              <button key={slot} type="button" className="m-btn m-btn-secondary" onClick={() => setBooked(slot)}>{slot}</button>
            ))}
          </div>
          {booked && <p role="status">Held {booked} for inquiry {showcaseBusiness.inquiry}. A repeated confirmation would return this same hold.</p>}
        </div>
      )}
    </div>
  );
}
