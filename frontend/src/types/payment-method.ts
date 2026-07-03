/**
 * Tipos del dominio de métodos de pago.
 * Reflejan el contrato de la API del backend (/payment-methods).
 * Espejo de types/category.ts. No hay paquete compartido con el backend —
 * el frontend define los suyos.
 *
 * Feature P4 (RF-PM-001..006, RN-021).
 */

// ─── Tipo de método de pago ───────────────────────────────────────────────────

/** Allowlist en código, espejo de PAYMENT_METHOD_TYPES del backend. */
export type PaymentMethodType = "CREDIT" | "DEBIT" | "CASH";

/** Etiquetas legibles del tipo para mostrar en la UI */
export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  CREDIT: "Crédito",
  DEBIT: "Débito",
  CASH: "Efectivo",
};

/** Opciones de tipo para el selector del modal (sin default — obligatorio, sin preselección) */
export const PAYMENT_METHOD_TYPE_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: "CREDIT", label: "Crédito" },
  { value: "DEBIT", label: "Débito" },
  { value: "CASH", label: "Efectivo" },
];

// ─── Allowlist de íconos (RF-PM-004) ──────────────────────────────────────────
// Espejo de PAYMENT_METHOD_ICONS del backend (backend/src/payment-methods/payment-method-constants.ts).
// Genéricos → lucide-react; marcas → simple-icons. El mapeo a glifos concretos
// vive en components/ui/payment-method-icon.tsx (único lugar).

export type PaymentMethodIconKey =
  | "card"
  | "cash"
  | "coins"
  | "wallet"
  | "bank"
  | "dollar"
  | "qr"
  | "visa"
  | "mastercard"
  | "amex"
  | "mercadopago"
  | "paypal";

/** Genéricos (lucide) — orden de render del icon-picker (docs/design.md) */
export const PAYMENT_METHOD_GENERIC_ICONS: readonly PaymentMethodIconKey[] = [
  "card",
  "cash",
  "coins",
  "wallet",
  "bank",
  "dollar",
  "qr",
];

/** Marcas (simple-icons) — orden de render del icon-picker, después de los genéricos */
export const PAYMENT_METHOD_BRAND_ICONS: readonly PaymentMethodIconKey[] = [
  "visa",
  "mastercard",
  "amex",
  "mercadopago",
  "paypal",
];

/** Set completo v1 (12 claves), orden canónico del icon-picker */
export const PAYMENT_METHOD_ICON_KEYS: readonly PaymentMethodIconKey[] = [
  ...PAYMENT_METHOD_GENERIC_ICONS,
  ...PAYMENT_METHOD_BRAND_ICONS,
];

/** Ícono default al crear y fallback de una marca ausente del set (RF-PM-004) */
export const DEFAULT_PAYMENT_METHOD_ICON: PaymentMethodIconKey = "card";

export function isValidPaymentMethodIcon(icon: string): icon is PaymentMethodIconKey {
  return (PAYMENT_METHOD_ICON_KEYS as readonly string[]).includes(icon);
}

/** Normaliza un ícono recibido del backend: fallback a "card" si no pertenece al set curado. */
export function normalizePaymentMethodIcon(icon: string): PaymentMethodIconKey {
  return isValidPaymentMethodIcon(icon) ? icon : DEFAULT_PAYMENT_METHOD_ICON;
}

// ─── PaymentMethod ─────────────────────────────────────────────────────────────

/**
 * Método de pago tal como lo devuelve el backend.
 * GET /payment-methods → data: PaymentMethod[]
 * POST /payment-methods → data: PaymentMethod
 * PATCH /payment-methods/:id → data: PaymentMethod
 * POST /payment-methods/:id/reactivate → data: PaymentMethod
 */
export interface PaymentMethod {
  id: string;
  userId: string;
  name: string;
  type: PaymentMethodType;
  /** Clave del set curado (allowlist en código); "card" default/fallback */
  icon: string;
  /** Día del mes 1-31; solo CREDIT (null en DEBIT/CASH) */
  closingDay: number | null;
  /** Día del mes 1-31; solo CREDIT (null en DEBIT/CASH) */
  paymentDay: number | null;
  /** Las respuestas solo traen activos (siempre null) */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  movementCount: number;
}

/** Método de pago embebido en un movimiento (Transaction/Recurring/InstallmentGroup/MovementItem) */
export interface EmbeddedPaymentMethod {
  id: string;
  name: string;
  icon: string;
  type: PaymentMethodType;
}

/** Body de POST /payment-methods */
export interface CreatePaymentMethodRequest {
  name: string;
  type: PaymentMethodType;
  icon?: string;
  closingDay?: number;
  paymentDay?: number;
}

/** Body de PATCH /payment-methods/:id — todos los campos opcionales */
export interface UpdatePaymentMethodRequest {
  name?: string;
  type?: PaymentMethodType;
  icon?: string;
  closingDay?: number;
  paymentDay?: number;
}

// ─── Reactivación (409) ────────────────────────────────────────────────────────

/**
 * Datos del método de pago reactivable que vienen en error.data del 409.
 * Solo presente cuando error.data.reactivable === true.
 */
export interface ReactivablePaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  icon: string;
}

/** Shape de error.data cuando hay una colisión con un método de pago eliminado (reactivable) */
export interface ReactivablePaymentMethodErrorData {
  reactivable: true;
  paymentMethod: ReactivablePaymentMethod;
}

/** Type guard para verificar si error.data es de tipo ReactivablePaymentMethodErrorData */
export function isReactivablePaymentMethodError(
  data: unknown,
): data is ReactivablePaymentMethodErrorData {
  return (
    typeof data === "object" &&
    data !== null &&
    "reactivable" in data &&
    (data as ReactivablePaymentMethodErrorData).reactivable === true &&
    "paymentMethod" in data &&
    typeof (data as ReactivablePaymentMethodErrorData).paymentMethod === "object"
  );
}
