import type { Bilingual, ServiceKind } from "./types";

export const DEMO_LABEL: Bilingual = {
  en: "Fictional demonstration. Palmetto Coast Home Services is not a real contractor.",
  es: "Demostración ficticia. Palmetto Coast Home Services no es un contratista real.",
};

export const BUSINESS = {
  id: "palmetto-coast",
  name: "Palmetto Coast Home Services",
  timezone: "America/New_York",
  serviceArea: ["Port St. Lucie", "Tradition", "St. Lucie West"],
  zips: ["34952", "34953", "34984", "34986", "34987"],
  hours: {
    en: "Monday–Friday, 8:00 a.m.–6:00 p.m. Saturday, 9:00 a.m.–1:00 p.m. Eastern Time. Closed Sunday.",
    es: "Lunes a viernes, 8:00 a.m.–6:00 p.m. Sábado, 9:00 a.m.–1:00 p.m., hora del Este. Domingo cerrado.",
  },
  afterHours: {
    en: "After hours we collect the details and ask Alex Rivera to follow up during business hours. We do not promise emergency dispatch.",
    es: "Fuera de horario anotamos los datos y pedimos que Alex Rivera haga seguimiento en horario laboral. No prometemos envío de emergencia.",
  },
  aiLanguages: ["en", "es"] as const,
  bufferMinutes: 30,
  sendingHoursMatchBusiness: true,
  reviewReminderHours: 48,
  demoTaxRate: 0,
  demoTaxNote: {
    en: "Demo tax rate: 0%. This is a demonstration setting, not a tax determination.",
    es: "Tasa de impuesto de demostración: 0%. Es un ajuste de demostración, no un cálculo fiscal.",
  },
  invoiceBanner: {
    en: "DEMO: NO PAYMENT DUE",
    es: "DEMOSTRACIÓN: NO SE REQUIERE PAGO",
  },
  recordingDefault: false,
};

export type Technician = {
  id: string;
  name: string;
  trade: "plumbing" | "hvac" | "electrical";
  languages: Array<"en" | "es">;
};

export const TECHNICIANS: Technician[] = [
  { id: "morgan", name: "Morgan Chen", trade: "plumbing", languages: ["en"] },
  { id: "sam", name: "Sam Brooks", trade: "hvac", languages: ["en"] },
  { id: "taylor", name: "Taylor Reed", trade: "electrical", languages: ["en"] },
];

export const OWNER = {
  name: "Alex Rivera",
  role: "Owner",
  languages: ["en", "es"] as const,
};

export type ServiceDef = {
  code: string;
  kind: ServiceKind;
  trade: Technician["trade"];
  durationMinutes: number;
  amountCents: number | null;
  creditDiagnostic: boolean;
  name: Bilingual;
  summary: Bilingual;
  assumptions: Bilingual;
  exclusions: Bilingual;
};

