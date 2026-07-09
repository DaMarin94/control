/**
 * Tipos/constantes compartidos de la feature "Método de pago predeterminado por
 * estructura" (RF-PM-007; spec visual en docs/design.md, §"Predeterminado por
 * estructura — configuración en el modal + indicador de solo-lectura…").
 *
 * Compartido entre:
 * - default-payment-method-indicator.tsx (indicador de solo-lectura en la fila)
 * - payment-method-form-modal.tsx (sección "Predeterminado para", donde se edita)
 */

export type DefaultPaymentMethodSlot = "unico" | "fijo" | "cuota";

export interface DefaultPaymentMethodSlots {
  unico: string | null;
  fijo: string | null;
  cuota: string | null;
}

export const DEFAULT_PAYMENT_METHOD_SLOT_ORDER: DefaultPaymentMethodSlot[] = [
  "unico",
  "fijo",
  "cuota",
];

export const DEFAULT_PAYMENT_METHOD_SLOT_LABELS: Record<DefaultPaymentMethodSlot, string> = {
  unico: "Únicos",
  fijo: "Fijos",
  cuota: "Cuotas",
};

export const EMPTY_DEFAULT_PAYMENT_METHOD_SLOTS: DefaultPaymentMethodSlots = {
  unico: null,
  fijo: null,
  cuota: null,
};

/**
 * Formatea una lista de estructuras para el toast/anuncio de reasignación:
 * "Únicos" / "Únicos y Fijos" / "Únicos, Fijos y Cuotas" (join en español, "y"
 * antes del último ítem, docs/design.md §"Comunicación de la reasignación al
 * guardar").
 */
export function formatStructureList(labels: string[]): string {
  if (labels.length <= 1) return labels.join("");
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}
