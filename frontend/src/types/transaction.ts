/**
 * Tipos del dominio de transacciones/movimientos.
 * Reflejan el contrato de la API del backend.
 * No hay paquete compartido con el backend — el frontend define los suyos.
 *
 * Fase 1.2.3: se agregan `currency` y `exchangeRate` en create/edit.
 */

import type { Category } from "@/types/category";
import type { CurrencyCode } from "@/types/settings";

/** Tipo de movimiento */
export type TransactionType = "EXPENSE" | "INCOME";

/** Etiquetas legibles del tipo para mostrar en la UI */
export const TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
};

/**
 * Transacción tal como la devuelve el backend.
 * GET /transactions → data: Transaction[]
 * POST /transactions → data: Transaction
 * PATCH /transactions/:id → data: Transaction
 */
export interface Transaction {
  id: string;
  userId: string;
  categoryId: string;
  type: TransactionType;
  /** Monto en centavos enteros de la moneda original (sin decimales) */
  amountCents: number;
  description: string | null;
  /** Instante en UTC (ISO 8601) */
  occurredAt: string;
  /** Nombre de zona IANA (ej: "America/Argentina/Buenos_Aires") */
  timezone: string;
  /** Moneda original del movimiento (Fase 1.2.3). Default "ARS". */
  currency: CurrencyCode;
  /** Cotización ARS por 1 USD (Fase 1.2.3). 1 para movimientos en ARS. */
  exchangeRate: number;
  createdAt: string;
  updatedAt: string;
  /** Categoría embebida en la respuesta */
  category: Pick<Category, "id" | "name" | "color" | "scope">;
}

/** Body de POST /transactions */
export interface CreateTransactionRequest {
  type: TransactionType;
  /** Monto en centavos enteros > 0 */
  amountCents: number;
  categoryId: string;
  /** Instante en UTC ISO 8601 */
  occurredAt: string;
  /** Nombre de zona IANA */
  timezone: string;
  description?: string;
  /** Moneda del movimiento (Fase 1.2.3). Default ARS. */
  currency?: CurrencyCode;
  /** Cotización ARS por 1 USD (Fase 1.2.3). Requerido si currency !== defaultCurrency. */
  exchangeRate?: number;
}

/** Body de PATCH /transactions/:id — todos los campos opcionales */
export interface UpdateTransactionRequest {
  type?: TransactionType;
  amountCents?: number;
  categoryId?: string;
  occurredAt?: string;
  timezone?: string;
  description?: string | null;
  /** Moneda del movimiento (Fase 1.2.3). */
  currency?: CurrencyCode;
  /** Cotización ARS por 1 USD (Fase 1.2.3). */
  exchangeRate?: number;
}