export const SERVICES: ServiceDef[] = [
  {
    code: "DIAG",
    kind: "diagnostic",
    trade: "plumbing",
    durationMinutes: 90,
    amountCents: 8900,
    creditDiagnostic: false,
    name: { en: "Diagnostic visit", es: "Visita de diagnóstico" },
    summary: {
      en: "A technician visits, inspects the reported issue, and explains the options.",
      es: "Un técnico visita, revisa el problema indicado y explica las opciones.",
    },
    assumptions: {
      en: "One accessible residential issue at the service address. The diagnostic fee is $89.",
      es: "Un problema residencial accesible en la dirección de servicio. La tarifa de diagnóstico es $89.00.",
    },
    exclusions: {
      en: "The visit fee does not include repairs, permits, or opening walls.",
      es: "La tarifa de la visita no incluye reparaciones, permisos ni abrir paredes.",
    },
  },
  {
    code: "VALVE_SHUTOFF",
    kind: "conditional_fixed",
    trade: "plumbing",
    durationMinutes: 90,
    amountCents: 22500,
    creditDiagnostic: true,
    name: {
      en: "Accessible under-sink shutoff-valve replacement",
      es: "Reemplazo de la válvula de cierre accesible bajo el fregadero",
    },
    summary: {
      en: "Replacement of an accessible under-sink shutoff valve, subject to technician confirmation.",
      es: "Reemplazo de una válvula de cierre accesible bajo el fregadero, sujeto a confirmación del técnico.",
    },
    assumptions: {
      en: "The valve is accessible under the sink, it is a standard residential shutoff, and the technician confirms that scope on site. Illustrated demo price: $225. The $89 diagnostic fee is credited toward that approved repair.",
      es: "La válvula es accesible bajo el fregadero, es un cierre residencial estándar y el técnico confirma ese alcance en el lugar. Precio ilustrado de demostración: $225.00. La tarifa de diagnóstico de $89.00 se acredita a esa reparación aprobada.",
    },
    exclusions: {
      en: "Concealed piping, opening a wall or cabinet rebuild, permits, code upgrades, and nonstandard parts are outside this price.",
      es: "Tubería oculta, abrir una pared, reconstruir el gabinete, permisos, actualizaciones de código y piezas no estándar quedan fuera de este precio.",
    },
  },
  {
    code: "FAUCET",
    kind: "diagnostic",
    trade: "plumbing",
    durationMinutes: 90,
    amountCents: 8900,
    creditDiagnostic: true,
    name: { en: "Faucet diagnostic", es: "Diagnóstico de grifo" },
    summary: {
      en: "Diagnose a dripping or loose faucet. Repair price is confirmed after inspection.",
      es: "Diagnosticar un grifo que gotea o está flojo. El precio de la reparación se confirma después de la inspección.",
    },
    assumptions: {
      en: "Diagnostic visit $89, credited toward an approved qualifying repair.",
      es: "Visita de diagnóstico $89.00, acreditada a una reparación calificada aprobada.",
    },
    exclusions: {
      en: "A firm faucet repair price is not given before the technician sees it.",
      es: "No se da un precio fijo de reparación del grifo antes de que el técnico lo vea.",
    },
  },
  {
    code: "WATER_HEATER_DIAG",
    kind: "diagnostic",
    trade: "plumbing",
    durationMinutes: 90,
    amountCents: 8900,
    creditDiagnostic: true,
    name: { en: "Water heater diagnostic", es: "Diagnóstico del calentador de agua" },
    summary: {
      en: "Inspect a water heater that is leaking, noisy, or not heating.",
      es: "Revisar un calentador de agua que gotea, hace ruido o no calienta.",
    },
    assumptions: {
      en: "Diagnostic visit $89. Replacement or repair requires technician confirmation.",
      es: "Visita de diagnóstico $89.00. El reemplazo o la reparación requieren confirmación del técnico.",
    },
    exclusions: {
      en: "No replacement price is quoted from a description alone.",
      es: "No se cotiza un reemplazo solo con una descripción.",
    },
  },
  {
    code: "DRAIN_ACCESS",
    kind: "diagnostic",
    trade: "plumbing",
    durationMinutes: 90,
    amountCents: 8900,
    creditDiagnostic: true,
    name: { en: "Accessible drain diagnostic", es: "Diagnóstico de desagüe accesible" },
    summary: {
      en: "Assess a slow or clogged drain that can be reached without opening a wall.",
      es: "Evaluar un desagüe lento u obstruido al que se puede llegar sin abrir una pared.",
    },
    assumptions: {
      en: "Diagnostic visit $89. Clearing price depends on what the technician finds.",
      es: "Visita de diagnóstico $89.00. El precio de la limpieza depende de lo que encuentre el técnico.",
    },
    exclusions: {
      en: "Sewer camera, excavation, and wall opening are not included.",
      es: "Cámara de alcantarillado, excavación y apertura de pared no están incluidas.",
    },
  },
  {
    code: "HVAC_MAINT",
    kind: "fixed",
    trade: "hvac",
    durationMinutes: 60,
    amountCents: 12900,
    creditDiagnostic: false,
    name: { en: "HVAC maintenance visit", es: "Visita de mantenimiento de HVAC" },
    summary: {
      en: "Scheduled maintenance for an accessible residential air conditioner or heat pump.",
      es: "Mantenimiento programado de un aire acondicionado o bomba de calor residencial accesible.",
    },
    assumptions: {
      en: "Illustrated demo price: $129 for one accessible system. Filters on hand are replaced only if supplied or a standard size is available.",
      es: "Precio ilustrado de demostración: $129.00 por un sistema accesible. Los filtros se cambian solo si están a mano o hay una medida estándar.",
    },
    exclusions: {
      en: "Repairs, refrigerant, and duct modifications are not part of the maintenance price.",
      es: "Reparaciones, refrigerante y cambios de conductos no forman parte del precio de mantenimiento.",
    },
  },
  {
    code: "HVAC_DIAG",
    kind: "diagnostic",
    trade: "hvac",
    durationMinutes: 90,
    amountCents: 8900,
    creditDiagnostic: true,
    name: { en: "HVAC diagnostic", es: "Diagnóstico de HVAC" },
    summary: {
      en: "Diagnose no cooling, no heating, or an HVAC system that will not start.",
      es: "Diagnosticar falta de enfriamiento, falta de calefacción o un sistema que no enciende.",
    },
    assumptions: {
      en: "Diagnostic visit $89, credited toward an approved qualifying repair.",
      es: "Visita de diagnóstico $89.00, acreditada a una reparación calificada aprobada.",
    },
    exclusions: {
      en: "A firm repair price requires inspection. Refrigerant handling is not priced sight unseen.",
      es: "Un precio fijo de reparación requiere inspección. El refrigerante no se cotiza sin ver el equipo.",
    },
  },
  {
    code: "ELEC_DIAG",
    kind: "diagnostic",
    trade: "electrical",
    durationMinutes: 90,
    amountCents: 8900,
    creditDiagnostic: true,
    name: { en: "Electrical diagnostic", es: "Diagnóstico eléctrico" },
    summary: {
      en: "Diagnose an outlet, switch, or breaker issue that is not an active emergency.",
      es: "Diagnosticar un problema de tomacorriente, interruptor o breaker que no sea una emergencia activa.",
    },
    assumptions: {
      en: "Diagnostic visit $89. Repair scope is confirmed on site.",
      es: "Visita de diagnóstico $89.00. El alcance de la reparación se confirma en el lugar.",
    },
    exclusions: {
      en: "Panel replacement, new circuits, and permitted work are not included in the diagnostic fee.",
      es: "El cambio de panel, circuitos nuevos y el trabajo con permiso no están incluidos en la tarifa de diagnóstico.",
    },
  },
  {
    code: "PANEL_INSPECT",
    kind: "inspection_required",
    trade: "electrical",
    durationMinutes: 90,
    amountCents: null,
    creditDiagnostic: false,
    name: { en: "Electrical panel inspection", es: "Inspección del panel eléctrico" },
    summary: {
      en: "Inspection required before any firm quote for panel work.",
      es: "Se requiere inspección antes de cualquier cotización firme de trabajo en el panel.",
    },
    assumptions: {
      en: "The visit confirms condition and options. No firm panel price is given in advance.",
      es: "La visita confirma la condición y las opciones. No se da un precio firme del panel por adelantado.",
    },
    exclusions: {
      en: "Replacement, permits, and utility coordination are quoted only after inspection.",
      es: "El reemplazo, los permisos y la coordinación con la utility se cotizan solo después de la inspección.",
    },
  },
  {
    code: "EV_INSPECT",
    kind: "inspection_required",
    trade: "electrical",
    durationMinutes: 90,
    amountCents: null,
    creditDiagnostic: false,
    name: { en: "EV charger inspection", es: "Inspección para cargador de vehículo eléctrico" },
    summary: {
      en: "Inspection required before a firm quote for an EV charger.",
      es: "Se requiere inspección antes de una cotización firme para un cargador de vehículo eléctrico.",
    },
    assumptions: {
      en: "Panel capacity, route, and permit needs are confirmed on site.",
      es: "La capacidad del panel, la ruta y los permisos se confirman en el lugar.",
    },
    exclusions: {
      en: "Equipment and installation are not priced before inspection.",
      es: "El equipo y la instalación no se cotizan antes de la inspección.",
    },
  },
  {
    code: "CONSTRUCTION_INSPECT",
    kind: "inspection_required",
    trade: "electrical",
    durationMinutes: 90,
    amountCents: null,
    creditDiagnostic: false,
    name: { en: "Construction work inspection", es: "Inspección de trabajo de construcción" },
    summary: {
      en: "Remodel or construction coordination starts with an inspection, not a firm quote.",
      es: "La coordinación de remodelación o construcción empieza con una inspección, no con una cotización firme.",
    },
    assumptions: {
      en: "The visit defines scope. Pricing follows the inspection.",
      es: "La visita define el alcance. El precio viene después de la inspección.",
    },
    exclusions: {
      en: "Materials, permits, and subcontractor work are not priced in advance.",
      es: "Materiales, permisos y trabajo de subcontratistas no se cotizan por adelantado.",
    },
  },
];

