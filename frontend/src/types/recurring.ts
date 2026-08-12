/**
 * Tipos del dominio de movimientos fijos.
 * Reflejan el contrato de la API del backend (Fase 6 + Fase 1.1.1 + Fase 1.2.3).
 *
 * Recurring es la plantilla recurrente (POST/PATCH /recurring).
 * No hay paquete compartido con el backend — el frontend define los suyos.
 */

import type { TransactionType } from "@/types/transaction";
import type { CategoryScope } from "@/types/category";
import type { CurrencyCode } from "@/types/settings";
import type { EmbeddedPaymentMethod } from "@/types/payment-method";

/**
 * Frecuencia de recurrencia de un movimiento fijo (P2 — Fase 1.1.1; P1/P4 —
 * pasa de enum string a entero).
 * Entero 1..12 = cantidad de meses del período (la instancia cae cuando
 * `monthDiff(startMonth, mes) % N === 0`). Set cerrado 1..12, sin valores libres.
 * Back-compat: los fijos existentes son 1 (mensual).
 */
export type RecurringFrequency = number;

/** Categoría embebida en la respuesta de un fijo */
export interface RecurringCategory {
  id: string;
  name: string;
  color: string;
  scope: CategoryScope;
}

/**
 * Movimiento fijo tal como lo devuelve el backend.
 * POST /recurring → data: Recurring (201)
 * PATCH /recurring/:id → data: Recurring (200) — puede ser un id nuevo si hubo split
 */
export interface Recurring {
  id: string;
  userId: string;
  categoryId: string;
  /**
   * Identidad estable de la cadena del fijo lógico — la comparten todas las
   * filas a través de los splits de edición (docs/data-model.md §"Recurring —
   * campos de cadena y calculado"). Presente en TODO Recurring (fijo normal o
   * calculado). Es la clave de agrupación de toasts/historial por movimiento
   * (RN-024) — NUNCA usar `id` para esto, cambia en cada split.
   */
  chainId: string;
  type: TransactionType;
  /** Monto en centavos enteros de la moneda original (sin decimales) */
  amountCents: number;
  description: string | null;
  /** Mes de inicio en formato YYYY-MM */
  startMonth: string;
  /** Mes desde el que está eliminado (YYYY-MM), null si está activo */
  deletedFrom: string | null;
  /**
   * Frecuencia de recurrencia (P2 — Fase 1.1.1; P1/P4 — entero 1..12).
   * Default 1 (mensual) para los fijos existentes (back-compat).
   */
  frequency: RecurringFrequency;
  /** Moneda original del fijo (Fase 1.2.3). Default "ARS". */
  currency: CurrencyCode;
  /** Cotización ARS por 1 USD del fijo (Fase 1.2.3). 1 para fijos en ARS. */
  exchangeRate: number;
  createdAt: string;
  updatedAt: string;
  /** Categoría embebida en la respuesta */
  category: RecurringCategory;
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

/** Body de POST /recurring */
export interface CreateRecurringRequest {
  type: TransactionType;
  /** Monto en centavos enteros > 0 */
  amountCents: number;
  categoryId: string;
  /** Mes de inicio en formato YYYY-MM — debe ser el mes actual del navegador */
  startMonth: string;
  /**
   * Frecuencia de recurrencia (P2 — Fase 1.1.1; P1/P4 — entero 1..12).
   * Opcional; default 1 (mensual) en el backend si se omite. Inmutable tras crear.
   */
  frequency?: RecurringFrequency;
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
 * Body de PATCH /recurring/:id.
 * currentMonth es REQUERIDO (para la lógica de split del backend).
 * type, startMonth y frequency NO son editables, no se envían.
 */
export interface UpdateRecurringRequest {
  /** Mes actual del navegador en formato YYYY-MM (requerido por el backend) */
  currentMonth: string;
  amountCents?: number;
  categoryId?: string;
  description?: string | null;
  /** Moneda del fijo (Fase 1.2.4). Permite cambiar la moneda al editar. */
  currency?: CurrencyCode;
  /** Cotización ARS por 1 USD para el mes actual (Fase 1.2.3). */
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
 * Body de POST /recurring/:id/skip (toggle anular/des-anular un fijo para un mes puntual).
 * P1 — Fase 1.1.1.
 */
export interface SkipRecurringRequest {
  /** Mes a anular/des-anular en formato YYYY-MM */
  month: string;
}

/**
 * Respuesta del endpoint POST /recurring/:id/skip.
 * data del sobre estándar { success, statusCode, data }.
 */
export interface SkipRecurringResponse {
  skipped: boolean;
  month: string;
}

/**
 * Body de POST /recurring/:id/skip, alcance RANGO (RF-MF-005, modal de
 * alcance de la anulación). Excluyente con `SkipRecurringRequest` (month) —
 * el controller del backend rechaza mezclar los dos shapes. Operación
 * EXPLÍCITA (no toggle): el sentido lo declara `action`, no el estado actual.
 */
export interface SkipRecurringRangeRequest {
  /** Mes desde, formato YYYY-MM, inclusive */
  from: string;
  /** Mes hasta, formato YYYY-MM, inclusive */
  to: string;
  action: "skip" | "unskip";
}

/**
 * Respuesta de POST /recurring/:id/skip, alcance RANGO.
 * `affectedCount` = cantidad de apariciones REALES del fijo (según su
 * frecuencia) dentro de [from, to] — el número que informa el modal.
 */
export interface SkipRecurringRangeResponse {
  action: "skip" | "unskip";
  from: string;
  to: string;
  affectedCount: number;
}
