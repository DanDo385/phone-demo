import { BUSINESS, DEMO_LABEL } from "./business";
import { formatMoney } from "./money";
import type { Lang } from "./types";

export type MailDraft = {
  subject: string;
  text: string;
  html: string;
  language: Lang;
};

function page(lang: Lang, title: string, body: string): string {
  return `<!doctype html><html lang="${lang}"><body style="font-family:Georgia,serif;color:#14221c;background:#f6f1e8;padding:24px"><div style="max-width:560px;margin:auto;background:#fffcf7;border:1px solid #e4ddd2;padding:24px"><p style="letter-spacing:.08em;text-transform:uppercase;font-size:12px;color:#0c6b66">${DEMO_LABEL[lang]}</p><h1 style="font-weight:500">${title}</h1>${body}</div></body></html>`;
}

export function continuationDraft(input: {
  lang: Lang;
  name?: string;
  issue?: string;
  link: string;
}): MailDraft {
  const who = input.name || (input.lang === "es" ? "hola" : "there");
  if (input.lang === "es") {
    const text = `${DEMO_LABEL.es}\n\n${who}, puede continuar la solicitud de Palmetto Coast Home Services cuando quiera.\n\nMotivo: ${input.issue ?? "visita"}\nEnlace: ${input.link}\n\nEl enlace caduca y se puede revocar. Una foto no confirma el diagnóstico ni el precio.`;
    return {
      language: "es",
      subject: "Continúe su solicitud con Palmetto Coast Home Services",
      text,
      html: page("es", "Continúe su solicitud", `<p>${who}, puede continuar cuando quiera.</p><p>Motivo: ${escapeHtml(input.issue ?? "visita")}</p><p><a href="${input.link}">Abrir la página segura</a></p><p>Una foto no confirma el diagnóstico ni el precio.</p>`),
    };
  }
  const text = `${DEMO_LABEL.en}\n\n${who}, you can continue your Palmetto Coast Home Services request whenever you are ready.\n\nRequest: ${input.issue ?? "visit"}\nLink: ${input.link}\n\nThe link expires and can be revoked. A photo does not confirm the diagnosis or the price.`;
  return {
    language: "en",
    subject: "Continue your Palmetto Coast Home Services request",
    text,
    html: page("en", "Continue your request", `<p>${escapeHtml(who)}, you can continue whenever you are ready.</p><p>Request: ${escapeHtml(input.issue ?? "visit")}</p><p><a href="${input.link}">Open the secure page</a></p><p>A photo does not confirm the diagnosis or the price.</p>`),
  };
}

export function confirmationDraft(input: { lang: Lang; when: string; address: string; link?: string }): MailDraft {
  if (input.lang === "es") {
    const text = `${DEMO_LABEL.es}\n\nSu visita quedó reservada para ${input.when}.\nDirección: ${input.address}\n${input.link ? `Detalles: ${input.link}\n` : ""}Horario del negocio: ${BUSINESS.hours.es}`;
    return {
      language: "es",
      subject: "Visita reservada — Palmetto Coast Home Services",
      text,
      html: page("es", "Visita reservada", `<p>Su visita quedó reservada para ${escapeHtml(input.when)}.</p><p>Dirección: ${escapeHtml(input.address)}</p>`),
    };
  }
  const text = `${DEMO_LABEL.en}\n\nYour visit is booked for ${input.when}.\nAddress: ${input.address}\n${input.link ? `Details: ${input.link}\n` : ""}Business hours: ${BUSINESS.hours.en}`;
  return {
    language: "en",
    subject: "Visit booked — Palmetto Coast Home Services",
    text,
    html: page("en", "Visit booked", `<p>Your visit is booked for ${escapeHtml(input.when)}.</p><p>Address: ${escapeHtml(input.address)}</p>`),
  };
}