export type Faq = { id: string; q: Bilingual; a: Bilingual };

export const FAQS: Faq[] = [
  {
    id: "area",
    q: { en: "Where do you work?", es: "¿En qué zona trabajan?" },
    a: {
      en: "Port St. Lucie, Tradition, and St. Lucie West, Florida.",
      es: "Port St. Lucie, Tradition y St. Lucie West, Florida.",
    },
  },
  {
    id: "hours",
    q: { en: "What are your hours?", es: "¿Cuál es el horario?" },
    a: { en: BUSINESS.hours.en, es: BUSINESS.hours.es },
  },
  {
    id: "after-hours",
    q: { en: "Do you offer after-hours emergency dispatch?", es: "¿Hay servicio de emergencia fuera de horario?" },
    a: { en: BUSINESS.afterHours.en, es: BUSINESS.afterHours.es },
  },
  {
    id: "diagnostic",
    q: { en: "What does a diagnostic visit cost?", es: "¿Cuánto cuesta la visita de diagnóstico?" },
    a: {
      en: "The illustrated demo price for a diagnostic visit is $89.00.",
      es: "El precio ilustrado de demostración de la visita de diagnóstico es $89.00.",
    },
  },
  {
    id: "valve",
    q: { en: "How much is an under-sink shutoff valve?", es: "¿Cuánto cuesta la válvula de cierre bajo el fregadero?" },
    a: {
      en: "If the technician confirms the valve is an accessible under-sink shutoff, the illustrated demo price is $225.00. That is not a promise from a photo.",
      es: "Si el técnico confirma que es una válvula de cierre accesible bajo el fregadero, el precio ilustrado de demostración es $225.00. Una foto no lo garantiza.",
    },
  },
  {
    id: "credit",
    q: { en: "Is the diagnostic fee credited?", es: "¿Se acredita la tarifa de diagnóstico?" },
    a: {
      en: "Yes. On an approved qualifying repair, the $89.00 diagnostic fee is credited. For the valve example the demo subtotal is $225.00.",
      es: "Sí. En una reparación calificada aprobada, la tarifa de diagnóstico de $89.00 se acredita. En el ejemplo de la válvula el subtotal de demostración es $225.00.",
    },
  },
  {
    id: "hvac",
    q: { en: "What does HVAC maintenance cost?", es: "¿Cuánto cuesta el mantenimiento de HVAC?" },
    a: {
      en: "The illustrated demo price for an HVAC maintenance visit is $129.00.",
      es: "El precio ilustrado de demostración de la visita de mantenimiento de HVAC es $129.00.",
    },
  },
  {
    id: "inspection",
    q: { en: "Can you quote a panel, EV charger, or construction job now?", es: "¿Pueden cotizar ahora un panel, un cargador o una obra?" },
    a: {
      en: "No. Electrical panel, EV charger, and construction work require an inspection before a firm quote.",
      es: "No. El panel eléctrico, el cargador de vehículo y la obra requieren inspección antes de una cotización firme.",
    },
  },
  {
    id: "languages",
    q: { en: "Do the technicians speak Spanish?", es: "¿Los técnicos hablan español?" },
    a: {
      en: "The AI receptionist speaks English and Spanish. Morgan Chen, Sam Brooks, and Taylor Reed conduct visits in English. Office follow-up can continue in Spanish.",
      es: "La recepcionista de IA habla inglés y español. Morgan Chen, Sam Brooks y Taylor Reed hacen las visitas en inglés. El seguimiento de la oficina puede continuar en español.",
    },
  },
  {
    id: "cancel",
    q: { en: "How do cancellations work?", es: "¿Cómo funcionan las cancelaciones?" },
    a: {
      en: "Please tell us as soon as you need to cancel or move a visit. This demo does not charge a cancellation fee.",
      es: "Avísenos en cuanto necesite cancelar o mover la visita. Esta demostración no cobra tarifa de cancelación.",
    },
  },
  {
    id: "pets",
    q: { en: "What should we do with pets?", es: "¿Qué hacemos con las mascotas?" },
    a: {
      en: "Please secure pets away from the work area and the door before the technician arrives.",
      es: "Asegure a las mascotas lejos del área de trabajo y de la puerta antes de que llegue el técnico.",
    },
  },
  {
    id: "parking",
    q: { en: "Where can the technician park?", es: "¿Dónde puede estacionar el técnico?" },
    a: {
      en: "A regular driveway or legal street space near the service address is enough. Tell us about gates, codes, or tight parking.",
      es: "Basta un estacionamiento normal o un espacio legal en la calle cerca de la dirección. Indique portones, códigos o estacionamiento limitado.",
    },
  },
  {
    id: "access",
    q: { en: "Does someone need to be home?", es: "¿Alguien debe estar en casa?" },
    a: {
      en: "An adult needs to be there to give access to the work area, unless you have arranged another access plan with the office.",
      es: "Un adulto debe estar para dar acceso al área de trabajo, salvo que haya acordado otro plan con la oficina.",
    },
  },
  {
    id: "prep",
    q: { en: "How should we prepare?", es: "¿Cómo debemos prepararnos?" },
    a: {
      en: "Clear the cabinet under the sink or the area around the equipment. We do not need you to take anything apart.",
      es: "Despeje el gabinete bajo el fregadero o el área alrededor del equipo. No necesita desarmar nada.",
    },
  },
  {
    id: "photos",
    q: { en: "Can a photo confirm the price?", es: "¿Una foto confirma el precio?" },
    a: {
      en: "A photo can help the technician prepare. It does not confirm a diagnosis or a final price.",
      es: "Una foto puede ayudar al técnico a prepararse. No confirma un diagnóstico ni un precio final.",
    },
  },
  {
    id: "payment",
    q: { en: "How do I pay this demo invoice?", es: "¿Cómo pago esta factura de demostración?" },
    a: {
      en: "You do not. Demo invoices say DEMO: NO PAYMENT DUE. This demo does not collect payment.",
      es: "No paga. Las facturas de demostración dicen DEMOSTRACIÓN: NO SE REQUIERE PAGO. Esta demostración no cobra.",
    },
  },
  {
    id: "danger",
    q: { en: "What if there is gas, smoke, or sparking?", es: "¿Qué hago si hay gas, humo o chispas?" },
    a: {
      en: "Leave the area and contact emergency services. We will not give repair steps, and we will not promise a dispatch.",
      es: "Aléjese y contacte a los servicios de emergencia. No damos pasos de reparación ni prometemos un envío.",
    },
  },
];

