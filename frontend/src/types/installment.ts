/**
 * Tipos del dominio de movimientos en cuotas.
 * Reflejan el contrato de la API del backend (Fase 7 + Fase 1.2.3).
 *
 * InstallmentGroup es el grupo padre que define monto, cantidad y mes de inicio.
 * No hay paquete compartido con el backend — el frontend define los suyos.
 */

import type { CategoryScope } from "@/types/category";
import type { CurrencyCode } from "@/types/settings";
import type { EmbeddedPaymentMethod } from "@/types/payment-method";

/** Categoría embebida en la respuesta de un grupo de cuotas */
export interface InstallmentCategory {
  id: string;
  name: string;
  color: string;
  scope: CategoryScope;
}

/**
 * Grupo de cuotas tal como lo devuelve el backend.
 * POST /installments → data: InstallmentGroup (201)
 * PATCH /installments/:id → data: InstallmentGroup (200)
 *
 * El type es siempre "EXPENSE" en v1 (RF-MC-001 — cuotas solo Gasto).
 */
export interface InstallmentGroup {
  id: string;
  userId: string;
  categoryId: string;
  /** Siempre "EXPENSE" en v1 */
  type: "EXPENSE";
  /** Monto de cada cuota en centavos enteros de la moneda original (no el total de la compra) */
  amountCents: number;
  /** Cantidad total de cuotas (entero > 0) */
  totalInstallments: number;
  /** Mes de inicio del grupo en formato YYYY-MM */
  startMonth: string;
  description: string | null;
  /** Moneda del grupo de cuotas (Fase 1.2.3). Default "ARS". */
  currency: CurrencyCode;
  /** Cotización ARS por 1 USD (Fase 1.2.3). 1 para cuotas en ARS. */
  exchangeRate: number;
  createdAt: string;
  updatedAt: string;
  /** Categoría embebida en la respuesta */
  category: InstallmentCategory;
  /** Método de pago asociado (P4, RF-PM-006); null = sin método */
  paymentMethodId: string | null;
  /** Método de pago embebido en la respuesta; null si no tiene */
  paymentMethod: EmbeddedPaymentMethod | null;
  /**
   * Débito automático (P4 — corrección de alcance). Atributo del MOVIMIENTO,
   * no del método de pago. Solo true/false si paymentMethod es de tipo DEBIT;
   * null en cualquier otro caso.
   */
  autoDebit: boolean | null;
}

/**
 * Body de POST /installments.
 * type es siempre "EXPENSE" — el front no ofrece selector de tipo (RF-MC-001).
 */
export interface CreateInstallmentRequest {
  /** Siempre "EXPENSE" en v1 */
  type: "EXPENSE";
  /** Monto de cada cuota en centavos enteros > 0 */
  amountCents: number;
  /** Cantidad total de cuotas (entero > 0) */
  totalInstallments: number;
  /** Mes de inicio en formato YYYY-MM (default: mes actual del navegador) */
  startMonth: string;
  categoryId: string;
  description?: string;
  /** Moneda del movimiento (Fase 1.2.3). Default ARS. */
  currency?: CurrencyCode;
  /** Cotización ARS por 1 USD (Fase 1.2.3). Requerido si currency !== defaultCurrency. */
  exchangeRate?: number;
  /** Método de pago asociado (P4, RF-PM-006). Opcional; se omite si no hay método. */
  paymentMethodId?: string;
  /**
   * Débito automático (P4 — corrección de alcance). Atributo del MOVIMIENTO.
   * El backend lo ignora (queda null) si el método efectivo no es DEBIT.
   */
  autoDebit?: boolean;
}

/**
 * Body de PATCH /installments/:id.
 * type NO se envía (no es editable).
 * description: null para limpiar el campo; undefined = no cambiar.
 */
export interface UpdateInstallmentRequest {
  amountCents?: number;
  totalInstallments?: number;
  startMonth?: string;
  categoryId?: string;
  description?: string | null;
  /** Moneda del grupo de cuotas (Fase 1.2.4). Permite cambiar la moneda al editar. */
  currency?: CurrencyCode;
  /** Cotización ARS por 1 USD (Fase 1.2.3). */
  exchangeRate?: number;
  /** Método de pago asociado (P4, RF-PM-006). null limpia la asociación. */
  paymentMethodId?: string | null;
  /**
   * Débito automático (P4 — corrección de alcance). Atributo del MOVIMIENTO.
   * El backend lo ignora (queda null) si el método efectivo no es DEBIT.
   */
  autoDebit?: boolean;
}

/**
 * Body de POST /installments/:id/skip (toggle anular/des-anular una cuota para un mes puntual — P3).
 */
export interface SkipInstallmentRequest {
  /** Mes a anular/des-anular en formato YYYY-MM */
  month: string;
}

/**
 * Respuesta de POST /installments/:id/skip.
 * data del sobre estándar { success, statusCode, data }.
 */
export interface SkipInstallmentResponse {
  skipped: boolean;
  month: string;
}
