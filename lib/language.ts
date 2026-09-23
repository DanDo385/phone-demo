import type { Lang, LanguageMode } from "./types";

const EXPLICIT_ES = [
  /espa[nñ]ol,?\s+por\s+favor/i,
  /en\s+espa[nñ]ol/i,
  /hablemos\s+en\s+espa[nñ]ol/i,
  /prefiero\s+(hablar\s+)?(en\s+)?espa[nñ]ol/i,
  /puedo\s+hablar\s+en\s+espa[nñ]ol/i,
  /cambiar\s+a(l)?\s+espa[nñ]ol/i,
  /continue\s+in\s+spanish/i,
  /switch\s+to\s+spanish/i,
  /can\s+we\s+speak\s+spanish/i,
];

const EXPLICIT_EN = [
  /can\s+we\s+continue\s+in\s+english/i,
  /continue\s+in\s+english/i,
  /switch\s+to\s+english/i,
  /in\s+english,?\s+please/i,
  /speak\s+english/i,
  /en\s+ingl[eé]s,?\s+por\s+favor/i,
  /continuemos\s+en\s+ingl[eé]s/i,
  /prefiero\s+(hablar\s+)?(en\s+)?ingl[eé]s/i,
  /cambiar\s+a(l)?\s+ingl[eé]s/i,
];

const UNSUPPORTED: Array<{ id: string; re: RegExp }> = [
  { id: "fr", re: /fran[cç]ais|en\s+french|speak\s+french|parler\s+fran/i },
  { id: "pt", re: /portugu[eê]s|portuguese|em\s+portugu/i },
  { id: "zh", re: /中文|mandarin|cantonese|speak\s+chinese|chino/i },
  { id: "ht", re: /krey[oò]l|haitian\s+creole|creole/i },
  { id: "vi", re: /ti[eế]ng\s+vi[eệ]t|vietnamese/i },
  { id: "de", re: /\bdeutsch\b|\bgerman\b/i },
  { id: "it", re: /\bitaliano\b|in\s+italian/i },
  { id: "ar", re: /arabic|\barab[eé]\b/i },
  { id: "ru", re: /\brussian\b|по-русски/i },
  { id: "ko", re: /\bkorean\b|한국어/i },
];

const HIGH_SIGNAL_ES = [
  "hola",
  "gracias",
  "fregadero",
  "fuga",
  "válvula",
  "valvula",
  "español",
  "espanol",
  "prefiero",
  "mañana",
  "manana",
  "cita",
  "correo",
  "dirección",
  "direccion",
  "hablar",
  "pueden",
  "tengo",
  "cocina",
  "debajo",
  "quisiera",
  "buenos",
  "días",
  "dias",
  "tardes",
  "llame",
  "ayuda",
  "gotea",
  "goteando",
];

export type LanguageRead = {
  explicit?: Lang;
  unsupported?: string;
  confident?: Lang;
  uncertain: boolean;
};

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9áéíóúñ]+/i)
    .filter(Boolean);
}

export function readLanguage(text: string): LanguageRead {
  const trimmed = text.trim();
  if (!trimmed) return { uncertain: false };
  for (const re of EXPLICIT_ES) if (re.test(trimmed)) return { explicit: "es", uncertain: false };
  for (const re of EXPLICIT_EN) if (re.test(trimmed)) return { explicit: "en", uncertain: false };
  for (const item of UNSUPPORTED) {
    if (item.re.test(trimmed)) return { unsupported: item.id, uncertain: false };
  }
  const tokens = words(trimmed);
  let hits = 0;
  const normalizedSignals = HIGH_SIGNAL_ES.map((w) => w.normalize("NFD").replace(/\p{M}/gu, ""));
  for (const token of tokens) {
    if (normalizedSignals.includes(token)) hits += 1;
  }
  const accent = /[áéíóúñ¿¡]/i.test(trimmed);
  if (hits >= 2 || (hits >= 1 && accent && tokens.length >= 4)) {
    return { confident: "es", uncertain: false };
  }
  if (hits === 1 && tokens.length <= 3) return { uncertain: true };
  return { uncertain: false };
}

export function resolveLanguage(input: {
  text: string;
  current: Lang;
  mode: LanguageMode;
  lock: "explicit" | "detected" | null;
  languageAsked: boolean;
}): {
  language: Lang;
  lock: "explicit" | "detected" | null;
  languageAsked: boolean;
  event?: { from: Lang; to: Lang; reason: string };
  unsupported?: string;
  ask: boolean;
} {
  const read = readLanguage(input.text);
  if (read.unsupported && !read.explicit) {
    return {
      language: input.current,
      lock: input.lock,
      languageAsked: input.languageAsked,
      unsupported: read.unsupported,
      ask: false,
    };
  }
  if (read.explicit && read.explicit !== input.current) {
    return {
      language: read.explicit,
      lock: "explicit",
      languageAsked: true,
      event: { from: input.current, to: read.explicit, reason: "Caller asked to switch languages" },
      ask: false,
    };
  }
  if (read.explicit) {
    return {
      language: input.current,
      lock: "explicit",
      languageAsked: true,
      ask: false,
    };
  }
  if (input.mode !== "auto" || input.lock) {
    return { language: input.current, lock: input.lock, languageAsked: input.languageAsked, ask: false };
  }
  if (read.confident && read.confident !== input.current) {
    return {
      language: read.confident,
      lock: "detected",
      languageAsked: input.languageAsked,
      event: { from: input.current, to: read.confident, reason: "Detected the caller's language" },
      ask: false,
    };
  }
  if (read.uncertain && !input.languageAsked) {
    return {
      language: input.current,
      lock: input.lock,
      languageAsked: true,
      ask: true,
    };
  }
  return { language: input.current, lock: input.lock, languageAsked: input.languageAsked, ask: false };
}

const PROTECTED = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\$\d+(?:\.\d{2})?|\+?\d[\d\s().-]{6,}\d|\b\d{1,5}\s+[A-Za-z0-9.'\-\s]+)/gi;

/** Translations may only come from an authored pair. Protected tokens must survive unchanged. */
export function translationKeepsFacts(original: string, translated: string, facts: string[]): boolean {
  for (const fact of facts) {
    if (!fact) continue;
    if (original.includes(fact) && !translated.includes(fact)) return false;
  }
  const money = original.match(/\$\d+(?:\.\d{2})?/g) ?? [];
  for (const m of money) if (!translated.includes(m)) return false;
  return true;
}

export function protectedTokens(text: string): string[] {
  return text.match(PROTECTED) ?? [];
}