export const POLICIES = {
  serviceArea: {
    en: "Service is limited to Port St. Lucie, Tradition, and St. Lucie West, Florida. Addresses outside that area are not booked. The office can still follow up.",
    es: "El servicio se limita a Port St. Lucie, Tradition y St. Lucie West, Florida. No se reservan direcciones fuera de esa zona. La oficina sí puede hacer seguimiento.",
  },
  scheduling: {
    en: "Visits are booked only inside published hours, with the duration of the service and a 30-minute buffer. The time is confirmed in Eastern Time only after the calendar accepts it.",
    es: "Las visitas se reservan solo dentro del horario publicado, con la duración del servicio y un margen de 30 minutos. La hora se confirma en hora del Este solo después de que el calendario la acepte.",
  },
  cancellation: FAQS.find((f) => f.id === "cancel")!.a,
  access: FAQS.find((f) => f.id === "access")!.a,
  pets: FAQS.find((f) => f.id === "pets")!.a,
  parking: FAQS.find((f) => f.id === "parking")!.a,
  preparation: FAQS.find((f) => f.id === "prep")!.a,
};

export const GREETING: Bilingual = {
  en: "Thanks for calling Palmetto Coast Home Services. I’m the AI assistant, and this call is transcribed. You can speak English or Spanish. Puede hablar en español.",
  es: "Gracias por llamar a Palmetto Coast Home Services. Soy el asistente de inteligencia artificial y esta llamada se transcribe. Puedo ayudarle en español.",
};

