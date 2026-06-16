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
import type { RecurringFrequency } from "@/types/recurring";

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
 * Para "unico": todos los campos están presentes; installment=null; frequency=null; skipped=false.
 * Para "fijo": occurredAt y timezone son null; installment=null; frequency=su frecuencia; skipped según el mes.
 * Para "cuota": occurredAt y timezone son null; installment tiene number/total/startMonth; frequency=null; skipped=false.
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
  /**
   * Frecuencia de recurrencia (P2 — Fase 1.1.1).
   * Presente solo para origin==="fijo" (su frecuencia: MONTHLY, BIMONTHLY, etc.).
   * null para "unico" y "cuota".
   */
  frequency: RecurringFrequency | null;
  /**
   * Indica si el fijo está anulado para el mes consultado (P1 — Fase 1.1.1).
   * Solo puede ser true para origin==="fijo".
   * Siempre false para "unico" y "cuota".
   * Los ítems anulados se siguen mostrando en la lista pero NO suman a los totales.
   */
  skipped: boolean;
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
