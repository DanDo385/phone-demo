"use client";

import { useMemo, useState } from "react";

const VOICES = [
  { id: "avery", name: "Avery", note: "Warm, recommended for English and Spanish" },
  { id: "jordan", name: "Jordan", note: "Clear and direct" },
  { id: "riley", name: "Riley", note: "Brighter pace" },
];

type Turn = { speaker: string; text: string };

export function CallScreen({ elevenlabs }: { elevenlabs: boolean }) {
  const [mode, setMode] = useState<"auto" | "en" | "es">("auto");
  const [voice, setVoice] = useState("avery");
  const [inquiryId, setInquiryId] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [label, setLabel] = useState("Not a telephone call");
  const [busy, setBusy] = useState(false);

  const greeting = useMemo(() => {
    if (mode === "es") return "Gracias por llamar a Palmetto Coast Home Services. Soy el asistente de inteligencia artificial y esta llamada se transcribe.";
    return "Thanks for calling Palmetto Coast Home Services. I’m the AI assistant, and this call is transcribed. You can speak English or Spanish. Puede hablar en español.";
  }, [mode]);

  async function start(channel: "simulated" | "elevenlabs") {
    setBusy(true);
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, voice, channel }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setLabel(body.error || "Could not start");
      return;
    }
    setInquiryId(body.inquiryId);
    setTurns([{ speaker: "agent", text: body.greeting }]);
    setLabel(channel === "elevenlabs" ? "Browser voice · ElevenLabs" : "Browser voice · simulated receptionist, not a telephone call");
    if (channel === "elevenlabs" && body.signedUrl) {
      await startEleven(body.signedUrl, body.inquiryId);
    } else {
      speak(body.greeting, mode === "es" ? "es-ES" : "en-US");
    }
  }

  async function startEleven(signedUrl: string, id: string) {
    const mod = await import("@elevenlabs/react");
    const conversation = await mod.Conversation.startSession({
      signedUrl,
      onMessage: (message: { message?: string; source?: string }) => {
        const textValue = message.message || "";
        const speaker = message.source === "user" ? "caller" : "agent";
        setTurns((prev) => [...prev, { speaker, text: textValue }]);
        void fetch("/api/voice/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inquiryId: id, speaker, text: textValue }),
        });
      },
    });
    void conversation;
  }

  async function send(utterance = text) {
    if (!inquiryId || !utterance.trim()) return;
    setText("");
    setTurns((prev) => [...prev, { speaker: "caller", text: utterance }]);
    const response = await fetch(`/api/inquiries/${inquiryId}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: utterance }),
    });
    const body = await response.json();
    setTurns((prev) => [...prev, { speaker: "agent", text: body.say }]);
    speak(body.say, body.language === "es" ? "es-ES" : "en-US");
  }

  function listen() {
    const Rec = (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; start: () => void } }).webkitSpeechRecognition;
    if (!Rec) {
      setLabel("This browser has no speech recognition. Type instead. This is still browser voice, not a telephone call.");
      return;
    }
    const rec = new Rec();
    rec.lang = mode === "es" ? "es-ES" : "en-US";
    rec.onresult = (event) => {
      const said = event.results[0][0].transcript;
      void send(said);
    };
    rec.start();
  }

  return (
    <div className="phone">
      <div className="demo-flag">Fictional demo · browser voice</div>
      <h1 className="wordmark" style={{ marginTop: 8 }}>Palmetto Coast</h1>
      <p className="muted">{label}</p>
      <div className="seg" style={{ margin: "12px 0" }}>
        {(["auto", "en", "es"] as const).map((item) => (
          <button key={item} className={mode === item ? "on" : ""} onClick={() => setMode(item)}>
            {item === "auto" ? "Auto" : item === "en" ? "English" : "Español"}
          </button>
        ))}
      </div>
      <div className="voice-grid">
        {VOICES.map((item) => (
          <button key={item.id} className={`voice ${voice === item.id ? "selected" : ""}`} onClick={() => { setVoice(item.id); speak(mode === "es" ? "Gracias por llamar." : item.note, mode === "es" ? "es-ES" : "en-US"); }}>
            <strong>{item.name}</strong>
            <div className="muted">{item.note}</div>
          </button>
        ))}
      </div>
      <p className="muted">Voice previews use this device’s speech. They are not an ElevenLabs sample unless a connected session is running.</p>
      <div className="actions" style={{ margin: "12px 0" }}>
        <button className="btn" disabled={busy} onClick={() => start("simulated")}>Start simulated browser voice</button>
        <button className="btn-secondary" disabled={!elevenlabs || busy} onClick={() => start("elevenlabs")}>Start ElevenLabs browser voice</button>
        <button className="btn-quiet" disabled={!inquiryId} onClick={listen}>Speak</button>
      </div>
      <div className="captions">
        {!turns.length && <p>{greeting}</p>}
        {turns.map((turn, index) => (
          <p key={index}><b>{turn.speaker === "agent" ? "AI" : "You"}:</b> {turn.text}</p>
        ))}
      </div>
      <div className="actions" style={{ marginTop: 12 }}>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Type if the microphone is unavailable" style={{ flex: 1, borderRadius: 999, border: "1px solid var(--line)", padding: "10px 14px" }} />
        <button className="btn" disabled={!inquiryId} onClick={() => send()}>Send</button>
      </div>
      {inquiryId && <p className="muted">Dashboard inquiry {inquiryId}</p>}
    </div>
  );
}

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
