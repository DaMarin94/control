/**
 * Tipos del dominio de movimientos — endpoint unificado GET /movements.
 * Reflejan el contrato de la API del backend (Fase 5–7).
 *
 * MovementItem es el ítem individual que puede ser "unico", "fijo" o "cuota".
 * - "unico": occurredAt/timezone presentes; installment=null.
 * - "fijo":  occurredAt/timezone=null; installment=null.
 * - "cuota": occurredAt/timezone=null; installment presente con number/total/startMonth.
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
 * Datos de cuota embebidos en MovementItem cuando origin === "cuota".
 * number: número de cuota dentro del grupo (ej: 3).
 * total: cantidad total de cuotas del grupo (ej: 12).
 * startMonth: mes de inicio del grupo en formato YYYY-MM.
 */
export interface InstallmentInfo {
  number: number;
  total: number;
  startMonth: string;
}

/**
 * Ítem individual de movimiento tal como lo devuelve GET /movements.
 * Para "unico": todos los campos están presentes; installment=null.
 * Para "fijo": occurredAt y timezone son null; installment=null.
 * Para "cuota": occurredAt y timezone son null; installment tiene number/total/startMonth.
 */
export interface MovementItem {
  id: string;
  origin: MovementOrigin;
  type: MovementType;
  amountCents: number;
  description: string | null;
  /**
   * Instante en UTC (ISO 8601) para únicos.
   * null para fijos y cuotas (no tienen instante específico).
   */
  occurredAt: string | null;
  /**
   * Nombre de zona IANA (ej: "America/Argentina/Buenos_Aires") para únicos.
   * null para fijos y cuotas.
   */
  timezone: string | null;
  /**
   * Datos de cuota (number, total, startMonth).
   * Presente para origin==="cuota"; null para "unico" y "fijo".
   */
  installment: InstallmentInfo | null;
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
  /** Poblado desde Fase 7 — las cuotas que caen en el mes */
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
