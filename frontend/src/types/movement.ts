/**
 * Tipos del dominio de movimientos — endpoint unificado GET /movements.
 * Reflejan el contrato de la API del backend (Fase 5).
 *
 * MovementItem es el ítem individual que puede ser "unico", "fijo" o "cuota".
 * Hoy solo "unico" tiene datos; "fijo" y "cuota" están preparados para Fases 6/7.
 *
 * MonthMovements es la respuesta completa de GET /movements?month=YYYY-MM.
 */

import type { CategoryScope } from "@/types/category";

/** Discriminador de origen del movimiento */
export type MovementOrigin = "unico" | "fijo" | "cuota";

/** Tipo de movimiento */
export type MovementType = "EXPENSE" | "INCOME";

/** Categoría embebida en cada MovementItem */
export interface MovementCategory {
  id: string;
  name: string;
  color: string;
  scope: CategoryScope;
}

/**
 * Ítem individual de movimiento tal como lo devuelve GET /movements.
 * Para "unico": todos los campos están presentes.
 * Para "fijo": occurredAt y timezone son null (no tienen instante específico).
 * Para "cuota" (Fase 7): occurredAt y timezone pueden diferir.
 */
export interface MovementItem {
  id: string;
  origin: MovementOrigin;
  type: MovementType;
  amountCents: number;
  description: string | null;
  /**
   * Instante en UTC (ISO 8601) para únicos.
   * null para fijos (no tienen día específico dentro del mes).
   */
  occurredAt: string | null;
  /**
   * Nombre de zona IANA (ej: "America/Argentina/Buenos_Aires") para únicos.
   * null para fijos.
   */
  timezone: string | null;
  category: MovementCategory;
}

/** Totales del mes */
export interface MonthTotals {
  expenseCents: number;
  incomeCents: number;
  /** Puede ser negativo */
  balanceCents: number;
}

/** Movimientos agrupados por origen */
export interface MovementsByOrigin {
  unicos: MovementItem[];
  /** Poblado desde Fase 6 — los fijos activos en el mes */
  fijos: MovementItem[];
  /** Vacío hasta Fase 7 */
  cuotas: MovementItem[];
}

/**
 * Respuesta completa de GET /movements?month=YYYY-MM.
 * data de la respuesta del backend.
 */
export interface MonthMovements {
  month: string;
  totals: MonthTotals;
  movements: MovementsByOrigin;
}