export const VOICES = [
  {
    id: "avery",
    name: "Avery",
    note: { en: "Warm, steady, recommended for both languages", es: "Cálida y clara, recomendada para ambos idiomas" },
    preview: {
      en: "Thanks for calling Palmetto Coast Home Services. How can I help?",
      es: "Gracias por llamar a Palmetto Coast Home Services. ¿Cómo puedo ayudarle?",
    },
  },
  {
    id: "jordan",
    name: "Jordan",
    note: { en: "Clear and direct", es: "Clara y directa" },
    preview: {
      en: "I can take the details and check a visit time.",
      es: "Puedo anotar los datos y revisar un horario de visita.",
    },
  },
  {
    id: "riley",
    name: "Riley",
    note: { en: "Brighter pace", es: "Ritmo más vivo" },
    preview: {
      en: "Tell me what is going on at the house.",
      es: "Cuénteme qué está pasando en la casa.",
    },
  },
] as const;

export function serviceByCode(code: string | undefined): ServiceDef | undefined {
  return SERVICES.find((s) => s.code === code);
}

export function technicianForTrade(trade: Technician["trade"]): Technician {
  return TECHNICIANS.find((t) => t.trade === trade) ?? TECHNICIANS[0];
}

export function technicianById(id: string): Technician | undefined {
  return TECHNICIANS.find((t) => t.id === id);
}

