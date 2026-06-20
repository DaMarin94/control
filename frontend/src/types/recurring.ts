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

/**
 * Frecuencia de recurrencia de un movimiento fijo (P2 — Fase 1.1.1).
 * Set cerrado: sin frecuencias libres ni custom.
 * Back-compat: los fijos existentes son MONTHLY.
 */
export type RecurringFrequency =
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "BIANNUAL"
  | "ANNUAL";

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
  type: TransactionType;
  /** Monto en centavos enteros de la moneda original (sin decimales) */
  amountCents: number;
  description: string | null;
  /** Mes de inicio en formato YYYY-MM */
  startMonth: string;
  /** Mes desde el que está eliminado (YYYY-MM), null si está activo */
  deletedFrom: string | null;
  /**
   * Frecuencia de recurrencia (P2 — Fase 1.1.1).
   * Default MONTHLY para los fijos existentes (back-compat).
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
   * Frecuencia de recurrencia (P2 — Fase 1.1.1).
   * Opcional; default MONTHLY en el backend si se omite.
   */
  frequency?: RecurringFrequency;
  description?: string;
  /** Moneda del movimiento (Fase 1.2.3). Default ARS. */
  currency?: CurrencyCode;
  /** Cotización ARS por 1 USD (Fase 1.2.3). Requerido si currency !== defaultCurrency. */
  exchangeRate?: number;
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
  /** Cotización ARS por 1 USD para el mes actual (Fase 1.2.3). */
  exchangeRate?: number;
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