export function invoiceDraft(input: { lang: Lang; number: string; totalCents: number; link?: string }): MailDraft {
  const total = formatMoney(input.totalCents);
  const banner = BUSINESS.invoiceBanner[input.lang];
  if (input.lang === "es") {
    return {
      language: "es",
      subject: `Factura de demostración ${input.number}`,
      text: `${banner}\n${DEMO_LABEL.es}\n\nFactura ${input.number}\nTotal ${total} USD\n${BUSINESS.demoTaxNote.es}\nNo se requiere pago.`,
      html: page("es", banner, `<p>Factura ${escapeHtml(input.number)}</p><p>Total ${total} USD</p><p>${BUSINESS.demoTaxNote.es}</p>`),
    };
  }
  return {
    language: "en",
    subject: `Demo invoice ${input.number}`,
    text: `${banner}\n${DEMO_LABEL.en}\n\nInvoice ${input.number}\nTotal ${total} USD\n${BUSINESS.demoTaxNote.en}\nNo payment is due.`,
    html: page("en", banner, `<p>Invoice ${escapeHtml(input.number)}</p><p>Total ${total} USD</p><p>${BUSINESS.demoTaxNote.en}</p>`),
  };
}

export function reviewDraft(input: { lang: Lang; links: Array<{ label: string; href: string }> }): MailDraft {
  const lines = input.links.map((link) => `${link.label}: ${link.href}`).join("\n");
  if (input.lang === "es") {
    return {
      language: "es",
      subject: "Si quiere, deje una reseña — Palmetto Coast",
      text: `${DEMO_LABEL.es}\n\nSi quiere dejar una reseña, puede escribirla usted en una de estas páginas de vista previa. No es necesario que sea positiva. No hay incentivo. Una visita al enlace no significa que la reseña se haya publicado.\n\n${lines}\n\nYa reseñé: ${input.links[0]?.href ?? ""}?done=1\nNo más recordatorios: ${input.links[0]?.href ?? ""}?optout=1`,
      html: page(
        "es",
        "Invitación a reseñar",
        `<p>Si quiere, escriba su propia reseña. No pedimos solo opiniones positivas y no hay incentivo.</p><ul>${input.links.map((l) => `<li><a href="${l.href}">${escapeHtml(l.label)}</a></li>`).join("")}</ul>`,
      ),
    };
  }
  return {
    language: "en",
    subject: "If you would like, leave a review — Palmetto Coast",
    text: `${DEMO_LABEL.en}\n\nIf you want to leave a review, you can write it yourself on one of these preview pages. It does not need to be positive. There is no incentive. Opening a link does not mean a review was submitted.\n\n${lines}\n\nAlready reviewed: ${input.links[0]?.href ?? ""}?done=1\nNo more reminders: ${input.links[0]?.href ?? ""}?optout=1`,
    html: page(
      "en",
      "Review invitation",
      `<p>If you want, write your own review. We do not ask only for positive reviews, and there is no incentive.</p><ul>${input.links.map((l) => `<li><a href="${l.href}">${escapeHtml(l.label)}</a></li>`).join("")}</ul>`,
    ),
  };
}

export function reminderDraft(input: { lang: Lang; link: string }): MailDraft {
  if (input.lang === "es") {
    return {
      language: "es",
      subject: "Un recordatorio sobre su reseña — Palmetto Coast",
      text: `${DEMO_LABEL.es}\n\nEste es el único recordatorio. Si ya reseñó o no quiere más mensajes, use el enlace.\n${input.link}`,
      html: page("es", "Recordatorio", `<p>Este es el único recordatorio.</p><p><a href="${input.link}">Abrir opciones</a></p>`),
    };
  }
  return {
    language: "en",
    subject: "One reminder about your review — Palmetto Coast",
    text: `${DEMO_LABEL.en}\n\nThis is the only reminder. If you already reviewed or want no more messages, use the link.\n${input.link}`,
    html: page("en", "Reminder", `<p>This is the only reminder.</p><p><a href="${input.link}">Open the options</a></p>`),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}
