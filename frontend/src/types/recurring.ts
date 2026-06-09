/**
 * Tipos del dominio de movimientos fijos.
 * Reflejan el contrato de la API del backend (Fase 6).
 *
 * Recurring es la plantilla recurrente (POST/PATCH /recurring).
 * No hay paquete compartido con el backend — el frontend define los suyos.
 */

import type { TransactionType } from "@/types/transaction";
import type { CategoryScope } from "@/types/category";

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
  /** Monto en centavos enteros (sin decimales) */
  amountCents: number;
  description: string | null;
  /** Mes de inicio en formato YYYY-MM */
  startMonth: string;
  /** Mes desde el que está eliminado (YYYY-MM), null si está activo */
  deletedFrom: string | null;
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
  description?: string;
}

/**
 * Body de PATCH /recurring/:id.
 * currentMonth es REQUERIDO (para la lógica de split del backend).
 * type y startMonth NO son editables, no se envían.
 */
export interface UpdateRecurringRequest {
  /** Mes actual del navegador en formato YYYY-MM (requerido por el backend) */
  currentMonth: string;
  amountCents?: number;
  categoryId?: string;
  description?: string | null;
}
