import { addressInServiceArea, detectServiceCode, FAQS, GREETING, serviceByCode } from "./business";
import { resolveLanguage } from "./language";
import { zonedParts } from "./time";
import type { DialogueState, Facts, Lang, LanguageMode, ToolCall, ToolResult } from "./types";

export type TurnOutcome = {
  state: DialogueState;
  say: string;
  sayEn?: string;
  languageEvent?: { from: Lang; to: Lang; reason: string };
  calls: ToolCall[];
  results: ToolResult[];
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;

function say(lang: Lang, en: string, es: string): { say: string; sayEn?: string } {
  if (lang === "es") return { say: es, sayEn: en };
  return { say: en };
}

function emptyState(language: Lang, lock: DialogueState["lock"]): DialogueState {
  return { language, lock, languageAsked: lock === "explicit", facts: {} };
}

export function initialState(mode: LanguageMode): DialogueState {
  if (mode === "es") return emptyState("es", "explicit");
  if (mode === "en") return emptyState("en", "explicit");
  return emptyState("en", null);
}

export function greetingFor(state: DialogueState): { say: string; sayEn?: string } {
  return say(state.language, GREETING.en, GREETING.es);
}

function titleName(text: string): string {
  return text
    .replace(/^(my name is|this is|i'm|i am|me llamo|soy|mi nombre es)\s+/i, "")
    .replace(/[.]/g, "")
    .trim();
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return raw.trim();
}

function absorb(text: string, facts: Facts, pendingName: boolean): Facts {
  const next = { ...facts };
  const email = text.match(EMAIL_RE)?.[0];
  if (email) next.email = email;
  const phone = text.match(PHONE_RE)?.[0];
  if (phone) next.phone = normalizePhone(phone);
  if (!next.issue && detectServiceCode(text)) next.issue = text.trim();
  const code = detectServiceCode(`${next.issue ?? ""} ${text}`);
  if (code) next.serviceCode = code;
  if (looksLikeAddress(text)) {
    next.address = text.trim();
    next.inServiceArea = addressInServiceArea(text);
  }
  if (pendingName && !email && !phone && !looksLikeAddress(text) && text.trim().split(/\s+/).length <= 5) {
    const name = titleName(text);
    if (name && !/^(yes|no|si|sí|ok|okay)$/i.test(name)) next.name = name;
  }
  const named = text.match(/(?:my name is|me llamo|soy|mi nombre es)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ' -]{2,60})/i);
  if (named) next.name = named[1].trim();
  return next;
}

function looksLikeAddress(text: string): boolean {
  return (
    /\d{2,6}\s+\S+/.test(text) &&
    /street|st\b|ave|avenue|trace|drive|dr\b|road|rd\b|lane|ln\b|way|blvd|boulevard|calle|avenida|port st|tradition|lucie/i.test(
      text,
    )
  );
}

function isYes(text: string): boolean {
  return /^(yes|yeah|yep|correct|that(?:'s| is) (?:right|correct)|ok|okay|sure|please|s[ií]|correcto|as[ií] es|de acuerdo|claro)\b/i.test(
    text.trim(),
  );
}

function wantsEmail(text: string): boolean {
  return /email|e-mail|link|photo|foto|enlace|correo|imagen|picture/i.test(text) && /yes|please|send|env[ií]|s[ií]|por favor|quiero|ok/i.test(text);
}

function wantsBook(text: string): boolean {
  return /book|schedule|appointment|earliest|cita|reserv|venir|venga|tomorrow|mañana|manana/i.test(text);
}

function slotChoice(text: string): number | "earliest_tomorrow_morning" | undefined {
  if (/earliest|primera hora|lo m[aá]s pronto|the first|la primera/i.test(text)) {
    if (/tomorrow|mañana|manana|morning|mañana por la mañana/i.test(text) || /earliest/i.test(text)) {
      return "earliest_tomorrow_morning";
    }
    return 0;
  }
  if (/second|segunda/i.test(text)) return 1;
  if (/third|tercera/i.test(text)) return 2;
  const time = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
  if (time) return undefined;
  return undefined;
}

function isDangerousDiy(text: string): boolean {
  return /how do i (fix|repair|replace|solder|wire)|can i (fix|repair|replace) it myself|c[oó]mo (lo |la )?(arreglo|reparo|cambio)|pasos para reparar/i.test(
    text,
  );
}

function isUrgent(text: string): boolean {
  return /gas|spark|chispa|smoke|humo|flood|inund|incendio|fire|no power to the whole|sin luz en toda/i.test(text);
}

function faqAnswer(text: string, lang: Lang): string | undefined {
  const rules: Array<{ re: RegExp; id: string }> = [
    { re: /pet|mascota|perro|gato/i, id: "pets" },
    { re: /park|estacion/i, id: "parking" },
    { re: /cancel/i, id: "cancel" },
    { re: /hour|horario|open/i, id: "hours" },
    { re: /after hours|fuera de horario|emergency dispatch|emergencia/i, id: "after-hours" },
    { re: /speak spanish|habla espa|technician.*spanish|t[eé]cnico.*espa/i, id: "languages" },
    { re: /photo|foto/i, id: "photos" },
    { re: /pay|pago|invoice|factura/i, id: "payment" },
    { re: /area|zona|where do you/i, id: "area" },
    { re: /prepare|prepar/i, id: "prep" },
    { re: /someone home|estar en casa|acceso/i, id: "access" },
  ];
  const hit = rules.find((rule) => rule.re.test(text));
  if (!hit) return undefined;
  const faq = FAQS.find((item) => item.id === hit.id);
  return faq ? faq.a[lang] : undefined;
}

function missing(facts: Facts): "issue" | "name" | "phone" | "email" | "address" | "confirm" | "next" {
  if (!facts.issue) return "issue";
  if (!facts.name) return "name";
  if (!facts.phone) return "phone";
  if (!facts.email) return "email";
  if (!facts.address) return "address";
  if (!facts.detailsConfirmed) return "confirm";
  return "next";
}

function question(state: DialogueState): { say: string; sayEn?: string } {
  const lang = state.language;
  const facts = state.facts;
  switch (missing(facts)) {
    case "issue":
      return say(lang, "What can we help with at the house?", "¿Qué podemos revisar en la casa?");
    case "name":
      return say(lang, "What name should I put on the request?", "¿Qué nombre pongo en la solicitud?");
    case "phone":
      return say(lang, "What is the best callback number?", "¿Cuál es el mejor número para devolverle la llamada?");
    case "email":
      return say(lang, "What email should I use if we send a link?", "¿Qué correo uso si enviamos un enlace?");
    case "address":
      return say(
        lang,
        "What is the service address, including the city?",
        "¿Cuál es la dirección del servicio, incluida la ciudad?",
      );
    case "confirm":
      return say(
        lang,
        `I have ${facts.name}, callback ${facts.phone}, email ${facts.email}, at ${facts.address}. Is that correct?`,
        `Tengo a ${facts.name}, teléfono ${facts.phone}, correo ${facts.email}, en ${facts.address}. ¿Es correcto?`,
      );
    default:
      return say(
        lang,
        "I can email a link to continue or upload a photo, and I can check a visit time. What would you like?",
        "Puedo enviarle un enlace para continuar o subir una foto, y puedo revisar un horario. ¿Qué prefiere?",
      );
  }
}

function prefixSwitch(event: { from: Lang; to: Lang } | undefined, lang: Lang, body: { say: string; sayEn?: string }): { say: string; sayEn?: string } {
  if (!event) return body;
  const en = `We'll continue in ${lang === "es" ? "Spanish" : "English"}. I am keeping the same request. ${body.sayEn ?? body.say}`;
  const es = `Seguimos en ${lang === "es" ? "español" : "inglés"}. Mantengo la misma solicitud. ${lang === "es" ? body.say : body.sayEn ?? body.say}`;
  return lang === "es" ? { say: es, sayEn: en } : { say: en };
}

export async function runTurn(input: {
  state: DialogueState;
  text: string;
  mode: LanguageMode;
  inquiryId: string;
  exec: (call: ToolCall) => Promise<ToolResult>;
}): Promise<TurnOutcome> {
  const resolved = resolveLanguage({
    text: input.text,
    current: input.state.language,
    mode: input.mode,
    lock: input.state.lock,
    languageAsked: input.state.languageAsked,
  });
  let state: DialogueState = {
    ...input.state,
    language: resolved.language,
    lock: resolved.lock,
    languageAsked: resolved.languageAsked,
    facts: { ...input.state.facts },
  };
  const calls: ToolCall[] = [];
  const results: ToolResult[] = [];
  const lang = state.language;

  if (resolved.unsupported) {
    const speech = say(
      lang,
      "I can continue in English or Spanish. I don't support that language. I can also ask Alex Rivera to follow up.",
      "Puedo continuar en inglés o en español. No hablo ese idioma. También puedo pedir que Alex Rivera haga seguimiento.",
    );
    return { state, ...speech, languageEvent: resolved.event, calls, results };
  }
  if (resolved.ask) {
    const speech = say(lang, "Would you like to continue in English or Spanish?", "¿Prefiere continuar en inglés o en español?");
    return { state, ...speech, languageEvent: resolved.event, calls, results };
  }

  if (isDangerousDiy(input.text)) {
    state.facts.dangerousRefused = true;
    const speech = prefixSwitch(
      resolved.event,
      lang,
      say(
        lang,
        "I can't give repair instructions. I can schedule a technician or ask the office to follow up.",
        "No puedo dar instrucciones de reparación. Puedo programar un técnico o pedir que la oficina haga seguimiento.",
      ),
    );
    return { state, ...speech, languageEvent: resolved.event, calls, results };
  }

  const languageOnly = Boolean(resolved.event);
  const pendingName = missing(state.facts) === "name" && !languageOnly;
  state.facts = absorb(input.text, state.facts, pendingName);
  if (state.facts.address) state.facts.inServiceArea = addressInServiceArea(state.facts.address);

  if (isYes(input.text) && missing(state.facts) === "confirm") state.facts.detailsConfirmed = true;
  if (wantsBook(input.text) && state.facts.name && state.facts.phone && state.facts.email && state.facts.address) {
    state.facts.detailsConfirmed = true;
  }
  if (/^(no|nope|incorrect|incorrecto)\b/i.test(input.text.trim())) {
    state.facts.detailsConfirmed = false;
  }
  if (/uploaded a photo|sub[ií] la foto|ya sub[ií]/i.test(input.text)) state.facts.photoNote = true;

  const saveArgs = {
    inquiry_id: input.inquiryId,
    name: state.facts.name ?? null,
    phone: state.facts.phone ?? null,
    email: state.facts.email ?? null,
    address: state.facts.address ?? null,
    issue: state.facts.issue ?? null,
    service_code: state.facts.serviceCode ?? null,
    preferred_language: lang,
  };
  if (state.facts.name || state.facts.phone || state.facts.email || state.facts.address) {
    calls.push({
      name: "save_customer_details",
      args: saveArgs,
      idempotencyKey: `save:${input.inquiryId}:${state.facts.name ?? ""}|${state.facts.phone ?? ""}|${state.facts.email ?? ""}|${state.facts.address ?? ""}|${lang}`,
    });
  }

  if (isUrgent(input.text)) {
    calls.push({
      name: "request_human_followup",
      args: { inquiry_id: input.inquiryId, reason: input.text.slice(0, 240) },
      idempotencyKey: `followup:${input.inquiryId}:urgent`,
    });
  }

  const aside = wantsEmail(input.text) ? undefined : faqAnswer(input.text, lang);

  if (state.facts.inServiceArea === false && state.facts.address) {
    for (const call of calls) results.push(await input.exec(call));
    const speech = prefixSwitch(
      resolved.event,
      lang,
      say(
        lang,
        `${state.facts.address} is outside Port St. Lucie, Tradition, and St. Lucie West, so I cannot book a visit. I can ask Alex Rivera to follow up.`,
        `${state.facts.address} está fuera de Port St. Lucie, Tradition y St. Lucie West, así que no puedo reservar la visita. Puedo pedir que Alex Rivera haga seguimiento.`,
      ),
    );
    return { state, ...speech, languageEvent: resolved.event, calls, results };
  }

  const emailAgreed = wantsEmail(input.text) || (isYes(input.text) && /email|link|photo|foto|enlace|correo/i.test(input.text));
  if (emailAgreed && state.facts.email && !state.facts.continuationSent) {
    state.facts.continuationConsent = true;
    calls.push({
      name: "send_continuation_link",
      args: { inquiry_id: input.inquiryId, email: state.facts.email, language: lang },
      idempotencyKey: `continuation:${input.inquiryId}:${state.facts.email.toLowerCase()}`,
    });
  }

  const choice = slotChoice(input.text);
  const bookingRequested = wantsBook(input.text) || typeof choice === "number" || choice === "earliest_tomorrow_morning";
  if (bookingRequested && missing(state.facts) === "next" && state.facts.inServiceArea !== false && state.facts.serviceCode) {
    if (!state.facts.estimateExplained) {
      calls.push({
        name: "calculate_estimate",
        args: { inquiry_id: input.inquiryId, service_code: state.facts.serviceCode },
        idempotencyKey: `estimate:${input.inquiryId}:${state.facts.serviceCode}`,
      });
    }
    if (!state.facts.offeredSlots?.length) {
      calls.push({
        name: "check_availability",
        args: { inquiry_id: input.inquiryId, service_code: state.facts.serviceCode },
        idempotencyKey: `availability:${input.inquiryId}:${state.facts.serviceCode}:${new Date().toISOString().slice(0, 13)}`,
      });
    }
  } else if (missing(state.facts) === "next" && state.facts.serviceCode && !state.facts.estimateExplained && (isYes(input.text) || emailAgreed)) {
    calls.push({
      name: "calculate_estimate",
      args: { inquiry_id: input.inquiryId, service_code: state.facts.serviceCode },
      idempotencyKey: `estimate:${input.inquiryId}:${state.facts.serviceCode}`,
    });
  }

  for (const call of calls) {
    if (call.name === "book_appointment") continue;
    results.push(await input.exec(call));
  }

  const estimateResult = results.find((r) => r.name === "calculate_estimate" && r.ok);
  if (estimateResult) {
    state.facts.estimateExplained = true;
    state.facts.estimateJson = JSON.stringify(estimateResult.data ?? {});
  }
  const saveOk = results.find((r) => r.name === "save_customer_details");
  if (saveOk && !saveOk.ok) {
    /* keep collected facts even if the save tool reports an error */
  }
  const mail = results.find((r) => r.name === "send_continuation_link");
  if (mail?.ok) {
    state.facts.continuationSent = true;
    state.facts.continuationEmailId = String(mail.data?.email_id ?? "");
  }
  const follow = results.find((r) => r.name === "request_human_followup");
  if (follow?.ok) state.facts.followupRequested = true;
  const availability = results.find((r) => r.name === "check_availability");
  if (availability?.ok && Array.isArray(availability.data?.slots)) {
    state.facts.offeredSlots = availability.data.slots as Facts["offeredSlots"];
    state.facts.schedulingStarted = true;
  }

  let selectedStart: string | undefined;
  const slots = state.facts.offeredSlots ?? [];
  if (choice === "earliest_tomorrow_morning") {
    const wantsTomorrow = /tomorrow|mañana|manana/i.test(input.text);
    const today = zonedParts(new Date());
    const base = new Date(Date.UTC(today.y, today.mo - 1, today.d));
    base.setUTCDate(base.getUTCDate() + 1);
    const morning = slots.find((slot) => {
      const parts = zonedParts(new Date(slot.start));
      const isMorning = parts.hour < 12;
      const isTomorrow = parts.y === base.getUTCFullYear() && parts.mo === base.getUTCMonth() + 1 && parts.d === base.getUTCDate();
      return isMorning && (!wantsTomorrow || isTomorrow);
    });
    selectedStart = (morning ?? slots[0])?.start;
  } else if (typeof choice === "number") {
    selectedStart = slots[choice]?.start;
  } else {
    const time = input.text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
    if (time && slots.length) {
      const hour = Number(time[1]);
      const selected = slots.find((slot) => slot.labelEn.includes(`${hour}:`) || slot.labelEs.includes(`${hour}:`));
      selectedStart = selected?.start;
    }
  }

  if (bookingRequested && selectedStart && !state.facts.appointmentId && state.facts.serviceCode) {
    const bookCall: ToolCall = {
      name: "book_appointment",
      args: {
        inquiry_id: input.inquiryId,
        service_code: state.facts.serviceCode,
        starts_at: selectedStart,
        language: lang,
      },
      idempotencyKey: `book:${input.inquiryId}:${selectedStart}`,
    };
    calls.push(bookCall);
    const booked = await input.exec(bookCall);
    results.push(booked);
    if (booked.ok) state.facts.appointmentId = String(booked.data?.appointment_id ?? "");
  }

  if (isUrgent(input.text)) {
    const speech = prefixSwitch(
      resolved.event,
      lang,
      say(
        lang,
        "If there is gas, smoke, sparking, or another danger, contact emergency services. I will not promise a dispatch. I have asked Alex Rivera to follow up during business hours.",
        "Si hay gas, humo, chispas u otro peligro, contacte a los servicios de emergencia. No prometo un envío. Pedí que Alex Rivera haga seguimiento en horario laboral.",
      ),
    );
    return { state, ...speech, languageEvent: resolved.event, calls, results };
  }

  const booked = results.find((r) => r.name === "book_appointment");
  if (booked?.ok) {
    state.facts.bookingAnnounced = true;
    const when = String(booked.data?.spoken ?? "");
    const whenEn = String(booked.data?.spoken_en ?? when);
    const tech = String(booked.data?.technician_name ?? "");
    const note = String(booked.data?.technician_language_note ?? "");
    const noteEn = String(booked.data?.technician_language_note_en ?? note);
    const price = estimateSentence(state, "en");
    const priceEs = estimateSentence(state, "es");
    const confirmation = String(booked.data?.confirmation_status ?? "");
    const confirmEn =
      confirmation === "sent"
        ? " I emailed the confirmation."
        : confirmation === "simulated"
          ? " The confirmation is a simulated preview, not a delivered email."
          : confirmation === "failed"
            ? " The confirmation email was not sent."
            : "";
    const confirmEs =
      confirmation === "sent"
        ? " Envié la confirmación."
        : confirmation === "simulated"
          ? " La confirmación es una vista simulada, no un correo entregado."
          : confirmation === "failed"
            ? " El correo de confirmación no se envió."
            : "";
    const mailBit = mail
      ? mail.ok
        ? say(lang, " The continuation email is in the preview.", " El correo de continuación está en la vista previa.")
        : say(lang, " The continuation email was not sent.", " El correo de continuación no se envió.")
      : { say: "" };
    const speech = prefixSwitch(
      resolved.event,
      lang,
      say(
        lang,
        `${price} I checked again and booked ${whenEn} with ${tech}. ${noteEn} The appointment is confirmed.${confirmEn}${mailBit.say}`,
        `${priceEs} Volví a revisar y reservé ${when} con ${tech}. ${note} La cita quedó confirmada.${confirmEs}${lang === "es" ? mailBit.say : ""}`,
      ),
    );
    return { state, ...speech, languageEvent: resolved.event, calls, results };
  }
  if (booked && !booked.ok) {
    const speech = prefixSwitch(
      resolved.event,
      lang,
      say(
        lang,
        `That appointment is not confirmed. ${booked.error ?? "The calendar did not accept it."} I can request a follow-up from Alex Rivera.`,
        `Esa cita no está confirmada. ${booked.error ?? "El calendario no la aceptó."} Puedo pedir que Alex Rivera haga seguimiento.`,
      ),
    );
    return { state, ...speech, languageEvent: resolved.event, calls, results };
  }

  if (slots.length && bookingRequested && !selectedStart) {
    const speech = prefixSwitch(resolved.event, lang, offerSlots(state));
    return { state, ...speech, languageEvent: resolved.event, calls, results };
  }

  const parts: string[] = [];
  const partsEn: string[] = [];
  if (aside) {
    parts.push(aside);
    const enAside = faqAnswer(input.text, "en");
    if (enAside) partsEn.push(enAside);
  }
  if (state.facts.photoNote && /photo|foto/i.test(input.text)) {
    const photo = say(
      lang,
      "I see the photo note. A photo does not confirm the diagnosis or the final price.",
      "Anoté lo de la foto. Una foto no confirma el diagnóstico ni el precio final.",
    );
    parts.push(photo.say);
    if (photo.sayEn) partsEn.push(photo.sayEn);
  }
  if (mail) {
    if (mail.ok) {
      const line = say(
        lang,
        `I prepared the continuation link for ${state.facts.email}. You can open it later. This call can continue.`,
        `Preparé el enlace de continuación para ${state.facts.email}. Puede abrirlo después. Esta llamada puede seguir.`,
      );
      parts.push(line.say);
      if (line.sayEn) partsEn.push(line.sayEn);
    } else {
      const line = say(
        lang,
        `I could not send the email. ${mail.error ?? "It was not delivered."}`,
        `No pude enviar el correo. ${mail.error ?? "No quedó entregado."}`,
      );
      parts.push(line.say);
      if (line.sayEn) partsEn.push(line.sayEn);
    }
  }
  if (estimateResult && !booked) {
    const speechEn = String(estimateResult.data?.speech_en ?? "");
    const speechEs = String(estimateResult.data?.speech_es ?? speechEn);
    parts.push(lang === "es" ? speechEs : speechEn);
    partsEn.push(speechEn);
  }
  const nextQ = question(state);
  if (missing(state.facts) !== "next" || !mail) {
    parts.push(nextQ.say);
    if (nextQ.sayEn) partsEn.push(nextQ.sayEn);
    else if (lang === "en") partsEn.push(nextQ.say);
  } else {
    const followAsk = say(
      lang,
      "If you want a visit, tell me which time you prefer.",
      "Si quiere una visita, dígame qué horario prefiere.",
    );
    parts.push(followAsk.say);
    if (followAsk.sayEn) partsEn.push(followAsk.sayEn);
  }
  const body = lang === "es" ? { say: parts.join(" "), sayEn: partsEn.join(" ") } : { say: parts.join(" ") };
  const speech = prefixSwitch(resolved.event, lang, body);
  return { state, ...speech, languageEvent: resolved.event, calls, results };
}

function estimateSentence(state: DialogueState, lang: Lang): string {
  if (!state.facts.estimateJson) return "";
  try {
    const data = JSON.parse(state.facts.estimateJson) as { speech_en?: string; speech_es?: string };
    return (lang === "es" ? data.speech_es : data.speech_en) ?? "";
  } catch {
    return "";
  }
}

function offerSlots(state: DialogueState): { say: string; sayEn?: string } {
  const slots = (state.facts.offeredSlots ?? []).slice(0, 3);
  const en = slots.map((slot, i) => `${i + 1}. ${slot.labelEn}`).join(" ");
  const es = slots.map((slot, i) => `${i + 1}. ${slot.labelEs}`).join(" ");
  const service = serviceByCode(state.facts.serviceCode);
  const nameEn = service?.name.en ?? "the visit";
  const nameEs = service?.name.es ?? "la visita";
  return say(
    state.language,
    `For ${nameEn} at ${state.facts.address}, I can offer ${en}. Which do you want?`,
    `Para ${nameEs} en ${state.facts.address}, puedo ofrecer ${es}. ¿Cuál prefiere?`,
  );
}

export function stateFromFacts(language: Lang, lock: DialogueState["lock"], asked: boolean, facts: Facts): DialogueState {
  return { language, lock, languageAsked: asked, facts };
}
