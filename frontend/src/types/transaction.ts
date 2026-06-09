/**
 * Tipos del dominio de transacciones/movimientos.
 * Reflejan el contrato de la API del backend (/transactions).
 * No hay paquete compartido con el backend — el frontend define los suyos.
 */

import type { Category } from "@/types/category";

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
  /** Monto en centavos enteros (sin decimales) */
  amountCents: number;
  description: string | null;
  /** Instante en UTC (ISO 8601) */
  occurredAt: string;
  /** Nombre de zona IANA (ej: "America/Argentina/Buenos_Aires") */
  timezone: string;
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
}

/** Body de PATCH /transactions/:id — todos los campos opcionales */
export interface UpdateTransactionRequest {
  type?: TransactionType;
  amountCents?: number;
  categoryId?: string;
  occurredAt?: string;
  timezone?: string;
  description?: string | null;
}

/** Parámetros para GET /transactions */
export interface GetTransactionsParams {
  /** Formato YYYY-MM */
  month: string;
  /** Nombre de zona IANA */
  timezone: string;
}
