/**
 * Allowlists en código para PaymentMethod (P4 — RN-021).
 *
 * `type` e `icon` NO son enums de Prisma: son strings validados contra una
 * allowlist en el código del backend, para poder sumar tipos/íconos futuros
 * sin migración (mismo criterio que `CurrencyQuote.variant`).
 */

/** Tipos de método de pago soportados (RF-PM-001, RN-021). Sin default: obligatorio al crear. */
export const PAYMENT_METHOD_TYPES = ['CREDIT', 'DEBIT', 'CASH'] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export function isValidPaymentMethodType(type: string): type is PaymentMethodType {
  return (PAYMENT_METHOD_TYPES as readonly string[]).includes(type);
}

/**
 * Set curado de íconos (v1, RF-PM-004). El cromo/diseño concreto vive en `docs/design.md`;
 * acá solo la allowlist de claves válidas.
 */
export const PAYMENT_METHOD_ICONS = [
  'card',
  'cash',
  'coins',
  'wallet',
  'bank',
  'dollar',
  'qr',
  'visa',
  'mastercard',
  'amex',
  'mercadopago',
  'paypal',
] as const;
export type PaymentMethodIcon = (typeof PAYMENT_METHOD_ICONS)[number];

/** Ícono default al crear y fallback para una marca ausente del set (RF-PM-004). */
export const DEFAULT_PAYMENT_METHOD_ICON: PaymentMethodIcon = 'card';

export function isValidPaymentMethodIcon(icon: string): icon is PaymentMethodIcon {
  return (PAYMENT_METHOD_ICONS as readonly string[]).includes(icon);
}

/**
 * Normaliza un ícono recibido: si no pertenece al set curado, cae al genérico
 * `card` (fallback silencioso — RF-PM-004, distinto del color de categorías,
 * que rechaza con 400 fuera de la matriz). Sin ícono → default `card`.
 */
export function normalizePaymentMethodIcon(icon: string | undefined | null): PaymentMethodIcon {
  if (icon && isValidPaymentMethodIcon(icon)) {
    return icon;
  }
  return DEFAULT_PAYMENT_METHOD_ICON;
}
