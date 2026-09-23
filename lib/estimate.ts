import { SERVICES, serviceByCode } from "./business";
import { formatMoney } from "./money";
import type { Bilingual, ServiceKind } from "./types";

export type EstimateLine = {
  code: string;
  amountCents: number;
  description: Bilingual;
};

export type Estimate = {
  serviceCode: string;
  kind: ServiceKind;
  lines: EstimateLine[];
  totalCents: number | null;
  currency: "USD";
  firm: boolean;
  speech: Bilingual;
  assumptions: Bilingual;
  exclusions: Bilingual;
};

export function calculateEstimate(serviceCode: string): Estimate | { error: string } {
  const service = serviceByCode(serviceCode);
  if (!service) return { error: `Unknown service ${serviceCode}` };
  if (service.kind === "inspection_required" || service.amountCents == null) {
    return {
      serviceCode,
      kind: "inspection_required",
      lines: [],
      totalCents: null,
      currency: "USD",
      firm: false,
      assumptions: service.assumptions,
      exclusions: service.exclusions,
      speech: {
        en: `${service.name.en} needs an inspection before a firm quote. I will not invent a price.`,
        es: `${service.name.es} necesita una inspección antes de una cotización firme. No voy a inventar un precio.`,
      },
    };
  }
  if (service.code === "VALVE_SHUTOFF") {
    const diag = SERVICES.find((s) => s.code === "DIAG")!;
    const lines: EstimateLine[] = [
      { code: "DIAG", amountCents: diag.amountCents!, description: diag.name },
      { code: "VALVE_SHUTOFF", amountCents: service.amountCents, description: service.name },
      {
        code: "DIAG_CREDIT",
        amountCents: -diag.amountCents!,
        description: {
          en: "Diagnostic fee credited toward the approved repair",
          es: "Tarifa de diagnóstico acreditada a la reparación aprobada",
        },
      },
    ];
    const total = lines.reduce((sum, line) => sum + line.amountCents, 0);
    return {
      serviceCode,
      kind: "conditional_fixed",
      lines,
      totalCents: total,
      currency: "USD",
      firm: false,
      assumptions: service.assumptions,
      exclusions: service.exclusions,
      speech: {
        en: `A diagnostic visit is ${formatMoney(diag.amountCents!)}. If the technician confirms the shutoff valve is accessible under the sink, the replacement is ${formatMoney(service.amountCents)}, and the diagnostic fee is credited. The demo subtotal would be ${formatMoney(total)}. The technician confirms the scope on site. I cannot promise a diagnosis from a description or a photo.`,
        es: `La visita de diagnóstico es ${formatMoney(diag.amountCents!)}. Si el técnico confirma que la válvula de cierre es accesible bajo el fregadero, el reemplazo es ${formatMoney(service.amountCents)} y la tarifa de diagnóstico se acredita. El subtotal de demostración sería ${formatMoney(total)}. El técnico confirma el alcance en el lugar. No puedo prometer un diagnóstico con una descripción o una foto.`,
      },
    };
  }
  return {
    serviceCode,
    kind: service.kind,
    lines: [{ code: service.code, amountCents: service.amountCents, description: service.name }],
    totalCents: service.amountCents,
    currency: "USD",
    firm: service.kind === "fixed",
    assumptions: service.assumptions,
    exclusions: service.exclusions,
    speech: {
      en: `${service.name.en} is ${formatMoney(service.amountCents)}. ${service.assumptions.en} ${service.exclusions.en}`,
      es: `${service.name.es} es ${formatMoney(service.amountCents)}. ${service.assumptions.es} ${service.exclusions.es}`,
    },
  };
}

export function invoiceLinesForApproved(serviceCode: string): EstimateLine[] {
  const estimate = calculateEstimate(serviceCode);
  if ("error" in estimate || estimate.totalCents == null) {
    const diag = calculateEstimate("DIAG");
    if ("error" in diag || !diag.lines.length) return [];
    return diag.lines;
  }
  return estimate.lines;
}