const AREA_PATTERNS = [
  /port\s+st\.?\s+lucie/i,
  /port\s+saint\s+lucie/i,
  /st\.?\s+lucie\s+west/i,
  /saint\s+lucie\s+west/i,
  /\btradition\b/i,
  /\b34952\b/,
  /\b34953\b/,
  /\b34984\b/,
  /\b34986\b/,
  /\b34987\b/,
];

export function addressInServiceArea(address: string): boolean {
  return AREA_PATTERNS.some((p) => p.test(address));
}

export function detectServiceCode(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/ev charger|cargador|veh[ií]culo el[eé]ctric/.test(t)) return "EV_INSPECT";
  if (/panel/.test(t)) return "PANEL_INSPECT";
  if (/remodel|construction|construcci[oó]n|obra/.test(t)) return "CONSTRUCTION_INSPECT";
  if (/maintenance|tune[- ]?up|mantenimiento/.test(t) && /hvac|a\/?c|air|aire|heat pump|bomba/.test(t)) return "HVAC_MAINT";
  if (/no (cooling|heat)|not cooling|not heating|no enfria|no enfr[ií]a|no calienta|aire acondicionado/.test(t)) return "HVAC_DIAG";
  if (/water heater|calentador/.test(t)) return "WATER_HEATER_DIAG";
  if (/drain|desag[uü]e|clog/.test(t)) return "DRAIN_ACCESS";
  if (/faucet|grifo/.test(t)) return "FAUCET";
  if (/shut[- ]?off|shutoff|v[aá]lvula|valve|under the sink|debajo del fregadero|bajo el fregadero|fuga/.test(t)) return "VALVE_SHUTOFF";
  if (/outlet|breaker|electric|el[eé]ctric/.test(t)) return "ELEC_DIAG";
  if (/leak|drip|gote|plumb/.test(t)) return "DIAG";
  return undefined;
}
